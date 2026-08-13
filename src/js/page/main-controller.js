import { idbKeyval as storage } from '../utils/storage.js';
import Svgo from './svgo.js';
import { domReady } from './utils.js';
import Output from './ui/output.js';
import DownloadButton from './ui/download-button.js';
import CopyButton from './ui/copy-button.js';
import BgFillButton from './ui/bg-fill-button.js';
import Results from './ui/results.js';
import Settings from './ui/settings.js';
import ToolbarActions from './ui/toolbar-actions.js';
import Toasts from './ui/toasts.js';
import FileDrop from './ui/file-drop.js';
import Preloader from './ui/preloader.js';
import ResultsContainer from './ui/results-container.js';
import ViewToggler from './ui/view-toggler.js';
import ResultsCache from './results-cache.js';
import MainUi from './ui/main-ui.js';
import { migrateSettings } from './migrate-settings.js';

const svgo = new Svgo();

export default class MainController {
  _mainUi = null;

  constructor() {
    // ui components
    this._outputUi = new Output();
    this._downloadButtonUi = new DownloadButton();
    this._copyButtonUi = new CopyButton();
    this._resultsUi = new Results();
    this._settingsUi = new Settings();
    this._actionsUi = new ToolbarActions();
    this._toastsUi = new Toasts();

    const bgFillUi = new BgFillButton();
    const dropUi = new FileDrop();
    const preloaderUi = new Preloader();
    // _resultsContainerUi is unused
    this._resultsContainerUi = new ResultsContainer(this._resultsUi);
    const viewTogglerUi = new ViewToggler();

    // ui events
    this._settingsUi.emitter.on('change', () => this._onSettingsChange());
    this._settingsUi.emitter.on('reset', (oldSettings) =>
      this._onSettingsReset(oldSettings),
    );
    this._actionsUi.emitter.on('svgDataLoad', (event) =>
      this._onInputChange(event),
    );
    dropUi.emitter.on('svgDataLoad', (event) => this._onInputChange(event));
    this._actionsUi.emitter.on('error', ({ error }) =>
      this._handleError(error),
    );
    dropUi.emitter.on('error', ({ error }) => this._handleError(error));
    viewTogglerUi.emitter.on('change', (event) =>
      this._outputUi.set(event.value),
    );
    this._copyButtonUi.emitter.on('copy', ({ success }) =>
      this._toastsUi.show(success ? 'Copy successful' : 'Copy failed', {
        duration: 2000,
      }),
    );
    window.addEventListener('keydown', (event) => this._onGlobalKeyDown(event));
    window.addEventListener('paste', (event) => this._onGlobalPaste(event));
    window.addEventListener('copy', (event) => this._onGlobalCopy(event));

    // state
    this._inputItem = null;
    this._cache = new ResultsCache(10);
    this._latestCompressJobId = 0;
    this._userHasInteracted = false;
    this._reloading = false;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('sw.js', { scope: './' })
        .then((registration) => {
          registration.addEventListener('updatefound', () =>
            this._onUpdateFound(registration),
          );
        })
        // Offline support is a bonus — losing it isn't worth interrupting the
        // user over, but it shouldn't be an unhandled rejection either.
        .catch((error) => {
          console.warn('Service worker registration failed', error);
        });
    }

    domReady.then(async () => {
      const container = document.querySelector('.app-output');
      const actionContainer = container.querySelector(
        '.action-button-container',
      );
      const minorActionContainer = container.querySelector(
        '.minor-action-container',
      );
      const outputElement = container.querySelector('.output');

      // The rest of the shell paints settled; the output is the only thing that
      // waits for a file, so it's the only thing that animates in.
      this._mainUi = new MainUi(this._outputUi.container);

      minorActionContainer.append(
        bgFillUi.container,
        this._copyButtonUi.container,
      );
      actionContainer.append(this._downloadButtonUi.container);
      outputElement.append(this._outputUi.container);
      container.append(this._toastsUi.container, dropUi.container);

      // Awaited, because `setSettings()` assigns input values without firing
      // events: nothing recompresses afterwards, so a demo compressed before
      // the restore lands would disagree with the panel showing it.
      await this._loadSettings();

      // someone managed to hit the preloader, aww
      if (preloaderUi.activated) {
        this._toastsUi.show('Ready now!', { duration: 3000 });
      }

      // Open with something to look at rather than an empty app. Skipped if the
      // user got there first — a drop or Ctrl+O during the settings restore.
      if (!this._userHasInteracted) {
        await this._actionsUi.loadDemo({ auto: true });
      }

      // Whether or not that worked: there's no drawer left to hide an
      // unactivated shell behind, so the output has to settle either way.
      this._mainUi.activate();
    });
  }

  _onGlobalKeyDown(event) {
    if (event.key === 'o' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this._actionsUi.showFilePicker();
    }

    if (event.key === 'Escape') this._actionsUi.resetPasteInput();
  }

  _onGlobalPaste(event) {
    const value = event.clipboardData.getData('text');
    if (value.includes('</svg>')) {
      this._actionsUi.setPasteInput(value);
      event.preventDefault();
    } else {
      this._toastsUi.show('Pasted value not an SVG', { duration: 2000 });
    }
  }

  _onGlobalCopy(event) {
    // Selection APIs don't reflect selections inside form controls — Chrome
    // reports `isCollapsed` as true while a textarea is fully selected — so the
    // focused element is the only reliable signal that the copy is the user's.
    const { activeElement } = document;
    if (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (!window.getSelection().isCollapsed) return;

    const { text } = this._copyButtonUi;

    if (!text) {
      // Leave the copy alone rather than cancelling it with nothing to offer.
      this._toastsUi.show('Nothing to copy', { duration: 2000 });
      return;
    }

    event.clipboardData.setData('text/plain', text);
    event.preventDefault();
    this._toastsUi.show('Copy successful', { duration: 2000 });
  }

  _onUpdateFound(registration) {
    const newWorker = registration.installing;

    registration.installing.addEventListener('statechange', async () => {
      if (this._reloading) return;

      // the very first activation!
      // tell the user stuff works offline
      if (
        newWorker.state === 'activated' &&
        !navigator.serviceWorker.controller
      ) {
        this._toastsUi.show('Ready to work offline', { duration: 5000 });
        return;
      }

      if (
        newWorker.state === 'activated' &&
        navigator.serviceWorker.controller
      ) {
        // if the user hasn't interacted yet, do a sneaky reload
        if (!this._userHasInteracted) {
          this._reloading = true;
          location.reload();
          return;
        }

        // otherwise, show the user an alert. No "dismiss": by the time this
        // runs the new worker has already `skipWaiting()`d and deleted this
        // build's static cache, so staying put means running this page's code
        // against the new build's lazily created workers. Reloading is the only
        // outcome the app can honour, so it's the only one offered.
        const toast = this._toastsUi.show('Update available', {
          buttons: ['reload'],
        });
        const answer = await toast.answer;

        if (answer === 'reload') {
          this._reloading = true;
          location.reload();
        }
      }
    });
  }

  _onSettingsChange() {
    const settings = this._settingsUi.getSettings();
    this._saveSettings(settings);
    this._compressSvg(settings);
  }

  async _onSettingsReset(oldSettings) {
    const toast = this._toastsUi.show('Settings reset', {
      buttons: ['undo', 'dismiss'],
      duration: 5000,
    });
    const answer = await toast.answer;

    if (answer === 'undo') {
      this._settingsUi.setSettings(oldSettings);
      this._onSettingsChange();
    }
  }

  async _onInputChange({ data, filename, auto = false }) {
    // The demo fetch is a real gap, so a user-driven load that landed while it
    // was in flight wins.
    if (auto && this._userHasInteracted) return;

    const settings = this._settingsUi.getSettings();
    // An automatic load isn't interaction: `_onUpdateFound` reads this flag to
    // choose between a silent reload and an "Update available" toast, and every
    // visitor would otherwise get the toast.
    if (!auto) this._userHasInteracted = true;
    const previousInput = this._inputItem;

    try {
      this._inputItem = await svgo.wrapOriginal(data);
      this._inputFilename = filename;
    } catch (error) {
      this._actionsUi.stopSpinner();

      // Nobody asked for the automatic demo, so nobody should be told it failed.
      if (auto) {
        console.warn('Demo SVG failed to load', error);
        return;
      }

      this._handleError(new Error(`Load failed: ${error.message}`));
      return;
    }

    // Only once the replacement exists, so a failed load doesn't revoke the
    // blob URL of the file still on screen.
    previousInput?.release();
    this._cache.purge();

    this._compressSvg(settings);
    this._outputUi.reset();
    this._mainUi.activate();
    this._actionsUi.stopSpinner();
  }

  _handleError(error) {
    this._toastsUi.show(error.message, { isError: true });
    console.error(error);
  }

  async _loadSettings() {
    // IndexedDB can be unavailable or blocked; falling back to the defaults
    // already rendered in the markup is a fine outcome.
    try {
      const settings = await storage.get('settings');
      if (settings) this._settingsUi.setSettings(migrateSettings(settings));
    } catch (error) {
      console.warn('Could not restore saved settings', error);
    }
  }

  _saveSettings(settings) {
    // doesn't make sense to retain the "show original" option
    const { original, ...settingsToKeep } = settings;
    storage.set('settings', settingsToKeep).catch((error) => {
      console.warn('Could not save settings', error);
    });
  }

  async _compressSvg(settings) {
    // The settings panel is interactive before the first SVG has finished
    // loading (fetch, then worker startup), so this is reachable with nothing
    // to compress. Before the abort, so a premature change doesn't cancel a
    // running job for nothing.
    if (!this._inputItem) return;

    const thisJobId = (this._latestCompressJobId = Math.random());

    await svgo.abort();

    if (thisJobId !== this._latestCompressJobId) {
      // while we've been waiting, there's been a newer call
      // to _compressSvg, we don't need to do anything
      return;
    }

    if (settings.original) {
      this._updateForFile(this._inputItem, {
        compress: settings.gzip,
      });
      return;
    }

    const cacheMatch = this._cache.match(settings.fingerprint);

    if (cacheMatch) {
      this._updateForFile(cacheMatch, {
        compareToFile: this._inputItem,
        compress: settings.gzip,
      });
      return;
    }

    this._downloadButtonUi.working();

    try {
      const resultFile = await svgo.process(this._inputItem.text, settings);

      this._updateForFile(resultFile, {
        compareToFile: this._inputItem,
        compress: settings.gzip,
      });

      this._cache.add(settings.fingerprint, resultFile);
    } catch (error) {
      if (error.name === 'AbortError') return;
      error.message = `Minifying error: ${error.message}`;
      this._handleError(error);
    } finally {
      this._downloadButtonUi.done();
    }
  }

  async _updateForFile(svgFile, { compareToFile, compress }) {
    this._outputUi.update(svgFile);
    this._downloadButtonUi.setDownload(this._inputFilename, svgFile);
    this._copyButtonUi.setCopyText(svgFile.text);

    this._resultsUi.update({
      comparisonSize: compareToFile && (await compareToFile.size({ compress })),
      size: await svgFile.size({ compress }),
    });
  }
}

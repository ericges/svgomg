import { idbKeyval as storage } from '../utils/storage.js';
import Svgo from './svgo.js';
import { domReady } from './utils.js';
import Output from './ui/output.js';
import DownloadButton from './ui/download-button.js';
import CopyButton from './ui/copy-button.js';
import PngButton from './ui/png-button.js';
import BgFillButton from './ui/bg-fill-button.js';
import Results from './ui/results.js';
import Settings from './ui/settings.js';
import ToolbarActions from './ui/toolbar-actions.js';
import Toasts from './ui/toasts.js';
import FileDrop from './ui/file-drop.js';
import Preloader from './ui/preloader.js';
import EmptyState from './ui/empty-state.js';
import ResultsContainer from './ui/results-container.js';
import ViewToggler from './ui/view-toggler.js';
import ViewMode from './ui/view-mode.js';
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
    this._pngButtonUi = new PngButton();
    this._resultsUi = new Results();
    this._settingsUi = new Settings();
    this._actionsUi = new ToolbarActions();
    this._toastsUi = new Toasts();
    this._emptyStateUi = new EmptyState();

    const bgFillUi = new BgFillButton();
    const dropUi = new FileDrop();
    const preloaderUi = new Preloader();
    // _resultsContainerUi is unused
    this._resultsContainerUi = new ResultsContainer(this._resultsUi);
    const viewTogglerUi = new ViewToggler();
    const viewModeUi = new ViewMode();

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
    // The two controls are orthogonal: the toolbar picks how the file is shown,
    // the canvas control picks which file that is. Neither writes into the
    // other — `_renderOutput()` composes the pair.
    viewTogglerUi.emitter.on('change', (event) => {
      this._outputView = event.value;
      this._renderOutput();
    });
    viewModeUi.emitter.on('change', (event) =>
      this._onViewModeChange(event.value),
    );
    this._copyButtonUi.emitter.on('copy', ({ success }) =>
      this._toastsUi.show(success ? 'Copy successful' : 'Copy failed', {
        duration: 2000,
      }),
    );
    this._pngButtonUi.emitter.on('error', ({ error }) =>
      this._handleError(error),
    );
    window.addEventListener('keydown', (event) => this._onGlobalKeyDown(event));
    window.addEventListener('paste', (event) => this._onGlobalPaste(event));
    window.addEventListener('copy', (event) => this._onGlobalCopy(event));

    // state
    this._inputItem = null;
    // The latest result, kept so a mode change can re-render without running
    // the worker. A borrowed reference, not an owned one: every result goes
    // into `_cache`, and the cache calls `release()` on what it evicts.
    this._resultItem = null;
    // Which file the canvas is showing (`optimised` | `original`), and how the
    // toolbar is showing it. Neither is persisted: a lens is about the moment,
    // not a preference to restore someone into.
    this._viewMode = 'optimised';
    this._outputView = 'image';
    // What `_renderOutput()` last put on screen, so an unchanged pair doesn't
    // reload the iframe or re-highlight the markup for nothing. `image` is
    // `Output`'s own starting type.
    this._renderedType = 'image';
    this._renderedFile = null;
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
      const viewModeContainer = container.querySelector('.view-mode-container');

      // The rest of the shell paints settled; the output is the only thing that
      // waits for a file, so it's the only thing that animates in — from
      // `_onInputChange`, once there is one.
      this._mainUi = new MainUi(this._outputUi.container);

      minorActionContainer.append(
        bgFillUi.container,
        this._copyButtonUi.container,
        this._pngButtonUi.container,
      );
      actionContainer.append(this._downloadButtonUi.container);
      viewModeContainer.append(viewModeUi.container);
      outputElement.append(this._outputUi.container);
      container.append(this._toastsUi.container, dropUi.container);

      // Awaited, because `setSettings()` assigns input values without firing
      // events: nothing recompresses afterwards, so a file compressed before
      // the restore lands would disagree with the panel showing it. The panel
      // is out of reach until the first file, but the toolbar isn't — Ctrl+O
      // works from the first frame.
      await this._loadSettings();

      // someone managed to hit the preloader, aww
      if (preloaderUi.activated) {
        this._toastsUi.show('Ready now!', { duration: 3000 });
      }

      // Nothing else to do: the app opens empty, on the sheet `EmptyState`
      // adopted, and waits to be given a file.
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

  async _onInputChange({ data, filename }) {
    const settings = this._settingsUi.getSettings();
    // `_onUpdateFound` reads this to choose between a silent reload and an
    // "Update available" toast: there's nothing to lose until someone has given
    // the app a file.
    this._userHasInteracted = true;
    const previousInput = this._inputItem;

    try {
      this._inputItem = await svgo.wrapOriginal(data);
      this._inputFilename = filename;
    } catch (error) {
      this._actionsUi.stopSpinner();
      this._handleError(new Error(`Load failed: ${error.message}`));
      return;
    }

    // Only once the replacement exists, so a failed load doesn't revoke the
    // blob URL of the file still on screen.
    previousInput?.release();
    // The purge releases what this was pointing at, so it has to go with it.
    this._cache.purge();
    this._resultItem = null;

    // The previous file's collision notices describe a document that is no
    // longer open, and the new ones aren't measured until it has been through
    // the pipeline. Dropped rather than left standing — a failed load returns
    // above, so the panel still describes what it is showing.
    this._settingsUi.setCollisions(null);

    this._compressSvg(settings);
    this._outputUi.reset();
    // After the reset, which would otherwise wipe it. The new input is in hand
    // before anything has been optimised, so the Original lens can show it at
    // once instead of waiting out a run whose result it isn't going to display.
    // The mode itself survives the new file.
    if (this._viewMode === 'original') {
      this._renderOutput();
      this._updateExports();
    }

    // Only now, on a file that actually parsed: a failed load leaves the app
    // empty, so it keeps the sheet that says so.
    this._emptyStateUi.hide();
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
    storage.set('settings', settings).catch((error) => {
      console.warn('Could not save settings', error);
    });
  }

  _onViewModeChange(mode) {
    this._viewMode = mode;
    // A lens, not a setting: this re-renders from the files already in hand.
    // No worker run, no abort, no fingerprint lookup — and deliberately no
    // `PanZoom.reset()` either, since comparing the same artwork at the same
    // zoom is the whole point of flipping between them.
    this._renderOutput();
    this._updateExports();
  }

  /**
   * The file the canvas is showing, which is also the one the export buttons
   * hand over.
   *
   * @returns {object | null} An `SvgFile`, or null before there is one.
   */
  _shownFile() {
    return this._viewMode === 'original' ? this._inputItem : this._resultItem;
  }

  _renderOutput() {
    const file = this._shownFile();
    const type = this._outputView;

    if (type === this._renderedType && file === this._renderedFile) return;

    const hasTypeChanged = type !== this._renderedType;

    this._renderedType = type;
    this._renderedFile = file;

    if (hasTypeChanged) {
      // `Output.set()` re-renders whatever it is already holding, which is this
      // same file — the two controls never move at once.
      this._outputUi.set(type);
    } else if (file) {
      this._outputUi.update(file);
    }
  }

  _updateExports() {
    const file = this._shownFile();

    if (!file) return;

    this._downloadButtonUi.setDownload(this._inputFilename, file);
    this._copyButtonUi.setCopyText(file.text);
    this._pngButtonUi.setExport(this._inputFilename, file);
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

    // Whichever lens is on the canvas: a mode is a view of the result, so the
    // result is always computed. Showing the original used to buy silence on a
    // slow file, and no longer does.
    const cacheMatch = this._cache.match(settings.fingerprint);

    if (cacheMatch) {
      this._updateForFile(cacheMatch, { compress: settings.gzip });
      return;
    }

    this._downloadButtonUi.working();

    try {
      const resultFile = await svgo.process(this._inputItem.text, settings);

      this._updateForFile(resultFile, { compress: settings.gzip });

      this._cache.add(settings.fingerprint, resultFile);
    } catch (error) {
      if (error.name === 'AbortError') return;
      error.message = `Minifying error: ${error.message}`;
      this._handleError(error);
    } finally {
      this._downloadButtonUi.done();
    }
  }

  async _updateForFile(resultFile, { compress }) {
    // Frozen before the awaits below: a new file can land while the sizes are
    // being measured, and a comparison drawn from two different documents would
    // be a lie.
    const inputItem = this._inputItem;

    // The panel's collision notices are read off the run that produced this
    // file — every guarded plugin's own view of the document, recorded as it
    // ran (`svgo-worker/collision-probes.js`). Something is optimised in every
    // mode now, so they hold in every mode.
    this._settingsUi.setCollisions(resultFile.collisions);
    this._resultItem = resultFile;
    // The canvas only moves if this is the file it's showing — under the
    // Original lens a fresh result updates the numbers and leaves the view be.
    this._renderOutput();
    this._updateExports();

    // Always the comparison, whichever lens is on the canvas: the numbers
    // describe the settings, not what is being looked at.
    this._resultsUi.update({
      comparisonSize: await inputItem.size({ compress }),
      size: await resultFile.size({ compress }),
    });
  }
}

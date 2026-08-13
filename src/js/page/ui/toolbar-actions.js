import { createNanoEvents } from 'nanoevents';
import { domReady, readFileAsText } from '../utils.js';
import Spinner from './spinner.js';

const DEMO_DIRECTORY = 'test-svgs/';
// Keeps an opened menu clear of the viewport edges.
const VIEWPORT_MARGIN = 8;

/**
 * The input actions in the toolbar: open a file, paste markup, load a demo.
 * All three end in a single `svgDataLoad` event.
 *
 * The demo action is a split button: the button itself loads the default demo,
 * the caret next to it opens a menu of every demo in `src/config.json`. Which
 * demos exist is never spelled out here — the template renders one item per
 * entry, each carrying its filename in `data-demo-file`.
 */
export default class ToolbarActions {
  constructor() {
    this.emitter = createNanoEvents();
    this._spinner = new Spinner();

    domReady.then(() => {
      this.container = document.querySelector('.toolbar');
      this._loadFileInput = this.container.querySelector('.load-file-input');
      this._pasteInput = this.container.querySelector('.paste-input');
      this._pasteLabel = this.container.querySelector('.toolbar-paste');
      this._loadFileBtn = this.container.querySelector('.load-file');
      this._loadDemoBtn = this.container.querySelector('.load-demo');
      this._demoGroup = this.container.querySelector('.toolbar-demo');
      this._demoMenuBtn = this.container.querySelector('.demo-menu-btn');
      this._demoMenu = this.container.querySelector('.demo-menu');

      this._loadFileBtn.addEventListener('click', (event) =>
        this._onLoadFileClick(event),
      );
      this._loadDemoBtn.addEventListener('click', (event) =>
        this._onLoadDemoClick(event),
      );
      // The caret button opens and closes the menu through its
      // `popovertarget`, so there's nothing to bind for that — these only
      // react to a state the browser has already changed.
      this._demoMenu.addEventListener('beforetoggle', (event) =>
        this._onDemoMenuBeforeToggle(event),
      );
      this._demoMenu.addEventListener('toggle', (event) =>
        this._onDemoMenuToggle(event),
      );
      this._demoMenu.addEventListener('click', (event) =>
        this._onDemoMenuClick(event),
      );
      this._loadFileInput.addEventListener('change', () =>
        this._onFileInputChange(),
      );
      this._pasteInput.addEventListener('input', () =>
        this._onTextInputChange(),
      );
    });
  }

  stopSpinner() {
    this._spinner.hide();
  }

  showFilePicker() {
    this._loadFileInput.click();
  }

  setPasteInput(value) {
    this._pasteInput.value = value;
    this._pasteInput.dispatchEvent(new Event('input'));
  }

  /**
   * A focused paste field is an opaque overlay sitting in the middle of the bar,
   * so Escape needs to get out of it.
   */
  resetPasteInput() {
    this._pasteInput.value = '';
    this._pasteInput.blur();
  }

  /**
   * Fetch and emit one of the bundled demo SVGs. `auto` marks the first-load
   * version: nothing was clicked, so there's no button to hang a spinner off,
   * and a visitor who did nothing shouldn't be shown an error for it either.
   * Never rejects — the caller decides what an empty app looks like.
   *
   * `file` is a filename from `src/test-svgs/`, and defaults to the one the
   * template put on the button.
   *
   * @param {{ auto?: boolean, file?: string }} [options] `auto` for the unprompted first load.
   */
  async loadDemo({ auto = false, file } = {}) {
    const demoFile = file ?? this._loadDemoBtn.dataset.demoFile;

    if (!auto) {
      this._loadDemoBtn.append(this._spinner.container);
      this._spinner.show();
    }

    try {
      const response = await fetch(DEMO_DIRECTORY + demoFile);
      // Without this a 404 would reach SVGO as an HTML error page and surface
      // as an unrelated parse error.
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.emitter.emit('svgDataLoad', {
        data: await response.text(),
        filename: demoFile,
        auto,
      });
    } catch (error) {
      this.stopSpinner();

      if (auto) {
        console.warn("Couldn't fetch the demo SVG", error);
        return;
      }

      this.emitter.emit('error', {
        error: new Error("Couldn't fetch demo SVG"),
      });
    }
  }

  _onTextInputChange() {
    const { value } = this._pasteInput;
    if (!value.includes('</svg>')) return;

    this._pasteInput.value = '';
    this._pasteInput.blur();

    this._pasteLabel.append(this._spinner.container);
    this._spinner.show();

    this.emitter.emit('svgDataLoad', {
      data: value,
      filename: 'image.svg',
    });
  }

  _onLoadFileClick(event) {
    event.preventDefault();
    // Without this the action keeps its focus fill after the picker closes.
    event.target.blur();
    this.showFilePicker();
  }

  async _onFileInputChange() {
    const file = this._loadFileInput.files[0];

    if (!file) return;

    this._loadFileBtn.append(this._spinner.container);
    this._spinner.show();

    try {
      const data = await readFileAsText(file);
      this.emitter.emit('svgDataLoad', { data, filename: file.name });
    } catch {
      // Without this the spinner would run forever on an unreadable file.
      this.stopSpinner();
      this.emitter.emit('error', {
        error: new Error(`Couldn't read ${file.name}`),
      });
    }
  }

  _onLoadDemoClick(event) {
    event.preventDefault();
    event.target.blur();
    this.loadDemo();
  }

  /**
   * A popover lives in the top layer, so it's positioned against the viewport
   * and not the button that opened it — and it has to be, because
   * `.toolbar-actions` scrolls horizontally and `.app-output` clips: an
   * in-flow dropdown would be cut off by both. Placed on `beforetoggle` rather
   * than `toggle` so it's already in the right spot on the first painted frame.
   *
   * @param {ToggleEvent} event The popover's own `beforetoggle`.
   */
  _onDemoMenuBeforeToggle(event) {
    if (event.newState !== 'open') return;

    const anchor = this._demoGroup.getBoundingClientRect();
    this._demoMenu.style.top = `${anchor.bottom}px`;
    this._demoMenu.style.left = `${anchor.left}px`;
  }

  _onDemoMenuToggle(event) {
    const isOpen = event.newState === 'open';
    this._demoMenuBtn.setAttribute('aria-expanded', String(isOpen));

    if (!isOpen) return;

    // Only a shown popover can be measured, so the clamp has to wait until
    // here: aligning the menu with the button's left edge overflows the right
    // edge of the viewport once the button is far enough along the bar.
    const overflow =
      this._demoMenu.getBoundingClientRect().right -
      (window.innerWidth - VIEWPORT_MARGIN);

    if (overflow > 0) {
      const left = Number.parseFloat(this._demoMenu.style.left) - overflow;
      this._demoMenu.style.left = `${Math.max(VIEWPORT_MARGIN, left)}px`;
    }

    // A mouse user's pointer is already on the menu; a keyboard user would
    // otherwise have to tab into it. `key-focused` is set by
    // `trackFocusMethod()` in page/utils.js.
    if (this._demoMenuBtn.classList.contains('key-focused')) {
      this._demoMenu.querySelector('.demo-menu-item').focus();
    }
  }

  _onDemoMenuClick(event) {
    const item = event.target.closest('.demo-menu-item');
    if (!item) return;

    // Hiding the popover returns focus to the caret button by itself.
    this._demoMenu.hidePopover();
    this.loadDemo({ file: item.dataset.demoFile });
  }
}

import { createNanoEvents } from 'nanoevents';
import { domReady, readFileAsText } from '../utils.js';
import Spinner from './spinner.js';

const DEMO_URL = 'test-svgs/car-lite.svg';
const DEMO_FILENAME = 'car-lite.svg';

/**
 * The input actions in the toolbar: open a file, paste markup, load the demo.
 * All three end in a single `svgDataLoad` event.
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

      this._loadFileBtn.addEventListener('click', (event) =>
        this._onLoadFileClick(event),
      );
      this._loadDemoBtn.addEventListener('click', (event) =>
        this._onLoadDemoClick(event),
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
   * Fetch and emit the bundled demo SVG. `auto` marks the first-load version:
   * nothing was clicked, so there's no button to hang a spinner off, and a
   * visitor who did nothing shouldn't be shown an error for it either.
   * Never rejects — the caller decides what an empty app looks like.
   *
   * @param {{ auto?: boolean }} [options] `auto` for the unprompted first load.
   */
  async loadDemo({ auto = false } = {}) {
    if (!auto) {
      this._loadDemoBtn.append(this._spinner.container);
      this._spinner.show();
    }

    try {
      const response = await fetch(DEMO_URL);
      // Without this a 404 would reach SVGO as an HTML error page and surface
      // as an unrelated parse error.
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.emitter.emit('svgDataLoad', {
        data: await response.text(),
        filename: DEMO_FILENAME,
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
}

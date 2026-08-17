import { createNanoEvents } from 'nanoevents';
import { strToEl } from '../utils.js';

// The lenses on the canvas. Which file each one puts on screen — and what it
// does to the export buttons and the size readout — is `MainController`'s
// business; this control only says which one is picked.
//
// A radio group rather than buttons, and one `<form>` rather than several: that
// buys arrow-key movement within the group, the `key-focused` ring
// `trackFocusMethod()` puts on a focused input, and a checked state the CSS can
// read — the same grammar as the toolbar's `.view-toggler`. Labels are text,
// because "Optimised" and "Original" have no icon that would say which is which.
const modes = [
  { value: 'optimised', label: 'Optimised' },
  { value: 'original', label: 'Original' },
  { value: 'diff', label: 'Diff' },
];

// `.selected` sits immediately after its input, so `:checked + .selected` can
// fill the segment and `.key-focused + .selected` can ring it.
const segment = ({ value, label }, index) =>
  `<label class="view-mode-segment"><input type="radio" name="view-mode" value="${value}"${
    index === 0 ? ' checked' : ''
  }><span class="selected"></span>${label}</label>`;

/**
 * The on-canvas switch between the optimised result and the file as it was
 * loaded.
 */
export default class ViewMode {
  constructor() {
    this.emitter = createNanoEvents();

    this.container = strToEl(
      `<form class="view-mode" aria-label="View mode">${modes
        .map((mode, index) => segment(mode, index))
        .join('')}</form>`,
    );

    this._radios = this.container.elements['view-mode'];

    this.container.addEventListener('change', () => {
      this.emitter.emit('change', { value: this._radios.value });
    });
  }
}

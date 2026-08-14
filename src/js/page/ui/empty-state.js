import { domReady, transitionFromClass } from '../utils.js';

/**
 * The white sheet the app opens on, with its invitation to open a file.
 *
 * Adopted from `index.njk`, where it's rendered `active` so it paints with the
 * rest of the shell rather than waiting for this. Dismissed once, on the first
 * SVG of the session, and never shown again — a loaded file is only ever
 * replaced by another one.
 */
export default class EmptyState {
  _hidden = false;

  constructor() {
    this._ready = domReady.then(() => {
      this.container = document.querySelector('.empty-state');
    });
  }

  /**
   * Fade the sheet out for good. Idempotent, and safe to call before DOM ready:
   * a paste can reach `MainController` that early.
   */
  async hide() {
    if (this._hidden) return;
    this._hidden = true;

    await this._ready;
    // Dropping `active` is what returns the settings panel and the action
    // buttons to the layout (see components/_empty-state.scss), and
    // `transitionFromClass` does it as the fade starts — so they settle behind
    // an opaque sheet instead of appearing out of one.
    await transitionFromClass(this.container);
    this.container.style.display = 'none';
  }
}

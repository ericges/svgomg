import { createNanoEvents } from 'nanoevents';
import FloatingActionButton from './floating-action-button.js';

export default class CopyButton extends FloatingActionButton {
  constructor() {
    const title = 'Copy as text';

    super({
      title,
      iconSvg:
        // prettier-ignore
        '<svg aria-hidden="true" class="icon" viewBox="0 0 24 24">' +
          '<path d="M16 1H4C3 1 2 2 2 3v14h2V3h12V1zm3 4H8C7 5 6 6 6 7v14c0 1 1 2 2 2h11c1 0 2-1 2-2V7c0-1-1-2-2-2zm0 16H8V7h11v14z"/>' +
        '</svg>',
    });

    this.emitter = createNanoEvents();
    this._text = null;
  }

  get text() {
    return this._text;
  }

  onClick() {
    super.onClick();
    this.copyText().then((success) => this.emitter.emit('copy', { success }));
  }

  async copyText() {
    if (!this._text) return false;

    try {
      await navigator.clipboard.writeText(this._text);
      return true;
    } catch {
      return false;
    }
  }

  setCopyText(text) {
    this._text = text;
  }
}

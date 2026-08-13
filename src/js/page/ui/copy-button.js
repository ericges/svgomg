import { createNanoEvents } from 'nanoevents';
import copyIconSvg from '../../../partials/icons/copy.svg';
import FloatingActionButton from './floating-action-button.js';

export default class CopyButton extends FloatingActionButton {
  constructor() {
    const title = 'Copy as text';

    super({
      title,
      iconSvg: copyIconSvg,
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

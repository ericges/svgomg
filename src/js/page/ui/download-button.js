import downloadIconSvg from '../../../partials/icons/download.svg';
import FloatingActionButton from './floating-action-button.js';
import Spinner from './spinner.js';

export default class DownloadButton extends FloatingActionButton {
  constructor() {
    const title = 'Download';

    super({
      title,
      href: './',
      iconSvg: downloadIconSvg,
      major: true,
    });

    this._spinner = new Spinner();
    this.container.append(this._spinner.container);
  }

  setDownload(filename, { url }) {
    this.container.download = filename;
    this.container.href = url;
  }

  working() {
    this._spinner.show(500);
  }

  done() {
    this._spinner.hide();
  }
}

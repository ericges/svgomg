import { gzip } from './gzip.js';

export default class SvgFile {
  constructor(text, width, height) {
    this.text = text;
    this._compressedSize = null;
    this._url = null;
    this.width = width;
    this.height = height;
  }

  async size({ compress }) {
    if (!compress) return this.text.length;

    this._compressedSize ||= gzip
      .compress(this.text)
      .then((response) => response.byteLength);

    return this._compressedSize;
  }

  get url() {
    this._url ||= URL.createObjectURL(
      new Blob([this.text], { type: 'image/svg+xml' }),
    );

    return this._url;
  }

  release() {
    if (!this._url) return;

    URL.revokeObjectURL(this._url);
  }
}

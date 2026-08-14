import { gzip } from './gzip.js';

export default class SvgFile {
  /**
   * One SVG the app is holding on to: the input, or a result of optimising it.
   *
   * @param {string} text The markup.
   * @param {number} width Pixel width, for sizing the preview.
   * @param {number} height Pixel height.
   * @param {object} [collisions] `{ fingerprint, subjects }` — what each
   * guarded plugin saw when it ran, and the settings that produced it, for the
   * panel's collision notices (`svgo-worker/collision-probes.js`). Only a
   * result has one: the input has been through no plugins.
   */
  constructor(text, width, height, collisions) {
    this.text = text;
    this._compressedSize = null;
    this._rawSize = null;
    this._url = null;
    this.width = width;
    this.height = height;
    this.collisions = collisions;
  }

  async size({ compress }) {
    // String length counts UTF-16 code units, not the UTF-8 bytes an SVG is
    // actually shipped as, so it under-reports anything non-ASCII. `??=` rather
    // than `||=` so a legitimately empty file isn't re-encoded every time.
    if (!compress) {
      this._rawSize ??= new TextEncoder().encode(this.text).byteLength;
      return this._rawSize;
    }

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
    // Clearing this keeps `release()` idempotent, and stops the `url` getter
    // handing back an already-revoked URL if the file is displayed again.
    this._url = null;
  }
}

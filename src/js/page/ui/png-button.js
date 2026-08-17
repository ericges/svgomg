import { createNanoEvents } from 'nanoevents';
import imageIconSvg from '../../../partials/icons/image.svg';
import FloatingActionButton from './floating-action-button.js';
import { previewSize } from './preview-size.js';
import { rasterizeToCanvas } from './rasterize.js';

const pngFilename = (svgFilename) =>
  `${svgFilename.replace(/\.svgz?$/i, '')}.png`;

export default class PngButton extends FloatingActionButton {
  constructor() {
    super({
      title: 'Save as PNG',
      iconSvg: imageIconSvg,
    });

    this.emitter = createNanoEvents();
    this._svgFile = null;
    this._filename = 'image.svg';
  }

  onClick() {
    super.onClick();
    this._save();
  }

  async _save() {
    // Snapshotted before the first await: setExport() may replace both while
    // we're rasterizing, and the download must not pair old pixels with a new
    // name.
    const svgFile = this._svgFile;

    if (!svgFile) return;

    const filename = this._filename;

    try {
      const blob = await this._rasterize(svgFile);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = pngFilename(filename);
      // Firefox only honours click() on an in-document anchor.
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error_) {
      // Not mutated in place: decode() rejects with a DOMException, whose
      // message is a getter-only accessor.
      const detail = error_ instanceof Error ? error_.message : String(error_);
      const error = new Error(`PNG export failed: ${detail}`, {
        cause: error_,
      });
      this.emitter.emit('error', { error });
    }
  }

  async _rasterize(svgFile, scale = 1) {
    const { width, height } = previewSize(svgFile.width, svgFile.height);
    const canvas = await rasterizeToCanvas(svgFile, { width, height, scale });

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });

    if (!blob) throw new Error('PNG encoding failed');
    return blob;
  }

  setExport(filename, svgFile) {
    this._filename = filename;
    this._svgFile = svgFile;
  }
}

import { createNanoEvents } from 'nanoevents';
import imageIconSvg from '../../../partials/icons/image.svg';
import FloatingActionButton from './floating-action-button.js';
import { previewSize } from './preview-size.js';

const pngFilename = (svgFilename) =>
  `${svgFilename.replace(/\.svgz?$/i, '')}.png`;

// A root carrying only a viewBox has no intrinsic size, and engines disagree
// about drawing such an image onto a canvas — Firefox drew it blank until
// 2025. Stamping the size we're going to raster at makes them all agree, and
// also neutralises percentage widths.
function withExplicitSize(text, width, height) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;

  if (root.nodeName !== 'svg') return text;

  root.setAttribute('width', width);
  root.setAttribute('height', height);
  return new XMLSerializer().serializeToString(doc);
}

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
    const markup = withExplicitSize(svgFile.text, width, height);
    // Not svgFile.url: the markup may differ, and revoking our URL must never
    // invalidate the download button's href. The charset matters — WebKit has
    // mis-decoded non-ASCII SVG blobs without it.
    const url = URL.createObjectURL(
      new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }),
    );
    const image = new Image();

    try {
      image.src = url;
      await image.decode();
    } finally {
      URL.revokeObjectURL(url);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

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

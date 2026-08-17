// Drawing an `SvgFile` onto a canvas, shared by the PNG export and the visual
// diff. Split out of `png-button.js` when the diff needed the same thing: two
// renders at one agreed pixel box, which is what `pixelmatch` compares.
//
// The caller supplies the box rather than having it derived here, because the
// two callers want different ones — the export takes it from the file it is
// exporting, and the diff forces both sides into the box the *input* file
// implies, so its two buffers are the same length.

// A root carrying only a viewBox has no intrinsic size, and engines disagree
// about drawing such an image onto a canvas — Firefox drew it blank until
// 2025. Stamping the size we're going to raster at makes them all agree, and
// also neutralises percentage widths.
export function withExplicitSize(text, width, height) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;

  if (root.nodeName !== 'svg') return text;

  root.setAttribute('width', width);
  root.setAttribute('height', height);
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Draw an SVG onto a fresh canvas at a given CSS box and device scale.
 *
 * @param {object} svgFile The file to draw — only its `text` is read.
 * @param {object} box The box to draw into.
 * @param {number} box.width Its width in CSS pixels.
 * @param {number} box.height Its height in CSS pixels.
 * @param {number} [box.scale] Device pixels per CSS pixel.
 * @returns {Promise<HTMLCanvasElement>} The canvas, `width`/`height` in device pixels.
 */
export async function rasterizeToCanvas(svgFile, { width, height, scale = 1 }) {
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

  return canvas;
}

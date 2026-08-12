// Split out of `svg-output.js` so it can be unit-tested: that module imports
// `../utils.js`, which touches `document` at load time and so can't be imported
// outside a browser.

// Beyond this the preview stops being useful and starts costing real memory in
// the compositor, so oversized SVGs are scaled down rather than laid out fully.
export const MAX_PREVIEW_DIMENSION = 4096;

// SVG's own default size for a replaced element without usable dimensions.
export const DEFAULT_PREVIEW_WIDTH = 300;
export const DEFAULT_PREVIEW_HEIGHT = 150;

// Checked positively so NaN and undefined fall through to the default, which a
// `<= 0` comparison would not do.
const isUsable = (value) => Number.isFinite(value) && value > 0;

export function previewSize(width, height) {
  if (!isUsable(width) || !isUsable(height)) {
    return { width: DEFAULT_PREVIEW_WIDTH, height: DEFAULT_PREVIEW_HEIGHT };
  }

  const scale = Math.min(1, MAX_PREVIEW_DIMENSION / Math.max(width, height));
  return { width: width * scale, height: height * scale };
}

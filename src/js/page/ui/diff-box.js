// The pixel box the visual diff rasterises both sides into. DOM-free and
// unit-tested, like `preview-size.js` beside it — `devicePixelRatio` is a
// parameter rather than a global read for exactly that reason.
//
// `pixelmatch` compares two buffers of equal length, so both sides go into *one*
// box, computed from the input file's dimensions. When an optimisation changes
// the intrinsic size the optimised render lands somewhere else inside that box,
// which is the honest rendering of a dimension change rather than a bug to
// correct for.

import { previewSize } from './preview-size.js';

// Two renders, an output image and a `getImageData()` copy of each all live at
// once, so the box is capped by area rather than by edge length: 2MP is about
// 32MB of RGBA across the four buffers, and a diff is a thing you look at for a
// moment rather than something the page holds open.
export const MAX_DIFF_AREA = 2_000_000;

/**
 * The CSS box and device scale to rasterise both sides of a diff at.
 *
 * @param {number} width The input file's width.
 * @param {number} height The input file's height.
 * @param {number} [pixelRatio] `devicePixelRatio`, the scale to aim for.
 * @returns {{width: number, height: number, scale: number}} CSS pixels, and the multiplier to draw at.
 */
export function diffBox(width, height, pixelRatio = 1) {
  const box = previewSize(width, height);
  // A ratio of 0, NaN or undefined means "we couldn't tell" — draw at 1:1
  // rather than at nothing.
  const wanted = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const area = box.width * box.height;
  // Scale is what the cap bites on: the CSS box is the preview's, so the diff
  // and the preview frame the artwork identically however coarse the raster.
  const capped = Math.sqrt(MAX_DIFF_AREA / area);

  return { ...box, scale: Math.min(wanted, capped) };
}

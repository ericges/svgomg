import pixelmatch from 'pixelmatch';
import { domReady, strToEl } from '../utils.js';
import PanZoom from './pan-zoom.js';
import { diffBox } from './diff-box.js';
import { rasterizeToCanvas } from './rasterize.js';

// Anti-aliasing is the noise floor here: two renders of near-identical artwork
// differ along every curve, and a diff that reddens all of them on an untouched
// file says nothing. `pixelmatch`'s own AA detection does most of the work — it
// paints those pixels its `aaColor` yellow rather than counting them — and this
// threshold, the colour distance below which a difference doesn't count at all,
// does the rest. Measured on the demos at the default preset: the stock 0.1
// leaves 322 red pixels on the tiger and 37 on the flag, 0.2 leaves 25 and 8
// (the car is 1 either way), and precision 0 on the tiger still lights up 943.
// So the signal survives a threshold that clears the residue.
const AA_THRESHOLD = 0.2;

// How much of the underlying render `pixelmatch` leaves behind the highlight.
// Its own default is 0.1, which over this checkerboard is close to a blank white
// box — the faded artwork is the context that makes the red mean something, so
// it has to actually be visible.
const CONTEXT_ALPHA = 0.5;

export default class RenderDiffOutput {
  constructor() {
    // prettier-ignore
    this.container = strToEl(
      '<div class="render-diff-output">' +
        '<div class="svg-container">' +
          '<canvas class="render-diff-canvas"></canvas>' +
        '</div>' +
        '<p class="render-diff-empty" hidden>No visible changes</p>' +
      '</div>'
    );

    this._canvas = this.container.querySelector('.render-diff-canvas');
    this._empty = this.container.querySelector('.render-diff-empty');
    // A token rather than a counter: rasterising is two async image decodes, and
    // a new result can land in the middle of them. Compared after every await,
    // so a stale pair never paints over a fresh one.
    this._latestJobId = null;

    domReady.then(() => {
      this._panZoom = new PanZoom(
        this.container.querySelector('.svg-container'),
        { eventArea: this.container },
      );
    });
  }

  async setSvg(resultFile, inputFile) {
    const thisJobId = {};
    this._latestJobId = thisJobId;

    if (!resultFile || !inputFile) {
      this.reset();
      return;
    }

    // One box for both sides, from the *input* file: `pixelmatch` needs two
    // buffers of the same length, and forcing a changed intrinsic size into the
    // box it used to occupy is the honest picture of that change.
    const box = diffBox(inputFile.width, inputFile.height, devicePixelRatio);
    const [before, after] = await Promise.all([
      rasterizeToCanvas(inputFile, box),
      rasterizeToCanvas(resultFile, box),
    ]);

    if (this._latestJobId !== thisJobId) return;

    const { width, height } = before;
    // Clean readback: both frames came from same-document blob URLs. An SVG
    // referencing an external resource simply doesn't render it onto a canvas,
    // which the PNG export has always been subject to as well.
    const beforeData = before
      .getContext('2d')
      .getImageData(0, 0, width, height);
    const afterData = after.getContext('2d').getImageData(0, 0, width, height);
    const diff = new ImageData(width, height);

    const changed = pixelmatch(
      beforeData.data,
      afterData.data,
      diff.data,
      width,
      height,
      { threshold: AA_THRESHOLD, alpha: CONTEXT_ALPHA },
    );

    this._canvas.width = width;
    this._canvas.height = height;
    this._canvas.style.width = `${box.width}px`;
    this._canvas.style.height = `${box.height}px`;
    this._canvas.getContext('2d').putImageData(diff, 0, 0);
    // Not an empty canvas: the faded render stays up as context for the claim.
    this._empty.hidden = changed > 0;
  }

  reset() {
    this._latestJobId = null;
    this._canvas.width = 0;
    this._canvas.height = 0;
    this._empty.hidden = true;
    this._panZoom?.reset();
  }
}

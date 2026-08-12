import { domReady, strToEl } from '../utils.js';
import PanZoom from './pan-zoom.js';

// Beyond this the preview stops being useful and starts costing real memory in
// the compositor, so oversized SVGs are scaled down rather than laid out fully.
const MAX_PREVIEW_DIMENSION = 4096;

// SVG's own default size for a replaced element without usable dimensions.
const DEFAULT_PREVIEW_WIDTH = 300;
const DEFAULT_PREVIEW_HEIGHT = 150;

// Checked positively so NaN and undefined fall through to the default, which a
// `<= 0` comparison would not do.
const isUsable = (value) => Number.isFinite(value) && value > 0;

function previewSize(width, height) {
  if (!isUsable(width) || !isUsable(height)) {
    return { width: DEFAULT_PREVIEW_WIDTH, height: DEFAULT_PREVIEW_HEIGHT };
  }

  const scale = Math.min(1, MAX_PREVIEW_DIMENSION / Math.max(width, height));
  return { width: width * scale, height: height * scale };
}

export default class SvgOutput {
  constructor() {
    // prettier-ignore
    this.container = strToEl(
      '<div class="svg-output">' +
        '<div class="svg-container">' +
          // No allow-scripts: the page CSP is inherited by this data: document
          // and already blocks scripts inside the previewed SVG, so dropping
          // the token makes that explicit. SMIL and CSS animation still run.
          '<iframe class="svg-frame" sandbox="" scrolling="no" title="Loaded SVG file"></iframe>' +
        '</div>' +
      '</div>'
    );

    this._svgFrame = this.container.querySelector('.svg-frame');
    this._svgContainer = this.container.querySelector('.svg-container');

    domReady.then(() => {
      this._panZoom = new PanZoom(this._svgContainer, {
        eventArea: this.container,
      });
    });
  }

  setSvg({ text, width, height }) {
    // TODO: revisit this
    // I would rather use blob urls, but they don't work in Firefox
    // All the internal refs break.
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1125667
    const nextLoad = this._nextLoadPromise();
    const size = previewSize(width, height);
    this._svgFrame.src = `data:image/svg+xml,${encodeURIComponent(text)}`;
    this._svgFrame.style.width = `${size.width}px`;
    this._svgFrame.style.height = `${size.height}px`;
    return nextLoad;
  }

  reset() {
    this._svgFrame.src = 'about:blank';
    this._panZoom.reset();
  }

  _nextLoadPromise() {
    return new Promise((resolve) => {
      const onload = () => {
        this._svgFrame.removeEventListener('load', onload);
        resolve();
      };

      this._svgFrame.addEventListener('load', onload);
    });
  }
}

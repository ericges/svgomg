import { strToEl, transitionToClass, transitionFromClass } from '../utils.js';
import SvgOutput from './svg-output.js';
import CodeOutput from './code-output.js';
import RenderDiffOutput from './render-diff-output.js';
import MarkupDiffOutput from './markup-diff-output.js';

export default class Output {
  constructor() {
    this.container = strToEl('<div class="output-switcher"></div>');

    // Keyed by the type `MainController._renderOutput()` composes out of the
    // toolbar's view and the canvas view mode. The two diff types take a second
    // file; the other two ignore it.
    this._types = {
      image: new SvgOutput(),
      code: new CodeOutput(),
      renderDiff: new RenderDiffOutput(),
      markupDiff: new MarkupDiffOutput(),
    };

    this._svgFile = null;
    this._compareFile = null;
    this._switchQueue = Promise.resolve();
    this.set('image', { noAnimate: true });
  }

  update(svgFile, compareFile = null) {
    this._svgFile = svgFile;
    this._compareFile = compareFile;
    return this._types[this._activeType].setSvg(svgFile, compareFile);
  }

  reset() {
    // The files go too: a switch between this and the next `update()` would
    // otherwise re-render the file that was just reset away.
    this._svgFile = null;
    this._compareFile = null;
    this._types[this._activeType].reset();
  }

  set(type, { noAnimate = false, svgFile, compareFile } = {}) {
    // Stored now rather than inside the queued step: a switch waits on whatever
    // is ahead of it in the queue, and an `update()` landing meanwhile is newer
    // than this call — recording the pair late would paint the stale one.
    if (svgFile !== undefined) this._svgFile = svgFile;
    if (compareFile !== undefined) this._compareFile = compareFile;

    this._switchQueue = this._switchQueue.then(async () => {
      const toRemove =
        this._activeType && this._types[this._activeType].container;

      this._activeType = type;
      const toAdd = this._types[this._activeType].container;
      this.container.append(toAdd);

      if (this._svgFile) {
        await this.update(this._svgFile, this._compareFile);
      } else if (toRemove) {
        // Nothing to show — but this type may still be holding whatever it
        // rendered last, which a `reset()` aimed at another type didn't reach.
        // Skipped on the first switch of all, where nothing has rendered yet
        // and `SvgOutput`'s `PanZoom` isn't built until DOM ready.
        this._types[this._activeType].reset();
      }

      if (noAnimate) {
        toAdd.classList.add('active');
        if (toRemove) toRemove.classList.remove('active');
      } else {
        const transitions = [transitionToClass(toAdd)];

        if (toRemove) transitions.push(transitionFromClass(toRemove));

        await Promise.all(transitions);
      }

      if (toRemove) toRemove.remove();
    });

    return this._switchQueue;
  }
}

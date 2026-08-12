import WorkerMessenger from './worker-messenger.js';
import SvgFile from './svg-file.js';

// `wrapOriginal` runs before any abort path exists — `MainController` only
// calls `abort()` from `_compressSvg`, which this blocks — so a pathological
// input would otherwise hang the UI behind the spinner with no way back.
// Generous, because legitimately huge SVGs are the whole point of the app.
const WRAP_ORIGINAL_TIMEOUT_MS = 20_000;

export default class Svgo extends WorkerMessenger {
  constructor() {
    super('js/svgo-worker.js');
    this._currentJob = Promise.resolve();
  }

  async wrapOriginal(svgText) {
    const { width, height } = await this.requestResponse(
      {
        action: 'wrapOriginal',
        data: svgText,
      },
      { timeout: WRAP_ORIGINAL_TIMEOUT_MS },
    );

    return new SvgFile(svgText, width, height);
  }

  process(svgText, settings) {
    this.abort();

    this._currentJob = this._currentJob
      .catch(() => {})
      .then(async () => {
        const { data, dimensions } = await this.requestResponse({
          action: 'process',
          settings,
          data: svgText,
        });

        // return final result
        return new SvgFile(data, dimensions.width, dimensions.height);
      });

    return this._currentJob;
  }
}

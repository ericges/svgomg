import { strToEl } from '../utils.js';

function round(num, places) {
  const mult = 10 ** places;
  return Math.floor(Math.round(num * mult)) / mult;
}

function humanSize(bytes) {
  return bytes < 1024 ? `${bytes} bytes` : `${round(bytes / 1024, 2)}k`;
}

export default class Results {
  constructor() {
    // prettier-ignore
    this.container = strToEl(
      '<div class="results">' +
        '<span class="size"></span> ' +
        '<span class="diff"></span>' +
      '</div>'
    );

    this._sizeEl = this.container.querySelector('.size');
    this._diffEl = this.container.querySelector('.diff');
  }

  update({ size, comparisonSize }) {
    this._sizeEl.textContent = comparisonSize
      ? `${humanSize(comparisonSize)} → ${humanSize(size)}`
      : humanSize(size);

    this._diffEl.classList.remove('decrease', 'increase');

    // just displaying a single size?
    if (!comparisonSize) {
      this._diffEl.textContent = '';
    } else if (size === comparisonSize) {
      this._diffEl.textContent = '±0%';
    } else {
      const hasIncreased = size > comparisonSize;
      const change = round(
        (Math.abs(size - comparisonSize) / comparisonSize) * 100,
        1,
      );

      // The sign is written out rather than left to `round`, so a change too
      // small to survive rounding still reads `-0%`/`+0%` and agrees with the
      // colour — `±0%` above is reserved for genuinely identical sizes.
      this._diffEl.textContent = `${hasIncreased ? '+' : '-'}${change}%`;
      this._diffEl.classList.add(hasIncreased ? 'increase' : 'decrease');
    }
  }
}

import { strToEl } from '../utils.js';
import { diffMarkup } from '../markup-diff.js';

// Unchanged markup is most of the file, and a screen of it between two changes
// is noise. Runs longer than this collapse to a single line saying how many
// there were — a static row, deliberately not an expander: the Markup view is
// where you go to read the whole thing.
const CONTEXT_RUN_LIMIT = 6;

// The gutter carries the meaning, not the tint: a row type has to be readable
// to someone who can't tell the two backgrounds apart.
const gutter = { context: ' ', add: '+', remove: '-' };

const escapeHtml = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const row = (type, text) =>
  `<div class="markup-diff-row markup-diff-${type}"><span class="markup-diff-gutter" aria-hidden="true">${gutter[type]}</span><span class="markup-diff-line">${escapeHtml(text)}</span></div>`;

const summaryRow = (count) =>
  `<div class="markup-diff-row markup-diff-skip"><span class="markup-diff-gutter" aria-hidden="true"> </span><span class="markup-diff-line">… ${count} unchanged lines</span></div>`;

export default class MarkupDiffOutput {
  constructor() {
    // prettier-ignore
    this.container = strToEl(
      '<div class="markup-diff-output">' +
        // The view has to say this: someone comparing it against the Markup
        // view would otherwise read the reflow as the optimiser's doing.
        '<p class="markup-diff-notice">Both sides are shown one element per line, so the comparison holds however Prettify is set. The file itself is unchanged.</p>' +
        '<div class="markup-diff-rows"></div>' +
      '</div>'
    );

    this._notice = this.container.querySelector('.markup-diff-notice');
    this._rows = this.container.querySelector('.markup-diff-rows');
    // Nothing until there is something: no file yet is an empty area, not a
    // spinner. `Output` never calls `setSvg` without a result, so this is also
    // what the Diff view shows while the first one is still being computed.
    this.reset();
  }

  setSvg(resultFile, inputFile) {
    if (!resultFile || !inputFile) {
      this.reset();
      return;
    }

    const parts = diffMarkup(inputFile.text, resultFile.text);
    const html = [];
    let changed = 0;

    for (const part of parts) {
      const lines = part.text.split('\n');

      if (part.type === 'context') {
        // Kept whole when short, and topped and tailed when long, so a change
        // still has a line of its own surroundings on each side.
        if (lines.length > CONTEXT_RUN_LIMIT) {
          html.push(
            row('context', lines[0]),
            summaryRow(lines.length - 2),
            row('context', lines.at(-1)),
          );
          continue;
        }
      } else {
        changed += lines.length;
      }

      for (const line of lines) html.push(row(part.type, line));
    }

    this._notice.hidden = false;
    this._rows.innerHTML = changed
      ? html.join('')
      : '<p class="markup-diff-state">No changes</p>';
  }

  reset() {
    this._notice.hidden = true;
    this._rows.replaceChildren();
  }
}

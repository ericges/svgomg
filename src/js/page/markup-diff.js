// The line diff behind the Markup + Diff view. DOM-free and unit-tested, a
// sibling of `settings-model.js` for the same reason: the component's job is one
// loop of rows, and everything that decides what a row *is* lives here.

import { diffLines } from 'diff';

// jsdiff is O(nd): a pathological pair can spin for a long time on the main
// thread, and this codebase's rule is that CPU work goes in a worker. This one
// stays in the page because it is bounded and only runs while the diff is on
// screen — that bound is this constant. Raising it means moving the module into
// a worker, which costs a sixth rollup bundle, a `js.bind(...)` line in
// `gulpfile.mjs` and a precache entry in `src/js/sw/index.js`.
export const MAX_EDIT_LENGTH = 2000;

/**
 * Both sides of the diff, reflowed to one element per line.
 *
 * With Prettify off — the default — the optimised markup is a single line, and
 * a line diff of a pretty-printed input against it says "everything changed"
 * and is worthless. So both sides are split the same way, unconditionally,
 * including when Prettify is on: the diff then reads the same however that
 * toggle moves.
 *
 * This is **cosmetic and lives only in this view**. Nothing here reaches what is
 * exported, copied, measured, cached or fingerprinted — those all read
 * `SvgFile.text`, which this never touches.
 *
 * The split is textual, not a parse. `<` is illegal unescaped in an attribute
 * value of well-formed XML — and both sides have been through SVGO's parser to
 * get here — so no attribute can be broken across lines by it. Comment and CDATA
 * content holding `> <` can be, which costs a spurious line break in a view
 * whose other side is split by the very same rule.
 *
 * @param {string} text The markup to reflow.
 * @returns {string[]} One line per element.
 */
export function reflowMarkup(text) {
  return text.replaceAll(/>\s*</g, '>\n<').trim().split('\n');
}

const block = (type, lines) => ({ type, text: lines.join('\n') });

// jsdiff gives up and returns undefined past `maxEditLength`. Rather than
// refuse, say the true but coarse thing: everything the two sides share at each
// end is context, and the middle changed wholesale.
function degrade(from, to) {
  let start = 0;

  while (
    start < from.length &&
    start < to.length &&
    from[start] === to[start]
  ) {
    start++;
  }

  let end = 0;

  while (
    end < from.length - start &&
    end < to.length - start &&
    from.at(-1 - end) === to.at(-1 - end)
  ) {
    end++;
  }

  const removed = from.slice(start, from.length - end);
  const added = to.slice(start, to.length - end);

  return [
    start > 0 && block('context', from.slice(0, start)),
    removed.length > 0 && block('remove', removed),
    added.length > 0 && block('add', added),
    end > 0 && block('context', from.slice(from.length - end)),
  ].filter(Boolean);
}

/**
 * The optimised markup against the input, as rows ready to render.
 *
 * @param {string} fromText The input file's markup.
 * @param {string} toText The optimised markup.
 * @returns {Array<{type: 'context' | 'add' | 'remove', text: string}>} One entry per run of lines.
 */
export function diffMarkup(fromText, toText) {
  const from = reflowMarkup(fromText);
  const to = reflowMarkup(toText);
  const parts = diffLines(from.join('\n'), to.join('\n'), {
    maxEditLength: MAX_EDIT_LENGTH,
  });

  if (!parts) return degrade(from, to);

  return parts.map((part) => {
    // jsdiff keeps the trailing newline on every run; the view wants lines.
    const text = part.value.replace(/\n$/, '');

    if (part.added) return { type: 'add', text };
    if (part.removed) return { type: 'remove', text };
    return { type: 'context', text };
  });
}

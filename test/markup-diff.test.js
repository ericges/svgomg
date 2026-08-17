import test from 'node:test';
import {
  diffMarkup,
  MAX_EDIT_LENGTH,
  reflowMarkup,
} from '../src/js/page/markup-diff.js';

const svg = (...children) =>
  `<svg xmlns="http://www.w3.org/2000/svg">${children.join('')}</svg>`;

const types = (parts) => parts.map((part) => part.type);
const textOf = (parts, type) =>
  parts
    .filter((part) => part.type === type)
    .map((part) => part.text)
    .join('\n');

test('a one-line SVG reflows to one element per line', (t) => {
  const source = svg('<rect width="1" height="1"/>', '<circle r="2"/>');
  const lines = reflowMarkup(source);

  t.assert.deepStrictEqual(lines, [
    '<svg xmlns="http://www.w3.org/2000/svg">',
    '<rect width="1" height="1"/>',
    '<circle r="2"/>',
    '</svg>',
  ]);
  // Nothing but the breaks it introduced: the pieces are the input again.
  t.assert.strictEqual(lines.join(''), source);
});

test('a pretty-printed side reflows to the same lines as a minified one', (t) => {
  const minified = svg('<rect width="1" height="1"/>');
  const pretty =
    '<svg xmlns="http://www.w3.org/2000/svg">\n    <rect width="1" height="1"/>\n</svg>\n';

  // The whole reason the reflow exists: without it, a pretty input against a
  // one-line output is "everything changed".
  t.assert.deepStrictEqual(reflowMarkup(pretty), reflowMarkup(minified));
});

test('identical markup is all context', (t) => {
  const source = svg('<rect width="1" height="1"/>');
  const parts = diffMarkup(source, source);

  t.assert.deepStrictEqual(types(parts), ['context']);
  t.assert.strictEqual(parts[0].text, reflowMarkup(source).join('\n'));
});

test('one changed line is one removal and one addition', (t) => {
  const parts = diffMarkup(
    svg('<rect width="1" height="1"/>', '<circle r="2"/>'),
    svg('<rect width="9" height="9"/>', '<circle r="2"/>'),
  );

  t.assert.deepStrictEqual(types(parts), [
    'context',
    'remove',
    'add',
    'context',
  ]);
  t.assert.strictEqual(textOf(parts, 'remove'), '<rect width="1" height="1"/>');
  t.assert.strictEqual(textOf(parts, 'add'), '<rect width="9" height="9"/>');
});

test('a pure insertion adds without removing', (t) => {
  const parts = diffMarkup(
    svg('<rect width="1" height="1"/>'),
    svg('<rect width="1" height="1"/>', '<circle r="2"/>'),
  );

  t.assert.strictEqual(types(parts).includes('remove'), false);
  t.assert.strictEqual(textOf(parts, 'add'), '<circle r="2"/>');
});

test('a pure deletion removes without adding', (t) => {
  const parts = diffMarkup(
    svg('<rect width="1" height="1"/>', '<circle r="2"/>'),
    svg('<rect width="1" height="1"/>'),
  );

  t.assert.strictEqual(types(parts).includes('add'), false);
  t.assert.strictEqual(textOf(parts, 'remove'), '<circle r="2"/>');
});

test('past the edit-length bound it degrades rather than refusing', (t) => {
  // Every middle line differs, so the edit distance is far past the bound and
  // jsdiff gives up. What comes back is coarse but true: the shared ends are
  // context, and the middle changed wholesale.
  const line = (index) => `<rect id="a${index}" width="${index}"/>`;
  const changed = (index) => `<circle id="b${index}" r="${index}"/>`;
  const count = MAX_EDIT_LENGTH * 2;
  const from = svg(...Array.from({ length: count }, (_, i) => line(i)));
  const to = svg(...Array.from({ length: count }, (_, i) => changed(i)));

  const parts = diffMarkup(from, to);

  t.assert.deepStrictEqual(types(parts), [
    'context',
    'remove',
    'add',
    'context',
  ]);
  // The trimmed context is intact at both ends: the root element and its close.
  t.assert.strictEqual(
    parts[0].text,
    '<svg xmlns="http://www.w3.org/2000/svg">',
  );
  t.assert.strictEqual(parts.at(-1).text, '</svg>');
  t.assert.strictEqual(parts[1].text.split('\n').length, count);
  t.assert.strictEqual(parts[2].text.split('\n').length, count);
});

test('the bail path keeps a common prefix and suffix out of the change', (t) => {
  const count = MAX_EDIT_LENGTH * 2;
  const shared = Array.from(
    { length: count },
    (_, index) => `<rect id="a${index}"/>`,
  );
  // Same head and tail, an entirely different middle.
  const from = svg(...shared, ...shared.map((_, i) => `<g id="from${i}"/>`));
  const to = svg(...shared, ...shared.map((_, i) => `<g id="to${i}"/>`));

  const parts = diffMarkup(from, to);
  const context = parts.find((part) => part.type === 'context');

  t.assert.deepStrictEqual(types(parts), [
    'context',
    'remove',
    'add',
    'context',
  ]);
  // The shared head survived as context rather than being reported as changed.
  t.assert.strictEqual(context.text.split('\n').length, count + 1);
});

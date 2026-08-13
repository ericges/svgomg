import test from 'node:test';
import { normalizeIdPrefix } from '../src/js/svgo-worker/id-prefix.js';

test('passes a safe prefix through, trimmed', (t) => {
  t.assert.strictEqual(normalizeIdPrefix('svgomg_'), 'svgomg_');
  t.assert.strictEqual(normalizeIdPrefix('  icon-  '), 'icon-');
  t.assert.strictEqual(normalizeIdPrefix('_x9'), '_x9');
});

test('rejects what an ID or a selector cannot carry', (t) => {
  // Deliberately ASCII-only: the prefix must survive both an `id` attribute
  // and the CSS selectors `prefixIds` rewrites, with no escaping anywhere.
  const rejected = ['1shape', '-x', 'a b', 'a.b', 'a#b', 'ä'].map((prefix) =>
    normalizeIdPrefix(prefix),
  );

  t.assert.deepStrictEqual(rejected, ['', '', '', '', '', '']);
});

test('nothing stored yet means no prefix', (t) => {
  t.assert.strictEqual(normalizeIdPrefix(undefined), '');
  t.assert.strictEqual(normalizeIdPrefix(''), '');
});

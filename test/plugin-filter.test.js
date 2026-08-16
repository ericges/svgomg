import test from 'node:test';
import { pluginMatches } from '../src/js/page/plugin-filter.js';

const plugin = { id: 'convertPathData', name: 'Round/rewrite paths' };

test('an empty query keeps everything', (t) => {
  t.assert.strictEqual(pluginMatches('', plugin), true);
  // Whitespace is not a query either — the field is trimmed before it decides,
  // so a stray space can't empty the panel.
  t.assert.strictEqual(pluginMatches(' '.repeat(3), plugin), true);
  t.assert.strictEqual(pluginMatches('\t\n', plugin), true);
});

test('the SVGO id matches, even when the display name would not', (t) => {
  // `PathData` appears in the id alone. Swapping the id out from under the
  // same name is what shows which of the two fields answered.
  t.assert.strictEqual(pluginMatches('convertPath', plugin), true);
  t.assert.strictEqual(pluginMatches('PathData', plugin), true);
  t.assert.strictEqual(
    pluginMatches('PathData', { id: 'mergePaths', name: plugin.name }),
    false,
  );
});

test('the display name matches, even when the id would not', (t) => {
  // And the mirror image: `rewrite` appears in the name alone.
  t.assert.strictEqual(pluginMatches('rewrite', plugin), true);
  t.assert.strictEqual(pluginMatches('Round', plugin), true);
  t.assert.strictEqual(
    pluginMatches('rewrite', { id: plugin.id, name: 'Merge paths' }),
    false,
  );
});

test('matching ignores case in both directions', (t) => {
  t.assert.strictEqual(pluginMatches('CONVERTPATHDATA', plugin), true);
  t.assert.strictEqual(pluginMatches('convertpathdata', plugin), true);
  t.assert.strictEqual(pluginMatches('ROUND/REWRITE', plugin), true);
});

test('surrounding whitespace is ignored, inner whitespace is not', (t) => {
  t.assert.strictEqual(pluginMatches('  paths  ', plugin), true);
  t.assert.strictEqual(pluginMatches('convert path', plugin), false);
});

test('a query in neither field matches nothing', (t) => {
  t.assert.strictEqual(pluginMatches('gzip', plugin), false);
  t.assert.strictEqual(pluginMatches('zzz', plugin), false);
});

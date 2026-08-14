import test from 'node:test';
import { collectNotes, settingNotes } from '../src/js/page/ui/setting-notes.js';
import { config, defaultPlugins, panelOrder } from './panel-order.js';

// The panel's own defaults, as `getSettings()` would hand them over.
const settingsFor = ({ plugins, ...overrides } = {}) => ({
  plugins: { ...defaultPlugins, ...plugins },
  multipass: false,
  pretty: false,
  original: false,
  gzip: true,
  floatPrecision: '3',
  transformPrecision: '5',
  dimensionAttrs: 'original',
  ids: 'minify',
  idPrefix: '',
  currentColor: false,
  ...overrides,
});

const NOTHING = { hasStyleElement: false, hasScripts: false, hasMask: false };
const STYLE = { ...NOTHING, hasStyleElement: true };
const SCRIPT = { ...NOTHING, hasScripts: true };
const MASK = { ...NOTHING, hasMask: true };

const names = (settings, facts) =>
  collectNotes(settings, facts).map((note) => note.name);

const textFor = (settings, facts, name) =>
  collectNotes(settings, facts).find((note) => note.name === name)?.text;

test('every rule points at a control the panel actually has', (t) => {
  // The `name` is how `Settings._renderNotes()` finds the row to sit under, so
  // a typo here is a notice that silently never appears.
  const pluginIds = new Set(config.plugins.map((plugin) => plugin.id));
  // The named controls that aren't plugins, from `index.njk`.
  const globalNames = new Set(['ids', 'idPrefix', 'currentColor']);

  t.assert.deepStrictEqual(
    settingNotes
      .map((rule) => rule.name)
      .filter((name) => !pluginIds.has(name) && !globalNames.has(name)),
    [],
    'rules naming a control that does not exist',
  );
});

test('a file with none of the three constructs says nothing', (t) => {
  t.assert.deepStrictEqual(names(settingsFor(), NOTHING), []);
});

test('nothing is said before a file has been read', (t) => {
  // The empty app: no facts, so no claims about a document there isn't one of.
  t.assert.deepStrictEqual(names(settingsFor(), undefined), []);
});

test('“Show original” silences everything', (t) => {
  // Nothing is being optimised, so no optimisation is being overruled.
  t.assert.deepStrictEqual(
    names(settingsFor({ original: true, currentColor: true }), {
      hasStyleElement: true,
      hasScripts: true,
      hasMask: true,
    }),
    [],
  );
});

test('a stylesheet that survived the pipeline deoptimises four controls', (t) => {
  t.assert.deepStrictEqual(names(settingsFor(), STYLE), [
    'ids',
    'removeUselessStrokeAndFill',
    'removeHiddenElems',
    'moveElemsAttrsToGroup',
  ]);

  // The flag is read off the *result* (`_updateDocumentFacts`), so no settings
  // condition rides on top of it. Whatever dissolved the stylesheet arrives
  // here as the fact being false — including the default Styles stage, which
  // clears it whenever every rule turned out to be inlinable and leaves it
  // whenever one didn't.
  t.assert.deepStrictEqual(names(settingsFor(), NOTHING), []);
  t.assert.deepStrictEqual(
    names(settingsFor({ plugins: { removeStyleElement: true } }), NOTHING),
    [],
  );
});

test('a script deoptimises four controls, one of them a different four', (t) => {
  // `moveElemsAttrsToGroup` guards on stylesheets only; `minifyStyles` on
  // scripts only. So neither document produces the same list.
  t.assert.deepStrictEqual(names(settingsFor(), SCRIPT), [
    'ids',
    'minifyStyles',
    'removeUselessStrokeAndFill',
    'removeHiddenElems',
  ]);
});

test('clearing scripts only helps on a second pass', (t) => {
  const withRemoval = settingsFor({ plugins: { removeScripts: true } });

  // `removeScripts` runs after every subject, so a single pass still sees the
  // script — the notice stands, and asks for the pass that would clear it.
  t.assert.deepStrictEqual(names(withRemoval, SCRIPT), [
    'ids',
    'minifyStyles',
    'removeUselessStrokeAndFill',
    'removeHiddenElems',
  ]);
  t.assert.match(
    textFor(withRemoval, SCRIPT, 'removeUselessStrokeAndFill'),
    /Multipass/,
  );
  t.assert.doesNotMatch(
    textFor(withRemoval, SCRIPT, 'removeUselessStrokeAndFill'),
    /Remove scripts/,
  );

  t.assert.deepStrictEqual(
    names({ ...withRemoval, multipass: true }, SCRIPT),
    [],
  );
  // Multipass alone changes nothing: every pass still finds the script.
  t.assert.strictEqual(
    names(settingsFor({ multipass: true }), SCRIPT).length,
    4,
  );
});

test('both constructs at once are named in one notice', (t) => {
  const facts = { ...NOTHING, hasStyleElement: true, hasScripts: true };
  const text = textFor(settingsFor(), facts, 'removeUselessStrokeAndFill');

  t.assert.match(text, /<style> element and a script/);
  t.assert.match(text, /Remove style elements.*Remove scripts/s);
});

test('currentColor is only mentioned when a mask makes it hold back', (t) => {
  t.assert.deepStrictEqual(names(settingsFor({ currentColor: true }), MASK), [
    'currentColor',
  ]);
  // The toggle off, or no mask: the conservative branch never runs.
  t.assert.deepStrictEqual(names(settingsFor(), MASK), []);
  t.assert.deepStrictEqual(
    names(settingsFor({ currentColor: true }), NOTHING),
    [],
  );
});

test('the IDs select is quiet on “Keep as they are”', (t) => {
  // Nothing to deoptimise: `cleanupIds` isn't in the pipeline at all.
  t.assert.strictEqual(
    names(settingsFor({ ids: 'keep' }), STYLE).includes('ids'),
    false,
  );
  t.assert.strictEqual(
    names(settingsFor({ ids: 'removeUnused' }), STYLE).includes('ids'),
    true,
  );
});

test('a rejected ID prefix is explained, whatever the file contains', (t) => {
  // The one rule that needs no document facts — the prefix is either usable by
  // `prefixIds` or it is dropped.
  t.assert.deepStrictEqual(names(settingsFor({ idPrefix: '1abc' }), NOTHING), [
    'idPrefix',
  ]);
  t.assert.deepStrictEqual(names(settingsFor({ idPrefix: 'a b' }), NOTHING), [
    'idPrefix',
  ]);
  t.assert.deepStrictEqual(
    names(settingsFor({ idPrefix: 'svgomg_' }), NOTHING),
    [],
  );
  t.assert.deepStrictEqual(names(settingsFor({ idPrefix: '  ' }), NOTHING), []);
});

test('the order the messages assume is the order the panel produces', (t) => {
  // Both neutralising conditions in `liveCauses()` are claims about pipeline
  // order, and the pipeline is the panel's DOM order. Moving a checkbox between
  // blocks would leave the messages advising a fix that no longer works.
  const at = (id) => panelOrder.indexOf(id);
  const subjects = [
    // `cleanupIds` has no checkbox; `buildPlugins` inserts it at this entry.
    'removeRasterImages',
    'removeUselessStrokeAndFill',
    'removeHiddenElems',
    'moveElemsAttrsToGroup',
  ];

  t.assert.deepStrictEqual(
    subjects.filter((subject) => at('removeStyleElement') > at(subject)),
    [],
    'subjects `removeStyleElement` no longer runs before',
  );
  t.assert.deepStrictEqual(
    subjects.filter((subject) => at('removeScripts') < at(subject)),
    [],
    'subjects `removeScripts` no longer runs after',
  );

  // `minifyStyles` is the one subject in the Styles block, ahead of the control
  // that would clear the stylesheet — which is why its rule ignores that half.
  t.assert.ok(at('minifyStyles') < at('removeStyleElement'));
  t.assert.ok(at('minifyStyles') < at('removeScripts'));
});

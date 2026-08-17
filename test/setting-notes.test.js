import test from 'node:test';
import { collectNotes, settingNotes } from '../src/js/page/ui/setting-notes.js';
import { config, panelOrder, panelSettings } from './panel-order.js';

// The rules in isolation: hand-written snapshots stand in for the probes, so
// this file is about what each guard *makes of* a document. That the snapshots
// themselves are true — and that each rule's reading matches the installed
// SVGO — is `test/collision-probes.test.js`.
const nothing = {
  hasStyleElement: false,
  hasFilledStyleElement: false,
  hasScripts: false,
  hasMask: false,
  hasIds: true,
  isDefsOnlyRoot: false,
  hasNonRenderingElement: true,
  hasMultiChildGroup: true,
  hasStyleRules: false,
  hasConvertibleStylesheet: false,
};

const EMPTY_STYLE = { ...nothing, hasStyleElement: true };
// A stylesheet with something in it: children, at least one rule, and a colour
// the currentColor pass would have rewritten. The three are separate facts —
// `<style>/* a comment */</style>` has the first and neither of the others.
const STYLE = {
  ...nothing,
  hasStyleElement: true,
  hasFilledStyleElement: true,
  hasStyleRules: true,
  hasConvertibleStylesheet: true,
};
const SCRIPT = { ...nothing, hasScripts: true };
const MASK = { ...STYLE, hasMask: true };

// Every subject saw the same document — the usual case, since the constructs
// these guards trip over are rarely removed mid-pipeline.
const everywhere = (snapshot) =>
  Object.fromEntries(
    settingNotes
      .filter((rule) => rule.subject)
      .map((rule) => [rule.subject, snapshot]),
  );

const names = (settings, collisions) =>
  collectNotes(settings, collisions).map((note) => note.name);

const textFor = (settings, collisions, name) =>
  collectNotes(settings, collisions).find((note) => note.name === name)?.text;

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

test('a document with none of the three constructs says nothing', (t) => {
  t.assert.deepStrictEqual(names(panelSettings(), everywhere(nothing)), []);
});

test('nothing is said before the first file has been optimised', (t) => {
  // The empty app: no plugin has run, so no claims about what one of them saw.
  t.assert.deepStrictEqual(names(panelSettings(), undefined), []);
  // Nor about a plugin that isn't in the pipeline at all — "Keep as they are"
  // leaves `cleanupIds` out, so it gets no probe and no notice.
  t.assert.strictEqual(
    names(panelSettings({ ids: 'keep' }), {}).includes('ids'),
    false,
  );
});

test('“Show original” silences everything', (t) => {
  // Nothing is being optimised, so no optimisation is being overruled.
  t.assert.deepStrictEqual(
    names(
      panelSettings({ original: true, currentColor: true }),
      everywhere(MASK),
    ),
    [],
  );
});

test('a stylesheet with rules deoptimises four controls', (t) => {
  t.assert.deepStrictEqual(names(panelSettings(), everywhere(STYLE)), [
    'ids',
    'removeUselessStrokeAndFill',
    'removeHiddenElems',
    'moveElemsAttrsToGroup',
  ]);
});

test('an empty <style> only stops the two plugins it really stops', (t) => {
  // `cleanupIds` and `removeHiddenElems` want a stylesheet with children in
  // it; the other two bail on the element itself. Reporting all four was this
  // feature's first bug: SVGO minified the IDs while the panel said it hadn't.
  t.assert.deepStrictEqual(names(panelSettings(), everywhere(EMPTY_STYLE)), [
    'removeUselessStrokeAndFill',
    'moveElemsAttrsToGroup',
  ]);
});

test('a script deoptimises four controls, one of them a different four', (t) => {
  // `moveElemsAttrsToGroup` guards on stylesheets only; `minifyStyles` on
  // scripts only. So neither document produces the same list.
  t.assert.deepStrictEqual(
    names(
      panelSettings(),
      everywhere({
        ...SCRIPT,
        hasFilledStyleElement: true,
        hasStyleRules: true,
      }),
    ),
    ['ids', 'minifyStyles', 'removeUselessStrokeAndFill', 'removeHiddenElems'],
  );

  // Without a stylesheet there are no rules for `minifyStyles` to have kept.
  t.assert.deepStrictEqual(names(panelSettings(), everywhere(SCRIPT)), [
    'ids',
    'removeUselessStrokeAndFill',
    'removeHiddenElems',
  ]);
});

test('switching a subject off clears its notice without waiting for a run', (t) => {
  // The report still describes a pipeline that ran the plugin, so each rule
  // re-reads its own control rather than trusting the probe's presence.
  t.assert.deepStrictEqual(
    names(
      panelSettings({
        ids: 'keep',
        plugins: {
          minifyStyles: false,
          removeUselessStrokeAndFill: false,
          removeHiddenElems: false,
          moveElemsAttrsToGroup: false,
        },
      }),
      everywhere({ ...STYLE, hasScripts: true }),
    ),
    [],
  );
});

test('a stylesheet of nothing but a comment prunes nothing and says nothing', (t) => {
  // `hasFilledStyleElement` means "has children", which is what SVGO's own
  // guards test — but it is not evidence that `minifyStyles` had a rule whose
  // pruning was disabled, and SVGO removes such a stylesheet outright.
  const commentOnly = {
    ...nothing,
    hasScripts: true,
    hasStyleElement: true,
    hasFilledStyleElement: true,
  };

  t.assert.strictEqual(
    names(panelSettings(), everywhere(commentOnly)).includes('minifyStyles'),
    false,
  );
  t.assert.strictEqual(
    names(
      panelSettings(),
      everywhere({ ...commentOnly, hasStyleRules: true }),
    ).includes('minifyStyles'),
    true,
  );
});

test('a subject with nothing to work on is not reported', (t) => {
  const barren = {
    ...STYLE,
    hasIds: false,
    hasNonRenderingElement: false,
    hasMultiChildGroup: false,
  };

  // `removeUselessStrokeAndFill` is the exception on purpose: it returns
  // nothing at all, so "doing nothing" is true of the whole document.
  t.assert.deepStrictEqual(names(panelSettings(), everywhere(barren)), [
    'removeUselessStrokeAndFill',
  ]);
});

test('a defs-only document is reported whatever else is going on', (t) => {
  const defsOnly = { ...nothing, isDefsOnlyRoot: true };

  t.assert.match(
    textFor(panelSettings(), everywhere(defsOnly), 'ids'),
    /nothing but <defs>/,
  );
});

test('the notices anticipate a fix the result hasn’t caught up with yet', (t) => {
  // The snapshots describe the *last* optimisation, and the panel re-renders
  // the moment a control moves. Without this the notices would go on advising
  // the option the user just picked until the worker came back.
  t.assert.deepStrictEqual(
    names(
      panelSettings({ plugins: { removeStyleElement: true } }),
      everywhere(STYLE),
    ),
    [],
  );

  // `minifyStyles` is the exception: it runs *before* `removeStyleElement`, so
  // that choice never reaches it.
  t.assert.deepStrictEqual(
    names(
      panelSettings({
        plugins: { removeStyleElement: true },
      }),
      everywhere({ ...STYLE, hasScripts: true }),
    ),
    ['ids', 'minifyStyles', 'removeUselessStrokeAndFill', 'removeHiddenElems'],
  );
});

test('clearing scripts only helps on a second pass', (t) => {
  const withRemoval = panelSettings({ plugins: { removeScripts: true } });

  // `removeScripts` runs after every subject, so a single pass still sees the
  // script — the notice stands, and asks for the pass that would clear it.
  t.assert.deepStrictEqual(names(withRemoval, everywhere(SCRIPT)), [
    'ids',
    'removeUselessStrokeAndFill',
    'removeHiddenElems',
  ]);
  t.assert.match(
    textFor(withRemoval, everywhere(SCRIPT), 'removeUselessStrokeAndFill'),
    /Multipass/,
  );
  t.assert.doesNotMatch(
    textFor(withRemoval, everywhere(SCRIPT), 'removeUselessStrokeAndFill'),
    /Remove scripts/,
  );

  t.assert.deepStrictEqual(
    names({ ...withRemoval, multipass: true }, everywhere(SCRIPT)),
    [],
  );
  // Multipass alone changes nothing: every pass still finds the script.
  t.assert.strictEqual(
    names(panelSettings({ multipass: true }), everywhere(SCRIPT)).length,
    3,
  );
});

test('both constructs at once are named in one notice', (t) => {
  const facts = everywhere({ ...STYLE, hasScripts: true });
  const text = textFor(panelSettings(), facts, 'removeUselessStrokeAndFill');

  t.assert.match(text, /<style> element and a script/);
  t.assert.match(text, /Remove style elements.*Remove scripts/s);
});

test('currentColor is only mentioned when a mask makes it hold back', (t) => {
  t.assert.strictEqual(
    names(panelSettings({ currentColor: true }), everywhere(MASK)).includes(
      'currentColor',
    ),
    true,
  );
  // The toggle off, or no mask: the conservative branch never runs.
  t.assert.strictEqual(
    names(panelSettings(), everywhere(MASK)).includes('currentColor'),
    false,
  );
  t.assert.strictEqual(
    names(panelSettings({ currentColor: true }), everywhere(STYLE)).includes(
      'currentColor',
    ),
    false,
  );
  // A mask but no stylesheet: nothing was held back.
  t.assert.strictEqual(
    names(
      panelSettings({ currentColor: true }),
      everywhere({ ...nothing, hasMask: true }),
    ).includes('currentColor'),
    false,
  );
  // A stylesheet with no colour in it: likewise nothing was held back, which
  // takes the same predicate the pass rewrites by to know.
  t.assert.strictEqual(
    names(
      panelSettings({ currentColor: true }),
      everywhere({ ...MASK, hasConvertibleStylesheet: false }),
    ).includes('currentColor'),
    false,
  );
});

test('a rejected ID prefix is explained, whatever the file contains', (t) => {
  // The one rule that reads no snapshot — the prefix is either usable by
  // `prefixIds` or it is dropped, so it holds before the first result too.
  t.assert.deepStrictEqual(
    names(panelSettings({ idPrefix: '1abc' }), undefined),
    ['idPrefix'],
  );
  t.assert.deepStrictEqual(
    names(panelSettings({ idPrefix: 'a b' }), undefined),
    ['idPrefix'],
  );
  t.assert.deepStrictEqual(
    names(panelSettings({ idPrefix: 'omsvg_' }), undefined),
    [],
  );
  t.assert.deepStrictEqual(
    names(panelSettings({ idPrefix: '  ' }), undefined),
    [],
  );
});

test('the order the messages assume is the order the pipeline runs', (t) => {
  // Both anticipating conditions are claims about pipeline order, and the
  // pipeline is `config.json`'s array order (`panelOrder` re-exports it from
  // `plugin-order.js`). Reordering the config would leave the messages
  // advising a fix that no longer works.
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

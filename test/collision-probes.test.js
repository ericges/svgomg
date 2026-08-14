import test from 'node:test';
import { optimize } from 'svgo';
// Reached by path, not by package name: `_collections.js` is not in svgo's
// `exports` map, and that is the point — nothing ships this import, it exists
// so the copies below fail loudly the day the originals change.
import {
  attrsGroups,
  elemsGroups,
} from '../node_modules/svgo/plugins/_collections.js';
import {
  collisionSubjects,
  nonRenderingElements,
  scriptEventAttributes,
  withCollisionProbes,
} from '../src/js/svgo-worker/collision-probes.js';
import { buildPlugins } from '../src/js/svgo-worker/build-plugins.js';
import { collectNotes, settingNotes } from '../src/js/page/ui/setting-notes.js';
import { stylesStages } from '../src/js/page/ui/setting-stages.js';
import { panelSettings, readSource } from './panel-order.js';

const wrap = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">${inner}</svg>`;

// The whole app pipeline for one set of settings, plus the notices the panel
// would show for its result. Every assertion below compares the two: a notice
// is only true if the output really does contain what it claims was kept.
const run = (svg, overrides = {}) => {
  const settings = panelSettings(overrides);
  const [collisions, plugins] = withCollisionProbes(buildPlugins(settings));
  const { data, error } = optimize(svg, {
    multipass: settings.multipass,
    plugins,
  });

  if (error) throw new Error(error);

  const notes = collectNotes(settings, collisions);

  return {
    data,
    collisions,
    notes,
    noteFor: (name) => notes.find((note) => note.name === name)?.text,
  };
};

const withStyles = (stage, overrides = {}) => ({
  ...overrides,
  plugins: { ...stylesStages[stage], ...overrides.plugins },
});

// One probe over an untouched document, for the flag-level checks. Read back
// out of the module's own behaviour rather than by importing the lists, so the
// test can't drift from them by checking a copy nothing uses.
const probeOnly = (svg) => {
  const [report, plugins] = withCollisionProbes([
    { name: 'removeHiddenElems', params: {} },
  ]);
  const { error } = optimize(svg, { plugins });

  if (error) throw new Error(error);

  return report.removeHiddenElems;
};

test('the copied event-attribute list is still SVGO’s', (t) => {
  // `hasScripts()` is mirrored rather than imported, so this is the seam that
  // rots. A `startsWith("on")` shortcut would pass a test like this and still
  // be wrong: `oncustom` is not an event attribute (see below).
  const svgo = new Set(
    [
      'animationEvent',
      'documentEvent',
      'documentElementEvent',
      'globalEvent',
      'graphicalEvent',
    ].flatMap((group) => [...attrsGroups[group]]),
  );
  // Set equality, both directions: a one-sided check would pass on a copy that
  // had grown an extra name, which is the mistake the prefix shortcut was.
  const alphabetical = (a, b) => a.localeCompare(b);

  t.assert.deepStrictEqual(
    [...scriptEventAttributes].toSorted(alphabetical),
    [...svgo].toSorted(alphabetical),
  );

  // And the copy is really the one the probe consults.
  const unrecognised = [...svgo].filter(
    (attribute) => !probeOnly(wrap(`<rect ${attribute}="x"/>`)).hasScripts,
  );

  t.assert.deepStrictEqual(unrecognised, []);
  t.assert.strictEqual(
    probeOnly(wrap('<rect oncustom="x"/>')).hasScripts,
    false,
    'an attribute SVGO does not recognise must not count as a script',
  );
});

test('the copied non-rendering element list is still SVGO’s', (t) => {
  const alphabetical = (a, b) => a.localeCompare(b);

  t.assert.deepStrictEqual(
    [...nonRenderingElements].toSorted(alphabetical),
    [...elemsGroups.nonRendering].toSorted(alphabetical),
  );

  const missing = [...elemsGroups.nonRendering].filter(
    (name) => !probeOnly(wrap(`<${name} id="x"/>`)).hasNonRenderingElement,
  );

  t.assert.deepStrictEqual(missing, []);
});

test('every rule names a plugin a probe can be placed in front of', (t) => {
  t.assert.deepStrictEqual(
    settingNotes
      .map((rule) => rule.subject)
      .filter((subject) => subject && !collisionSubjects.includes(subject)),
    [],
    'rules whose subject gets no probe, so whose notice can never appear',
  );
});

test('an empty <style> stops one pair of plugins and not the other', (t) => {
  // The distinction the flags exist for. `cleanupIds` and `removeHiddenElems`
  // want a `<style>` with rules in it; `removeUselessStrokeAndFill` and
  // `moveElemsAttrsToGroup` stop at the element itself.
  const empty = run(
    wrap(
      '<style></style><rect id="longId" width="4" height="4"/><use href="#longId"/><mask id="m"><rect width="1" height="1"/></mask><rect fill="none" stroke="red" stroke-width="0" width="4" height="4"/>',
    ),
    withStyles('keep'),
  );

  // Really minified, and the unreferenced mask really was swept up — notices
  // saying otherwise would be false.
  t.assert.match(empty.data, /id="a"/);
  t.assert.doesNotMatch(empty.data, /<mask/);
  t.assert.strictEqual(empty.noteFor('ids'), undefined);
  t.assert.strictEqual(empty.noteFor('removeHiddenElems'), undefined);

  // Really did nothing: the zero-width stroke is still there.
  t.assert.match(empty.data, /stroke="red"/);
  t.assert.match(empty.noteFor('removeUselessStrokeAndFill'), /Doing nothing/);

  const filled = run(
    wrap(
      '<style>.a{fill:red}</style><rect id="longId" width="4" height="4"/><use href="#longId"/>',
    ),
    withStyles('keep'),
  );

  t.assert.match(filled.data, /id="longId"/);
  t.assert.match(filled.noteFor('ids'), /IDs are left as they are/);
});

test('an attribute SVGO does not treat as a script raises nothing', (t) => {
  const custom = run(
    wrap(
      '<rect id="longId" oncustom="x" width="1" height="1"/><use href="#longId"/>',
    ),
  );

  t.assert.match(custom.data, /id="a"/);
  t.assert.strictEqual(custom.noteFor('ids'), undefined);

  const real = run(
    wrap(
      '<rect id="longId" onclick="x" width="1" height="1"/><use href="#longId"/>',
    ),
  );

  t.assert.match(real.data, /id="longId"/);
  t.assert.match(real.noteFor('ids'), /a script/);
});

test('a script an earlier plugin carried away is not reported', (t) => {
  // The reason the evidence is gathered where each plugin runs: the metadata
  // stage removes `<metadata>` — and anything inside it — long before every
  // plugin that would have backed off for a script.
  const buried = run(
    wrap(
      '<metadata><script>x</script></metadata><rect id="longId" width="1" height="1"/><use href="#longId"/>',
    ),
  );

  t.assert.doesNotMatch(buried.data, /script/);
  t.assert.match(buried.data, /id="a"/);
  t.assert.deepStrictEqual(buried.notes, []);

  // The same script where nothing removes it.
  const loose = run(
    wrap(
      '<script>x</script><rect id="longId" width="1" height="1"/><use href="#longId"/>',
    ),
  );

  t.assert.match(loose.data, /id="longId"/);
  t.assert.match(loose.noteFor('ids'), /a script/);
});

test('a mask an earlier plugin dropped does not hold back currentColor', (t) => {
  // `removeUselessDefs` removes an unreferenced `<mask>` before
  // `current-color-styles` ever sees it, so the stylesheet does convert.
  const dropped = run(
    wrap(
      '<style>.x{fill:red}</style><defs><mask><rect width="1" height="1"/></mask></defs><rect class="x" width="1" height="1"/>',
    ),
    withStyles('keep', { currentColor: true }),
  );

  t.assert.match(dropped.data, /fill:currentColor/);
  t.assert.strictEqual(dropped.noteFor('currentColor'), undefined);

  // Referenced, so it survives — and the stylesheet is left alone.
  const kept = run(
    wrap(
      '<style>.x{fill:red}</style><defs><mask id="m"><rect width="1" height="1"/></mask></defs><rect class="x" mask="url(#m)" width="1" height="1"/>',
    ),
    withStyles('keep', { currentColor: true }),
  );

  t.assert.match(kept.data, /fill:red/);
  t.assert.match(kept.noteFor('currentColor'), /<mask>/);
});

test('currentColor says nothing about stylesheets a document hasn’t got', (t) => {
  const maskOnly = run(
    wrap(
      '<defs><mask id="m"><rect width="1" height="1"/></mask></defs><rect fill="red" mask="url(#m)" width="1" height="1"/>',
    ),
    { currentColor: true },
  );

  t.assert.match(maskOnly.data, /currentColor/);
  t.assert.strictEqual(maskOnly.noteFor('currentColor'), undefined);
});

test('minifyStyles says nothing about rules a document hasn’t got', (t) => {
  const scriptOnly = run(
    wrap('<script>x</script><rect fill="red" width="1" height="1"/>'),
  );

  t.assert.strictEqual(scriptOnly.noteFor('minifyStyles'), undefined);

  const withRules = run(
    wrap(
      '<style>.a{fill:red}.unused{fill:blue}</style><script>x</script><rect class="a" width="1" height="1"/>',
    ),
    withStyles('minify'),
  );

  // The unused rule really is still there, which is what the notice claims.
  t.assert.match(withRules.data, /\.unused/);
  t.assert.match(withRules.noteFor('minifyStyles'), /without the usage check/);
});

test('a stylesheet of nothing but a comment is not a stylesheet with rules', (t) => {
  // A `<style>` with a child but no rule: SVGO's guards count the child, and
  // nothing was pruned because there was nothing to prune.
  const commentOnly = run(
    wrap(
      '<style>/* only a comment */</style><script>x</script><rect width="1" height="1"/>',
    ),
    withStyles('minify'),
  );

  t.assert.doesNotMatch(commentOnly.data, /<style/);
  t.assert.strictEqual(commentOnly.noteFor('minifyStyles'), undefined);
});

test('currentColor is quiet about a stylesheet holding no colour', (t) => {
  const noColours = run(
    wrap(
      '<style>.x{stroke-width:2}</style><defs><mask id="m"><rect width="1" height="1"/></mask></defs><rect class="x" mask="url(#m)" fill="red" width="1" height="1"/>',
    ),
    withStyles('keep', { currentColor: true }),
  );

  // The rule survives untouched either way, so nothing was held back.
  t.assert.match(noColours.data, /stroke-width:2/);
  t.assert.strictEqual(noColours.noteFor('currentColor'), undefined);
});

test('removeHiddenElems is only reported for the step that stops', (t) => {
  const both = run(
    wrap(
      '<style>.a{fill:red}</style><rect width="0" height="10"/><mask id="m"><rect width="1" height="1"/></mask>',
    ),
    withStyles('keep'),
  );

  // The zero-sized rectangle goes either way; the definition stays.
  t.assert.doesNotMatch(both.data, /<rect width="0"/);
  t.assert.match(both.data, /<mask/);
  t.assert.match(both.noteFor('removeHiddenElems'), /last step is skipped/);
  t.assert.match(both.noteFor('removeHiddenElems'), /Zero-sized/);

  // Nothing the sweep would have looked at: no claim to make.
  const nothingDeferred = run(
    wrap('<style>.a{fill:red}</style><rect width="0" height="10"/>'),
    withStyles('keep'),
  );

  t.assert.doesNotMatch(nothingDeferred.data, /<rect/);
  t.assert.strictEqual(nothingDeferred.noteFor('removeHiddenElems'), undefined);
});

test('removeHiddenElems claims nothing about what would have been removed', (t) => {
  // A referenced `<mask>` is kept whether or not the guard fires, so a notice
  // calling it an unused definition kept *by the collision* would be false.
  // What is true, and all the message says, is that the reference check itself
  // is skipped.
  const referenced = run(
    wrap(
      '<style>.x{fill:red}</style><defs><mask id="m"><rect width="1" height="1"/></mask></defs><rect mask="url(#m)" width="1" height="1"/>',
    ),
    withStyles('keep'),
  );
  const note = referenced.noteFor('removeHiddenElems');

  t.assert.match(referenced.data, /<mask/);
  t.assert.match(note, /stops working out whether anything still refers/);
  t.assert.doesNotMatch(note, /unused/);

  // The other half of the retired guess: CSS takes the last declaration, so
  // this path is opaque and was never a candidate. Nothing claims it was.
  const opaque = run(
    wrap(
      '<style>.x{fill:red}</style><path style="opacity:0;opacity:1" d="M0 0h1"/>',
    ),
    withStyles('keep'),
  );

  t.assert.match(opaque.data, /opacity:1/);
  t.assert.strictEqual(opaque.noteFor('removeHiddenElems'), undefined);
});

test('a defs-only document is reported even with no stylesheet in sight', (t) => {
  const defsOnly = run(
    wrap('<defs><rect id="longId" width="1" height="1"/></defs>'),
  );

  t.assert.match(defsOnly.data, /id="longId"/);
  t.assert.match(defsOnly.noteFor('ids'), /nothing but <defs>/);
});

test('a document with no IDs is told nothing about IDs', (t) => {
  const noIds = run(
    wrap('<style>.a{fill:red}</style><rect width="1" height="1"/>'),
    withStyles('keep'),
  );

  t.assert.strictEqual(noIds.noteFor('ids'), undefined);
});

test('moveElemsAttrsToGroup needs a group worth moving anything out of', (t) => {
  const grouped = run(
    wrap(
      '<style>.a{fill:red}</style><g><path fill="red" d="M0 0h1"/><path fill="red" d="M2 0h1"/></g>',
    ),
    withStyles('keep'),
  );

  t.assert.match(
    grouped.noteFor('moveElemsAttrsToGroup'),
    /Skipping every group/,
  );
  // Whether the children shared anything liftable is the plugin's comparison,
  // not a claim the notice makes.
  t.assert.doesNotMatch(
    grouped.noteFor('moveElemsAttrsToGroup'),
    /attributes it would move/,
  );

  const ungrouped = run(
    wrap('<style>.a{fill:red}</style><path fill="red" d="M0 0h1"/>'),
    withStyles('keep'),
  );

  t.assert.strictEqual(ungrouped.noteFor('moveElemsAttrsToGroup'), undefined);
});

test('multipass reports the last pass, not any pass', async (t) => {
  // Without the per-pass reset the snapshots would mean "seen at some point",
  // and a script cleared on pass one would still be reported to a panel whose
  // plugins ran on pass two without it.
  const kitchenSink = await readSource('test-svgs/kitchen-sink.svg');
  const cleared = run(kitchenSink, {
    multipass: true,
    plugins: { ...stylesStages.remove, removeScripts: true },
  });

  t.assert.deepStrictEqual(cleared.notes, []);

  const single = run(kitchenSink, {
    plugins: { ...stylesStages.remove, removeScripts: true },
  });

  // One pass: `removeScripts` runs after every subject, so the script is still
  // there for all of them and the notices say so.
  t.assert.deepStrictEqual(
    single.notes.map((note) => note.name),
    ['ids', 'removeUselessStrokeAndFill', 'removeHiddenElems'],
  );
});

test('the demo the app ships as its default collides with nothing', async (t) => {
  // The other half of the gate: on ordinary artwork the panel stays silent.
  const carLite = run(await readSource('test-svgs/car-lite.svg'));

  t.assert.deepStrictEqual(carLite.notes, []);
});

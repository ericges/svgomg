import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { optimize } from 'svgo';
import { buildPlugins } from '../src/js/svgo-worker/build-plugins.js';

// `src/test-svgs/kitchen-sink.svg` is the one fixture authored to give every
// exposed optimisation something to do. These assertions read the source tree,
// not `build/`, so unlike the smoke test they need no build.
const repoRoot = path.join(import.meta.dirname, '..');

const readSource = (relativePath) =>
  fs.readFile(path.join(repoRoot, 'src', relativePath), 'utf8');

const fixture = await readSource('test-svgs/kitchen-sink.svg');
const config = JSON.parse(await readSource('config.json'));

// The defaults keep every checkbox out of the way, exactly as in
// `test/build-plugins.test.js`; each test opts into what it's about.
const compress = (overrides = {}) => {
  const settings = {
    floatPrecision: '3',
    transformPrecision: '5',
    ids: 'keep',
    idPrefix: '',
    currentColor: false,
    plugins: {},
    ...overrides,
  };

  return optimize(fixture, {
    plugins: buildPlugins(settings),
    multipass: Boolean(settings.multipass),
  }).data;
};

// `removeUselessStrokeAndFill` and `moveElemsAttrsToGroup` refuse to run at all
// while a <style> element or a script is in the document — a stylesheet or an
// event handler could be supplying the very fill they'd remove. This fixture
// has both on purpose (something has to cover `removeStyleElement` and
// `removeScripts`), so these two are measured against a document those plugins
// have already been cleared out of. That deoptimisation is why the panel runs
// `removeStyleElement` tenth; see the plugin-order note in CLAUDE.md.
const styleDeoptimised = new Set([
  'removeUselessStrokeAndFill',
  'moveElemsAttrsToGroup',
]);
const cleared = { removeStyleElement: true, removeScripts: true };

// `buildPlugins` iterates the `plugins` object's own entries, so a plugin left
// out of it never runs — an absent key is not the same as `false`.
const allPlugins = Object.fromEntries(
  config.plugins.map(({ id }) => [id, true]),
);
const defaultPlugins = Object.fromEntries(
  config.plugins.map(({ id, enabledByDefault }) => [
    id,
    Boolean(enabledByDefault),
  ]),
);

test('every configured plugin changes the kitchen-sink fixture', (t) => {
  // The point of the fixture. Each plugin runs alone and is compared against a
  // run of nothing at all — both go through SVGO's parse/stringify, so the only
  // difference is that one plugin. Anything listed here has quietly stopped
  // being covered: either the fixture lost the construct it acted on, or SVGO
  // changed what the plugin does.
  const baselines = {
    plain: compress(),
    cleared: compress({ plugins: cleared }),
  };

  const inert = config.plugins
    .map(({ id }) => id)
    .filter((id) => {
      const isDeoptimised = styleDeoptimised.has(id);
      const data = compress({
        plugins: isDeoptimised ? { ...cleared, [id]: true } : { [id]: true },
      });
      return data === baselines[isDeoptimised ? 'cleared' : 'plain'];
    });

  t.assert.deepStrictEqual(
    inert,
    [],
    'plugins the fixture no longer gives anything to do',
  );
});

test('the two style-deoptimised plugins really are deoptimised', (t) => {
  // Pins the reason the test above needs its exception, so that if SVGO ever
  // drops the bail-out the exception gets deleted rather than quietly kept.
  const untouched = compress();
  const acted = [...styleDeoptimised].filter(
    (id) => compress({ plugins: { [id]: true } }) !== untouched,
  );

  t.assert.deepStrictEqual(
    acted,
    [],
    'plugins that acted despite the <style> and <script> still being there — drop them from `styleDeoptimised`',
  );
});

test('every combination of the grouped controls yields usable markup', (t) => {
  // The four selects and toggles multiply out to combinations no single hand
  // test covers, and the fixture is the widest input in the repo. Nothing here
  // pins SVGO's output — it checks the pipeline survives the whole matrix.
  const combinations = ['original', 'viewBox', 'widthHeight', 'both'].flatMap(
    (dimensionAttrs) =>
      ['keep', 'minify', 'removeUnused'].flatMap((ids) =>
        [false, true].flatMap((currentColor) =>
          [false, true].map((multipass) => ({
            dimensionAttrs,
            ids,
            currentColor,
            multipass,
          })),
        ),
      ),
  );

  const broken = combinations.filter((combination) => {
    const data = compress({
      ...combination,
      idPrefix: 'ks_',
      plugins: allPlugins,
    });
    // A preserved `<!--!` banner comment legitimately precedes the root, so
    // this looks for the element rather than the start of the string.
    return !/<svg[\s>]/.test(data) || /<parsererror/.test(data);
  });

  t.assert.deepStrictEqual(
    broken,
    [],
    'control combinations that produced unusable markup',
  );
});

test('the four dimension modes each write different root attributes', (t) => {
  // The fixture carries `width`/`height` in `px` *and* a `viewBox`, which is
  // the only shape that tells all four modes apart. The `px` is why this runs
  // the default checkbox set rather than none: neither `removeDimensions` nor
  // `removeViewBox` can parse a unit, so both lean on `cleanupNumericValues`
  // having stripped it earlier in the array — and `ensure-dimensions` covers
  // the case where it hasn't.
  const root = (dimensionAttrs) =>
    /<svg[^>]*>/.exec(compress({ dimensionAttrs, plugins: defaultPlugins }))[0];

  t.assert.match(root('original'), /width="480"/);
  t.assert.match(root('original'), /viewBox="0 0 480 360"/);

  t.assert.doesNotMatch(root('viewBox'), /\swidth=/);
  t.assert.match(root('viewBox'), /viewBox="0 0 480 360"/);

  t.assert.match(root('widthHeight'), /width="480"/);
  t.assert.doesNotMatch(root('widthHeight'), /\sviewBox=/);

  t.assert.match(root('both'), /width="480"/);
  t.assert.match(root('both'), /viewBox="0 0 480 360"/);
});

test('currentColor stops at the edge of the mask', (t) => {
  // `current-color-styles.js` leaves every stylesheet alone once a <mask>
  // exists anywhere in the document, because a rule could select into it. The
  // fixture has to contain a mask, so this is the branch it demonstrates —
  // `test/build-plugins.test.js` covers the converting branch on mask-free
  // input. Keep both, or the conservative path stops being exercised.
  //
  // `convertColors` is listed but off, which is the colour-swap-only path: the
  // toggle converts to currentColor without also minifying the colours.
  const data = compress({
    currentColor: true,
    plugins: { convertColors: false },
  });

  t.assert.match(
    data,
    /fill="currentColor"/,
    'no attribute colour was converted at all',
  );

  const mask = /<mask id="ks-mask">[\s\S]*?<\/mask>/.exec(data);
  t.assert.ok(mask, 'the fixture no longer carries a <mask id="ks-mask">');
  t.assert.doesNotMatch(
    mask[0],
    /currentColor/,
    'currentColor leaked into the mask, which would break it',
  );
  t.assert.match(mask[0], /#ffffff/, 'the mask lost its literal white');

  const stylesheets = data
    .matchAll(/<style[^>]*>(?<css>[\s\S]*?)<\/style>/g)
    .map((match) => match.groups.css)
    .toArray();

  t.assert.ok(stylesheets.length > 0, 'the fixture lost its stylesheets');
  t.assert.deepStrictEqual(
    stylesheets.filter((css) => css.includes('currentColor')),
    [],
    'stylesheets rewritten despite the document containing a mask',
  );
});

test('idPrefix leaves every internal reference resolvable', (t) => {
  // `prefixIds` has to rewrite the definitions and the things pointing at them
  // together. The fixture references ids through `url(#…)`, `href` and
  // `xlink:href`, from a <use>, a <textPath> and an <mpath> — so a mode
  // `prefixIds` misses shows up here as a dangling reference.
  const data = compress({ idPrefix: 'ks_', plugins: allPlugins });

  const ids = new Set(
    data.matchAll(/\bid="(?<id>[^"]+)"/g).map((match) => match.groups.id),
  );
  const references = new Set(
    data
      .matchAll(/(?:url\(#|(?:xlink:)?href=")#?(?<id>[^")]+)/g)
      .map((match) => match.groups.id)
      // `<a xlink:href="https://…">` points outside the document.
      .filter((id) => !id.includes(':') && !id.includes('/')),
  );

  t.assert.ok(ids.size > 0, 'the prefixed output declares no ids at all');
  t.assert.ok(
    references.size > 0,
    'the fixture references no ids, so this proves nothing',
  );
  t.assert.deepStrictEqual(
    [...references].filter((id) => !ids.has(id)),
    [],
    'references left pointing at ids that no longer exist',
  );
  t.assert.deepStrictEqual(
    [...ids].filter((id) => !id.startsWith('ks_')),
    [],
    'ids the prefix never reached',
  );
});

test('the fixture is offered as a demo and is not the default', (t) => {
  // The gulpfile ships a test-svg only when `src/config.json` lists it, and
  // `demos[0]` is both the bare Demo button's file and the only precached one.
  // Appending keeps `src/js/sw/index.js` correct; prepending would not.
  const files = config.demos.map((demo) => demo.file);

  t.assert.ok(
    files.includes('kitchen-sink.svg'),
    'kitchen-sink.svg is in src/test-svgs/ but no demo entry ships it',
  );
  t.assert.notStrictEqual(
    files[0],
    'kitchen-sink.svg',
    'the kitchen sink became the default demo, which is also the precached one',
  );
});

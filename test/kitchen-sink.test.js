import test from 'node:test';
import { optimize } from 'svgo';
import { buildPlugins } from '../src/js/svgo-worker/build-plugins.js';
import {
  allPlugins,
  combinations,
  config,
  defaultPlugins,
  panelPlugins,
  readSource,
} from './panel-order.js';

// `src/test-svgs/kitchen-sink.svg` is the one fixture authored to give every
// exposed optimisation something to do. These assertions read the source tree,
// not `build/`, so unlike the smoke test they need no build.
const fixture = await readSource('test-svgs/kitchen-sink.svg');

// The defaults keep every checkbox out of the way, exactly as in
// `test/build-plugins.test.js`; each test opts into what it's about. `plugins`
// comes from `./panel-order.js` rather than `config.plugins`, because SVGO runs
// the array in order and the panel's order is not the config file's.
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

// Every axis of the settings panel that changes the pipeline rather than just
// the measurement, so a matrix over it is the widest thing the fixture can be
// put through without a browser.
const matrix = combinations({
  dimensionAttrs: ['original', 'viewBox', 'widthHeight', 'both'],
  ids: ['keep', 'minify', 'removeUnused'],
  currentColor: [false, true],
  multipass: [false, true],
});

// A reference that outlives the thing it points at is the failure mode every
// id-rewriting mode shares, and the one that survives a "does it still look
// like SVG" check untouched.
const danglingReferences = (data) => {
  const ids = new Set(
    data.matchAll(/\bid="(?<id>[^"]+)"/g).map((match) => match.groups.id),
  );
  const references = data
    .matchAll(/(?:url\(#|(?:xlink:)?href=")#?(?<id>[^")]+)/g)
    .map((match) => match.groups.id)
    // `<a xlink:href="https://…">` and the data: URI point outside the document.
    .filter((id) => !id.includes(':') && !id.includes('/'))
    .toArray();

  return { ids, references, dangling: references.filter((id) => !ids.has(id)) };
};

test('every configured plugin changes the kitchen-sink fixture', (t) => {
  // A cheap early warning, not a coverage proof: it only asks whether a plugin
  // changed *any* byte, and plugins with incidental targets in the labels and
  // definitions stay non-inert long after their own tile is gone. Deleting the
  // colour, numbers, hidden or animation tile outright leaves this test green
  // — which is what the witness and sentinel tests below are for.
  const baselines = {
    plain: compress(),
    cleared: compress({ plugins: cleared }),
  };

  const inert = panelPlugins
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

test('the tiles the inert sweep cannot see keep their witnesses', (t) => {
  // Binds a plugin to the construct it is supposed to act on, in both
  // directions: the `source` patterns fail if the tile was trimmed away, the
  // `optimised`/`removed` ones fail if the plugin stopped doing the thing the
  // tile is there to demonstrate. Only the tiles the sweep above is blind to
  // need this — the rest are pinned by the sentinel matrix.
  const witnesses = [
    {
      tile: 'colour',
      plugin: 'convertColors',
      source: [/fill="#FF0000"/, /fill="rgb\(0, 128, 255\)"/],
      optimised: [/fill="red"/, /fill="#0080ff"/],
      removed: [/#FF0000/, /rgb\(/],
    },
    {
      tile: 'numbers',
      plugin: 'cleanupNumericValues',
      source: [/width="\+40"/, /height="20\.250000"/, /y="135\.5000"/],
      optimised: [/width="40"/, /height="20.25"/, /y="135.5"/],
      removed: [/"\+40"/, /20\.250000/],
    },
    {
      tile: 'hidden',
      plugin: 'removeHiddenElems',
      source: [/display="none"/, /opacity="0"/, /visibility="hidden"/, /r="0"/],
      // The one rect in the tile with nothing wrong with it has to stay.
      optimised: [/#c8ced6/],
      removed: [/display="none"/, /visibility="hidden"/, /r="0"/],
    },
  ];

  const problems = witnesses.flatMap(
    ({ tile, plugin, source, optimised, removed }) => {
      const data = compress({ plugins: { ...cleared, [plugin]: true } });

      return [
        ...source
          .filter((pattern) => !pattern.test(fixture))
          .map((pattern) => `the ${tile} tile no longer contains ${pattern}`),
        ...optimised
          .filter((pattern) => !pattern.test(data))
          .map((pattern) => `${plugin} no longer produces ${pattern}`),
        ...removed
          .filter((pattern) => pattern.test(data))
          .map((pattern) => `${plugin} left ${pattern} in the ${tile} tile`),
      ];
    },
  );

  t.assert.deepStrictEqual(problems, []);
});

test('both precision sliders have range on the fixture', (t) => {
  // A slider whose whole 0–8 sweep is byte-identical is a control the fixture
  // cannot demonstrate by hand. `floatPrecision` needs coordinates with more
  // decimals than it keeps; `transformPrecision` needs a transform that reaches
  // `convertTransform` intact, which on a <g> nothing does — the default
  // pipeline bakes those into path data first. See the <use> in the numbers
  // tile.
  const sweep = (key) =>
    new Set(
      Array.from({ length: 9 }, (_, value) =>
        compress({ [key]: String(value), plugins: defaultPlugins }),
      ),
    ).size;

  t.assert.ok(
    sweep('floatPrecision') >= 8,
    'floatPrecision no longer changes the output across most of its range',
  );
  t.assert.ok(
    sweep('transformPrecision') >= 8,
    'transformPrecision no longer changes the output across most of its range',
  );
});

test('the default preset keeps every tile of the test card', (t) => {
  // What "usable markup" has to mean for a diagnostic: the constructs a reader
  // is meant to see are all still there, in every combination of the grouped
  // controls. Matched by element rather than by id, since two of the id modes
  // rename them. These are the defaults, so nothing here is destructive.
  const sentinels = {
    mask: /<mask[\s>]/,
    filter: /<filter[\s>]/,
    pattern: /<pattern[\s>]/,
    clipPath: /<clipPath[\s>]/,
    symbol: /<symbol[\s>]/,
    use: /<use[\s>]/,
    image: /<image[\s>]/,
    marker: /<marker[\s>]/,
    linearGradient: /<linearGradient[\s>]/,
    radialGradient: /<radialGradient[\s>]/,
    animate: /<animate[\s>]/,
    rotate: /<animateTransform[^>]+type="rotate"/,
    set: /<set[\s>]/,
    motionPath: /<mpath[\s>]/,
    textPath: /<textPath[\s>]/,
    tspan: /<tspan[\s>]/,
    foreignObject: /<foreignObject[\s>]/,
    switch: /<switch[\s>]/,
    nestedSvg: /<svg[^>]*>[\s\S]*<svg[\s>]/,
    anchor: /<a[\s>]/,
    // The red diagonal of the shapes tile, and the one rect of the hidden tile
    // that is meant to survive — both easy to lose to a plugin interaction.
    diagonal: /m82 70 16-18/,
    visibleRect: /h19v17/,
    // The long-coordinate path the float-precision slider works on.
    longCoordinates: /168\.123/,
  };

  const missing = matrix.flatMap((combination) => {
    const data = compress({ ...combination, plugins: defaultPlugins });
    return Object.entries(sentinels)
      .filter(([, pattern]) => !pattern.test(data))
      .map(([name]) => ({ ...combination, missing: name }));
  });

  t.assert.deepStrictEqual(missing, [], 'tiles the default preset destroyed');
});

test('every combination of the grouped controls resolves its references', (t) => {
  // Replaces a check for `<svg` and `<parsererror`, which could not fail:
  // `optimize()` throws on malformed input and its serializer returns text, so
  // no parser error can ever reach the output. This runs the whole matrix with
  // every plugin enabled — a destructive configuration no preset produces, but
  // the widest one the panel can reach — and asks something an id-rewriting bug
  // would actually break.
  const broken = matrix
    .map((combination) => ({
      combination,
      ...danglingReferences(
        compress({ ...combination, idPrefix: 'ks_', plugins: allPlugins }),
      ),
    }))
    .filter(({ dangling }) => dangling.length > 0);

  t.assert.deepStrictEqual(broken, [], 'combinations left dangling references');

  // Guards the guard: a matrix that stopped referencing anything would pass.
  const { references } = danglingReferences(
    compress({ idPrefix: 'ks_', plugins: allPlugins }),
  );
  t.assert.ok(
    references.length > 0,
    'the fixture references no ids, so this proves nothing',
  );
});

test('removeOffCanvasPaths still deletes an on-canvas straight line', (t) => {
  // A known SVGO defect, pinned rather than hidden. `removeOffCanvasPaths`
  // only treats an *absolute* `M` inside the viewBox as proof of visibility;
  // everything else falls through to `intersects()`, which builds a convex hull
  // and gives up when it has fewer than three points. A straight line has two.
  // So any zero-area path with a relative start is deleted wherever it sits.
  //
  // The fixture's red diagonal is a <line>, which `convertShapeToPath` turns
  // into exactly that, so enabling "Remove out-of-bounds paths" on otherwise
  // default settings loses a visible element. The <line> is the only witness
  // `convertShapeToPath` has for that shape, so the fixture keeps it and this
  // test records the damage. When SVGO fixes the hull check this test fails,
  // which is the point — delete it then.
  const withOffCanvas = compress({
    plugins: { ...defaultPlugins, removeOffCanvasPaths: true },
  });

  t.assert.match(
    compress({ plugins: defaultPlugins }),
    /m82 70 16-18/,
    'the fixture lost its red diagonal, so this test has nothing to say',
  );
  t.assert.doesNotMatch(
    withOffCanvas,
    /m82 70 16-18/,
    'SVGO stopped eating the on-canvas diagonal — delete this test and the note in CLAUDE.md',
  );
  // The plugin does still do its actual job.
  t.assert.doesNotMatch(
    withOffCanvas,
    /M-240-240/,
    'the genuinely off-canvas square survived',
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
  const { ids, references, dangling } = danglingReferences(
    compress({ idPrefix: 'ks_', plugins: allPlugins }),
  );

  t.assert.ok(ids.size > 0, 'the prefixed output declares no ids at all');
  t.assert.ok(
    references.length > 0,
    'the fixture references no ids, so this proves nothing',
  );
  t.assert.deepStrictEqual(
    dangling,
    [],
    'references left pointing at ids that no longer exist',
  );
  t.assert.deepStrictEqual(
    [...ids].filter((id) => !id.startsWith('ks_')),
    [],
    'ids the prefix never reached',
  );
});

test('no rotate animation leans on a coordinate system SVGO can collapse', (t) => {
  // A `rotate` with a bare angle turns about the origin of whatever coordinate
  // system it finds itself in. Wrap it in a <g transform="translate(…)"> and it
  // looks fine — until `collapseGroups` bakes that translate into the geometry
  // and the animation starts swinging the element around the root origin, well
  // outside the viewBox. Spelling out `angle cx cy` is what makes it survive,
  // so this checks the optimised output rather than the source.
  const bareAngle = compress({ plugins: defaultPlugins })
    .matchAll(
      /<animateTransform[^>]+\btype="rotate"[^>]+\bvalues="(?<values>[^"]*)"/g,
    )
    .map((match) => match.groups.values)
    .toArray();

  t.assert.ok(bareAngle.length > 0, 'the fixture lost its rotate animation');
  t.assert.deepStrictEqual(
    bareAngle.filter((values) =>
      values
        .split(';')
        .some((frame) => frame.trim().split(/[\s,]+/).length < 3),
    ),
    [],
    'rotate keyframes missing an explicit centre — these move when a group collapses',
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

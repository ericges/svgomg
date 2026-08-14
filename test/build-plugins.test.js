import test from 'node:test';
import { optimize } from 'svgo';
import { buildPlugins } from '../src/js/svgo-worker/build-plugins.js';
import { panelOrder } from './panel-order.js';

// Runs the exact plugin array the worker would hand to SVGO, so what's
// asserted is the assembled pipeline, not any one plugin in isolation. The
// defaults keep every checkbox-driven plugin out of the way; each test opts
// into precisely the controls it's about.
const compress = (svg, overrides = {}) => {
  const settings = {
    floatPrecision: '3',
    transformPrecision: '5',
    ids: 'keep',
    idPrefix: '',
    currentColor: false,
    plugins: {},
    ...overrides,
  };

  return optimize(svg, { plugins: buildPlugins(settings) }).data;
};

test('the viewBox mode reads px lengths without numeric cleanup', (t) => {
  // `removeDimensions` alone can't parse `100px`, so this used to depend on
  // the independently exposed `cleanupNumericValues` stripping the unit first.
  const data = compress(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100px" height="50px"><rect width="10" height="10"/></svg>',
    { dimensionAttrs: 'viewBox' },
  );

  t.assert.match(data, /^<svg [^>]*viewBox="0 0 100 50"/);
  t.assert.doesNotMatch(data, /^<svg [^>]*width=/);
});

test('currentColor converts however the colour was authored', (t) => {
  // A presentation attribute, a style attribute and a stylesheet rule must
  // all swap — `convertColors` alone only sees the first.
  const data = compress(
    '<svg xmlns="http://www.w3.org/2000/svg"><style>.hot{fill:red}</style><path class="hot" style="stroke:blue" fill="#f00" d="M0 0h1v1z"/><circle style="fill:none" r="1"/></svg>',
    { currentColor: true, plugins: { convertColors: false } },
  );

  t.assert.match(data, /<style>\.hot\{fill:currentColor\}<\/style>/);
  t.assert.match(data, /style="stroke:currentColor"/);
  t.assert.match(data, /fill="currentColor"/);
  // `none` is not a colour; swapping it would make hidden shapes visible.
  t.assert.match(data, /style="fill:none"/);
});

test('a document with a mask keeps its stylesheets wholesale', (t) => {
  // The stylesheet is a *sibling* of the mask, yet its rule selects into it —
  // recolouring `.mask` would change the mask's luminance. No cheap check
  // tells such rules from harmless ones, so the presence of a mask preserves
  // every stylesheet; attribute colours outside the mask still convert.
  const data = compress(
    '<svg xmlns="http://www.w3.org/2000/svg" color="black"><style>.mask{fill:white}</style><mask id="m"><path class="mask" d="M0 0h10v10z"/></mask><path mask="url(#m)" fill="red" d="M0 0h10v10z"/></svg>',
    { currentColor: true, plugins: { convertColors: false } },
  );

  t.assert.match(data, /\.mask\{fill:white\}/);
  t.assert.match(data, /fill="currentColor"/);
});

test('currentColor leaves mask content alone', (t) => {
  // Masks read luminance: recolouring their content changes what they hide.
  // `convertColors` skips everything inside one, and so must the companion —
  // for the style attribute and for a stylesheet nested in the mask alike.
  const data = compress(
    '<svg xmlns="http://www.w3.org/2000/svg" color="black"><mask id="m"><style>.mask{fill:white}</style><path class="mask" style="fill:#fff" d="M0 0h10v10z"/></mask><path mask="url(#m)" fill="red" d="M0 0h10v10z"/></svg>',
    { currentColor: true, plugins: { convertColors: false } },
  );

  t.assert.match(data, /\.mask\{fill:white\}/);
  t.assert.match(data, /style="fill:#fff"/);
  t.assert.match(data, /fill="currentColor"/);
});

const idSvg =
  '<svg xmlns="http://www.w3.org/2000/svg"><style>#shape{fill:red}</style><path id="shape" d="M0 0h1v1z"/></svg>';

test('a prefix that would break IDs or selectors is not applied', (t) => {
  // `prefixIds` passes the string through verbatim: `1shape` is no valid ID
  // and `#a bshape` is two selectors. Doing nothing beats emitting either.
  const digitPrefixed = compress(idSvg, { idPrefix: '1' });
  const spacePrefixed = compress(idSvg, { idPrefix: 'a b' });

  t.assert.match(digitPrefixed, /id="shape"/);
  t.assert.match(spacePrefixed, /id="shape"/);
});

test('a valid prefix is trimmed and reaches stylesheet selectors too', (t) => {
  const data = compress(idSvg, { idPrefix: ' svgomg_ ' });

  t.assert.match(data, /id="svgomg_shape"/);
  t.assert.match(data, /#svgomg_shape\{/);
});

// The order `Settings.getSettings()` yields, which is the panel's DOM order:
// the metadata block, then the styles block, then the feature list, each in
// `config.json` order. SVGO runs plugins in array order, so moving a checkbox
// between those blocks reorders the pipeline — this pins the result.
const pluginOrder = [
  'removeComments',
  'removeMetadata',
  'removeEditorsNSData',
  'removeTitle',
  'removeDesc',
  'mergeStyles',
  'inlineStyles',
  'minifyStyles',
  'convertStyleToAttrs',
  'removeStyleElement',
  'removeDoctype',
  'removeXMLProcInst',
  'removeXMLNS',
  'cleanupAttrs',
  'removeRasterImages',
  'removeUselessDefs',
  'cleanupNumericValues',
  'cleanupListOfValues',
  'convertColors',
  'removeUnknownsAndDefaults',
  'removeNonInheritableGroupAttrs',
  'removeUselessStrokeAndFill',
  'cleanupEnableBackground',
  'removeHiddenElems',
  'removeEmptyText',
  'convertShapeToPath',
  'moveElemsAttrsToGroup',
  'moveGroupAttrsToElems',
  'collapseGroups',
  'convertPathData',
  'convertEllipseToCircle',
  'convertTransform',
  'removeEmptyAttrs',
  'removeEmptyContainers',
  'mergePaths',
  'removeUnusedNS',
  'reusePaths',
  'sortAttrs',
  'sortDefsChildren',
  'removeScripts',
  'removeOffCanvasPaths',
  'convertOneStopGradients',
  'removeDeprecatedAttrs',
  'removeXlink',
];

test('the pinned order is the one the panel actually renders', (t) => {
  // Closes the loop on the order: this literal is what the assertions below
  // read, `panelOrder` is `src/config.json` partitioned the way `index.njk`
  // loops over it, and `test/build-smoke.test.js` checks the built markup comes
  // out in that same order. Without this, adding a plugin to `config.json`
  // silently leaves the pinned array describing a pipeline that no longer runs.
  t.assert.deepStrictEqual(pluginOrder, panelOrder);
});

test('the assembled array keeps panel order, with the selects slotted in', (t) => {
  const plugins = buildPlugins({
    floatPrecision: '3',
    transformPrecision: '5',
    dimensionAttrs: 'viewBox',
    ids: 'minify',
    idPrefix: 'svgomg_',
    currentColor: true,
    plugins: Object.fromEntries(pluginOrder.map((name) => [name, true])),
  });
  const at = (name) => pluginOrder.indexOf(name);

  t.assert.deepStrictEqual(
    plugins.map((plugin) => plugin.name),
    [
      // Before everything, so what it adds is treated like the input's own.
      'ensure-dimensions',
      ...pluginOrder.slice(0, at('removeRasterImages')),
      // Where its checkbox used to sit, so `removeUselessDefs` and `mergePaths`
      // see cleaned IDs.
      'cleanupIds',
      ...pluginOrder.slice(at('removeRasterImages'), at('convertColors') + 1),
      // Right behind `convertColors`, which never looks past attributes.
      'current-color-styles',
      ...pluginOrder.slice(at('convertColors') + 1),
      'removeDimensions',
      'prefixIds',
    ],
  );
});

test('removing the stylesheet stops holding back the plugins behind it', (t) => {
  // `cleanupIds`, `moveElemsAttrsToGroup` and `removeHiddenElems` all bail out
  // when they see a `<style>`: any selector could rely on what they'd touch.
  // Grouping the five style plugins under the Styles select moved
  // `removeStyleElement` from the end of the array to the front, so "Remove
  // entirely" no longer leaves the rest of the pipeline hobbled by a
  // stylesheet that is about to be deleted anyway.
  const data = compress(
    '<svg xmlns="http://www.w3.org/2000/svg"><style>#a{fill:red}</style><g id="a"><path d="M0 0h10v10z"/><path d="M0 0h5v5z"/></g></svg>',
    {
      ids: 'minify',
      plugins: Object.fromEntries(
        pluginOrder.map((name) => [name, name === 'removeStyleElement']),
      ),
    },
  );

  t.assert.doesNotMatch(data, /<style/);
  t.assert.doesNotMatch(data, /\bid=/);
});

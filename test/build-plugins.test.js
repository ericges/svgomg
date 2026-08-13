import test from 'node:test';
import { optimize } from 'svgo';
import { buildPlugins } from '../src/js/svgo-worker/build-plugins.js';

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

import test from 'node:test';
import { optimize } from 'svgo';
import { createFeaturesExtractor } from '../src/js/svgo-worker/document-features.js';
import { buildPlugins } from '../src/js/svgo-worker/build-plugins.js';
import { stylesStages } from '../src/js/page/ui/setting-stages.js';
import { defaultPlugins, readSource } from './panel-order.js';

// Driven through SVGO rather than by calling the visitor directly, because what
// the flags mean depends on how SVGO models the document — a `<script>`'s
// content is children, not an attribute, and that distinction is the rule.
const featuresOf = (svg) => {
  const [features, plugin] = createFeaturesExtractor();
  const { error } = optimize(svg, { plugins: [plugin] });

  if (error) throw new Error(error);

  return features;
};

const wrap = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">${inner}</svg>`;

test('a document with none of the three constructs reports none', (t) => {
  t.assert.deepStrictEqual(featuresOf(wrap('<rect width="10" height="10"/>')), {
    hasStyleElement: false,
    hasScripts: false,
    hasMask: false,
  });
});

test('a style element is reported whether or not it has rules', (t) => {
  t.assert.strictEqual(
    featuresOf(wrap('<style>.a{fill:red}</style>')).hasStyleElement,
    true,
  );

  // The wider of SVGO's two readings, on purpose: `cleanupIds` wants a non-empty
  // stylesheet, but `removeUselessStrokeAndFill` bails on the element itself.
  t.assert.strictEqual(
    featuresOf(wrap('<style></style>')).hasStyleElement,
    true,
  );
});

test('scripts are what SVGO counts as scripts', (t) => {
  const hasScripts = (inner) => featuresOf(wrap(inner)).hasScripts;

  t.assert.strictEqual(hasScripts('<script>alert(1)</script>'), true);
  // Empty, so there is nothing to run — SVGO's own guard skips it too.
  t.assert.strictEqual(hasScripts('<script></script>'), false);

  t.assert.strictEqual(hasScripts('<a href="javascript:alert(1)">x</a>'), true);
  t.assert.strictEqual(
    hasScripts('<a xlink:href=" JAVASCRIPT:alert(1)">x</a>'),
    true,
  );
  t.assert.strictEqual(hasScripts('<a href="#target">x</a>'), false);

  t.assert.strictEqual(hasScripts('<rect onclick="alert(1)"/>'), true);
  t.assert.strictEqual(hasScripts('<rect onmouseover="alert(1)"/>'), true);
  // The `on` prefix stands in for SVGO's 79-name list, so a plain attribute
  // that merely starts with those letters must not trip it.
  t.assert.strictEqual(hasScripts('<rect opacity=".5"/>'), false);
});

test('a mask anywhere is reported', (t) => {
  t.assert.strictEqual(
    featuresOf(
      wrap('<defs><mask id="m"><rect width="10" height="10"/></mask></defs>'),
    ).hasMask,
    true,
  );
  t.assert.strictEqual(
    featuresOf(wrap('<rect width="10" height="10"/>')).hasMask,
    false,
  );
});

test('the kitchen-sink fixture carries all three', async (t) => {
  // The fixture the collision notices were written for: its `<style>`, script
  // and `<mask>` are what make `removeUselessStrokeAndFill`,
  // `moveElemsAttrsToGroup` and the currentColor stylesheet branch back off.
  const features = featuresOf(await readSource('test-svgs/kitchen-sink.svg'));

  t.assert.deepStrictEqual(features, {
    hasStyleElement: true,
    hasScripts: true,
    hasMask: true,
  });
});

// What the worker's `process` action does: the extractor last in the array, so
// it describes the finished document rather than the input.
const resultFeaturesOf = (svg, stage, { multipass = false } = {}) => {
  const [features, plugin] = createFeaturesExtractor();
  const settings = {
    plugins: { ...defaultPlugins, ...stylesStages[stage] },
    floatPrecision: 3,
    transformPrecision: 5,
    multipass,
    ids: 'minify',
    idPrefix: '',
    currentColor: false,
    dimensionAttrs: 'original',
  };
  const { error } = optimize(svg, {
    multipass,
    plugins: [...buildPlugins(settings), plugin],
  });

  if (error) throw new Error(error);

  return features;
};

test('only the result says whether a stylesheet survived the Styles stage', async (t) => {
  // The reason the notices read this flag off the output instead of the input:
  // "Inline into elements" dissolves the `<style>` element only when every rule
  // could be inlined, and SVGO inlines a rule only if its selector matches
  // exactly one element and it isn't behind a non-screen media query. So the
  // stage chosen doesn't answer the question — the result does.
  const inlinable = wrap(
    '<style>#a{fill:red}</style><rect id="a" width="4" height="4"/>',
  );
  const twoMatches = wrap(
    '<style>.c{fill:red}</style><rect class="c" width="4" height="4"/><rect class="c" x="5" width="4" height="4"/>',
  );

  t.assert.strictEqual(
    resultFeaturesOf(inlinable, 'inline').hasStyleElement,
    false,
  );
  t.assert.strictEqual(
    resultFeaturesOf(twoMatches, 'inline').hasStyleElement,
    true,
  );
  t.assert.strictEqual(
    resultFeaturesOf(twoMatches, 'attributes').hasStyleElement,
    true,
  );
  // The one stage that always clears it, which is why it is the fix the
  // notices name.
  t.assert.strictEqual(
    resultFeaturesOf(twoMatches, 'remove').hasStyleElement,
    false,
  );

  // Same on the fixture the notices were written for.
  const kitchenSink = await readSource('test-svgs/kitchen-sink.svg');
  t.assert.strictEqual(
    resultFeaturesOf(kitchenSink, 'inline').hasStyleElement,
    true,
  );
  t.assert.strictEqual(
    resultFeaturesOf(kitchenSink, 'remove').hasStyleElement,
    false,
  );
});

test('multipass reports the last pass, not any pass', async (t) => {
  // Without the per-pass reset the flags would mean "seen at some point", and a
  // stylesheet cleared on pass one would still be reported to a panel whose
  // plugins ran on pass two without it.
  const kitchenSink = await readSource('test-svgs/kitchen-sink.svg');

  t.assert.strictEqual(
    resultFeaturesOf(kitchenSink, 'remove', { multipass: true })
      .hasStyleElement,
    false,
  );
});

test('the demo the app ships as its default carries none of them', async (t) => {
  // The other half of the gate: on ordinary artwork the panel stays silent.
  const features = featuresOf(await readSource('test-svgs/car-lite.svg'));

  t.assert.deepStrictEqual(features, {
    hasStyleElement: false,
    hasScripts: false,
    hasMask: false,
  });
});

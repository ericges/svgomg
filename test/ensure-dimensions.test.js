import test from 'node:test';
import { createEnsureDimensionsPlugin } from '../src/js/svgo-worker/ensure-dimensions.js';

// Drive the visitor the way SVGO would, without running SVGO: `enter` takes the
// node and its parent, and only a root `<svg>` is of interest. Returns the
// attributes it leaves behind.
const ensure = (attributes, parentType = 'root', name = 'svg') => {
  const node = { name, attributes: { ...attributes } };
  createEnsureDimensionsPlugin().fn().element.enter(node, { type: parentType });
  return node.attributes;
};

test('fills in width and height that a viewBox implies', (t) => {
  t.assert.deepStrictEqual(ensure({ viewBox: '0 0 100 50' }), {
    viewBox: '0 0 100 50',
    width: '100',
    height: '50',
  });
});

test('takes the extent from the viewBox, not its offset', (t) => {
  t.assert.deepStrictEqual(ensure({ viewBox: '-10 -20 100 50' }), {
    viewBox: '-10 -20 100 50',
    width: '100',
    height: '50',
  });
});

test('leaves size attributes that are already there', (t) => {
  // `100%` is a deliberate responsive choice — overwriting it with pixels
  // would change how the image behaves, not just how it's written.
  t.assert.deepStrictEqual(ensure({ viewBox: '0 0 100 50', width: '100%' }), {
    viewBox: '0 0 100 50',
    width: '100%',
    height: '50',
  });
  t.assert.deepStrictEqual(
    ensure({ viewBox: '0 0 100 50', width: '20', height: '10' }),
    { viewBox: '0 0 100 50', width: '20', height: '10' },
  );
});

test('derives a viewBox from usable width and height', (t) => {
  t.assert.deepStrictEqual(ensure({ width: '100', height: '50' }), {
    width: '100',
    height: '50',
    viewBox: '0 0 100 50',
  });
  t.assert.deepStrictEqual(ensure({ width: '100px', height: '50px' }), {
    width: '100px',
    height: '50px',
    viewBox: '0 0 100 50',
  });
});

test('leaves the document alone when neither pair is usable', (t) => {
  // Nothing here says what the user units are, so guessing would be wrong.
  t.assert.deepStrictEqual(ensure({ width: '100%', height: '100%' }), {
    width: '100%',
    height: '100%',
  });
  t.assert.deepStrictEqual(ensure({ width: '100' }), { width: '100' });
  t.assert.deepStrictEqual(ensure({}), {});
  t.assert.deepStrictEqual(ensure({ viewBox: 'nonsense', width: '100%' }), {
    viewBox: 'nonsense',
    width: '100%',
  });
});

test('ignores everything but the root svg', (t) => {
  t.assert.deepStrictEqual(ensure({ viewBox: '0 0 100 50' }, 'element'), {
    viewBox: '0 0 100 50',
  });
  t.assert.deepStrictEqual(
    ensure({ viewBox: '0 0 100 50' }, 'root', 'symbol'),
    {
      viewBox: '0 0 100 50',
    },
  );
});

test('is idempotent, so multipass cannot compound it', (t) => {
  const once = ensure({ viewBox: '0 0 100 50' });
  const twice = ensure(once);

  t.assert.deepStrictEqual(twice, once);
});

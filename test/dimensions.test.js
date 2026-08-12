import test from 'node:test';
import {
  createDimensionsExtractor,
  parseLength,
  parseViewBox,
} from '../src/js/svgo-worker/dimensions.js';

// Drive the visitor plugin the way SVGO would, without running SVGO: `enter`
// takes the node and its parent, and only a root `<svg>` is of interest.
const extractFrom = (attributes, parentType = 'root', name = 'svg') => {
  const [dimensions, plugin] = createDimensionsExtractor();
  plugin.fn().element.enter({ name, attributes }, { type: parentType });
  return dimensions;
};

test('parseLength accepts bare user units and explicit px', (t) => {
  t.assert.strictEqual(parseLength('100'), 100);
  t.assert.strictEqual(parseLength('100px'), 100);
  t.assert.strictEqual(parseLength('100PX'), 100);
  t.assert.strictEqual(parseLength(' 100px '), 100);
  t.assert.strictEqual(parseLength('.5'), 0.5);
  t.assert.strictEqual(parseLength('1.5'), 1.5);
  t.assert.strictEqual(parseLength('1e3'), 1000);
  t.assert.strictEqual(parseLength(100), 100);
});

test('parseLength rejects units it cannot convert to pixels', (t) => {
  // The whole point of the pattern: `100%` must not be read as 100px.
  t.assert.strictEqual(parseLength('100%'), undefined);
  t.assert.strictEqual(parseLength('10em'), undefined);
  t.assert.strictEqual(parseLength('10mm'), undefined);
  t.assert.strictEqual(parseLength('10 px'), undefined);
});

test('parseLength rejects values that cannot size a preview', (t) => {
  t.assert.strictEqual(parseLength('0'), undefined);
  t.assert.strictEqual(parseLength('-5'), undefined);
  t.assert.strictEqual(parseLength('1e400'), undefined); // Infinity
  t.assert.strictEqual(parseLength(''), undefined);
  t.assert.strictEqual(parseLength(undefined), undefined);
  t.assert.strictEqual(parseLength(null), undefined);
  t.assert.strictEqual(parseLength('abc'), undefined);
  t.assert.strictEqual(parseLength('100abc'), undefined);
});

test('parseViewBox requires four finite numbers with a positive extent', (t) => {
  t.assert.deepStrictEqual(parseViewBox('0 0 100 50'), {
    width: 100,
    height: 50,
  });
  t.assert.deepStrictEqual(parseViewBox('0,0,100,50'), {
    width: 100,
    height: 50,
  });
  t.assert.deepStrictEqual(parseViewBox(' 0 , 0  100\n50 '), {
    width: 100,
    height: 50,
  });
  // Offsets don't have to be positive — only the extent does.
  t.assert.deepStrictEqual(parseViewBox('-10 -10 100 50'), {
    width: 100,
    height: 50,
  });
});

test('parseViewBox rejects malformed values', (t) => {
  t.assert.strictEqual(parseViewBox('0 0 100'), undefined);
  t.assert.strictEqual(parseViewBox('0 0 100 50 60'), undefined);
  t.assert.strictEqual(parseViewBox('0 0 abc 50'), undefined);
  t.assert.strictEqual(parseViewBox('0 0 0 50'), undefined);
  t.assert.strictEqual(parseViewBox('0 0 -100 50'), undefined);
  t.assert.strictEqual(parseViewBox(''), undefined);
  t.assert.strictEqual(parseViewBox(undefined), undefined);
});

test('the extractor prefers usable width/height over the viewBox', (t) => {
  t.assert.deepStrictEqual(
    extractFrom({ width: '100', height: '50', viewBox: '0 0 999 999' }),
    { width: 100, height: 50 },
  );
});

test('the extractor falls back to the viewBox unless both lengths are usable', (t) => {
  // Not merely when they're absent: a percentage width is present but useless.
  t.assert.deepStrictEqual(
    extractFrom({ width: '100%', height: '50', viewBox: '0 0 20 10' }),
    { width: 20, height: 10 },
  );
  t.assert.deepStrictEqual(extractFrom({ viewBox: '0 0 20 10' }), {
    width: 20,
    height: 10,
  });
});

test('the extractor reports nothing when no source is usable', (t) => {
  t.assert.deepStrictEqual(extractFrom({ width: '100%', height: '100%' }), {});
  t.assert.deepStrictEqual(extractFrom({ viewBox: 'nonsense' }), {});
  t.assert.deepStrictEqual(extractFrom({}), {});
});

test('the extractor ignores nested svg elements', (t) => {
  // A nested `<svg>` sizes itself, not the document.
  t.assert.deepStrictEqual(
    extractFrom({ width: '100', height: '50' }, 'element'),
    {},
  );
});

test('the extractor ignores non-svg elements', (t) => {
  t.assert.deepStrictEqual(
    extractFrom({ width: '100', height: '50' }, 'root', 'rect'),
    {},
  );
});

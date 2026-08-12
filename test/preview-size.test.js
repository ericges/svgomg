import test from 'node:test';
import {
  DEFAULT_PREVIEW_HEIGHT,
  DEFAULT_PREVIEW_WIDTH,
  MAX_PREVIEW_DIMENSION,
  previewSize,
} from '../src/js/page/ui/preview-size.js';

const defaults = {
  width: DEFAULT_PREVIEW_WIDTH,
  height: DEFAULT_PREVIEW_HEIGHT,
};

test('sizes within the ceiling pass through untouched', (t) => {
  t.assert.deepStrictEqual(previewSize(100, 50), { width: 100, height: 50 });
  t.assert.deepStrictEqual(
    previewSize(MAX_PREVIEW_DIMENSION, MAX_PREVIEW_DIMENSION),
    { width: MAX_PREVIEW_DIMENSION, height: MAX_PREVIEW_DIMENSION },
  );
});

test('oversized previews are scaled down preserving aspect ratio', (t) => {
  const size = previewSize(MAX_PREVIEW_DIMENSION * 2, MAX_PREVIEW_DIMENSION);
  t.assert.deepStrictEqual(size, {
    width: MAX_PREVIEW_DIMENSION,
    height: MAX_PREVIEW_DIMENSION / 2,
  });
  t.assert.strictEqual(size.width / size.height, 2);
});

test('the longest side drives the scale', (t) => {
  t.assert.deepStrictEqual(previewSize(10, MAX_PREVIEW_DIMENSION * 10), {
    width: 1,
    height: MAX_PREVIEW_DIMENSION,
  });
});

test('unusable dimensions fall back to the SVG default size', (t) => {
  // Checked positively, so NaN/undefined land here rather than sneaking past a
  // `<= 0` comparison.
  t.assert.deepStrictEqual(previewSize(NaN, 100), defaults);
  t.assert.deepStrictEqual(previewSize(100, NaN), defaults);
  t.assert.deepStrictEqual(previewSize(undefined, undefined), defaults);
  t.assert.deepStrictEqual(previewSize(0, 100), defaults);
  t.assert.deepStrictEqual(previewSize(-10, 10), defaults);
  t.assert.deepStrictEqual(previewSize(Infinity, 10), defaults);
});

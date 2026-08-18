import test from 'node:test';
import { diffBox, MAX_DIFF_AREA } from '../src/js/page/ui/diff-box.js';
import {
  DEFAULT_PREVIEW_HEIGHT,
  DEFAULT_PREVIEW_WIDTH,
} from '../src/js/page/ui/preview-size.js';

// What the caller actually rasterises at, which is what `pixelmatch` compares.
const pixels = ({ width, height, scale }) => ({
  width: Math.max(1, Math.round(width * scale)),
  height: Math.max(1, Math.round(height * scale)),
});

// The cap is on the box this function returns; `rasterizeToCanvas()` rounds it
// to whole pixels afterwards, which can add most of a row and a column. Rounded
// because the scale is a square root, so an exactly-capped box lands a
// fractional pixel either side of the limit.
const area = ({ width, height, scale }) =>
  Math.round(width * scale * height * scale);

test('the box is the preview box, so the diff frames the artwork the same way', (t) => {
  const box = diffBox(400, 300, 1);

  t.assert.strictEqual(box.width, 400);
  t.assert.strictEqual(box.height, 300);
  t.assert.strictEqual(box.scale, 1);
});

test('both sides get identical pixel dimensions', (t) => {
  // The point of one box for the pair: `pixelmatch` compares two buffers of
  // equal length, and an optimisation can change the intrinsic size. Whatever
  // the result file's own dimensions, the caller passes the input's.
  const box = diffBox(123, 457, 2);

  t.assert.deepStrictEqual(pixels(box), pixels(box));
  t.assert.deepStrictEqual(pixels(box), { width: 246, height: 914 });
});

test('devicePixelRatio is honoured below the cap', (t) => {
  t.assert.strictEqual(diffBox(400, 300, 2).scale, 2);
  t.assert.strictEqual(diffBox(400, 300, 3).scale, 3);
});

test('the area cap bites before the ratio does', (t) => {
  const box = diffBox(2000, 1500, 3);

  t.assert.ok(box.scale < 3, 'the requested ratio was not capped');
  t.assert.ok(area(box) <= MAX_DIFF_AREA, `${area(box)} is past the cap`);
  // Still the preview's box: only the raster gets coarser, so the diff frames
  // the artwork exactly as the preview does.
  t.assert.strictEqual(box.width, 2000);
  t.assert.strictEqual(box.height, 1500);
});

test('an already oversized box is scaled below 1', (t) => {
  // `previewSize` clamps the long edge to 4096 first; 4096×4096 is still 16MP,
  // so the cap has to take it further down.
  const box = diffBox(8000, 8000, 1);

  t.assert.ok(box.scale < 1);
  t.assert.ok(area(box) <= MAX_DIFF_AREA);
  t.assert.deepStrictEqual(pixels(box), { width: 1414, height: 1414 });
});

test('a file with no usable dimensions falls back to the preview default', (t) => {
  const box = diffBox(undefined, undefined, 1);

  t.assert.strictEqual(box.width, DEFAULT_PREVIEW_WIDTH);
  t.assert.strictEqual(box.height, DEFAULT_PREVIEW_HEIGHT);
});

test('an unusable pixel ratio draws at 1:1 rather than at nothing', (t) => {
  // `devicePixelRatio` is a parameter precisely so this module stays DOM-free,
  // which means it can be handed anything.
  const scales = [0, -1, NaN, undefined].map(
    (ratio) => diffBox(400, 300, ratio).scale,
  );

  t.assert.deepStrictEqual(scales, [1, 1, 1, 1]);
});

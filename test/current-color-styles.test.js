import test from 'node:test';
import { convertCssColoursToCurrentColor } from '../src/js/svgo-worker/current-color-styles.js';

test('converts every colour property, however the value was written', (t) => {
  t.assert.strictEqual(
    convertCssColoursToCurrentColor(
      'fill:red;stroke:rgb(0,0,255);stop-color:#abc',
    ),
    'fill:currentColor;stroke:currentColor;stop-color:currentColor',
  );
});

test('keeps none, whichever case it was written in', (t) => {
  t.assert.strictEqual(
    convertCssColoursToCurrentColor('fill:none'),
    'fill:none',
  );
  t.assert.strictEqual(
    convertCssColoursToCurrentColor('fill:NONE'),
    'fill:NONE',
  );
});

test('a trailing !important survives the rewrite', (t) => {
  t.assert.strictEqual(
    convertCssColoursToCurrentColor('fill: red !important'),
    'fill: currentColor !important',
  );
});

test('a property name inside a selector is not a declaration', (t) => {
  t.assert.strictEqual(
    convertCssColoursToCurrentColor('.fill:hover{color:red}'),
    '.fill:hover{color:currentColor}',
  );
});

test('properties that merely contain a colour name stay untouched', (t) => {
  t.assert.strictEqual(
    convertCssColoursToCurrentColor('fill-opacity:.5;color-scheme:dark'),
    'fill-opacity:.5;color-scheme:dark',
  );
});

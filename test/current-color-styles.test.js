import test from 'node:test';
import {
  convertStyleAttribute,
  convertStylesheet,
} from '../src/js/svgo-worker/current-color-styles.js';

test('converts every colour property, however the value was written', (t) => {
  t.assert.strictEqual(
    convertStyleAttribute('fill:red;stroke:rgb(0,0,255);stop-color:#abc'),
    'fill:currentColor;stroke:currentColor;stop-color:currentColor',
  );
});

test('keeps none, whichever case it was written in', (t) => {
  t.assert.strictEqual(
    convertStyleAttribute('fill:none;stroke:NONE'),
    'fill:none;stroke:NONE',
  );
});

test('a trailing !important survives the rewrite', (t) => {
  t.assert.strictEqual(
    convertStyleAttribute('fill: red !important'),
    'fill:currentColor!important',
  );
});

test('a property name inside a selector is not a declaration', (t) => {
  t.assert.strictEqual(
    convertStylesheet('.fill:hover{color:red}'),
    '.fill:hover{color:currentColor}',
  );
});

test('properties that merely contain a colour name stay untouched', (t) => {
  t.assert.strictEqual(
    convertStyleAttribute('fill-opacity:.5;color-scheme:dark'),
    'fill-opacity:.5;color-scheme:dark',
  );
});

test('a semicolon inside the value is not a terminator', (t) => {
  // A data URL is one value; cutting it at the `;` would leave the dangling
  // `base64,…)` behind as garbage.
  t.assert.strictEqual(
    convertStyleAttribute('fill:url(data:image/svg+xml;base64,PHN2Zy8+)'),
    'fill:currentColor',
  );
});

test('quoted text that looks like a declaration is not one', (t) => {
  t.assert.strictEqual(
    convertStylesheet('.x::before{content:" fill:red"}'),
    '.x::before{content:" fill:red"}',
  );
});

test('comments cannot smuggle a declaration in', (t) => {
  // The comment itself is dropped in regeneration — SVGO's own style passes
  // do the same — but its content must not be rewritten as if it were CSS.
  t.assert.strictEqual(
    convertStyleAttribute('/* fill:red */ stroke:blue'),
    'stroke:currentColor',
  );
});

test('rules nested in at-rules are still reached', (t) => {
  t.assert.strictEqual(
    convertStylesheet('@media (min-width:1px){.a{fill:red}}'),
    '@media (min-width:1px){.a{fill:currentColor}}',
  );
});

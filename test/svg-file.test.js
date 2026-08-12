import test from 'node:test';
import SvgFile from '../src/js/page/svg-file.js';

const rawSize = (text) => new SvgFile(text, 10, 10).size({ compress: false });

test('raw size counts UTF-8 bytes, not UTF-16 code units', async (t) => {
  // The fixtures from the audit: `.length` would report 1, 2 and 14.
  t.assert.strictEqual(await rawSize('é'), 2);
  t.assert.strictEqual(await rawSize('🚀'), 4);
  t.assert.strictEqual(await rawSize('<svg>é🚀</svg>'), 17);
});

test('raw size still matches string length for ASCII', async (t) => {
  const text = '<svg xmlns="http://www.w3.org/2000/svg"/>';
  t.assert.strictEqual(await rawSize(text), text.length);
  t.assert.strictEqual(await rawSize(''), 0);
});

test('raw size is memoised', async (t) => {
  const file = new SvgFile('<svg/>', 10, 10);
  t.assert.strictEqual(await file.size({ compress: false }), 6);

  file.text = 'longer than before';
  t.assert.strictEqual(await file.size({ compress: false }), 6);
});

test('an empty file memoises its zero size', async (t) => {
  // `??=` rather than `||=`: with `||=` a 0-byte file would be re-encoded on
  // every call, which this catches by mutating the text behind the memo.
  const file = new SvgFile('', 10, 10);
  t.assert.strictEqual(await file.size({ compress: false }), 0);

  file.text = 'not empty any more';
  t.assert.strictEqual(await file.size({ compress: false }), 0);
});

test('the blob URL is created once and revoked on release', (t) => {
  let created = 0;
  const revoked = [];
  t.mock.method(URL, 'createObjectURL', () => `blob:test-${++created}`);
  t.mock.method(URL, 'revokeObjectURL', (url) => {
    revoked.push(url);
  });

  const file = new SvgFile('<svg/>', 10, 10);
  const { url } = file;

  t.assert.strictEqual(file.url, url);
  t.assert.strictEqual(created, 1);

  file.release();
  t.assert.deepStrictEqual(revoked, [url]);

  // Idempotent: a second release must not revoke an already-revoked URL, and
  // must not create one just to revoke it.
  file.release();
  t.assert.deepStrictEqual(revoked, [url]);
  t.assert.strictEqual(created, 1);
});

test('a released file can be displayed again', (t) => {
  let created = 0;
  t.mock.method(URL, 'createObjectURL', () => `blob:test-${++created}`);
  t.mock.method(URL, 'revokeObjectURL', () => {});

  const file = new SvgFile('<svg/>', 10, 10);
  const first = file.url;
  file.release();

  // Clearing `_url` on release stops the getter handing back a dead URL.
  t.assert.notStrictEqual(file.url, first);
  t.assert.strictEqual(created, 2);
});

import test from 'node:test';
import ResultsCache from '../src/js/page/results-cache.js';
import SvgFile from '../src/js/page/svg-file.js';

// The cache only ever calls `release()`, so a counter is enough for the
// ring-buffer tests. The blob-URL balance test below uses the real `SvgFile`.
const fakeFile = () => ({
  releases: 0,
  release() {
    this.releases++;
  },
});

const releaseCounts = (files) => files.map((file) => file.releases);

test('items are retrievable by fingerprint', (t) => {
  const cache = new ResultsCache(3);
  const a = fakeFile();
  const b = fakeFile();

  cache.add('a', a);
  cache.add('b', b);

  t.assert.strictEqual(cache.match('a'), a);
  t.assert.strictEqual(cache.match('b'), b);
  t.assert.strictEqual(cache.match('nope'), undefined);
});

test('the ring buffer evicts and releases the oldest entry', (t) => {
  const cache = new ResultsCache(3);
  const files = Array.from({ length: 3 }, () => fakeFile());

  for (const [index, file] of files.entries()) cache.add(`f${index}`, file);
  t.assert.deepStrictEqual(releaseCounts(files), [0, 0, 0]);

  const extra = fakeFile();
  cache.add('f3', extra);

  // Slot 0 is reused, so only the first file is released...
  t.assert.deepStrictEqual(releaseCounts(files), [1, 0, 0]);
  // ...and its fingerprint no longer resolves.
  t.assert.strictEqual(cache.match('f0'), undefined);
  t.assert.strictEqual(cache.match('f3'), extra);
  t.assert.strictEqual(cache.match('f1'), files[1]);
});

test('purge releases everything it still holds', (t) => {
  const cache = new ResultsCache(10);
  const files = Array.from({ length: 4 }, () => fakeFile());

  for (const [index, file] of files.entries()) cache.add(`f${index}`, file);
  cache.purge();

  t.assert.deepStrictEqual(releaseCounts(files), [1, 1, 1, 1]);
  t.assert.strictEqual(cache.match('f0'), undefined);
});

test('purge is safe to repeat and leaves a usable cache', (t) => {
  const cache = new ResultsCache(2);
  const file = fakeFile();

  cache.add('a', file);
  cache.purge();
  cache.purge();

  t.assert.strictEqual(file.releases, 1);

  const next = fakeFile();
  cache.add('b', next);
  t.assert.strictEqual(cache.match('b'), next);
});

test('every blob URL the cache hands out is revoked again', (t) => {
  // The audit's balance test: `createObjectURL` and `revokeObjectURL` must come
  // out even across eviction and purge, using the real SvgFile lifecycle.
  let created = 0;
  let revoked = 0;
  t.mock.method(URL, 'createObjectURL', () => `blob:test-${++created}`);
  t.mock.method(URL, 'revokeObjectURL', () => {
    revoked++;
  });

  const cache = new ResultsCache(2);
  const urls = [];

  for (let index = 0; index < 5; index++) {
    const file = new SvgFile(`<svg id="${index}"/>`, 10, 10);
    // Reading `.url` is what `DownloadButton.setDownload` does for every
    // displayed result, whether or not the user ever downloads it.
    urls.push(file.url);
    cache.add(`f${index}`, file);
  }

  t.assert.deepStrictEqual(
    urls,
    [1, 2, 3, 4, 5].map((n) => `blob:test-${n}`),
  );
  t.assert.strictEqual(created, 5);
  t.assert.strictEqual(revoked, 3); // three evictions; two files still held

  cache.purge();
  t.assert.strictEqual(revoked, created);
});

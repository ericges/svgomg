import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// These assertions read `build/`, so they need a *production* build:
// `npm run build`. A dev build (`npm run dev`) skips terser, which the
// mangling check below detects and reports rather than failing obscurely.
const repoRoot = path.join(import.meta.dirname, '..');
const buildDir = path.join(repoRoot, 'build');

const readBuildFile = async (relativePath) => {
  try {
    return await fs.readFile(path.join(buildDir, relativePath), 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error(
      `build/${relativePath} is missing — run \`npm run build\` first.`,
      { cause: error },
    );
  }
};

// The built markup is minified with `removeAttributeQuotes`, so the quotes are
// optional and the backreference has to allow an empty one.
const inputNamePattern =
  /<input[^>]+\bname=(?<quote>["']?)(?<name>[^\s"'>]+)\k<quote>/g;

const inputNames = (html) =>
  new Set(html.matchAll(inputNamePattern).map((match) => match.groups.name));

// Every `this._foo` in the page bundle's own sources. Terser is configured to
// mangle /^_/ properties for this bundle, so none of them may survive.
const privatePropertyNames = async () => {
  const pageSourceDir = path.join(repoRoot, 'src', 'js', 'page');
  const entries = await fs.readdir(pageSourceDir, {
    recursive: true,
    withFileTypes: true,
  });
  const names = new Set();

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map(async (entry) => {
        const source = await fs.readFile(
          path.join(entry.parentPath, entry.name),
          'utf8',
        );
        for (const match of source.matchAll(
          /\bthis\.(?<property>_[A-Za-z]\w*)/g,
        )) {
          names.add(match.groups.property);
        }
      }),
  );

  return names;
};

test('the page bundle has its `_` properties mangled', async (t) => {
  const page = await readBuildFile('js/page.js');
  const names = [...(await privatePropertyNames())];

  // Guards against the scan silently finding nothing and passing vacuously.
  t.assert.ok(
    names.length > 10,
    `expected to find _-prefixed properties in src/js/page, found ${names.length}`,
  );

  const survivors = names.filter((name) => page.includes(name));
  t.assert.deepStrictEqual(
    survivors,
    [],
    'unmangled `_` properties in build/js/page.js — is this a dev build? Run `npm run build`.',
  );
});

test('the worker message protocol survives minification intact', async (t) => {
  // The page and the worker are separately minified bundles, so every key that
  // crosses between them must appear literally in both. This is what breaks if
  // one of them is renamed to `_something`.
  const page = await readBuildFile('js/page.js');
  const worker = await readBuildFile('js/svgo-worker.js');
  const keys = ['action', 'wrapOriginal', 'process', 'settings', 'dimensions'];

  t.assert.deepStrictEqual(
    keys.filter((key) => !page.includes(key)),
    [],
    'protocol keys missing from build/js/page.js',
  );
  t.assert.deepStrictEqual(
    keys.filter((key) => !worker.includes(key)),
    [],
    'protocol keys missing from build/js/svgo-worker.js',
  );
});

test('settings keys reach the worker under their HTML `name` attributes', async (t) => {
  // `name` attribute → `Settings.getSettings()` → worker plugin params. The
  // page bundle never spells these out (it reads them off the inputs), so the
  // markup is one end of the contract and the worker bundle the other.
  const names = inputNames(await readBuildFile('index.html'));
  const worker = await readBuildFile('js/svgo-worker.js');
  const workerKeys = [
    'floatPrecision',
    'transformPrecision',
    'multipass',
    'pretty',
  ];

  t.assert.deepStrictEqual(
    workerKeys.filter((key) => !names.has(key)),
    [],
    'settings the worker reads that no input is named after',
  );
  t.assert.deepStrictEqual(
    workerKeys.filter((key) => !worker.includes(key)),
    [],
    'settings keys missing from build/js/svgo-worker.js',
  );

  // Read by the page only — they change how the result is measured, not how
  // it's optimised.
  const page = await readBuildFile('js/page.js');
  t.assert.deepStrictEqual(
    ['gzip', 'original', 'fingerprint'].filter((key) => !page.includes(key)),
    [],
    'settings keys missing from build/js/page.js',
  );
});

test('every configured SVGO plugin renders a checkbox', async (t) => {
  // Exposing a plugin is meant to be one entry in `src/config.json` and no JS
  // change, which only holds while the template renders all of them.
  const names = inputNames(await readBuildFile('index.html'));
  const config = JSON.parse(
    await fs.readFile(path.join(repoRoot, 'src', 'config.json'), 'utf8'),
  );

  t.assert.ok(config.plugins.length > 0, 'src/config.json lists no plugins');
  t.assert.deepStrictEqual(
    config.plugins.map((plugin) => plugin.id).filter((id) => !names.has(id)),
    [],
    'configured plugins with no checkbox in the built markup',
  );
});

test('the service worker gets a build-derived cache name', async (t) => {
  const sw = await readBuildFile('sw.js');

  // If `@rollup/plugin-replace` stopped substituting it, the SW would throw on
  // an undefined global at install time and offline support would go silently.
  t.assert.ok(
    !sw.includes('SVGOMG_BUILD_ID'),
    'SVGOMG_BUILD_ID was not substituted into build/sw.js',
  );
  // Terser folds the template literal in a production build and leaves it
  // alone in a dev one; both spellings are fine, an absent hash isn't.
  t.assert.match(sw, /static-(?:\$\{)?["'`]?[\da-f]{16}/);
});

test('every precached asset exists in the build', async (t) => {
  // The precache list is hand-written, and `cache.addAll` rejects as a whole if
  // any entry 404s — one stale path disables offline support entirely.
  const sw = await readBuildFile('sw.js');
  const addAll = /addAll\(\[(?<entries>[^\]]*)\]\)/.exec(sw);
  t.assert.ok(addAll, 'no `addAll([...])` precache list found in build/sw.js');

  // Either quote style: terser rewrites these to double quotes, dev builds
  // keep the single quotes from the source.
  const assets = addAll.groups.entries
    .matchAll(/(?<quote>["'])(?<asset>[^"']*)\k<quote>/g)
    .map((match) => match.groups.asset)
    .toArray();
  t.assert.ok(assets.length > 0, 'the precache list is empty');

  const missing = [];
  await Promise.all(
    assets.map(async (asset) => {
      // './' is the app shell, served as index.html.
      const target = asset === './' ? 'index.html' : asset;
      try {
        await fs.access(path.join(buildDir, target));
      } catch {
        missing.push(asset);
      }
    }),
  );

  t.assert.deepStrictEqual(missing, [], 'precached assets missing from build/');
});

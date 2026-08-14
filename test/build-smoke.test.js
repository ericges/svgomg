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
// optional and the backreference has to allow an empty one. Selects count as
// well as inputs: the size-attribute and ID controls are `<select name=…>`.
const inputNamePattern =
  /<(?:input|select)[^>]+\bname=(?<quote>["']?)(?<name>[^\s"'>]+)\k<quote>/g;

// Matches a class name as a whole token. `\b` alone isn't enough: it treats `-`
// as a boundary, so `menu-item` would hit inside both `menu-item-text` and
// `demo-menu-item`, and `toolbar` inside `toolbar-brand`.
const classTokenPattern = (name) =>
  new RegExp(String.raw`(?<![\w-])${name}(?![\w-])`);

const inputNames = (html) =>
  new Set(html.matchAll(inputNamePattern).map((match) => match.groups.name));

// Same optional-quote problem as `inputNamePattern`.
const demoFilePattern =
  /\bdata-demo-file=(?<quote>["']?)(?<file>[^\s"'>]+)\k<quote>/g;

const demoFiles = (html) =>
  new Set(html.matchAll(demoFilePattern).map((match) => match.groups.file));

const readConfig = async () =>
  JSON.parse(
    await fs.readFile(path.join(repoRoot, 'src', 'config.json'), 'utf8'),
  );

// The hand-written `cache.addAll([...])` list from the built service worker.
const precachedAssets = (sw) => {
  const addAll = /addAll\(\[(?<entries>[^\]]*)\]\)/.exec(sw);
  if (!addAll) return;

  // Either quote style: terser rewrites these to double quotes, dev builds
  // keep the single quotes from the source.
  return addAll.groups.entries
    .matchAll(/(?<quote>["'])(?<asset>[^"']*)\k<quote>/g)
    .map((match) => match.groups.asset)
    .toArray();
};

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
    // `dimensionAttrs` rather than `dimensions` on purpose: the latter is
    // already a protocol key (above), so it would satisfy this check on its
    // own and the size-attribute contract would go untested.
    'dimensionAttrs',
    'ids',
    'idPrefix',
    'currentColor',
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
  // change, which only holds while the template renders all of them. They come
  // out of three loops now — the feature list, the metadata block and the
  // styles block — so this also catches a `metadata` or `styles` flag that no
  // branch picks up.
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

test('plugins the new selects absorbed are no longer checkboxes', async (t) => {
  // `cleanupIds`, `removeViewBox` and `removeDimensions` are configured from
  // the "IDs" and "Size attributes" selects now. A checkbox for one of them
  // would be a second, conflicting control over the same plugin.
  const names = inputNames(await readBuildFile('index.html'));
  const config = await readConfig();
  const absorbed = ['cleanupIds', 'removeViewBox', 'removeDimensions'];

  t.assert.deepStrictEqual(
    absorbed.filter((id) => names.has(id)),
    [],
    'absorbed plugins still rendering their own control',
  );
  t.assert.deepStrictEqual(
    config.plugins
      .map((plugin) => plugin.id)
      .filter((id) => absorbed.includes(id)),
    [],
    'absorbed plugins still listed in src/config.json',
  );
});

test('the settings panel carries the controls the page bundle queries', async (t) => {
  // `Settings` resolves all of these with `querySelector` inside a
  // `domReady.then()`, where a null is an uncaught TypeError. The stage blocks
  // additionally have to carry `plugins`: that class is what puts their
  // checkboxes in `_pluginInputs`, and so in `getSettings().plugins`.
  const html = await readBuildFile('index.html');
  const classNames = [
    'settings',
    'settings-scroller',
    'setting-reset',
    'plugins',
    'metadata-select',
    'metadata-custom',
    'styles-select',
    'styles-custom',
  ];

  t.assert.deepStrictEqual(
    classNames.filter((name) => !classTokenPattern(name).test(html)),
    [],
    'selectors the settings panel queries that are missing from the built markup',
  );

  // `sortClassName` reorders class attributes, so match the tag and test the
  // tokens within it rather than the attribute value literally.
  const stageBlocks = ['metadata-custom', 'styles-custom'].map((name) => {
    const tag = new RegExp(
      String.raw`<div[^>]*(?<![\w-])${name}(?![\w-])[^>]*>`,
    ).exec(html);

    return [name, Boolean(tag) && classTokenPattern('plugins').test(tag[0])];
  });

  t.assert.deepStrictEqual(
    stageBlocks.filter(([, isPluginsContainer]) => !isPluginsContainer),
    [],
    'stage blocks that are not .plugins containers — their checkboxes would never reach getSettings()',
  );
});

test('the plugin checkboxes render in the order the worker runs them', async (t) => {
  // Document order of `.plugins input` is `_pluginInputs` order is
  // `Object.entries(settings.plugins)` order is SVGO's execution order.
  // `test/build-plugins.test.js` pins the resulting array; this pins the
  // markup it comes from, which is what a moved checkbox would change.
  const config = await readConfig();
  const ids = new Set(config.plugins.map((plugin) => plugin.id));
  const rendered = [...inputNames(await readBuildFile('index.html'))].filter(
    (name) => ids.has(name),
  );

  t.assert.deepStrictEqual(rendered.slice(0, 10), [
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'removeTitle',
    'removeDesc',
    'mergeStyles',
    'inlineStyles',
    'minifyStyles',
    'convertStyleToAttrs',
    'removeStyleElement',
  ]);
  t.assert.strictEqual(rendered.length, config.plugins.length);
});

test('every configured demo is offered, shipped, and named on the button', async (t) => {
  // Adding a demo is meant to be one entry in `src/config.json`: the template
  // renders the menu item, and the gulpfile's `copy` glob ships exactly the
  // files listed there. `ToolbarActions` only ever reads `data-demo-file`.
  const html = await readBuildFile('index.html');
  const { demos } = await readConfig();
  const offered = demoFiles(html);

  t.assert.ok(demos?.length > 1, 'src/config.json lists no demo menu');
  t.assert.deepStrictEqual(
    demos.map((demo) => demo.file).filter((file) => !offered.has(file)),
    [],
    'configured demos with no menu item in the built markup',
  );

  const missing = [];
  await Promise.all(
    demos.map(async (demo) => {
      try {
        await fs.access(path.join(buildDir, 'test-svgs', demo.file));
      } catch {
        missing.push(demo.file);
      }
    }),
  );
  t.assert.deepStrictEqual(
    missing,
    [],
    'demos offered in the menu that build/test-svgs/ does not carry',
  );

  // The bare button — and the automatic first load through it — take their file
  // from this attribute, so the first configured demo is the default.
  const button = /<button[^>]+\bload-demo\b[^>]*>/.exec(html);
  t.assert.ok(button, 'no `.load-demo` button in the built markup');
  t.assert.deepStrictEqual(
    [...demoFiles(button[0])],
    [demos[0].file],
    'the Demo button does not default to the first configured demo',
  );

  // That one demo loads itself on startup, so it's the only one that has to be
  // there offline — but it does have to be, or a returning visitor's app opens
  // empty. The rest are network-only on purpose.
  const assets = precachedAssets(await readBuildFile('sw.js'));
  t.assert.ok(
    assets?.includes(`test-svgs/${demos[0].file}`),
    'the default demo is not in the service worker precache list',
  );
});

test('the toolbar carries the input actions and the view toggler', async (t) => {
  // The page bundle finds all of these with `querySelector`, so a class renamed
  // in the template is a runtime TypeError inside a `domReady.then()` with
  // nothing else to catch it.
  const html = await readBuildFile('index.html');
  const classNames = [
    'toolbar',
    'load-file',
    'load-file-input',
    'paste-input',
    'toolbar-paste',
    'load-demo',
    'toolbar-demo',
    'demo-menu-btn',
    'demo-menu',
    'demo-menu-item',
    'view-toggler',
  ];

  t.assert.deepStrictEqual(
    // Class *tokens*, not whole attributes: htmlmin unquotes them and they sit
    // alongside other classes.
    classNames.filter((name) => !classTokenPattern(name).test(html)),
    [],
    'selectors the page bundle queries that are missing from the built markup',
  );

  // `ViewToggler` does `container.output[0].checked = true`, which needs a form
  // whose `output` is a RadioNodeList — one radio and it's a lone element.
  t.assert.strictEqual(
    html.matchAll(/name=(?<quote>["']?)output\k<quote>[\s>]/g).toArray().length,
    2,
    'the view toggler needs exactly two radios named `output`',
  );
});

test('the off-canvas menu is gone, and the toolbar is critical CSS', async (t) => {
  const html = await readBuildFile('index.html');
  const drawerClassNames = [
    'main-menu',
    'menu-btn',
    'menu-item',
    'material-tab',
  ];

  t.assert.deepStrictEqual(
    drawerClassNames.filter((name) => classTokenPattern(name).test(html)),
    [],
    'drawer markup left behind in the built page',
  );

  // A partial forwarded from both style indexes emits into both sheets. For the
  // toolbar that's not just waste: all.css arrives after first paint, so a rule
  // for the bar in there can only move it once the page is already up.
  const headCss = await readBuildFile('head.css');
  const allCss = await readBuildFile('all.css');

  t.assert.match(headCss, /\.toolbar/);
  t.assert.ok(
    !allCss.includes('.toolbar'),
    'toolbar CSS leaked into all.css — it belongs to src/styles/critical/',
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
  const assets = precachedAssets(sw);
  t.assert.ok(assets, 'no `addAll([...])` precache list found in build/sw.js');
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

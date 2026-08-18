import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { quotedControlLabels } from '../src/js/page/ui/setting-notes.js';

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

test('the page bundle keeps the copying-array methods out of the boot path', async (t) => {
  // The build minifies without transpiling, so an ES2023 method in the page
  // bundle throws in a browser that runs everything else — and one did:
  // `Settings` briefly booted through `toSorted()`, which would have cost the
  // whole panel, not just the sort. xo's unicorn rules actively rewrite
  // toward these methods (`no-array-sort`, `no-array-reverse`), so the same
  // slip recurs whenever page code appeases the linter — suppress the rule at
  // the call site instead, with `settings.js` as the pattern. Confined to
  // the page bundle: it's all hand-written but `nanoevents`, so a hit here is
  // ours, not a vendored library forcing a baseline discussion.
  const page = await readBuildFile('js/page.js');

  t.assert.deepStrictEqual(
    ['.toSorted(', '.toReversed(', '.toSpliced('].filter((method) =>
      page.includes(method),
    ),
    [],
    'ES2023 copying-array methods in build/js/page.js',
  );
});

test('the page bundle never selects on an attribute the minifier strips', async (t) => {
  // `removeRedundantAttributes` drops `type=text` — it is the HTML default —
  // so `input[type=text]` matches nothing in a production build. The scroller's
  // mousedown exemption used to select on exactly that, which left the ID
  // prefix field unfocusable by click in every shipped build while working
  // fine in `npm run dev`. It reads the `type` DOM property instead now.
  const page = await readBuildFile('js/page.js');
  const html = await readBuildFile('index.html');

  t.assert.doesNotMatch(
    page,
    /input\[type=["']?text/,
    'the page bundle selects on `input[type=text]`, which the minifier strips',
  );

  // The premise, so this test explains itself if the minifier config changes.
  const idPrefix =
    /<input[^>]+\bname=(?<quote>["']?)idPrefix\k<quote>[^>]*>/.exec(html);
  t.assert.ok(idPrefix, 'no idPrefix field in the built markup');
  t.assert.doesNotMatch(idPrefix[0], /\btype=/);
});

test('the preview iframe ships with an empty sandbox', async (t) => {
  // The preview renders untrusted SVG, and one of the bundled demos —
  // `kitchen-sink.svg` — carries a <script>, an `onclick` and a `javascript:`
  // href on purpose, so this attribute is load-bearing rather than theoretical.
  // `sandbox=""` grants nothing; adding `allow-scripts` would let a dropped
  // file run code in the app's origin. Pinned here because the iframe is built
  // by `strToEl` in the page bundle, where no markup test would see it.
  const page = await readBuildFile('js/page.js');

  t.assert.match(
    page,
    /<iframe[^>]+\bsandbox=(?<quote>["'])\k<quote>/,
    'the preview iframe lost its empty `sandbox` attribute',
  );
  t.assert.doesNotMatch(
    page,
    /\bsandbox=["'][^"']*allow-scripts/,
    'the preview iframe grants allow-scripts — untrusted SVG could run code',
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
    'settings-tabs',
    'settings-tab',
    'plugin-category',
    'plugin-category-count',
    'plugin-category-notice',
    'plugin-category-notice-text',
    'setting-item-toggle',
    'setting-item-name',
    'setting-filter-input',
    'setting-filter-count',
    'setting-filter-empty',
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

test('the collision notices quote controls the panel really offers', async (t) => {
  // A notice's fix names a control by its label — "set Styles to “Remove style
  // elements”". Nothing else ties those strings to the template, so renaming an
  // option would leave the advice pointing at a control that no longer exists
  // under that name.
  const html = await readBuildFile('index.html');

  t.assert.deepStrictEqual(
    quotedControlLabels.filter((label) => !html.includes(label)),
    [],
    'labels the notices quote that are missing from the built markup',
  );
});

test('the plugin checkboxes cover the config exactly once each', async (t) => {
  // The pipeline runs in `config.json`'s array order now (`plugin-order.js`),
  // so the markup's order stopped binding it — the panel is free to group and
  // sort its controls. Coverage still matters: a plugin with no checkbox can
  // never be enabled, and one with two would fight itself over a single
  // settings key. The raw match list rather than `inputNames()`, because a
  // duplicate collapses in a Set and nothing else here would notice it.
  const config = await readConfig();
  const html = await readBuildFile('index.html');
  const ids = config.plugins.map((plugin) => plugin.id);
  const rendered = html
    .matchAll(inputNamePattern)
    .map((match) => match.groups.name)
    .filter((name) => ids.includes(name))
    .toArray();
  const byName = (a, b) => a.localeCompare(b);

  t.assert.deepStrictEqual(rendered.toSorted(byName), ids.toSorted(byName));
  // Stated outright as well, because the comparison above is the only thing
  // standing between the categorised list and a plugin rendered twice — once
  // under its category and once in the stage block it also carries a flag for.
  t.assert.strictEqual(rendered.length, 44);
  t.assert.strictEqual(rendered.length, ids.length);
});

test('the tabs each own a panel, and only one of them is showing', async (t) => {
  // `Settings` reads `aria-controls` to find the panel a tab governs, and an
  // id that resolves to nothing would leave `_panels` holding a null.
  const html = await readBuildFile('index.html');
  const tabs = html
    .matchAll(/<button[^>]+\brole=(?<q>["']?)tab\k<q>[^>]*>/g)
    .map(([tag]) => tag)
    .toArray();

  t.assert.strictEqual(tabs.length, 2, 'the panel needs exactly two tabs');

  const attribute = (tag, name) =>
    new RegExp(String.raw`\b${name}=(?<q>["']?)(?<v>[^\s"'>]*)\k<q>`).exec(tag)
      ?.groups.v;

  const governed = tabs.map((tag) => attribute(tag, 'aria-controls'));

  t.assert.deepStrictEqual(
    governed.filter((panel) => !panel),
    [],
    'tabs with no aria-controls',
  );

  t.assert.deepStrictEqual(
    governed.filter(
      (panel) =>
        !new RegExp(String.raw`<div[^>]+\bid=(["']?)${panel}\1[\s>]`).test(
          html,
        ),
    ),
    [],
    'tabs whose aria-controls names no panel',
  );

  t.assert.strictEqual(
    tabs.filter((tag) => attribute(tag, 'aria-selected') === 'true').length,
    1,
    'exactly one tab ships selected',
  );

  // The inactive panel is `hidden`, not merely off-screen: it has to be out of
  // reach of the keyboard and of a screen reader too.
  const panels = html
    .matchAll(/<div[^>]+\brole=(?<q>["']?)tabpanel\k<q>[^>]*>/g)
    .map(([tag]) => tag)
    .toArray();

  t.assert.strictEqual(panels.length, 2);
  t.assert.strictEqual(
    panels.filter((tag) => /\shidden[\s>]/.test(tag)).length,
    1,
    'exactly one panel ships hidden',
  );
});

test('the plugins render under their category, and the flagged ones do not', async (t) => {
  // Where each checkbox lives is the whole point of the split: a categorised
  // plugin belongs to the Optimise tab, and a flagged one renders only inside
  // the stage block its select governs — never in both.
  const config = await readConfig();
  const html = await readBuildFile('index.html');

  // Sliced on markers that only the container carries. `id=` rather than the
  // panel id alone: the tab button names the same string in `aria-controls`,
  // and it comes first in the document.
  const slice = (from, to) => {
    const start = html.indexOf(from);

    if (start === -1) return '';

    const end = html.indexOf(to, start + from.length);

    return html.slice(start, end === -1 ? html.length : end);
  };

  const names = (markup) =>
    new Set(
      markup.matchAll(inputNamePattern).map((match) => match.groups.name),
    );

  const optimise = slice(
    'id=settings-panel-optimise',
    'id=settings-panel-output',
  );

  t.assert.deepStrictEqual(
    config.categories
      .filter((category) => !optimise.includes(`data-category=${category.id}`))
      .map((category) => category.id),
    [],
    'categories that do not render inside the Optimise panel',
  );

  // Categories don't nest, so the first `</details>` closes each one.
  const misfiled = config.categories.flatMap((category) => {
    const rendered = names(slice(`data-category=${category.id}`, '</details>'));

    return config.plugins
      .filter((plugin) => plugin.category === category.id)
      .filter((plugin) => !rendered.has(plugin.id))
      .map((plugin) => `${plugin.id} (${category.id})`);
  });

  t.assert.deepStrictEqual(
    misfiled,
    [],
    'plugins missing from the category they are filed under',
  );

  const onOptimiseTab = names(optimise);

  t.assert.deepStrictEqual(
    config.plugins
      .filter((plugin) => plugin.metadata || plugin.styles)
      .filter((plugin) => onOptimiseTab.has(plugin.id))
      .map((plugin) => plugin.id),
    [],
    'flagged plugins rendered on the Optimise tab as well as in their stage block',
  );

  // And the reverse: nothing categorised leaked into a stage block. The blocks
  // hold labels and spans only, so the first `</div>` closes them.
  const inStageBlocks = new Set(
    ['metadata-custom', 'styles-custom'].flatMap((name) => [
      ...names(slice(name, '</div>')),
    ]),
  );

  t.assert.deepStrictEqual(
    config.plugins
      .filter((plugin) => plugin.category)
      .filter((plugin) => inStageBlocks.has(plugin.id))
      .map((plugin) => plugin.id),
    [],
    'categorised plugins rendered inside a stage block',
  );

  // The stage blocks are still where the flagged plugins do render.
  t.assert.deepStrictEqual(
    config.plugins
      .filter((plugin) => plugin.metadata || plugin.styles)
      .filter((plugin) => !inStageBlocks.has(plugin.id))
      .map((plugin) => plugin.id),
    [],
    'flagged plugins missing from their stage block',
  );
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

  // The bare button takes its file from this attribute, so the first configured
  // demo is the default.
  const button = /<button[^>]+\bload-demo\b[^>]*>/.exec(html);
  t.assert.ok(button, 'no `.load-demo` button in the built markup');
  t.assert.deepStrictEqual(
    [...demoFiles(button[0])],
    [demos[0].file],
    'the Demo button does not default to the first configured demo',
  );

  // That one is what the bare button loads, so it's the only one that has to be
  // there offline — but it does have to be, or the button fails for a returning
  // visitor with no connection. The rest are network-only on purpose.
  const assets = precachedAssets(await readBuildFile('sw.js'));
  t.assert.ok(
    assets?.includes(`test-svgs/${demos[0].file}`),
    'the default demo is not in the service worker precache list',
  );
});

test('the app opens on the empty state, ahead of everything it hides', async (t) => {
  // Nothing loads itself any more: the app opens on this sheet, and `EmptyState`
  // dismisses it on the first file by removing `active`. That one class does
  // three things at once (components/_empty-state.scss): it makes the sheet
  // visible, and it takes the settings panel and the action buttons out of the
  // layout — the latter two through sibling selectors, which only reach elements
  // that come *after* it. Both are contracts the stylesheet can't state itself.
  const html = await readBuildFile('index.html');
  const sheet = /<div[^>]+\bempty-state\b[^>]*>/.exec(html);

  t.assert.ok(sheet, 'no `.empty-state` in the built markup');
  t.assert.ok(
    classTokenPattern('active').test(sheet[0]),
    'the empty state renders without `active`, so it renders invisible',
  );

  const hidden = ['settings-scroller', 'action-button-container'];
  t.assert.deepStrictEqual(
    hidden.filter((name) => html.indexOf(name) < html.indexOf('empty-state')),
    [],
    'markup the empty state hides that the sibling selectors cannot reach',
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
    !sw.includes('OMSVG_BUILD_ID'),
    'OMSVG_BUILD_ID was not substituted into build/sw.js',
  );
  // Terser folds the template literal in a production build and leaves it
  // alone in a dev one; both spellings are fine, an absent hash isn't.
  t.assert.match(sw, /static-(?:\$\{)?["'`]?[\da-f]{16}/);
});

test('the licence and its notices ship with the build', async (t) => {
  // The deployed site is where the bundled MIT/BSD/ISC code actually reaches
  // anyone, so those licences require their notices to travel with it. The raw
  // markdown is the canonical form and isn't precached; the pages built from it
  // are, and the next test covers those.
  const licence = await readBuildFile('LICENSE.md');
  const notice = await readBuildFile('NOTICE.md');

  // The Original Licensor's own copyright covers his own work, and all of it
  // was written in 2026 — the fork point is Jake Archibald's 2025 commit, and its
  // year belongs to his notice, not to this one. Widen the range only when
  // there is another year's work behind it.
  t.assert.match(licence, /^Copyright \(c\) 2026 Eric Gesemann$/m);

  // Three parts, and the whole construction rests on all three being present:
  // Part I grants and conditions, Parts II and III say what a permitted purpose
  // is, and Part I's grants are given for nothing else.
  t.assert.match(licence, /^# OMSVG License 1\.0$/m);
  t.assert.match(licence, /^## Part I — General Terms$/m);
  t.assert.match(licence, /^## Part II — Commercial Terms$/m);
  t.assert.match(licence, /^## Part III — Noncommercial Terms$/m);
  // The two purpose declarations are what the four grants hang on, and they are
  // deliberately parallel — neither part grants anything itself.
  t.assert.match(licence, /^### 16\. Commercial use$/m);
  t.assert.match(licence, /^Any commercial purpose is a permitted purpose\.$/m);
  t.assert.match(
    licence,
    /^Any noncommercial purpose is a permitted purpose\.$/m,
  );
  // Most of the document is a standard licence form whose own terms require that
  // a changed version drop its name and URL. It was changed — the sections that
  // condition it, and the numbering — so neither may come back. See CLAUDE.md.
  t.assert.doesNotMatch(licence, /polyform/i);

  // The chain a recipient of someone else's fork depends on. Pinning the form's
  // "the licensor" to the one named licensor once broke it: every grant then
  // came from him, including when a fork was the one distributing, so the
  // fork's own additions reached its recipients with no grant at all. These two
  // are what replaced that, and neither is decorative.
  t.assert.match(licence, /^### 10\. How permissions reach you$/m);
  t.assert.match(licence, /grants\s+nothing on the Original Licensor's behalf/);
  t.assert.match(licence, /^b\. license your own changes and new works/m);

  // One place to look up a word, which is what let the paragraph explaining the
  // form's own vocabulary go away entirely.
  t.assert.strictEqual(
    (licence.match(/^#{2,3} Definitions$/gm) ?? []).length,
    1,
  );

  // The section numbers run continuously across all three parts, so a gap, a
  // repeat or an off-by-one is a citation pointing at the wrong clause — the
  // failure mode of renumbering, and invisible in a diff of the prose.
  t.assert.deepStrictEqual(
    (licence.match(/^### \d+\. .+$/gm) ?? []).map((h) =>
      Number.parseInt(h.slice(4), 10),
    ),
    Array.from({ length: 19 }, (_, i) => i + 1),
  );

  // The form's fourteen clauses, each under the number it was given. They are
  // distributed across Parts I and III and their text is kept word for word, so
  // nothing but this says where a clause is meant to have ended up — and a
  // count rather than a presence check, because a clause rendering twice would
  // hand the second copy a `-1` slug and a dead link.
  const formClauses = [
    '1. Acceptance',
    '4. Copyright License',
    '5. Distribution License',
    '6. Notices',
    '7. Changes and New Works License',
    '8. Patent License',
    '11. Fair Use',
    '12. No Other Rights',
    '13. Patent Defense',
    '14. Violations',
    '15. No Liability',
    '17. Noncommercial Purposes',
    '18. Personal Uses',
    '19. Noncommercial Organizations',
  ];
  t.assert.deepStrictEqual(
    formClauses.map(
      (heading) =>
        `${heading}: ${licence.split(`\n### ${heading}\n`).length - 1}`,
    ),
    formClauses.map((heading) => `${heading}: 1`),
  );

  // Sections 14 and 15 are the whole of the licence's cure and its disclaimer,
  // and they sit in Part I because they reach every permission. An earlier
  // draft kept a second, weaker cure of its own alongside the form's.
  t.assert.match(
    licence,
    /with these\s+terms, and take practical steps to correct past violations, within 32 days of\s+receiving notice/,
  );
  t.assert.strictEqual(
    (licence.match(/^### \d+\. Violations$/gm) ?? []).length,
    1,
  );

  // The ambiguity that caused the defect above was a capital letter: "the
  // Licensor" meant one person, "the licensor" meant whoever was offering. The
  // first is renamed so that only one of them is a proper noun.
  t.assert.doesNotMatch(licence, /(?<!Original )Licensor/);

  // Sections 2 and 3 carry the whole construction: each opens by making every
  // permission conditional on itself, which is what stops it being an
  // "additional restriction" a recipient could strip. Neither is pinned
  // anywhere else — the numbering check below reads numbers, not titles.
  t.assert.match(licence, /^### 2\. Source availability$/m);
  t.assert.match(licence, /^### 3\. No revenue from providing access$/m);
  t.assert.match(
    licence,
    /Every permission this license grants is\s+conditional on this section and on\s+section 3/,
  );
  t.assert.match(
    licence,
    /Every permission this license grants is also conditional on this section/,
  );

  // Section 3's prohibition is expressly non-exhaustive, so its exceptions must
  // refer to the rule and never back to the examples: "without any of the
  // monetisation listed above" let an unlisted form of indirect monetisation
  // argue it was expressly permitted.
  t.assert.match(licence, /That includes, without limitation:/);
  t.assert.doesNotMatch(licence, /listed above/);
  t.assert.match(
    licence,
    /hosting it publicly free of charge, where you derive no revenue or other\s+consideration of monetary value, directly or indirectly, from providing that\s+access/,
  );
  // The exceptions are deemed rather than illustrative, which is deliberate —
  // so the deeming has to be limited to the conduct each one describes, or free
  // hosting plus something unlisted lands inside it.
  t.assert.match(
    licence,
    /None of the following is, \*\*in itself\*\*, deriving revenue from providing access/,
  );
  t.assert.match(licence, /judged against this section on its own/);
  // The three qualifiers that keep a subscription business out of the client
  // and donation exceptions.
  t.assert.match(licence, /not a material part of what they pay for/);
  t.assert.match(licence, /you do not also make it available to the public/);
  t.assert.match(licence, /is never conditional on payment/);

  // Section 9 reserves the marks against a *changed* public version, not
  // against a mirror — so it has to open with the carve-out rather than a flat
  // prohibition its own third sentence then contradicts. "may keep them"
  // pointed back at a bundle that included the domain.
  t.assert.match(licence, /^### 9\. Name and marks$/m);
  t.assert.match(
    licence,
    /Except as this section allows, this license gives no permission/,
  );
  t.assert.doesNotMatch(licence, /may keep them/);
  t.assert.match(
    licence,
    /An unchanged\s+copy may keep the name, the logo, and the icons/,
  );
  t.assert.match(licence, /does not reach the domain omsvg\.app/);
  t.assert.match(licence, /grants no trademark rights/);

  // The front matter says which sections are the form's and what was done to
  // them. It used to claim they were "kept word for word", which was untrue:
  // section 6 dropped an alternative that pointed at the removed URL, and the
  // form's own definitions were folded into this document's.
  t.assert.doesNotMatch(licence, /kept word for word/);
  t.assert.match(
    licence,
    /The remaining fourteen sections are taken from a\s+standard license form/,
  );
  t.assert.doesNotMatch(licence, /or the URL for them above/);
  t.assert.match(
    licence,
    /Sections 2, 3, 9, 10, and 16 are the Original Licensor's own terms/,
  );

  // The licence governs the code as a whole and reaches nothing the Original
  // Licensor holds no rights in — the repository ships artwork that is other
  // people's, one drawing of it under a copyleft licence.
  t.assert.match(licence, /These terms govern this software as a whole/);
  t.assert.match(
    licence,
    /They do not\s+reach material the Original Licensor holds no\s+rights in/,
  );
  t.assert.match(licence, /ASSETS\.md/);
  // The bundled npm components are that material too, and the licence has to
  // say so as expressly as it says it of the artwork: "all of its code" once
  // read "whatever its origin", which invited the reading that these terms
  // relicense third-party code the Original Licensor never wrote.
  t.assert.doesNotMatch(licence, /whatever its origin/);
  t.assert.match(
    licence,
    /The third-party software components this project bundles are such\s+material/,
  );
  t.assert.match(
    licence,
    /nothing in this license narrows,\s+replaces, or adds a condition to a permission any of them gives/,
  );

  t.assert.match(notice, /The MIT License/);
  // MIT conditions redistribution on *the above* copyright notice, so this is
  // the line as it stood at `f925656` — not an inferred range, and not an
  // aggregate. The other upstream rightsholders are named outside the block.
  t.assert.match(notice, /Copyright \(c\) 2015 Jake Archibald/);
  // `pako` is `MIT AND Zlib` and the app bundles the zlib port, but `test/
  // notices.test.js` only checks that package *names* appear — the zlib terms
  // were named and never supplied for months.
  t.assert.match(notice, /Jean-loup Gailly and Mark Adler/);
  t.assert.match(notice, /This notice may not be removed or altered/);
  // The WOFF2 carries no licence metadata, so the OFL has to reach the reader
  // from here as well as from the precached file.
  t.assert.match(notice, /SIL OPEN FONT LICENSE/);
  // Two packages carry an e-mail address inside the copyright line itself.
  // Dropping it is the same normalisation the upstream block was guilty of.
  t.assert.match(notice, /TJ Holowaychuk <tj@vision-media\.ca>/);
  t.assert.match(notice, /Andrey Sitnik <andrey@sitnik\.ru>/);
  // Every package the bundles carry has to be named; `test/notices.test.js`
  // checks the list against the real dependency closure.
  t.assert.match(notice, /\bsvgo\b/);
  // The artwork is neither code nor this project's, so its terms live in their
  // own document and the notices have to point at it.
  t.assert.match(notice, /ASSETS\.md/);
});

test('every shipped file of artwork has its terms recorded', async (t) => {
  // `test/notices.test.js` walks npm packages only, which is why every demo
  // asset passed it while one of them was Free Art Licensed and unattributed.
  // Nothing but this checks the non-package half.
  const assets = await readBuildFile('ASSETS.md');
  const { demos } = await readConfig();

  // Driven off `config.json` rather than a fixed list, so adding a demo fails
  // the build until someone records where it came from.
  t.assert.deepStrictEqual(
    demos.map((demo) => demo.file).filter((file) => !assets.includes(file)),
    [],
    'demos shipping with no entry in ASSETS.md',
  );

  // The repository is a point of distribution too, so the fixtures that never
  // reach `build/` are covered as well.
  t.assert.deepStrictEqual(
    ['fail.svg'].filter((file) => !assets.includes(file)),
    [],
    'repository-only fixtures with no entry in ASSETS.md',
  );

  // The Tiger is AGPL-3.0-or-later. Section 4 conditions passing a copy on
  // giving the recipient the licence with it, so the text has to ship and
  // ASSETS.md has to say which drawing needs it.
  t.assert.match(assets, /AGPL-3\.0-or-later/);
  t.assert.match(assets, /licences\/AGPL-3\.0\.txt/);
  const agpl = await readBuildFile('licences/AGPL-3.0.txt');
  t.assert.match(agpl, /GNU AFFERO GENERAL PUBLIC LICENSE/);
  t.assert.match(agpl, /Version 3, 19 November 2007/);

  // The aggregation claim has to match what the app really does: the default
  // demo is precached at install, so the old "retrieved only when a user asks
  // for it" was false of it. Driven off the real precache list, so a second
  // precached drawing fails until the sentence accounts for it too.
  const [intro] = assets.split(/^---$/m);
  t.assert.doesNotMatch(intro, /retrieved only when a user asks/);
  t.assert.match(intro, /service\s+worker installs/);
  const precachedDemos = (precachedAssets(await readBuildFile('sw.js')) ?? [])
    .filter((asset) => asset.startsWith('test-svgs/'))
    .map((asset) => asset.slice('test-svgs/'.length));
  t.assert.ok(precachedDemos.length > 0, 'no precached demo to check against');
  t.assert.deepStrictEqual(
    precachedDemos.filter((file) => !intro.includes(file)),
    [],
    'a precached drawing the ASSETS.md aggregation claim does not account for',
  );

  // Both were removed because their terms could not be carried. The record of
  // that is the only thing stopping either being added back unnoticed.
  t.assert.ok(
    demos.every(
      (demo) => demo.file !== 'car.svg' && demo.file !== 'github.svg',
    ),
    'a demo whose terms this project cannot carry is back in src/config.json',
  );
});

// The fenced blocks in NOTICE.md are licence texts with headings of their own,
// so anything asking "did this get converted?" has to look past them.
const stripPre = (html) => html.replaceAll(/<pre[\s\S]*?<\/pre>/g, '');

test('the licence and notices are served as pages', async (t) => {
  // Blue Oak and MIT both want the notice to reach whoever gets a copy, and an
  // unadvertised `/NOTICE.md` doesn't. These are rendered from the same markdown
  // at build time, so a stale copy isn't possible — but a silent render failure
  // would be, which is what the conversion assertions below are for.
  const licence = await readBuildFile('licence.html');
  const notices = await readBuildFile('notices.html');
  const assets = await readBuildFile('assets.html');

  t.assert.match(licence, /OMSVG License 1\.0/);
  t.assert.doesNotMatch(licence, /polyform/i);
  t.assert.match(notices, /Jake Archibald/);
  t.assert.match(notices, /\bsvgo\b/);
  t.assert.match(assets, /Ghostscript/);

  // The licence links to its own clauses; `marked` emits no heading ids unless
  // the gulpfile's renderer puts them there, and a dead anchor in a legal
  // document is invisible until someone follows it. The optional quotes are
  // because `html-minifier-terser` drops them in a production build.
  // The slug carries the section number, so numbering the form's clause
  // headings retargeted both of the licence's own internal links.
  t.assert.match(licence, /<h3 id="?5-distribution-license"?>/);
  t.assert.match(licence, /href="?#5-distribution-license"?/);
  t.assert.match(licence, /<h3 id="?7-changes-and-new-works-license"?>/);
  t.assert.match(licence, /href="?#7-changes-and-new-works-license"?/);

  t.assert.match(licence, /<h2/, 'licence.html carries no rendered headings');
  t.assert.match(notices, /<h2/, 'notices.html carries no rendered headings');
  t.assert.match(assets, /<h2/, 'assets.html carries no rendered headings');

  // A `## ` left at the start of a line means the markdown was inlined rather
  // than converted. Fenced blocks are stripped first: NOTICE.md quotes the Blue
  // Oak licence verbatim, its headings included.
  t.assert.doesNotMatch(stripPre(licence), /^## /m);
  t.assert.doesNotMatch(stripPre(notices), /^## /m);
  t.assert.doesNotMatch(stripPre(assets), /^## /m);

  // NOTICE.md cross-references `./LICENSE.md`; in a build the sibling is a page,
  // so that link has to have been rewritten or it serves raw markdown. The same
  // goes for `./ASSETS.md`, which both of the other two point at.
  t.assert.match(notices, /licence\.html/);
  t.assert.doesNotMatch(notices, /\.\/LICENSE\.md/);
  t.assert.match(notices, /assets\.html/);
  t.assert.doesNotMatch(notices, /\.\/ASSETS\.md/);
  t.assert.doesNotMatch(licence, /\.\/ASSETS\.md/);

  // ASSETS.md links the AGPL text relatively, and that one path has to resolve
  // in the repository and in the build alike — hence `licences/` at the root of
  // both rather than under `src/`.
  t.assert.match(assets, /href="?\.\/licences\/AGPL-3\.0\.txt"?/);
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

  // The other direction, for the one asset that is on the list for a licensing
  // reason rather than a functional one: nothing would break offline without
  // it, so nothing else would notice it going.
  t.assert.ok(
    assets.includes('fonts/JetBrainsMonoNL/OFL.txt'),
    'the font licence is not precached, so an offline copy ships the font without it',
  );
  // Same direction, same reason: the artwork provenance page and the AGPL text
  // the Tiger demo needs.
  t.assert.ok(
    assets.includes('assets.html'),
    'the artwork provenance page is not precached, so an offline copy ships the demos without their terms',
  );
  t.assert.ok(
    assets.includes('licences/AGPL-3.0.txt'),
    'the AGPL text is not precached, so an offline copy lists the Tiger without its licence',
  );
});

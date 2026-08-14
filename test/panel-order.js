import fs from 'node:fs/promises';
import path from 'node:path';

// Not a `.test.js` file, so `npm run test:node` never runs it as a suite — it
// is the one place that knows how `src/config.json` maps onto the order SVGO
// actually receives.
const repoRoot = path.join(import.meta.dirname, '..');

export const readSource = (relativePath) =>
  fs.readFile(path.join(repoRoot, 'src', relativePath), 'utf8');

export const config = JSON.parse(await readSource('config.json'));

// `src/index.njk` renders the plugin checkboxes in three loops — the metadata
// block, then the styles block, then the feature list — and `_pluginInputs` is
// `.plugins input` in document order, which becomes `Object.entries(settings
// .plugins)` and then SVGO's execution order. So a test that walks
// `config.plugins` straight through is running a pipeline the app never
// assembles: with everything enabled the two orders disagree by 14 bytes on
// the kitchen-sink fixture, and `removeStyleElement` moves from tenth to
// thirty-ninth, which is the whole point of grouping the style plugins.
export const panelPlugins = [
  ...config.plugins.filter((plugin) => plugin.metadata),
  ...config.plugins.filter((plugin) => plugin.styles),
  ...config.plugins.filter((plugin) => !plugin.metadata && !plugin.styles),
];

export const panelOrder = panelPlugins.map((plugin) => plugin.id);

// `buildPlugins` iterates the `plugins` object's own entries, so a plugin left
// out of it never runs — an absent key is not the same as `false`.
export const allPlugins = Object.fromEntries(
  panelPlugins.map(({ id }) => [id, true]),
);

export const defaultPlugins = Object.fromEntries(
  panelPlugins.map(({ id, enabledByDefault }) => [
    id,
    Boolean(enabledByDefault),
  ]),
);

// The panel's own defaults, as `getSettings()` would hand them over: the same
// object `buildPlugins()` and `collectNotes()` both take, so a test can drive
// the real pipeline and the notices it produces from one place.
export const panelSettings = ({ plugins, ...overrides } = {}) => ({
  plugins: { ...defaultPlugins, ...plugins },
  multipass: false,
  pretty: false,
  original: false,
  gzip: true,
  floatPrecision: '3',
  transformPrecision: '5',
  dimensionAttrs: 'original',
  ids: 'minify',
  idPrefix: '',
  currentColor: false,
  ...overrides,
});

// Cartesian product of `{ axis: [values] }`, so a settings matrix stays flat
// instead of nesting one callback per control.
export const combinations = (axes) => {
  let rows = [{}];

  for (const [key, values] of Object.entries(axes)) {
    rows = rows.flatMap((row) =>
      values.map((value) => ({ ...row, [key]: value })),
    );
  }

  return rows;
};

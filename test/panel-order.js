import fs from 'node:fs/promises';
import path from 'node:path';

// Not a `.test.js` file, so `npm run test:node` never runs it as a suite — it
// is the shared vocabulary for driving the pipeline the app really assembles.
const repoRoot = path.join(import.meta.dirname, '..');

export const readSource = (relativePath) =>
  fs.readFile(path.join(repoRoot, 'src', relativePath), 'utf8');

export const config = JSON.parse(await readSource('config.json'));

// The pipeline order is `src/config.json`'s array order, which
// `buildPlugins()` walks for itself (`src/js/svgo-worker/plugin-order.js`) —
// the panel's DOM order stopped mattering when the two were decoupled. The
// old names survive so the suites read the same; `panelOrder` re-exports the
// module the worker actually uses, so what the tests pin is what runs.
export const panelPlugins = config.plugins;

export { pluginOrder as panelOrder } from '../src/js/svgo-worker/plugin-order.js';

// `buildPlugins` walks the canonical order and reads each key off the map, so
// an absent key is simply disabled — these list every id explicitly to switch
// them on.
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

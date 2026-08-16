import test from 'node:test';
import { migrateSettings } from '../src/js/page/migrate-settings.js';
import SettingsModel, {
  defaultSettings,
  globalFields,
} from '../src/js/page/settings-model.js';
import { settingNotes } from '../src/js/page/ui/setting-notes.js';
import { stylesStages } from '../src/js/page/ui/setting-stages.js';
import {
  config,
  defaultPlugins,
  panelOrder,
  panelSettings,
  readSource,
} from './panel-order.js';

// The fingerprint's fixed half, hand-computed from `index.njk`: every named
// control except `gzip` and `original`, in document order, a checkbox as a bit
// and everything else delimited. The plugin half is derived below rather than
// spelled out, since adding a plugin to `config.json` legitimately lengthens
// it.
const GLOBAL_PREFIX = '0,|3|,|5|,|original|,|minify|,||,0,0';

const defaultPluginBits = config.plugins
  .map((plugin) => Number(Boolean(plugin.enabledByDefault)))
  .join(',');

// A model over two known plugins, so a whole fingerprint can be written out.
const twoPluginModel = () =>
  new SettingsModel({
    ...defaultSettings(),
    plugins: { removeComments: true, removeDoctype: false },
  });

// The snapshot fixtures `test/setting-notes.test.js` uses, kept in step with
// it: what each guarded plugin saw when it ran.
const nothing = {
  hasStyleElement: false,
  hasFilledStyleElement: false,
  hasScripts: false,
  hasMask: false,
  hasIds: true,
  isDefsOnlyRoot: false,
  hasNonRenderingElement: true,
  hasMultiChildGroup: true,
  hasStyleRules: false,
  hasConvertibleStylesheet: false,
};

const STYLE = {
  ...nothing,
  hasStyleElement: true,
  hasFilledStyleElement: true,
  hasStyleRules: true,
  hasConvertibleStylesheet: true,
};

const everywhere = (snapshot) =>
  Object.fromEntries(
    settingNotes
      .filter((rule) => rule.subject)
      .map((rule) => [rule.subject, snapshot]),
  );

// `<input>` tags, and `<select>`s with their options, from the settings panel
// alone — the file also carries `<meta name=…>` and the view-toggler radios.
const panelControls = async () => {
  const source = await readSource('index.njk');
  const start = source.indexOf('<div class="settings">');
  const end = source.indexOf('<div class="preloader"');
  const panel = source.slice(start, end);

  return (
    Array.from(
      panel.matchAll(/<input\b[^>]*>|<select\b[^>]*>.*?<\/select>/gs),
      ([tag]) => ({
        tag,
        name: /\bname="(?<name>[^"]*)"/.exec(tag)?.groups.name,
      }),
    )
      .filter((control) => control.name !== undefined)
      // The plugin macro renders its `name` from `config.json`; the checkboxes
      // it produces are covered by the plugin-default assertion instead.
      .filter((control) => !control.name.includes('{{'))
  );
};

// What the markup would hand `getSettings()` before anyone touches it.
const initialValue = ({ tag }) => {
  if (tag.startsWith('<select')) {
    return (
      /<option value="(?<value>[^"]*)"[^>]*\sselected/.exec(tag)?.groups
        .value ?? ''
    );
  }

  if (/\btype="checkbox"/.test(tag)) return /\schecked[\s>]/.test(tag);

  return /\svalue="(?<value>[^"]*)"/.exec(tag)?.groups.value ?? '';
};

test('the default fingerprint is the panel state, encoded as it always was', (t) => {
  const model = new SettingsModel();

  t.assert.strictEqual(
    model.fingerprint,
    `${GLOBAL_PREFIX},${defaultPluginBits}`,
  );
  // One field per named control except the two view-only ones, plus one bit
  // per plugin.
  t.assert.strictEqual(
    model.fingerprint.split(',').length,
    globalFields.length - 2 + config.plugins.length,
  );
});

test('a whole fingerprint, written out', (t) => {
  // Small enough to read: the eight globals, then `removeComments` and
  // `removeDoctype` in `config.json` order.
  t.assert.strictEqual(
    twoPluginModel().fingerprint,
    '0,|3|,|5|,|original|,|minify|,||,0,0,1,0',
  );
});

test('gzip and original are settings but not cache keys', (t) => {
  const model = new SettingsModel();
  const before = model.fingerprint;

  model.setGlobal('gzip', false);
  model.setGlobal('original', true);

  t.assert.strictEqual(model.fingerprint, before);
  // They do reach the settings object — `MainController` reads both.
  t.assert.strictEqual(model.get().gzip, false);
  t.assert.strictEqual(model.get().original, true);
});

test('every other control moves the fingerprint', (t) => {
  // Each entry mutates one control and states the whole global half it should
  // produce; the plugin half never moves here.
  const cases = [
    [
      (model) => model.setGlobal('pretty', true),
      '1,|3|,|5|,|original|,|minify|,||,0,0',
    ],
    // A number in, a string out — the control only ever produced strings.
    [
      (model) => model.setGlobal('floatPrecision', 4),
      '0,|4|,|5|,|original|,|minify|,||,0,0',
    ],
    [
      (model) => model.setGlobal('transformPrecision', '0'),
      '0,|3|,|0|,|original|,|minify|,||,0,0',
    ],
    [
      (model) => model.setGlobal('dimensionAttrs', 'viewBox'),
      '0,|3|,|5|,|viewBox|,|minify|,||,0,0',
    ],
    [
      (model) => model.setGlobal('ids', 'keep'),
      '0,|3|,|5|,|original|,|keep|,||,0,0',
    ],
    [
      (model) => model.setGlobal('idPrefix', 'icon-'),
      '0,|3|,|5|,|original|,|minify|,|icon-|,0,0',
    ],
    [
      (model) => model.setGlobal('currentColor', true),
      '0,|3|,|5|,|original|,|minify|,||,1,0',
    ],
    [
      (model) => model.setGlobal('multipass', true),
      '0,|3|,|5|,|original|,|minify|,||,0,1',
    ],
  ];

  const wrong = cases.filter(([mutate, expected]) => {
    const model = new SettingsModel();

    mutate(model);

    return model.fingerprint !== `${expected},${defaultPluginBits}`;
  });

  t.assert.deepStrictEqual(
    wrong.map(([, expected]) => expected),
    [],
    'controls whose fingerprint is not what the encoding says',
  );
});

test('a plugin toggle flips its own bit, in pipeline order', (t) => {
  const model = new SettingsModel();

  // `removeTitle` ships off and sits fourth in `config.json`.
  model.setPlugin('removeTitle', true);

  const bits = model.fingerprint.split(',').slice(globalFields.length - 2);

  t.assert.strictEqual(bits[3], '1');
  t.assert.strictEqual(
    bits.join(','),
    defaultPluginBits
      .split(',')
      .map((bit, index) => (index === 3 ? '1' : bit))
      .join(','),
  );
});

test('the plugin map is emitted in canonical pipeline order', (t) => {
  t.assert.deepStrictEqual(Object.keys(new SettingsModel().get().plugins), [
    ...panelOrder,
  ]);
});

test('a name the pipeline does not know sorts last rather than throwing', (t) => {
  const model = new SettingsModel({
    ...defaultSettings(),
    plugins: {
      notAPlugin: true,
      removeDoctype: false,
      removeComments: true,
    },
  });

  t.assert.deepStrictEqual(Object.keys(model.get().plugins), [
    'removeComments',
    'removeDoctype',
    'notAPlugin',
  ]);
  t.assert.strictEqual(model.fingerprint.endsWith(',1,0,1'), true);
});

test('get() hands out a fresh object every call', (t) => {
  // `MainController` keeps one as the undo snapshot across an await.
  const model = new SettingsModel();
  const snapshot = model.get();

  model.setGlobal('pretty', true);
  model.setPlugin('removeComments', false);

  t.assert.strictEqual(snapshot.pretty, false);
  t.assert.strictEqual(snapshot.plugins.removeComments, true);
});

test('picking a stage writes the checkboxes it stands for', (t) => {
  const model = new SettingsModel();

  model.setStage('styles', 'remove');

  const { plugins } = model.get();

  t.assert.deepStrictEqual(
    Object.fromEntries(
      Object.keys(stylesStages.remove).map((name) => [name, plugins[name]]),
    ),
    stylesStages.remove,
  );
  t.assert.strictEqual(model.stageOf('styles'), 'remove');
});

test('custom reveals the checkboxes without rewriting them', (t) => {
  const model = new SettingsModel();
  const before = model.get().plugins;

  model.setStage('metadata', 'custom');

  t.assert.strictEqual(model.stageOf('metadata'), 'custom');
  t.assert.deepStrictEqual(model.get().plugins, before);
});

test('a checkbox toggled by hand does not re-derive its select', (t) => {
  // The asymmetry the panel depends on: this combination is exactly the
  // 'attributes' stage, but the block must not snap shut mid-edit.
  const model = new SettingsModel();

  t.assert.strictEqual(model.stageOf('styles'), 'inline');

  model.setPlugin('convertStyleToAttrs', true);

  t.assert.strictEqual(model.stageOf('styles'), 'inline');

  // Restoring the same state programmatically is the one direction that does
  // derive.
  const restored = new SettingsModel();

  restored.set(model.get());

  t.assert.strictEqual(restored.stageOf('styles'), 'attributes');
});

test('the stages start where the markup starts them', (t) => {
  const model = new SettingsModel();

  t.assert.strictEqual(model.stageOf('metadata'), 'junk');
  t.assert.strictEqual(model.stageOf('styles'), 'inline');
});

test('reset returns every control to its default', (t) => {
  const model = new SettingsModel();

  model.setGlobal('pretty', true);
  model.setGlobal('idPrefix', 'icon-');
  model.setGlobal('floatPrecision', '8');
  model.setPlugin('removeTitle', true);
  model.setStage('styles', 'remove');
  model.setStage('metadata', 'custom');

  model.reset();

  t.assert.deepStrictEqual(model.get(), new SettingsModel().get());
  t.assert.strictEqual(model.stageOf('metadata'), 'junk');
  t.assert.strictEqual(model.stageOf('styles'), 'inline');
});

test('the defaults are config.json and the shared test vocabulary', (t) => {
  const defaults = defaultSettings();

  t.assert.deepStrictEqual(defaults.plugins, defaultPlugins);
  // `panelSettings()` is what the other suites drive the real pipeline with,
  // so the model and they cannot describe different panels.
  t.assert.deepStrictEqual(defaults, panelSettings());
});

test('the defaults are the markup, control for control', async (t) => {
  const controls = await panelControls();

  t.assert.deepStrictEqual(
    controls.map((control) => control.name),
    globalFields.map((field) => field.name),
    'the panel’s named controls, in the order the fingerprint reads them',
  );

  const defaults = defaultSettings();

  t.assert.deepStrictEqual(
    controls
      .map((control) => [control.name, initialValue(control)])
      .filter(([name, initial]) => initial !== defaults[name]),
    [],
    'controls whose initial markup state is not the model default',
  );

  // The bounds a restored value is normalised against have to be the ones the
  // slider will apply to it, or the model and the panel disagree.
  const attribute = (tag, name) =>
    Number(new RegExp(String.raw`\s${name}="(?<v>[^"]*)"`).exec(tag)?.groups.v);

  t.assert.deepStrictEqual(
    controls
      .filter(({ tag }) => /\btype="range"/.test(tag))
      .map(({ tag, name }) => [
        name,
        attribute(tag, 'min'),
        attribute(tag, 'max'),
        attribute(tag, 'step'),
      ]),
    globalFields
      .filter((field) => field.type === 'range')
      .map((field) => [field.name, field.min, field.max, field.step]),
    'range bounds that differ from the markup',
  );
});

test('a restored range value is snapped to the step the control offers', (t) => {
  // A fraction the slider cannot display must not survive in the model: it
  // would show 2 in the panel while sending 1.5 to the worker and the cache
  // key, and nothing would reveal the split until that slider was moved.
  const model = new SettingsModel();

  model.set({ floatPrecision: '1.5' });

  t.assert.strictEqual(model.get().floatPrecision, '2');

  model.set({ transformPrecision: 6.4 });

  t.assert.strictEqual(model.get().transformPrecision, '6');

  // Out of range as well as off-step: clamped first, then snapped.
  model.set({ floatPrecision: '99.7' });

  t.assert.strictEqual(model.get().floatPrecision, '8');
  t.assert.strictEqual(model.fingerprint.startsWith('0,|8|,|6|'), true);

  // Whole values are left exactly as they are — this is the common path.
  model.set({ floatPrecision: '3', transformPrecision: '5' });

  t.assert.strictEqual(model.get().floatPrecision, '3');
  t.assert.strictEqual(model.get().transformPrecision, '5');
});

test('the notices are the ones collectNotes produces', (t) => {
  const model = new SettingsModel();

  t.assert.deepStrictEqual(model.notes(), [], 'nothing before the first file');

  model.setCollisions({
    fingerprint: model.fingerprint,
    subjects: everywhere(nothing),
  });

  t.assert.deepStrictEqual(model.notes(), []);

  model.setCollisions({
    fingerprint: model.fingerprint,
    subjects: everywhere(STYLE),
  });

  const names = model.notes().map((note) => note.name);

  // `removeUselessStrokeAndFill` returns nothing at all while any `<style>`
  // element is present, and it ships on.
  t.assert.strictEqual(names.includes('removeUselessStrokeAndFill'), true);
  t.assert.strictEqual(
    model.notes().every((note) => note.text !== ''),
    true,
  );
});

test('nothing is claimed while Show original is on', (t) => {
  const model = new SettingsModel();

  model.setCollisions({
    fingerprint: model.fingerprint,
    subjects: everywhere(STYLE),
  });
  model.setGlobal('original', true);

  t.assert.deepStrictEqual(model.notes(), []);
});

test('the notices go pending when they describe another run', (t) => {
  const model = new SettingsModel();

  t.assert.strictEqual(model.pending, false, 'no report, nothing to qualify');

  model.setCollisions({
    fingerprint: model.fingerprint,
    subjects: everywhere(STYLE),
  });

  t.assert.strictEqual(model.pending, false);

  model.setGlobal('multipass', true);

  t.assert.strictEqual(model.pending, true);

  model.setGlobal('multipass', false);

  t.assert.strictEqual(model.pending, false, 'back to the settings it ran on');

  // `gzip` and `original` are outside the fingerprint, so neither invalidates
  // a report.
  model.setGlobal('gzip', false);

  t.assert.strictEqual(model.pending, false);
});

test('a saved payload round-trips through migrateSettings', (t) => {
  const saved = {
    gzip: true,
    pretty: false,
    multipass: false,
    floatPrecision: '3',
    transformPrecision: '5',
    // Persisted alongside the rest, and meaningless on the way back in.
    fingerprint: 'stale',
    plugins: {
      cleanupIds: true,
      removeDimensions: true,
      removeComments: true,
      removeMetadata: true,
      removeEditorsNSData: true,
      removeTitle: false,
      removeDesc: true,
    },
  };

  const model = new SettingsModel();

  model.set(migrateSettings(saved));

  const settings = model.get();

  t.assert.strictEqual(settings.dimensionAttrs, 'viewBox');
  t.assert.strictEqual(settings.ids, 'minify');
  // The retired checkboxes are gone, and no longer keys of anything.
  t.assert.strictEqual('cleanupIds' in settings.plugins, false);
  t.assert.strictEqual('removeDimensions' in settings.plugins, false);
  // The legacy metadata remap, and the stage it now derives to.
  t.assert.strictEqual(settings.plugins.removeDesc, false);
  t.assert.strictEqual(model.stageOf('metadata'), 'junk');
  // The stored fingerprint is recomputed, never restored.
  t.assert.strictEqual(settings.fingerprint, model.fingerprint);
  t.assert.strictEqual(
    settings.fingerprint.startsWith('0,|3|,|5|,|viewBox|'),
    true,
  );
});

test('set() takes a payload get() produced, unchanged', (t) => {
  const source = new SettingsModel();

  source.setGlobal('idPrefix', 'icon-');
  source.setGlobal('dimensionAttrs', 'both');
  source.setPlugin('removeScripts', true);
  source.setStage('metadata', 'all');

  const restored = new SettingsModel();

  restored.set(source.get());

  t.assert.deepStrictEqual(restored.get(), source.get());
  t.assert.strictEqual(restored.stageOf('metadata'), 'all');
});

test('a payload the panel cannot have produced is not passed on', (t) => {
  const model = new SettingsModel();

  // A corrupted save: the DOM would have blanked the select and jumped the
  // range to its midpoint. Keeping the current value is the safer answer.
  model.set({ dimensionAttrs: 'nonsense', floatPrecision: 'x', ids: 'keep' });

  t.assert.strictEqual(model.get().dimensionAttrs, 'original');
  t.assert.strictEqual(model.get().floatPrecision, '3');
  t.assert.strictEqual(model.get().ids, 'keep');

  // Out of range, as the control itself would have clamped it.
  model.set({ floatPrecision: 99 });

  t.assert.strictEqual(model.get().floatPrecision, '8');

  // And a payload with no plugin map at all restores what it does carry.
  model.set({ pretty: true });

  t.assert.strictEqual(model.get().pretty, true);
});

import test from 'node:test';
import { migrateSettings } from '../src/js/page/migrate-settings.js';

// The five metadata plugins as `config.json` used to default them.
const oldMetadata = {
  removeComments: true,
  removeMetadata: true,
  removeEditorsNSData: true,
  removeTitle: false,
  removeDesc: true,
};

const oldSettings = (plugins = {}) => ({
  gzip: true,
  pretty: false,
  multipass: false,
  floatPrecision: '3',
  transformPrecision: '5',
  plugins: { cleanupIds: true, ...plugins },
});

test('reads the old dimension toggles as a size-attribute mode', (t) => {
  t.assert.strictEqual(
    migrateSettings(oldSettings({ removeDimensions: true })).dimensionAttrs,
    'viewBox',
  );
  t.assert.strictEqual(
    migrateSettings(oldSettings({ removeViewBox: true })).dimensionAttrs,
    'widthHeight',
  );
});

test('resolves both dimension toggles to what they used to amount to', (t) => {
  // `removeDimensions` ran later in the plugin order, so it won.
  const migrated = migrateSettings(
    oldSettings({ removeDimensions: true, removeViewBox: true }),
  );

  t.assert.strictEqual(migrated.dimensionAttrs, 'viewBox');
});

test('leaves the size-attribute mode absent when neither toggle was set', (t) => {
  // Absent means `setSettings` skips it and the markup default stands.
  const migrated = migrateSettings(
    oldSettings({ removeDimensions: false, removeViewBox: false }),
  );

  t.assert.ok(!('dimensionAttrs' in migrated));
});

test('reads the old cleanupIds toggle as an ID mode', (t) => {
  t.assert.strictEqual(
    migrateSettings(oldSettings({ cleanupIds: true })).ids,
    'minify',
  );
  t.assert.strictEqual(
    migrateSettings(oldSettings({ cleanupIds: false })).ids,
    'keep',
  );
});

test('leaves the ID mode absent when nothing was stored for it', (t) => {
  const settings = oldSettings();
  delete settings.plugins.cleanupIds;

  t.assert.ok(!('ids' in migrateSettings(settings)));
});

test('drops the plugin keys the selects absorbed', (t) => {
  const migrated = migrateSettings(
    oldSettings({ removeViewBox: true, removeDimensions: false }),
  );

  t.assert.deepStrictEqual(
    ['cleanupIds', 'removeViewBox', 'removeDimensions'].filter(
      (name) => name in migrated.plugins,
    ),
    [],
  );
});

test('re-reads untouched metadata defaults as the new default stage', (t) => {
  // The old default kept `<title>` but dropped `<desc>`, which matches no
  // stage; left alone it would pin every returning visitor to "Custom".
  const migrated = migrateSettings(oldSettings(oldMetadata));

  t.assert.strictEqual(migrated.plugins.removeDesc, false);
  t.assert.strictEqual(migrated.plugins.removeTitle, false);
  t.assert.strictEqual(migrated.plugins.removeComments, true);
});

test('leaves a deliberate metadata combination alone', (t) => {
  const migrated = migrateSettings(
    oldSettings({ ...oldMetadata, removeComments: false }),
  );

  t.assert.strictEqual(migrated.plugins.removeDesc, true);
  t.assert.strictEqual(migrated.plugins.removeComments, false);
});

test('passes settings in the new shape through untouched', (t) => {
  const settings = {
    ...oldSettings(),
    dimensionAttrs: 'both',
    ids: 'removeUnused',
    idPrefix: 'svgomg_',
    currentColor: true,
    plugins: { removeComments: true },
  };

  t.assert.deepStrictEqual(migrateSettings(settings), settings);
});

test('does not mutate what it was given', (t) => {
  const settings = oldSettings({ removeViewBox: true });
  const before = structuredClone(settings);

  migrateSettings(settings);

  t.assert.deepStrictEqual(settings, before);
});

test('survives settings with no plugins at all', (t) => {
  // `setSettings` indexes into `plugins`, so it must not come back undefined.
  t.assert.deepStrictEqual(migrateSettings({ gzip: true }).plugins, {});
});

// Saved settings predate the "Size attributes" and "IDs" selects, which
// absorbed three plugin checkboxes between them. `Settings.setSettings()`
// ignores names it finds no input for, so without a translation the stored
// booleans would be dropped on the floor and every returning visitor would
// quietly get the defaults for those controls instead of their own choices.

const retiredPlugins = ['removeViewBox', 'removeDimensions', 'cleanupIds'];

// What `config.json` used to default the five metadata plugins to. Settings
// matching this exactly are untouched defaults rather than a deliberate
// combination, so they're re-read as the new "drop junk, keep accessibility"
// stage — otherwise practically every returning visitor lands on "Custom" and
// stays there. It does mean `<desc>` survives from now on, which is the
// intended new default.
const oldMetadataDefaults = {
  removeComments: true,
  removeMetadata: true,
  removeEditorsNSData: true,
  removeTitle: false,
  removeDesc: true,
};

const isOldMetadataDefault = (plugins) =>
  Object.entries(oldMetadataDefaults).every(
    ([name, enabled]) => plugins[name] === enabled,
  );

export const migrateSettings = (settings) => {
  const plugins = { ...settings.plugins };
  const migrated = { ...settings, plugins };

  // A save made by this version always carries the select keys, so their
  // absence is what identifies a legacy save. Only those get the metadata
  // remap below — a current user must be able to keep the exact combination
  // the old defaults happened to be.
  const isLegacySave =
    settings.ids === undefined && settings.dimensionAttrs === undefined;

  if (migrated.dimensionAttrs === undefined) {
    // Both toggles could be on at once; `removeDimensions` ran later and won,
    // so that's the mode this used to amount to. Neither one set leaves the
    // key absent, so the value rendered in the markup stands.
    if (plugins.removeDimensions) {
      migrated.dimensionAttrs = 'viewBox';
    } else if (plugins.removeViewBox) {
      migrated.dimensionAttrs = 'widthHeight';
    }
  }

  if (migrated.ids === undefined && 'cleanupIds' in plugins) {
    migrated.ids = plugins.cleanupIds ? 'minify' : 'keep';
  }

  if (isLegacySave && isOldMetadataDefault(plugins)) {
    plugins.removeDesc = false;
  }

  for (const name of retiredPlugins) delete plugins[name];

  return migrated;
};

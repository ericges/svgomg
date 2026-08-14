// The `plugins` array order in `src/config.json` is the canonical pipeline
// order: SVGO runs plugins in the order given, and `buildPlugins()` assembles
// its array by walking this list rather than the order the panel happened to
// send — so the settings UI is free to group and sort its controls without
// silently reordering the optimisation. Inserting a plugin's `config.json`
// entry is what declares its pipeline slot.
//
// Shared with the page (like `id-prefix.js`) so `getSettings()` emits its map
// in the same order the worker will run it. The import attribute is for Node,
// which loads this module under `node --test`; the gulpfile's `json-module`
// transform handles it for the bundles.
import config from '../../config.json' with { type: 'json' };

export const pluginOrder = config.plugins.map((plugin) => plugin.id);

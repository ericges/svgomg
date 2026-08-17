// The settings panel's state, with no DOM in it. `ui/settings.js` is now a
// binder that mirrors this model into the markup and the events back into it;
// everything that decides what a setting *means* — the emitted object, the
// cache fingerprint, the staged selects, the collision notices, the defaults —
// lives here, where `node --test` can reach it. The panel held the most logic
// in the codebase and the least coverage, and a preset (see `FUTURE.md`) has
// nowhere to live while the DOM is the only store.
//
// Sibling of `migrate-settings.js` rather than a member of `ui/` precisely
// because it must not reach for `document`. That placement changes no output
// filename — bundles are named after their directory.
//
// It *composes* `ui/setting-stages.js` and `ui/setting-notes.js` rather than
// absorbing them: both are already DOM-free and already covered.

import config from '../../config.json' with { type: 'json' };
import { pluginOrder } from '../svgo-worker/plugin-order.js';
import { collectNotes } from './ui/setting-notes.js';
import {
  deriveStage,
  metadataStages,
  stylesStages,
} from './ui/setting-stages.js';

// The named controls that aren't plugin checkboxes, in the order their values
// are pushed into the fingerprint — so this array is a byte-for-byte contract
// with the results cache and not merely a list. It was `index.njk`'s document
// order until the panel grew tabs; now `test/settings-model.test.js` pins the
// order outright, and holds the markup to the same *set* of controls and every
// `default`, so the two can't drift.
//
// `type` mirrors the control the template renders, because the fingerprint
// treats checkboxes (a bit) differently from everything else (a delimited
// value), and because it says how an incoming value has to be coerced.
export const globalFields = [
  { name: 'gzip', type: 'checkbox', default: true },
  { name: 'pretty', type: 'checkbox', default: false },
  {
    name: 'floatPrecision',
    type: 'range',
    default: '3',
    min: 0,
    max: 8,
    step: 1,
  },
  {
    name: 'transformPrecision',
    type: 'range',
    default: '5',
    min: 0,
    max: 8,
    step: 1,
  },
  {
    name: 'dimensionAttrs',
    type: 'select',
    default: 'original',
    options: ['original', 'viewBox', 'widthHeight', 'both'],
  },
  {
    name: 'ids',
    type: 'select',
    default: 'minify',
    options: ['minify', 'removeUnused', 'keep'],
  },
  { name: 'idPrefix', type: 'text', default: '' },
  { name: 'currentColor', type: 'checkbox', default: false },
  { name: 'multipass', type: 'checkbox', default: false },
];

// `gzip` doesn't change SVGO's output — only how the result is measured — so it
// doesn't belong in the cache key. It used to have "Show original" for company,
// until that became a view mode on the canvas rather than a setting.
const unfingerprinted = new Set(['gzip']);

// Which checkboxes each staged select governs. Taken from `config.json`'s
// flags rather than from the stage maps' own keys, exactly as the panel takes
// them from the DOM: a flagged plugin missing from a map has to still reach
// `deriveStage()`, so that it matches no stage and the select pins to 'custom'
// with the block held open. That's the documented failure mode
// `test/setting-stages.test.js` guards; reading the names off the map instead
// would quietly hide it.
const stageGroups = {
  metadata: {
    stages: metadataStages,
    names: config.plugins
      .filter((plugin) => plugin.metadata)
      .map((plugin) => plugin.id),
  },
  styles: {
    stages: stylesStages,
    names: config.plugins
      .filter((plugin) => plugin.styles)
      .map((plugin) => plugin.id),
  },
};

/**
 * The state the panel ships with: `config.json`'s `enabledByDefault` for every
 * plugin, and the `globalFields` table for the rest. The markup carries the
 * same values as its initial attributes — that's what paints the panel before
 * any of this runs — and the test holds the two together.
 *
 * @returns {object} A fresh settings object, without a fingerprint.
 */
export const defaultSettings = () => {
  const settings = {
    plugins: Object.fromEntries(
      config.plugins.map((plugin) => [
        plugin.id,
        Boolean(plugin.enabledByDefault),
      ]),
    ),
  };

  for (const field of globalFields) settings[field.name] = field.default;

  return settings;
};

// Incoming values are coerced the way the control itself would coerce them,
// since a restored payload used to be assigned straight onto an input: a
// checkbox yields a boolean, everything else a string, and a range is clamped
// and snapped to its step exactly as the input's own value sanitisation does.
//
// The model has to land on the value the slider will *display*, not merely a
// legal-looking one: `_syncDom()` hands this to the real input, which rounds
// it, and from then on the panel would be showing 2 while the worker and the
// cache key were given 1.5 — invisible until someone moves that slider.
//
// Two cases deliberately stop imitating the DOM, because there the control
// discards the setting rather than correcting it: a select handed an unknown
// value blanks itself, and a range handed a non-numeric one jumps to its
// midpoint. Neither is reachable from a payload `get()` produced, and keeping
// the current value is the more defensible answer for a corrupted save than
// passing nonsense on to the worker.
const coerceValue = (field, current, value) => {
  if (field.type === 'checkbox') return Boolean(value);

  const text = String(value);

  if (field.options && !field.options.includes(text)) return current;

  if (field.type === 'range') {
    const number = Number(text);

    if (Number.isNaN(number)) return current;

    // Clamp first, then snap — the order the value sanitisation algorithm
    // uses. Ties go to the higher step, which is both what the spec says and
    // what `Math.round` does. The markup's bounds are themselves multiples of
    // the step (the test holds all three equal to the template), so snapping
    // a clamped value can't leave the range again.
    const clamped = Math.min(Math.max(number, field.min), field.max);

    return String(
      field.min + Math.round((clamped - field.min) / field.step) * field.step,
    );
  }

  return text;
};

export default class SettingsModel {
  /**
   * Build a model sitting on its defaults.
   *
   * @param {object} [defaults] The state `reset()` returns to. Defaults to the
   * panel's own, and is only worth passing in a test.
   */
  constructor(defaults = defaultSettings()) {
    this._defaults = { plugins: { ...defaults.plugins } };

    for (const field of globalFields) {
      this._defaults[field.name] =
        field.name in defaults ? defaults[field.name] : field.default;
    }

    // Canonical pipeline order (`plugin-order.js`), not the order the panel
    // happens to lay its checkboxes out in: `buildPlugins()` decides the
    // execution order for itself, but emitting the map — and the fingerprint
    // built from it — in that same order keeps a mid-update worker from an
    // older build running the panel's layout as a pipeline, and keeps two
    // visual arrangements of the same settings from producing different cache
    // keys. An unknown name shouldn't exist; it sorts last rather than
    // throwing.
    const pluginIndex = new Map(pluginOrder.map((id, index) => [id, index]));

    this._pluginNames = Object.keys(this._defaults.plugins);
    // In-place `sort`, not `toSorted`: the build minifies without transpiling,
    // and this line runs in the boot path — an ES2023-only method here costs
    // the whole panel in a browser that otherwise runs everything on it. The
    // array is `Object.keys`' own, so the mutation reaches nobody. (As a bare
    // statement the sort passes `unicorn/no-array-sort`, which only flags
    // sorts posing as copies.)
    this._pluginNames.sort(
      (a, b) =>
        (pluginIndex.get(a) ?? pluginOrder.length) -
        (pluginIndex.get(b) ?? pluginOrder.length),
    );

    // What each guarded plugin saw when it last ran, for the collision
    // notices. Undefined until `MainController` has an optimised file to
    // describe, which is also what keeps the notices off an app that has
    // nothing open.
    this._collisions = undefined;
    this._stages = {};
    this.reset();
  }

  /**
   * The settings object the rest of the app passes around — the same shape
   * `Settings.getSettings()` has always returned, plugins first and in
   * pipeline order.
   *
   * @returns {object} A fresh object every call: `MainController` keeps one as
   * the undo snapshot across an await, so it must not alias this model.
   */
  get() {
    const plugins = {};

    for (const name of this._pluginNames) plugins[name] = this._plugins[name];

    const settings = { plugins };

    for (const field of globalFields) {
      settings[field.name] = this._globals[field.name];
    }

    settings.fingerprint = this.fingerprint;

    return settings;
  }

  /**
   * Everything that changes SVGO's output, in one string.
   *
   * @returns {string} The results-cache key for the current state.
   */
  get fingerprint() {
    const fingerprint = [];

    for (const field of globalFields) {
      if (unfingerprinted.has(field.name)) continue;

      const value = this._globals[field.name];

      fingerprint.push(
        field.type === 'checkbox' ? Number(value) : `|${value}|`,
      );
    }

    for (const name of this._pluginNames) {
      fingerprint.push(Number(this._plugins[name]));
    }

    return fingerprint.join(',');
  }

  /**
   * Restore a whole payload — saved settings, or the undo of a reset. Names
   * the panel doesn't have are ignored, which is what lets a stored
   * `fingerprint` and the plugins `migrateSettings()` retired pass through
   * harmlessly.
   *
   * @param {object} settings A `get()`-shaped object; keys may be missing.
   */
  set(settings) {
    for (const field of globalFields) {
      if (!(field.name in settings)) continue;

      this._globals[field.name] = coerceValue(
        field,
        this._globals[field.name],
        settings[field.name],
      );
    }

    // A payload without a `plugins` map is not something `get()` can produce,
    // and the DOM binder used to throw on one. Tolerating it costs nothing and
    // means a truncated save restores what it does carry.
    const plugins = settings.plugins ?? {};

    for (const name of this._pluginNames) {
      if (!(name in plugins)) continue;

      this._plugins[name] = Boolean(plugins[name]);
    }

    // The one place the stages are read back off the checkboxes — see
    // `setPlugin()` for why that direction is restores-only.
    this._deriveStages();
  }

  /**
   * Write one named control, as editing it does.
   *
   * @param {string} name A `globalFields` name; anything else is ignored.
   * @param {boolean|string|number} value The new value, coerced to the shape
   * the control would have produced.
   */
  setGlobal(name, value) {
    const field = globalFields.find((candidate) => candidate.name === name);

    if (!field) return;

    this._globals[name] = coerceValue(field, this._globals[name], value);
  }

  /**
   * Toggle one plugin, as a checkbox does.
   *
   * Deliberately does not re-derive the staged select above it: toggling a
   * checkbox by hand leaves that select on 'custom' even if the combination
   * happens to match a stage, so the block doesn't snap shut mid-edit.
   * Deriving is for programmatic restores only (`set()`, `reset()`).
   *
   * @param {string} name A plugin id; anything else is ignored.
   * @param {boolean} enabled Whether it runs.
   */
  setPlugin(name, enabled) {
    if (!(name in this._plugins)) return;

    this._plugins[name] = Boolean(enabled);
  }

  /**
   * Pick a stage, writing the checkboxes it stands for. 'custom' writes
   * nothing — it only reveals them.
   *
   * @param {string} group 'metadata' or 'styles'.
   * @param {string} stage A key of that group's stage map, or 'custom'.
   */
  setStage(group, stage) {
    const { stages, names } = stageGroups[group];
    const combination = stages[stage];

    if (combination) {
      for (const name of names) {
        // A flagged plugin the map forgot reads as `false` here, exactly as an
        // unwritten checkbox did.
        if (name in this._plugins) {
          this._plugins[name] = Boolean(combination[name]);
        }
      }
    }

    this._stages[group] = stage;
  }

  /**
   * What a staged select is currently showing.
   *
   * @param {string} group 'metadata' or 'styles'.
   * @returns {string} The stage that select is showing; 'custom' when the
   * checkboxes match none.
   */
  stageOf(group) {
    return this._stages[group];
  }

  /** Back to the state the panel ships with. */
  reset() {
    this._globals = {};

    for (const field of globalFields) {
      this._globals[field.name] = this._defaults[field.name];
    }

    this._plugins = { ...this._defaults.plugins };
    this._deriveStages();
  }

  /**
   * The document each guarded plugin saw, from the probes the worker ran
   * alongside the optimisation. The collision notices are gated on it — see
   * `ui/setting-notes.js`.
   *
   * @param {object} [collisions] `{fingerprint, subjects}`; null between files.
   */
  setCollisions(collisions) {
    this._collisions = collisions;
  }

  /**
   * The collision notices for the current settings and the last run.
   *
   * @returns {Array<{name: string, text: string}>} Every notice that holds.
   */
  notes() {
    return collectNotes(this.get(), this._collisions?.subjects);
  }

  /**
   * Whether the notices are still talking about the previous run.
   *
   * @returns {boolean} Whether the notices describe a run other than the one
   * the current settings would produce. The report describes the settings it
   * was produced under; anything changed upstream of a subject — enabling
   * "Remove metadata" on a file whose script sits inside it, say — can only be
   * answered by the run that's already on its way, so until it lands the
   * notices are flagged as describing the previous one rather than silently
   * reinterpreted.
   */
  get pending() {
    return (
      Boolean(this._collisions) &&
      this._collisions.fingerprint !== this.fingerprint
    );
  }

  _deriveStages() {
    for (const [group, { stages, names }] of Object.entries(stageGroups)) {
      this._stages[group] = deriveStage(
        stages,
        Object.fromEntries(
          names
            .filter((name) => name in this._plugins)
            .map((name) => [name, this._plugins[name]]),
        ),
      );
    }
  }
}

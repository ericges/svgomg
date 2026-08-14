// The panel's collision notices, DOM-free so they can be unit-tested — a
// sibling of `settings.js`, which renders them, the same way `setting-stages.js`
// is a sibling of the selects it drives.
//
// Several exposed optimisations quietly do nothing depending on what else is
// switched on and what the file contains: SVGO's own guards switch them off
// when the document has a `<style>` element or a script, and
// `current-color-styles.js` backs off when it has a `<mask>`. The toggle still
// reads "on", the output just doesn't change. These rules say so, next to the
// control they are about.
//
// Each rule is derived from the settings and *gated* on what the input really
// contains (`svgo-worker/document-features.js`, scanned once per file).
// Without that gate the default settings would put five permanent notices in
// the panel, including on files where nothing is affected.

import { normalizeIdPrefix } from '../../svgo-worker/id-prefix.js';

// Which of the two deoptimising constructs are still in play. Both answers are
// about pipeline order, and the two are read off different documents (see
// `MainController._updateDocumentFacts`):
//
// - `facts.hasStyleElement` describes the *result*. Every subject here runs
//   after the Styles block, so a stylesheet still in the output was there for
//   all of them — and one that isn't was dissolved in time, whether by
//   "Remove style elements" or by an inlining that happened to succeed. No
//   settings condition is needed on top: the answer already accounts for them.
// - `facts.hasScripts` describes the *input*, because `removeScripts` runs
//   after every subject. On a single pass it is too late to help; only a second
//   `multipass` pass sees a script-free document. That one is settings-derived,
//   and `test/setting-notes.test.js` pins the ordering it assumes against
//   `panelOrder`.
const liveCauses = (settings, facts) => {
  const causes = [];

  if (facts.hasStyleElement) causes.push('style');

  if (
    facts.hasScripts &&
    !(settings.plugins?.removeScripts && settings.multipass)
  ) {
    causes.push('script');
  }

  return causes;
};

const listPhrase = (parts) => parts.join(' and ');

const causeText = (causes) =>
  listPhrase(
    causes.map((cause) =>
      cause === 'style' ? 'a <style> element' : 'a script',
    ),
  );

// A fix names the control the user has to reach for, in the words the panel
// uses for it — so these are the panel's strings, not the plugins'.
// `test/build-smoke.test.js` checks each one is still in the built markup,
// since renaming a label would otherwise leave the advice pointing at nothing.
const label = {
  stylesRemove: 'Remove style elements',
  removeScripts: 'Remove scripts',
  multipass: 'Multipass',
};

export const quotedControlLabels = Object.values(label);

// The script half asks only for what is still missing: with "Remove scripts"
// already on, all that's left is the second pass.
const scriptFix = (settings) => {
  if (!settings.plugins?.removeScripts && !settings.multipass) {
    return `switch on “${label.removeScripts}” and “${label.multipass}”`;
  }

  return settings.multipass
    ? `switch on “${label.removeScripts}”`
    : `switch on “${label.multipass}”, so a second pass runs without it`;
};

const fixText = (causes, settings) =>
  `Fix: ${listPhrase(
    causes.map((cause) =>
      cause === 'style'
        ? `set Styles to “${label.stylesRemove}”`
        : scriptFix(settings),
    ),
  )}.`;

// One entry per rule, in panel order; `name` is the `name` attribute of the
// control the notice belongs to, which is the panel's existing contract between
// markup, settings and worker. `note()` returns the text, or an empty string
// for "nothing to say" — so adding a rule is one entry here plus its test.
export const settingNotes = [
  {
    name: 'ids',
    note(settings, facts) {
      if ((settings.ids ?? 'minify') === 'keep') return '';

      const causes = liveCauses(settings, facts);
      if (causes.length === 0) return '';

      return `IDs are left as they are: one could be referenced from ${causeText(causes)}, so SVGO backs off. ${fixText(causes, settings)}`;
    },
  },
  {
    name: 'idPrefix',
    // The one rule that needs no document: the prefix is either usable or it
    // isn't. Shares `normalizeIdPrefix` with the worker, so the panel and the
    // pipeline can't disagree about what counts.
    note(settings) {
      const typed = String(settings.idPrefix ?? '').trim();
      if (typed === '' || normalizeIdPrefix(typed)) return '';

      return 'Not applied: a prefix has to start with a letter or underscore, then letters, digits, hyphens or underscores.';
    },
  },
  {
    name: 'minifyStyles',
    // Its guard is scripts-only, and it runs inside the Styles block — ahead of
    // `removeStyleElement`, so that control can't help it either way.
    note(settings, facts) {
      if (!settings.plugins?.minifyStyles) return '';

      const causes = liveCauses(settings, facts).filter(
        (cause) => cause === 'script',
      );

      if (causes.length === 0) return '';

      return `Unused rules are kept: the SVG has a script that could be using them. ${fixText(causes, settings)}`;
    },
  },
  {
    name: 'currentColor',
    note(settings, facts) {
      if (!settings.currentColor || !facts.hasMask) return '';

      return 'Stylesheets are left as they are: the SVG has a <mask>, and a rule could select into it. Presentation attributes are still converted.';
    },
  },
  {
    name: 'removeUselessStrokeAndFill',
    note(settings, facts) {
      if (!settings.plugins?.removeUselessStrokeAndFill) return '';

      const causes = liveCauses(settings, facts);
      if (causes.length === 0) return '';

      return `Doing nothing: SVGO switches this off entirely while the SVG has ${causeText(causes)}. ${fixText(causes, settings)}`;
    },
  },
  {
    name: 'removeHiddenElems',
    note(settings, facts) {
      if (!settings.plugins?.removeHiddenElems) return '';

      const causes = liveCauses(settings, facts);
      if (causes.length === 0) return '';

      return `Holding back: hidden elements stay while the SVG has ${causeText(causes)}, since something there could reveal them. ${fixText(causes, settings)}`;
    },
  },
  {
    name: 'moveElemsAttrsToGroup',
    note(settings, facts) {
      if (!settings.plugins?.moveElemsAttrsToGroup) return '';

      const causes = liveCauses(settings, facts).filter(
        (cause) => cause === 'style',
      );

      if (causes.length === 0) return '';

      return `Skipping every group: a selector could rely on the attributes it would move, and the SVG has ${causeText(causes)}. ${fixText(causes, settings)}`;
    },
  },
];

/**
 * Every notice that currently holds, in panel order.
 *
 * @param {object} settings A `Settings.getSettings()` object.
 * @param {object} [facts] What the loaded file contains, from the worker's
 * `extract-features` pass. Absent until the first file has been read.
 * @returns {Array<{name: string, text: string}>} One entry per control with something to say.
 */
export function collectNotes(settings, facts) {
  // Nothing to warn about with no file, and nothing is being optimised at all
  // while "Show original" is on.
  if (!facts || settings.original) return [];

  return settingNotes
    .map((rule) => ({ name: rule.name, text: rule.note(settings, facts) }))
    .filter((note) => note.text !== '');
}

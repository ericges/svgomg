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
// The evidence comes from `svgo-worker/collision-probes.js`, which records the
// document as each guarded plugin saw it — one snapshot per subject, taken
// where that plugin ran. This module holds the other half: **what each
// plugin's guard makes of that snapshot**, which is not the same question for
// any two of them. `cleanupIds` needs a `<style>` with rules in it while
// `removeUselessStrokeAndFill` stops at an empty one; `removeHiddenElems`
// gives up only part of its job where the others give up all of it. Each rule
// below states its own reading, and each is pinned against the installed SVGO
// in `test/collision-probes.test.js`.
//
// Every rule is also gated on there having been something to overrule — no
// point telling anyone their unused CSS rules were kept by a document with no
// stylesheet.

import { normalizeIdPrefix } from '../../svgo-worker/id-prefix.js';

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

// Both of these anticipate the result that is already being computed. The
// snapshots describe the *last* optimisation, and `Settings` re-renders the
// moment a control moves — so between picking a fix and the worker coming back
// with it, the panel would go on advising the option the user just chose. Each
// condition is a claim about plugin order, pinned in `test/setting-notes.test.js`
// against `panelOrder`:
//
// - `removeStyleElement` runs in the Styles block, ahead of every subject here
//   except `minifyStyles`, so switching it on clears the stylesheet for all of
//   them with certainty. (Nothing similar can be said for the other Styles
//   stages: inlining dissolves the `<style>` only when every rule turned out to
//   be inlinable, which is exactly why the flag is measured and not derived.)
// - `removeScripts` runs *after* every subject, so it only helps on a second
//   `multipass` pass — which is why it takes both.
const stylesheetSurvives = (settings, present) =>
  present && !settings.plugins?.removeStyleElement;

const scriptSurvives = (settings, at) =>
  at.hasScripts && !(settings.plugins?.removeScripts && settings.multipass);

const listPhrase = (parts) => parts.join(' and ');

const causeText = (causes) =>
  listPhrase(
    causes.map((cause) =>
      cause === 'style' ? 'a <style> element' : 'a script',
    ),
  );

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

// One entry per rule, in panel order. `name` is the `name` attribute of the
// control the notice belongs to, which is the panel's existing contract between
// markup, settings and worker; `subject` is the plugin whose snapshot the rule
// reads, and a rule with one is skipped entirely when that plugin didn't run.
// `note()` returns the text, or an empty string for "nothing to say" — so
// adding a rule is one entry here plus its test.
export const settingNotes = [
  {
    name: 'ids',
    subject: 'cleanupIds',
    // Guard: a `<style>` *with rules* or a script. Plus one more that has
    // nothing to do with either — a document whose `<svg>` holds only `<defs>`
    // is skipped outright.
    note(settings, at) {
      if (!at.hasIds) return '';

      if (at.isDefsOnlyRoot) {
        return 'IDs are left as they are: SVGO skips this step on a document whose <svg> contains nothing but <defs>.';
      }

      const causes = [];

      if (stylesheetSurvives(settings, at.hasFilledStyleElement)) {
        causes.push('style');
      }

      if (scriptSurvives(settings, at)) causes.push('script');
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
    subject: 'minifyStyles',
    // Guard: scripts only, and only for the usage-based half — style
    // attributes and the rules themselves are still minified. It runs inside
    // the Styles block, *ahead* of `removeStyleElement`, so that control can't
    // help it either way and its stylesheet is read as measured.
    note(settings, at) {
      if (!at.hasFilledStyleElement || !scriptSurvives(settings, at)) return '';

      return `Unused rules are kept: the SVG has a script that could be using them. ${fixText(['script'], settings)}`;
    },
  },
  {
    name: 'currentColor',
    subject: 'current-color-styles',
    // Ours, not SVGO's: a rule in any stylesheet can select into a `<mask>`,
    // and masks read luminance rather than colour.
    note(settings, at) {
      if (
        !settings.currentColor ||
        !at.hasMask ||
        !stylesheetSurvives(settings, at.hasFilledStyleElement)
      ) {
        return '';
      }

      return 'Stylesheets are left as they are: the SVG has a <mask>, and a rule could select into it. Colours in attributes are still converted.';
    },
  },
  {
    name: 'removeUselessStrokeAndFill',
    subject: 'removeUselessStrokeAndFill',
    // Guard: *any* `<style>` element — an empty one stops it too — or a
    // script. The plugin returns nothing at all, so there is no partial
    // outcome to qualify and nothing to gate on.
    note(settings, at) {
      const causes = [];

      if (stylesheetSurvives(settings, at.hasStyleElement)) {
        causes.push('style');
      }

      if (scriptSurvives(settings, at)) causes.push('script');
      if (causes.length === 0) return '';

      return `Doing nothing: SVGO switches this off entirely while the SVG has ${causeText(causes)}. ${fixText(causes, settings)}`;
    },
  },
  {
    name: 'removeHiddenElems',
    subject: 'removeHiddenElems',
    // Guard: a `<style>` with rules, or a script — and unlike the others this
    // one is partial. It only blocks the deferred sweep at the end of the
    // pass, which is where unreferenced non-rendering definitions and
    // transparent paths are removed; everything the plugin can decide on the
    // spot still goes.
    note(settings, at) {
      if (!at.hasDeferredHiddenCandidate) return '';

      const causes = [];

      if (stylesheetSurvives(settings, at.hasFilledStyleElement)) {
        causes.push('style');
      }

      if (scriptSurvives(settings, at)) causes.push('script');
      if (causes.length === 0) return '';

      return `Half of this runs: unused definitions — <mask>, <clipPath>, gradients — and fully transparent paths are kept while the SVG has ${causeText(causes)}, since something there could still refer to them. Zero-sized and hidden elements are removed as usual. ${fixText(causes, settings)}`;
    },
  },
  {
    name: 'moveElemsAttrsToGroup',
    subject: 'moveElemsAttrsToGroup',
    // Guard: *any* `<style>` element, scripts not among its concerns. Only
    // groups with more than one child are candidates in the first place.
    note(settings, at) {
      if (
        !at.hasMultiChildGroup ||
        !stylesheetSurvives(settings, at.hasStyleElement)
      ) {
        return '';
      }

      return `Skipping every group: a selector could rely on the attributes it would move, and the SVG has ${causeText(['style'])}. ${fixText(['style'], settings)}`;
    },
  },
];

/**
 * Every notice that currently holds, in panel order.
 *
 * @param {object} settings A `Settings.getSettings()` object.
 * @param {object} [collisions] What each guarded plugin saw when it last ran,
 * keyed by plugin name (`svgo-worker/collision-probes.js`). Absent until the
 * first file has been optimised, and while "Show original" is on.
 * @returns {Array<{name: string, text: string}>} One entry per control with something to say.
 */
export function collectNotes(settings, collisions) {
  // Nothing is being optimised at all while "Show original" is on, so nothing
  // is being overruled either.
  if (settings.original) return [];

  return settingNotes
    .map((rule) => {
      // A rule whose plugin didn't run has nothing to explain — including
      // before the first result, when no plugin has run at all.
      const at = rule.subject ? collisions?.[rule.subject] : undefined;

      if (rule.subject && !at) return { name: rule.name, text: '' };

      return { name: rule.name, text: rule.note(settings, at) };
    })
    .filter((note) => note.text !== '');
}

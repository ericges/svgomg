import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  deriveStage,
  metadataStages,
  stylesStages,
} from '../src/js/page/ui/setting-stages.js';

const metadataCheckboxes = (overrides = {}) => ({
  removeComments: false,
  removeMetadata: false,
  removeEditorsNSData: false,
  removeTitle: false,
  removeDesc: false,
  ...overrides,
});

const stylesCheckboxes = (overrides = {}) => ({
  mergeStyles: false,
  inlineStyles: false,
  minifyStyles: false,
  convertStyleToAttrs: false,
  removeStyleElement: false,
  ...overrides,
});

// The two groups, each paired with the `src/config.json` flag that marks the
// checkboxes it governs.
const stageMaps = [
  ['metadata', metadataStages],
  ['styles', stylesStages],
];

const compareNames = (a, b) => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

test('each stage derives back to itself', (t) => {
  const derived = stageMaps.flatMap(([flag, stages]) =>
    Object.entries(stages).map(([name, combination]) => [
      `${flag}.${name}`,
      deriveStage(stages, { ...combination }),
    ]),
  );

  t.assert.deepStrictEqual(
    derived,
    stageMaps.flatMap(([flag, stages]) =>
      Object.keys(stages).map((name) => [`${flag}.${name}`, name]),
    ),
  );
});

test('the default metadata stage keeps both accessibility elements', (t) => {
  // The point of the new default: junk goes, `<title>` and `<desc>` stay.
  t.assert.strictEqual(metadataStages.junk.removeTitle, false);
  t.assert.strictEqual(metadataStages.junk.removeDesc, false);
  t.assert.strictEqual(metadataStages.junk.removeComments, true);
});

test('a metadata combination no stage covers is custom', (t) => {
  // The old default — dropping `<desc>` but keeping `<title>`.
  t.assert.strictEqual(
    deriveStage(
      metadataStages,
      metadataCheckboxes({
        removeComments: true,
        removeMetadata: true,
        removeEditorsNSData: true,
        removeDesc: true,
      }),
    ),
    'custom',
  );
  t.assert.strictEqual(
    deriveStage(metadataStages, metadataCheckboxes({ removeTitle: true })),
    'custom',
  );
});

test('an empty set is custom rather than vacuously the first stage', (t) => {
  // `every` on nothing is true, so a missing block would otherwise report the
  // first stage and hide the toggles on a group with none of them.
  t.assert.strictEqual(deriveStage(metadataStages, {}), 'custom');
  t.assert.strictEqual(deriveStage(stylesStages, {}), 'custom');
});

test('only the checkboxes present are compared', (t) => {
  // Guards the derivation against a plugin being added or dropped in
  // `config.json` without the stage map being updated to match.
  t.assert.strictEqual(
    deriveStage(metadataStages, {
      removeComments: true,
      removeMetadata: true,
    }),
    'junk',
  );
});

test('the styles default is what config.json defaults the plugins to', (t) => {
  // Why the Styles select needs no migration: an old save restores exactly
  // this combination and derives straight to 'inline'.
  t.assert.deepStrictEqual(
    stylesStages.inline,
    stylesCheckboxes({
      mergeStyles: true,
      inlineStyles: true,
      minifyStyles: true,
    }),
  );
});

test('keep and remove are told apart by removeStyleElement alone', (t) => {
  // The two ends of the scale differ in one bit, and `find` takes the first
  // match — so `keep` has to be declared first for an all-false set.
  t.assert.strictEqual(deriveStage(stylesStages, stylesCheckboxes()), 'keep');
  t.assert.strictEqual(
    deriveStage(stylesStages, stylesCheckboxes({ removeStyleElement: true })),
    'remove',
  );
});

test('a styles combination no stage covers is custom', (t) => {
  // Inlining and then removing the element: contradictory, and exactly the
  // kind of combination the select exists to stop people reaching by accident.
  t.assert.strictEqual(
    deriveStage(
      stylesStages,
      stylesCheckboxes({
        mergeStyles: true,
        inlineStyles: true,
        minifyStyles: true,
        removeStyleElement: true,
      }),
    ),
    'custom',
  );
  t.assert.strictEqual(
    deriveStage(stylesStages, stylesCheckboxes({ convertStyleToAttrs: true })),
    'custom',
  );
});

test('each stage map covers exactly the plugins its flag marks', async (t) => {
  // A plugin flagged in `config.json` but missing from the map matches no
  // stage, so the select pins to 'custom' and the block never closes — and
  // nothing else in the suite notices, because the checkbox does render.
  const config = JSON.parse(
    await fs.readFile(
      path.join(import.meta.dirname, '..', 'src', 'config.json'),
      'utf8',
    ),
  );

  const covered = stageMaps.flatMap(([flag, stages]) => {
    const flagged = config.plugins
      .filter((plugin) => plugin[flag])
      .map((plugin) => plugin.id)
      .toSorted(compareNames);

    return Object.entries(stages).map(([name, combination]) => [
      `${flag}.${name}`,
      // An empty flagged list would make every stage match it vacuously, so
      // report the ids rather than just whether they agree.
      Object.keys(combination).toSorted(compareNames).join(','),
      flagged.join(','),
    ]);
  });

  t.assert.deepStrictEqual(
    covered.filter(([, keys, flagged]) => keys !== flagged || keys === ''),
    [],
    'stages whose keys are not exactly the plugins their flag marks',
  );
});

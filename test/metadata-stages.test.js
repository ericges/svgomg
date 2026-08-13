import test from 'node:test';
import {
  deriveMetadataStage,
  metadataStages,
} from '../src/js/page/ui/metadata-stages.js';

const checkboxes = (overrides = {}) => ({
  removeComments: false,
  removeMetadata: false,
  removeEditorsNSData: false,
  removeTitle: false,
  removeDesc: false,
  ...overrides,
});

test('each stage derives back to itself', (t) => {
  const derived = Object.entries(metadataStages).map(([name, combination]) => [
    name,
    deriveMetadataStage({ ...combination }),
  ]);

  t.assert.deepStrictEqual(
    derived,
    Object.keys(metadataStages).map((name) => [name, name]),
  );
});

test('the default stage keeps both accessibility elements', (t) => {
  // The point of the new default: junk goes, `<title>` and `<desc>` stay.
  t.assert.strictEqual(metadataStages.junk.removeTitle, false);
  t.assert.strictEqual(metadataStages.junk.removeDesc, false);
  t.assert.strictEqual(metadataStages.junk.removeComments, true);
});

test('a combination no stage covers is custom', (t) => {
  // The old default — dropping `<desc>` but keeping `<title>`.
  t.assert.strictEqual(
    deriveMetadataStage(
      checkboxes({
        removeComments: true,
        removeMetadata: true,
        removeEditorsNSData: true,
        removeDesc: true,
      }),
    ),
    'custom',
  );
  t.assert.strictEqual(
    deriveMetadataStage(checkboxes({ removeTitle: true })),
    'custom',
  );
});

test('an empty set is custom rather than vacuously the first stage', (t) => {
  // `every` on nothing is true, so a missing metadata block would otherwise
  // report 'keep' and hide the toggles on a document with none of them.
  t.assert.strictEqual(deriveMetadataStage({}), 'custom');
});

test('only the checkboxes present are compared', (t) => {
  // Guards the derivation against a metadata plugin being added or dropped in
  // `config.json` without the stage map being updated to match.
  t.assert.strictEqual(
    deriveMetadataStage({ removeComments: true, removeMetadata: true }),
    'junk',
  );
});

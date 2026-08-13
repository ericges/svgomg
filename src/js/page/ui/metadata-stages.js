// Split out of `settings.js` so it can be unit-tested: that module reaches for
// `document` as soon as it's imported. Sibling of its only consumer, which
// changes no output filename — bundles are named after their directory.
//
// The "Metadata" select is sugar over five plugin checkboxes. It carries no
// `name`, so it never reaches the settings object and the checkboxes stay the
// single source of truth; these are the combinations it can express.

export const metadataStages = {
  keep: {
    removeComments: false,
    removeMetadata: false,
    removeEditorsNSData: false,
    removeTitle: false,
    removeDesc: false,
  },
  junk: {
    removeComments: true,
    removeMetadata: true,
    removeEditorsNSData: true,
    removeTitle: false,
    removeDesc: false,
  },
  all: {
    removeComments: true,
    removeMetadata: true,
    removeEditorsNSData: true,
    removeTitle: true,
    removeDesc: true,
  },
};

// `checkedByName` is the current state of the five checkboxes. Anything that
// matches no stage is 'custom', which is what reveals them for editing.
export const deriveMetadataStage = (checkedByName) => {
  const names = Object.keys(checkedByName);

  // No checkboxes at all would otherwise match every stage vacuously and
  // report 'keep', hiding the block on a document that has nothing in it.
  if (names.length === 0) return 'custom';

  const stage = Object.keys(metadataStages).find((name) =>
    names.every(
      (plugin) => checkedByName[plugin] === metadataStages[name][plugin],
    ),
  );

  return stage ?? 'custom';
};

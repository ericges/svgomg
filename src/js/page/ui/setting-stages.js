// Split out of `settings.js` so it can be unit-tested: that module reaches for
// `document` as soon as it's imported. Sibling of its only consumer, which
// changes no output filename — bundles are named after their directory.
//
// The "Metadata" and "Styles" selects are sugar over the plugin checkboxes they
// govern. Neither carries a `name`, so neither reaches the settings object and
// the checkboxes stay the single source of truth; these are the combinations
// they can express. A stage map's keys must be exactly the ids its
// `config.json` flag marks — a flagged plugin missing from the map matches no
// stage, so the select pins to 'custom' and the block never closes.

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

// One pipeline decision, not five independent toggles: `mergeStyles` feeds
// `inlineStyles` feeds `convertStyleToAttrs`, and `removeStyleElement` throws
// away rules that inlining would have preserved — which is why it sits at the
// end of the scale rather than next to "minify". `inline` is what `config.json`
// defaults the five plugins to, so the markup's `selected` and the derived
// value agree, and an old save needs no migration to land on it.
//
// `keep` is declared first deliberately: it and `remove` differ only in
// `removeStyleElement`, so if that plugin ever left `config.json` the
// all-false remainder should read as "keep", not "remove".
export const stylesStages = {
  keep: {
    mergeStyles: false,
    inlineStyles: false,
    minifyStyles: false,
    convertStyleToAttrs: false,
    removeStyleElement: false,
  },
  minify: {
    mergeStyles: true,
    inlineStyles: false,
    minifyStyles: true,
    convertStyleToAttrs: false,
    removeStyleElement: false,
  },
  inline: {
    mergeStyles: true,
    inlineStyles: true,
    minifyStyles: true,
    convertStyleToAttrs: false,
    removeStyleElement: false,
  },
  attributes: {
    mergeStyles: true,
    inlineStyles: true,
    minifyStyles: true,
    convertStyleToAttrs: true,
    removeStyleElement: false,
  },
  remove: {
    mergeStyles: false,
    inlineStyles: false,
    minifyStyles: false,
    convertStyleToAttrs: false,
    removeStyleElement: true,
  },
};

// `checkedByName` is the current state of one group's checkboxes. Anything that
// matches no stage is 'custom', which is what reveals them for editing. Only
// the names given are compared, so a plugin added to or dropped from
// `config.json` degrades the derivation rather than breaking it.
export const deriveStage = (stages, checkedByName) => {
  const names = Object.keys(checkedByName);

  // No checkboxes at all would otherwise match every stage vacuously and report
  // the first one, hiding the block on a group that has nothing in it.
  if (names.length === 0) return 'custom';

  const stage = Object.keys(stages).find((name) =>
    names.every((plugin) => checkedByName[plugin] === stages[name][plugin]),
  );

  return stage ?? 'custom';
};

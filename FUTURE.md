# Future prospects

Ideas that came out of the settings-panel UX work (2026-08) and were deliberately
left out of it. Nothing here is committed to — it's a record of the reasoning so
the next person doesn't have to rediscover it.

The panel now has three categories (View, Output, Optimisation) and four
non-binary controls: a size-attribute select, an ID mode select with a free-text
prefix, a staged metadata select with a Custom escape hatch, and a currentColor
toggle. Both ideas below extend that same pattern.

## A styles select

Five checkboxes describe what is really one pipeline decision:
`mergeStyles` → `inlineStyles` → `minifyStyles`, plus `convertStyleToAttrs` and
`removeStyleElement`. Their interactions are not guessable from the labels, and
some combinations are contradictory (inlining styles and then removing the style
element does something quite different from either alone).

One select would carry it:

| Option | Plugins |
|---|---|
| Keep as they are | none |
| Minify | `mergeStyles`, `minifyStyles` |
| Inline into elements | `mergeStyles`, `inlineStyles`, `minifyStyles` |
| Convert to presentation attributes | the above plus `convertStyleToAttrs` |
| Remove entirely | `removeStyleElement` |

Notes for whoever builds it:

- Order is load-bearing. `mergeStyles` has to run before `inlineStyles`, which
  has to run before `convertStyleToAttrs`. The worker builds its plugin array in
  `config.json` order, so plugins driven by a select need explicit placement —
  see how `cleanupIds` is slotted in `src/js/svgo-worker/index.js`.
- `inlineStyles` only moves what it can prove is safe; a stylesheet with media
  queries or pseudo-classes partly survives. The label should not promise more
  than that.
- `removeStyleElement` throws away rules that inlining would have preserved, so
  it belongs at the end of the scale, not next to "minify".

## Configuration presets

A named-preset feature would subsume several one-off ideas, including the
embedding-target select that was considered and dropped during this work: rather
than a control that means "standalone file" or "inline in HTML", those become
two presets among others.

An inline-in-HTML preset would set an ID prefix (the reason `prefixIds` was
exposed in the first place) and enable `removeXMLNS`, `removeDoctype` and
`removeXMLProcInst` — all of which are redundant or actively harmful inside an
HTML document, and all of which are wrong for a standalone `.svg` file.

Sketch:

- Ship a handful of built-in presets and let people save the current panel state
  under a name of their own.
- Storage: `src/js/utils/storage.js` already backs the saved settings; a presets
  map would be a second key in the same store.
- The panel is the source of truth for settings, so applying a preset is just
  `Settings.setSettings()` — the same path the reset-undo toast uses.
- Worth deciding early: does selecting a preset pin the panel to it (so later
  edits show as "Modified"), or is it a one-shot fill? The former needs a state
  that the current DOM-as-state design has nowhere to put.

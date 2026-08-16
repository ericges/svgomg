# SVGOMG — GUI redesign handoff

Everything a designer needs to redraw this interface: what screens and states exist,
what each one is for, which parts are load-bearing, and where the assets live.

**Captured:** 2026-08-16, from the current `main` (`67a3adf`), SVGO v4.0.2.
Desktop shots are 1918×908 CSS px (scaled to 1568 px wide); the responsive shot is
two live viewports side by side at 400 px and 700 px.

---

## 1. What the app is

SVGOMG is a **client-side-only** GUI for [SVGO](https://github.com/svg/svgo). There is no
backend and no upload: the SVG is optimised in the browser, in web workers, and a service
worker makes the whole app work offline. It is vanilla ES modules and Sass — no framework,
no component library, no CSS-in-JS.

The screen is three regions:

| region | what it does |
|---|---|
| **Toolbar** (top, 52 px) | get a file in (Open / Paste / Demo), switch Preview ↔ Markup |
| **Output** (left, fills) | the rendered SVG, or its markup; floating action buttons; the size readout |
| **Settings panel** (right, 21.1em) | ~57 controls that shape the optimisation |

### Run it yourself — the live app is the source of truth

```sh
npm install
npm run dev     # builds, watches, serves on http://localhost:8080
```

Screenshots can't show motion, hover, focus rings, the ripple effect on buttons, the
pan/zoom of the preview, or the intro animation. Please spend ten minutes in the running
app before designing.

---

## 2. Screen and state inventory

All files are in `screenshots/`.

### The shell

| # | file | what it shows |
|---|---|---|
| 01 | `01-empty-state.png` | **First paint.** The app opens empty — no file, no settings panel, no buttons. Just the toolbar and an invitation sheet. |
| 02 | `02-toolbar-left.png` | Brand block (logo, wordmark, "Powered by SVGO v4.0.2") and the three input actions. "Demo" is a split button: the left half loads the default demo, the caret opens the list. |
| 03 | `03-toolbar-right-view-toggler.png` | Preview/Markup segmented toggle and the Contribute link. |
| 04 | `04-demo-menu-open.png` | The demo picker. Eight entries, rendered from `src/config.json`. It is a `popover` in the top layer (it has to be — the toolbar scrolls horizontally and the output clips). |
| 05 | `05-paste-markup-focused.png` | "Paste markup" is a `<label>` wrapping an invisible textarea; focusing it widens the control into a paste field. |

### A file is loaded

| # | file | what it shows |
|---|---|---|
| 06 | `06-loaded-preview-desktop.png` | The working state: preview on a checkerboard, settings panel revealed on the right, FAB stack and size readout bottom-right. |
| 07 | `07-fab-stack-and-results.png` | Close-up of the four buttons — vivid background, Copy, Save as PNG (40 px minor FABs) and Download (56 px major FAB) — plus the results pill: `8.32k → 4.92k  −40.8%`. |
| 08 | `08-markup-view-minified.png` | Markup view: the optimised source, syntax-highlighted by Prism on a dark ground. This is the *only* dark surface in the app. |
| 09 | `09-markup-view-prettified.png` | Same, with "Prettify markup" on. |
| 22 | `22-preview-vivid-background.png` | The vivid-background toggle — checks a dark ground behind the artwork. |
| 23 | `23-results-show-original.png` | With "Show original" on there is nothing to compare, so the readout collapses to a single size. |

### The settings panel (top to bottom, five overlapping segments)

| # | file | what it shows |
|---|---|---|
| 10 | `10-settings-panel-1-view-output.png` | **View** section (Show original, Compare gzipped) and the start of **Output**: Prettify, two precision sliders. |
| 11 | `11-settings-panel-2-selects.png` | Size attributes / IDs / ID prefix / Metadata / Styles, then "Colours to currentColor" and **Optimisation**. |
| 12–14 | `12…`, `13…`, `14-settings-panel-…` | The **Features** list — 44 plugin toggles in three screens, ending with the "Reset all" button. |
| 15 | `15-stage-blocks-custom-expanded.png` | Metadata and Styles set to "Custom…", which reveals the individual toggles they normally stand in for (indented sub-block). |

### Feedback and edge states

| # | file | what it shows |
|---|---|---|
| 16 | `16-kitchen-sink-with-notices.png` | The `kitchen-sink` demo — a labelled test card with every construct the optimisations act on. Loading it triggers the collision notices. |
| 17 | `17-notice-on-stage-select.png` | A **collision notice**: an ⓘ paragraph under a control saying that the chosen option is being overruled, and how to fix it. |
| 18 | `18-notices-on-checkboxes.png` | Two more, hosted under plugin toggles. Note how much vertical space they take. |
| 19 | `19-notice-move-attrs-to-group.png` | A notice scrolled to the top of the panel — they can appear anywhere in the list. |
| 20 | `20-notice-pending-dimmed.png` | The **pending** state: while a re-optimisation is in flight the advice dims, because it may be about to change. *(Forced for the screenshot — it has a transition delay so a fast recompression never shows it.)* |
| 21 | `21-id-prefix-invalid.png` | Invalid input: a rejected ID prefix gets a red border plus a notice saying it was not applied. The only error styling in the panel. |
| 24 | `24-toast-copy-successful.png` | Toast, one action. |
| 25 | `25-toast-settings-reset-undo.png` | Toast, two actions (Undo / Dismiss). Same component as the "Update available" toast. |
| 26 | `26-toast-error.png` | Error toast — the message is rendered as monospace `<pre><code>`, so it can be long and ugly. |
| 27 | `27-drop-overlay.png` | Drag a file anywhere over the page: full-bleed scrim, "Drop it!" *(forced)*. |
| 28 | `28-preloader.png` | The pre-JS loading state — spinner plus "Sorry, wasn't ready…" *(forced; only seen on a slow first load)*. |

### Responsive

| # | file | what it shows |
|---|---|---|
| 29 | `29-responsive-empty-400-700.png` | Empty state at 400 px (left) and 700 px (right). Below 480 px the toolbar loses its labels *and* the wordmark; the brand shrinks to the logo tile. |
| 30 | `30-responsive-loaded-400-700.png` | Loaded, same two widths. **Under 640 px the layout stacks**: preview on top, the results readout becomes a full-width blue bar, and the settings panel sits below it as a scrolling sheet. At 700 px it is already the desktop side-panel. |

Breakpoints in the stylesheet: **480, 640, 720, 900**.

### Assets

| # | file | what it shows |
|---|---|---|
| 31–32 | `31-icon-sheet-1.png`, `32-icon-sheet-2.png` | All 14 icons. The originals are in `assets/icons/` — use those, not the screenshots. |

---

## 3. Design tokens as they exist today

There is no token file; these are the values that recur in `src/styles/`.

| token | value | used for |
|---|---|---|
| Brand blue | `#3f51b5` | toolbar, sliders, switches, focus rings, results bar, major FAB |
| Theme colour | `#303f9f` | browser chrome (`meta[name=theme-color]`) |
| Accent cyan | `#00bcd4` | ripples, toast actions, keyboard-focus outlines |
| Error red | `#d32f2f` | invalid field border |
| Code ground | `#2b2b2b` with `#a9b7c6` text | markup view, toasts (a Darcula-family Prism theme) |
| Surface | `#fff`, dividers `#e7e7e7`/`#d7d7d7`, muted text `#767676` | panel, cards |
| UI type | `system-ui` stack, 1rem / 1.3 | everything |
| Code type | JetBrains Mono NL (subsetted woff2, self-hosted) | markup, error toasts |
| Toolbar | 52 px tall, 13 px type, 8 px radii | — |
| Panel | 21.1em wide at ≥640 px | — |
| FABs | 40 px minor / 56 px major, fully rounded | — |

---

## 4. Constraints the redesign has to respect

These are not style preferences — breaking them breaks the app.

1. **No external resources, at all.** The page ships a strict CSP (`default-src 'none'`,
   `connect-src 'self'`) and a service worker that precaches every asset. Web fonts, icon
   CDNs, analytics and remote images are impossible; anything new must be self-hosted and
   added to the precache list. Font weight/format choices therefore cost first-paint bytes.
2. **The toolbar is critical CSS**, inlined in `<head>`. It must look final at first paint —
   no rule for it may live in the async stylesheet, and it must not animate into place.
3. **The empty-state sheet is the first child of the main area**, and CSS sibling selectors
   off its `active` class are what hide the settings panel and the action buttons before a
   file exists. Reordering that markup silently reveals an empty panel.
4. **Icons are inline SVG partials that inherit `currentColor`** (`assets/icons/`). A
   component recolours a glyph by setting `color`. Several are stroke-only with `fill="none"`,
   so a blanket `fill` rule fills them in solid.
5. **The plugin list is generated from `src/config.json`** — currently 44 toggles, and it
   grows whenever SVGO exposes something new. Any layout for that list has to survive
   "twenty more of these". This is the single biggest design problem in the panel.
6. **Collision notices can appear under almost any control**, at any position, and they are
   3–8 lines of prose. They are `aria-describedby` targets for their control, and they must
   sit *after* the label, never inside it (the label is the checkbox's click target).
7. **The preview is a sandboxed iframe** (`sandbox=""`, never `allow-scripts`), because
   uploaded SVGs can carry scripts. It also must never live inside a `display: none`
   subtree — so "hide the preview" has to mean something other than hiding `.output`.
8. **Settings state lives in the DOM**, keyed by the inputs' `name` attributes; those names
   are the contract between the markup, the saved preferences and the worker. Renaming a
   control in the template is a data-migration, not a rename.
9. **Range inputs are wrapped by a custom `MaterialSlider`**, and the panel's scroller
   cancels `mousedown` to stop double-tap selection — any *new kind* of focusable control
   has to be added to that exemption list or it can't take focus.
10. **Every optimisation control needs a visible on/off/indeterminate state at a glance.**
    People scan this list for what is enabled; that is its whole job.

---

## 5. Known rough edges — fair game for the redesign

- **The panel is a ~57-item scroll.** Three sections, one of which is 44 near-identical
  switches with terse technical labels. The Metadata and Styles selects already show the way
  out — each one stands in for a block of related toggles and only reveals them on "Custom…" —
  but the Features list itself has no such grouping, no search, and no indication of which
  toggles actually did something to *this* file.
- **The collision notices are excellent information in an awkward place.** They push the
  list around as they appear and disappear, and on a file like the kitchen sink several
  are on screen at once.
- **The results readout** (`8.32k → 4.92k −40.8%`) is the app's headline number and it sits
  in a small pill wedged against the download button.
- **Mobile puts the whole panel below the preview**, so changing a setting and seeing its
  effect means scrolling back and forth.
- **The brand block** is a flat teal tile plus a wordmark; there is no real logo mark.
- **Two dark surfaces** (markup view, toasts) coexist with an otherwise white app, and the
  code theme is inherited from Prism rather than designed.
- **Copy is inconsistent in register** — "Sorry, wasn't ready…" next to "Doing nothing:
  SVGO switches this off entirely while the SVG has a `<style>` element and a script."

---

## 6. What is *not* in the screenshots

Look at these in the running app: hover and focus states, the ripple on buttons, the
preview's pan/zoom, the intro animation when the first file lands, toast enter/exit, the
panel's scroll shadows, and the "Update available" toast (it only appears after a redeploy).

---

## 7. Contents of this folder

```
design-handoff/
├── README.md            this document
├── screenshots/         32 annotated captures (PNG)
└── assets/icons/        the 14 icon partials as SVG source
```

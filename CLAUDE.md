# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SVGOMG — a client-side-only web GUI for [SVGO](https://github.com/svg/svgo). No backend: the SVG never leaves the browser. Optimisation, gzip sizing and syntax highlighting all run in web workers, and a service worker makes the app work offline. Vanilla ES modules, no framework.

## Commands

```sh
npm install
npm run dev      # clean + build + watch src/ + serve build/ on localhost:8080 (sirv, dev mode)
npm run build    # one-off production build (clean-build: terser + cleancss + htmlmin)
npm start        # serve an existing build/ without building
npm run lint      # xo (JS) + stylelint (src/styles/)
npm run fix       # xo --fix
npm run test:node # node --test over test/ — needs an existing production build
npm test          # lint + build + test:node — the whole suite
```

The test runner is **`node --test`, with no test framework and no new dependencies**; specs live in `test/*.test.js` and are wired up in `package.json`. XO lints them, so `xo.config.mjs` gives `test/**` Node globals rather than the browser ones, and its `node-test` rules require assertions to go through the test context (`t.assert.strictEqual`, not an imported `node:assert`).

Coverage is deliberately narrow: the pure, DOM-free logic plus one production-build smoke test. `test/build-smoke.test.js` reads `build/`, so it needs a build to have run, and it must be a **production** one — a dev build fails its first assertion with a message saying so. It checks the seams a bundler can silently break: that `_` properties really are mangled, that the keys crossing the page↔worker boundary survive in both bundles, that every `src/config.json` plugin renders a checkbox, that `SVGOMG_BUILD_ID` was substituted, and that every hand-written precache entry exists in `build/`.

Everything else is still verified **by hand** in `npm run dev` — anything touching the DOM, the service-worker lifecycle, or real workers has no coverage. `src/test-svgs/` holds fixtures for that; only `car-lite.svg` is copied into the build (it backs the "demo" button).

Two modules exist only so that logic is reachable outside a browser, and should stay that way: `src/js/svgo-worker/dimensions.js` (the worker entry point exports nothing and ends in a `self.onmessage` assignment) and `src/js/page/ui/preview-size.js` (`svg-output.js` imports `utils.js`, which touches `document` at load). Both are siblings of their only consumer, which changes no output filename — bundles are named after their *directory*.

`npm run dev` serves as well as watches — don't start a second server on 8080.

CI splits the same work across two jobs rather than running `npm test`: `lint` runs `npm run lint`, and `build` runs `npm run build` then `npm run test:node` — the tests live in that job because the smoke test needs the build output. Adding a check to `npm test` alone therefore gates nothing.

Deployment: CI builds every push and PR, but only **`main`** is published to GitHub Pages — both the artifact upload and the deploy job are gated on `github.ref == 'refs/heads/main'` in `.github/workflows/ci.yml`. Lint, build and tests must pass first.

## Build pipeline (gulpfile.mjs)

Five separate Rollup IIFE bundles, one per entry directory under `src/js/` — the output filename is the *directory* name:

| entry | output |
|---|---|
| `src/js/page/index.js` | `build/js/page.js` |
| `src/js/svgo-worker/index.js` | `build/js/svgo-worker.js` |
| `src/js/gzip-worker/index.js` | `build/js/gzip-worker.js` |
| `src/js/prism-worker/index.js` | `build/js/prism-worker.js` |
| `src/js/sw/index.js` | `build/sw.js` (root — needs root scope) |

Adding a bundle means adding a `js.bind(...)` line to `appJs`. The service worker is deliberately *not* in `appJs`: it is bundled by the separate `swJs` task, which runs last (see "The service worker and its cache name" below).

Other tasks: `css` (Sass → `build/all.css` + `build/head.css`), `html` (Nunjucks: `src/index.njk` → `build/index.html`), `copy` (`.well-known`, `images`, `fonts`, `src/*.json`, `test-svgs/car-lite.svg`).

Five build facts that are easy to trip over:

- `html` globs `src/*.njk` and `gulp-nunjucks` rewrites the extension, so `index.njk` becomes `build/index.html`. The partials under `src/partials/` keep a plain `.html` extension — they're only ever `{% include %}`d, never compiled directly — which is why `watch()` globs `html` alongside `njk`.
- `html` reads `build/head.css` off disk and inlines it via `{{ headCSS|safe }}`, so it must run *after* `css` (`gulp.series(css, html)`).
- `swJs` hashes `build/`, so it must run *after* every task that writes there — hence `gulp.series(gulp.parallel(gulp.series(css, html), appJs, copy), swJs)`, and the same ordering in each `watch()` watcher.
- `IS_DEV_TASK` (argv contains `dev` or `--dev`) disables terser, CleanCSS and html minification. Minification bugs only reproduce under `npm run build`.
- `copy` passes an explicit `{ base: 'src' }`. gulp 5 resolves `base` per-glob, so without it `src/*.json` lands in `build/src/` instead of `build/` — which would put `manifest.json` at the wrong URL.
- `copy` also passes `encoding: false` to both `src()` and `dest()`, because it carries **binary** files (the PNGs, the woff2). gulp 5 / vinyl-fs 4 decode contents as UTF-8 by default, which replaces every non-UTF-8 byte with U+FFFD — silently and irreversibly. It doesn't fail the build: the files just grow and stop parsing (a PNG's leading `0x89` becomes `ef bf bd`, so the favicon vanished and the code font fell back). Any new glob carrying binary must keep this flag. `cmp -s src/<f> build/<f>` is the check.

The gulpfile is ESM (`gulpfile.mjs`) because `gulp-nunjucks` is ESM-only. CleanCSS and `html-minifier-terser` are driven through a small local `mapContents()` vinyl transform rather than gulp plugin wrappers.

### `_`-prefixed properties are mangled — this constrains naming

For the `page` bundle only, terser is configured with `mangle: { properties: { regex: /^_/ } }`. So the `_privateThing` convention is load-bearing, not cosmetic: **any property that crosses a boundary the minifier can't see must not start with `_`**. That means worker message payloads, settings keys derived from HTML `name` attributes, and anything read from JSON. Conversely, renaming a public property to `_public` in the page bundle will silently break it in production but work in dev.

## Architecture

### UI component convention

Every class in `src/js/page/ui/` owns a DOM subtree exposed as `this.container` and, where it has outputs, a [nanoevents](https://github.com/ai/nanoevents) `this.emitter`. `MainController` (`src/js/page/main-controller.js`) constructs them all, subscribes to their emitters, and appends their containers into the server-rendered shell. Components never talk to each other directly — everything routes through `MainController`.

Components get their DOM one of two ways, and it matters:

- **Self-created** (`Output`, `Toasts`, `DownloadButton`, `Ripple`, …) — build markup with `strToEl()` from `src/js/page/utils.js`; usable immediately in the constructor.
- **Adopted from `index.njk`** (`Settings`, `ToolbarActions`, `Preloader`, `ViewToggler`, …) — `document.querySelector` inside `domReady.then(...)`, so **`this.container` is undefined until DOM ready**. `MainController`'s own DOM wiring is likewise inside a `domReady.then()`.

`utils.js` also provides `transitionToClass`/`transitionFromClass` (add/remove a class and await `transitionend`, with a 1s timeout race) — this is how all the animation sequencing works, including `MainUi.activate()`'s intro animation.

### Worker protocol

`src/js/page/worker-messenger.js` is a generic request/response wrapper over `postMessage`: it tags each message with an incrementing `id`, keeps a `_pending` map of `[resolve, reject]`, and resolves on `{ id, result }` / rejects on `{ id, error }`. The worker is created **lazily** on first request. `abort()` terminates the worker, rejects all pending promises with an `AbortError` `DOMException`, and starts a fresh one — that's the only cancellation mechanism, since SVGO itself is synchronous and uninterruptible.

Subclasses: `Svgo` (`page/svgo.js`), `Gzip` (`page/gzip.js`, singleton export), `Prism` (`page/prism.js`).

Each worker's `self.onmessage` follows the same try/catch-and-reply-with-`error.message` shape. `svgo-worker` dispatches on `event.data.action` through an `actions` map (`wrapOriginal`, `process`) — add new operations there. It imports `svgo/browser` and injects an inline `extract-dimensions` visitor plugin to read width/height (or viewBox) out of the same optimize pass.

### Settings live in the DOM, not in JS

There is no settings state object. `src/config.json` lists the exposed SVGO plugins (`id`, `name`, `enabledByDefault`); the Nunjucks template loops over it to render one checkbox per plugin with `name="{{ plugin.id }}"`. `Settings.getSettings()` reads the inputs back and rebuilds `{ plugins: {...}, floatPrecision, multipass, pretty, gzip, original, fingerprint }`, keyed by those `name` attributes. `Settings.setSettings()` does the reverse when restoring from IndexedDB, and `_onReset()` restores defaults by re-reading each input's *initial HTML attributes*.

Consequences:

- **Exposing another SVGO plugin = one entry in `src/config.json`.** No JS change.
- The `name` attribute is the contract between HTML, the settings object, and the worker's plugin list.
- Range inputs are wrapped by `MaterialSlider` and must be written through `this._sliderMap.get(input).value`, not `input.value`.
- Range `input` events are throttled 150ms before `change` is emitted; other inputs emit immediately.

### Startup: the demo loads itself, and the shell paints settled

There is no start screen and no dismissable overlay. On `domReady`, `MainController` awaits `_loadSettings()` and then calls `this._actionsUi.loadDemo({ auto: true })`, so the app opens with the bundled `test-svgs/car-lite.svg` already optimised. Three things about that are load-bearing:

- **`await _loadSettings()` must come first.** `Settings.setSettings()` assigns input values programmatically, which fires no `input` event, so nothing recompresses afterwards — a demo compressed before the restore landed would silently disagree with the panel displaying it.
- **The `auto` flag must not set `_userHasInteracted`.** That flag decides whether a service-worker update reloads silently or shows an "Update available" toast; if an unprompted demo load counted as interaction, every visitor would get the toast. `auto` also suppresses the spinner (no button was clicked) and both failure paths — a fetch error in `loadDemo`, a parse error in `_onInputChange` — degrade to a `console.warn`, because nobody asked for it.
- **`_compressSvg` starts with `if (!this._inputItem) return;`.** The settings panel is interactive a few hundred ms before the demo finishes, so it *is* reachable with nothing to compress.

`MainUi.activate()` now fades in only `.output-switcher`; the toolbar, settings panel and action buttons are in place from the first frame. It's called from the `domReady` tail regardless of whether the demo loaded, because there's no drawer left to hide an unactivated shell behind.

### Compression flow and caching

`MainController._compressSvg(settings)` is the hot path:

1. Bails immediately if there's no input yet (see above), then stamps a `_latestCompressJobId` (a random number), `await svgo.abort()`, and bails again if a newer call landed meanwhile.
2. If `settings.original`, shows the input file as-is.
3. Looks up `settings.fingerprint` in `ResultsCache` (a 10-entry ring buffer). The fingerprint deliberately **excludes `gzip` and `original`**, since neither changes SVGO's output — only how it's measured/displayed.
4. Otherwise `svgo.process()`, then caches the result. `AbortError` is swallowed; other errors become a toast.

`SvgFile` (`page/svg-file.js`) lazily memoises both its blob `url` and its gzipped `size()`. `ResultsCache` calls `release()` on evicted entries to revoke blob URLs — if you add another place that holds `SvgFile`s, it owns that revocation too.

### The service worker and its cache name

**The app has no version number** — no changelog, and `package.json` deliberately has no `version` field. Nothing in the page bundle knows what build it is; git history is the record.

The service worker's static cache is named `svgomg-static-<hash>`, where the hash is `SVGOMG_BUILD_ID`: the gulpfile's `buildId()` sha256-hashes the relative path and contents of every file in `build/` (sorted, excluding `sw.js` itself and `.map` files) and Rollup `@rollup/plugin-replace` substitutes it into the SW bundle. So the cache name — and with it the update flow — changes **exactly when the shipped bytes change**, with nothing to bump by hand. Two consequences:

- `swJs` must run after every other build task, since it hashes their output. This is the only reason the SW isn't part of `appJs`.
- Anything that alters output alters the hash, including a dependency upgrade or a change to the minifier config. Rebuilding unchanged sources reproduces the same hash, so an idempotent redeploy doesn't churn users' caches.

`src/js/sw/index.js` precaches a **hand-written asset list** — new runtime assets must be added there manually. Because there's no version, there's no way to tell a breaking update from a safe one, so **every update `skipWaiting()`s**; `MainController._onUpdateFound` then shows either a silent reload (user hasn't interacted) or an "Update available" toast, with no "dismiss" — by the time it runs, the old build's cache is already gone, so reloading is the only outcome the app can honour. `.woff2` requests use a separate cache-first-then-fill `svgomg-fonts` cache that survives build changes.

**The immediate activation is a settled decision, not an oversight.** A 2026-08 audit recommended replacing it with a controlled update (leave the new worker waiting, activate on acceptance, reload on `controllerchange`); the repository owner reviewed that and chose to keep the current behaviour, because there is no version number to distinguish a breaking update from a safe one and the residual risk needs a worker message-contract change to bite. Don't re-architect it without a fresh decision from the owner.

`src/js/utils/storage.js` is a tiny hand-rolled IndexedDB key/value store (`svgo-keyval`), used by the page for saved settings.

## Styles

Two Sass entry points, both in `src/styles/`: `head.scss` (critical CSS, inlined into `<head>`) and `all.scss` (the rest, loaded async). Component partials live in one of two directories, each with an `_index.scss` that `@forward`s its members:

| directory | index loaded by | when to put a component here |
|---|---|---|
| `src/styles/critical/` | `head.scss` | it styles server-rendered markup that must not flash unstyled (`toolbar`, `view-toggler`, `preloader`) |
| `src/styles/components/` | `all.scss` | everything else |

**The toolbar is critical, and `_main-layout.scss` must not mention `.toolbar`.** The bar is the app's only affordance before `all.css` arrives, so `critical/_toolbar.scss` owns *every* `.toolbar` rule — including the `z-index` and `box-shadow` that used to sit in `_main-layout.scss`. A rule for the bar in the async stylesheet can only ever move it *after* first paint; the old `transform: translateY(-110%)` intro state did exactly that, which is why it's gone. `test/build-smoke.test.js` asserts `.toolbar` appears in `head.css` and not in `all.css`.

**A component belongs to exactly one directory.** The two entry points are separate compilations, so a partial forwarded by both indexes would have its rules emitted into both `head.css` and `all.css`. Adding a component means one `@forward` line in one index.

Everything uses the Sass module system (`@use` / `@forward`) — no `@import`. So a partial that needs `_utils.scss` (the `user-select` mixin, the `$ease*` easing curves) must `@use '../utils'` itself and call members namespaced: `@include utils.user-select(none)`, `utils.$easeOutQuint`. Loading a module twice in one compilation emits its CSS once, so this costs nothing.

`_utils.scss` still emits one rule (`.bg-dark`), and both entries load it — so that rule does land in both stylesheets. Keep output-producing rules out of it.

## Code style

xo + Prettier (single quotes, semicolons, trailing commas, 2-space indent) for JS; stylelint with `stylelint-config-twbs-bootstrap` for Sass. Rule overrides live in `xo.config.mjs` and `.stylelintrc`; Prettier options live in `.prettierrc`. `npm run fix` autofixes JS. `.editorconfig` applies repo-wide.

Two xo gotchas worth knowing:

- xo applies **its own** Prettier options in preference to `.prettierrc` (it defaults to `bracketSpacing: false`), so this repo's formatting is pinned by restating the options in the `prettier/prettier` rule in `xo.config.mjs`. Changing `.prettierrc` alone won't change what xo enforces.
- `xo.config.mjs` disables a set of rules that conflict with load-bearing patterns here — most importantly `unicorn/prefer-private-class-fields` and `unicorn/no-undeclared-class-members`, because the `_` prefix must stay a normal property for the terser mangling described above. Each override carries a comment explaining why.

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
npm run lint     # xo (JS) + stylelint (src/css/)
npm run fix      # xo --fix
npm test         # lint + build — this is the whole test suite
```

There are **no unit tests and no test runner**; `npm test` is lint + build, which is also exactly what CI runs. Verify behaviour changes by hand in `npm run dev`. `src/test-svgs/` holds fixtures for that; only `car-lite.svg` is copied into the build (it backs the "demo" button).

`npm run dev` serves as well as watches — don't start a second server on 8080.

Deployment: CI builds every push/PR, but only the **`live`** branch is published to `gh-pages`. `main` is the development branch.

## Build pipeline (gulpfile.mjs)

Five separate Rollup IIFE bundles, one per entry directory under `src/js/` — the output filename is the *directory* name:

| entry | output |
|---|---|
| `src/js/page/index.js` | `build/js/page.js` |
| `src/js/svgo-worker/index.js` | `build/js/svgo-worker.js` |
| `src/js/gzip-worker/index.js` | `build/js/gzip-worker.js` |
| `src/js/prism-worker/index.js` | `build/js/prism-worker.js` |
| `src/js/sw/index.js` | `build/sw.js` (root — needs root scope) |

Adding a bundle means adding a `js.bind(...)` line to `allJs`.

Other tasks: `css` (Sass → `build/all.css` + `build/head.css`), `html` (Nunjucks → `build/index.html`), `copy` (`.well-known`, `imgs`, `fonts`, `src/*.json`, `test-svgs/car-lite.svg`).

Three build facts that are easy to trip over:

- `html` reads `build/head.css` off disk and inlines it via `{{ headCSS|safe }}`, so it must run *after* `css` (`gulp.series(css, html)`).
- `IS_DEV_TASK` (argv contains `dev` or `--dev`) disables terser, CleanCSS and html minification. Minification bugs only reproduce under `npm run build`.
- `copy` passes an explicit `{ base: 'src' }`. gulp 5 resolves `base` per-glob, so without it `src/*.json` lands in `build/src/` instead of `build/` — which silently breaks the service worker, since it precaches `changelog.json` at the root.

The gulpfile is ESM (`gulpfile.mjs`) because `gulp-nunjucks` is ESM-only. CleanCSS and `html-minifier-terser` are driven through a small local `mapContents()` vinyl transform rather than gulp plugin wrappers.

### `_`-prefixed properties are mangled — this constrains naming

For the `page` bundle only, terser is configured with `mangle: { properties: { regex: /^_/ } }`. So the `_privateThing` convention is load-bearing, not cosmetic: **any property that crosses a boundary the minifier can't see must not start with `_`**. That means worker message payloads, settings keys derived from HTML `name` attributes, and anything read from JSON. Conversely, renaming a public property to `_public` in the page bundle will silently break it in production but work in dev.

## Architecture

### UI component convention

Every class in `src/js/page/ui/` owns a DOM subtree exposed as `this.container` and, where it has outputs, a [nanoevents](https://github.com/ai/nanoevents) `this.emitter`. `MainController` (`src/js/page/main-controller.js`) constructs them all, subscribes to their emitters, and appends their containers into the server-rendered shell. Components never talk to each other directly — everything routes through `MainController`.

Components get their DOM one of two ways, and it matters:

- **Self-created** (`Output`, `Toasts`, `DownloadButton`, `Ripple`, …) — build markup with `strToEl()` from `src/js/page/utils.js`; usable immediately in the constructor.
- **Adopted from `index.html`** (`Settings`, `MainMenu`, `Preloader`, `ViewToggler`, …) — `document.querySelector` inside `domReady.then(...)`, so **`this.container` is undefined until DOM ready**. `MainController`'s own DOM wiring is likewise inside a `domReady.then()`.

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

### Compression flow and caching

`MainController._compressSvg(settings)` is the hot path:

1. Stamps a `_latestCompressJobId` (a random number), `await svgo.abort()`, then bails if a newer call landed meanwhile.
2. If `settings.original`, shows the input file as-is.
3. Looks up `settings.fingerprint` in `ResultsCache` (a 10-entry ring buffer). The fingerprint deliberately **excludes `gzip` and `original`**, since neither changes SVGO's output — only how it's measured/displayed.
4. Otherwise `svgo.process()`, then caches the result. `AbortError` is swallowed; other errors become a toast.

`SvgFile` (`page/svg-file.js`) lazily memoises both its blob `url` and its gzipped `size()`. `ResultsCache` calls `release()` on evicted entries to revoke blob URLs — if you add another place that holds `SvgFile`s, it owns that revocation too.

### Versioning and the service worker

`src/changelog.json`'s **first entry's `version` is the single source of truth**. It reaches the app twice: Rollup `@rollup/plugin-replace` substitutes `SVGOMG_VERSION` (used by `sw/index.js` for cache names), and Nunjucks writes `window.version` into `index.html` (read as `self.version` for the changelog UI and the `last-seen-version` IndexedDB key). `package.json` deliberately has **no** `version` field: the package is `private` and never published, nothing reads it, and a second copy only ever drifts from the changelog. Bump the changelog and nothing else.

So: **shipping a user-visible change means prepending an entry to `src/changelog.json`**, which changes the SW cache name and triggers the update flow.

`src/js/sw/index.js` precaches a **hand-written asset list** — new runtime assets must be added there manually. Its update policy is deliberate: on a *minor* version change it `skipWaiting()`s; on a *major* change it waits, and `MainController._onUpdateFound` shows either a silent reload (user hasn't interacted) or an "Update available" toast. `.woff2` requests use a separate cache-first-then-fill `svgomg-fonts` cache that survives version changes.

`src/js/utils/storage.js` is a tiny hand-rolled IndexedDB key/value store (`svgo-keyval`), shared by the page and the service worker.

## Styles

Two Sass entry points, both in `src/css/`: `head.scss` (critical CSS, inlined into `<head>`) and `all.scss` (the rest, loaded async). Partials live in `src/css/components/`. Note both entries `@import 'utils'` — putting output-producing rules in `_utils.scss` duplicates them.

## Code style

xo + Prettier (single quotes, semicolons, trailing commas, 2-space indent) for JS; stylelint with `stylelint-config-twbs-bootstrap` for Sass. Rule overrides live in `xo.config.mjs` and `.stylelintrc`; Prettier options live in `.prettierrc`. `npm run fix` autofixes JS. `.editorconfig` applies repo-wide.

Two xo gotchas worth knowing:

- xo applies **its own** Prettier options in preference to `.prettierrc` (it defaults to `bracketSpacing: false`), so this repo's formatting is pinned by restating the options in the `prettier/prettier` rule in `xo.config.mjs`. Changing `.prettierrc` alone won't change what xo enforces.
- `xo.config.mjs` disables a set of rules that conflict with load-bearing patterns here — most importantly `unicorn/prefer-private-class-fields` and `unicorn/no-undeclared-class-members`, because the `_` prefix must stay a normal property for the terser mangling described above. Each override carries a comment explaining why.

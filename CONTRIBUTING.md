# Contributing to OMSVG

Bug reports, ideas and pull requests are welcome.
[Check the issues](https://github.com/ericges/omsvg/issues) to see what's planned, and open one
before starting anything large — it saves you building something that was already decided against.

## Getting set up

Requires Node **22**, **24**, or **26 and later**. There is nothing else to install and no service
to configure: the app is static files and runs entirely in the browser.

```sh
git clone https://github.com/ericges/omsvg.git
cd omsvg
npm install
npm run dev
```

`npm run dev` builds, watches `src/`, and serves the result on <http://localhost:8080>. It serves as
well as watches, so don't start a second server on that port.

## Before you open a pull request

Run the whole suite:

```sh
npm test        # lint + production build + tests
```

CI splits the same work across two jobs — `lint`, and `build` followed by the tests — so a check
added to `npm test` alone gates nothing. Both must pass before anything is merged, and only `main`
is deployed.

Two things are worth doing by hand as well, because nothing automated covers them:

- **Anything touching the DOM, the workers or the service worker has no test coverage.** Load a file
  in `npm run dev` and look at it. `src/test-svgs/` holds fixtures, including
  `kitchen-sink.svg` — a labelled test card carrying every construct the exposed optimisations act
  on, so toggling any single control visibly changes the output.
- **Minification bugs only reproduce under `npm run build`.** The dev build skips terser, CleanCSS
  and HTML minification.

## Code style

`xo` (with Prettier) for JS, `stylelint` for Sass. `npm run fix` autofixes what it can. Please don't
reformat code you aren't otherwise changing.

Two conventions are load-bearing rather than cosmetic, and both are easy to trip over:

- **A property whose name starts with `_` is mangled by the minifier**, for the page bundle only. So
  anything crossing a boundary the minifier can't see — worker message payloads, settings keys taken
  from HTML `name` attributes, anything read out of JSON — must **not** start with `_`. Conversely,
  renaming a public property to `_something` will work in dev and break in production.
- **The test suite uses `node --test` with no framework and no additional dependencies.** Assertions
  go through the test context (`t.assert.strictEqual`), not an imported `node:assert`. Please keep
  new tests to that, and don't add a dependency to write one.

`CLAUDE.md` documents the architecture in far more detail than this file does — the settings model,
the worker protocol, the collision notices, the build pipeline and the reasons behind them. Read the
part that covers what you're changing; most of it exists because something was got wrong once.

## Some things are easier than they look

**Exposing another SVGO plugin is one entry in [`src/config.json`](./src/config.json)** — an `id`, a
`name`, an `enabledByDefault` flag and a `category`. The template renders the checkbox, and the
`name` attribute carries it through to the worker. Its position in the array is its position in the
pipeline. No JavaScript change is needed unless the plugin belongs to one of the four grouped
controls, which are mapped by hand.

**Adding a demo SVG** is likewise one entry in that file's `demos` array plus the file in
`src/test-svgs/`; the build ships exactly the files listed there.

## Reporting a bug

Say what you did, what you expected and what happened, and **attach the SVG** if you can — most
bugs here are specific to one file's markup. If the file is confidential, a reduced version that
still reproduces the problem is just as good. Include your browser, since the app leans on fairly
new platform features (`popover`, service workers, `structuredClone`).

Note that the app never uploads anything, so there are no server logs to look at: whatever the
browser console says is the only record.

## Licensing and copyright

OMSVG is source-available, not open source — the terms are in [LICENSE.md](./LICENSE.md), and the
[README](./README.md#licence) summarises what they permit in practice. Contributions are covered by
them too:

> By opening a pull request you confirm that you wrote the contribution yourself or have the right to
> submit it, and that you license it under the licence in [LICENSE.md](./LICENSE.md) — granting Eric
> Gesemann the right to publish it under that licence and under any later version of it published for
> this project. You keep the copyright in your contribution.

There is no CLA to sign and no checkbox to tick; opening the pull request is the whole of it.

Two reasons that clause is worded the way it is, since it asks for slightly more than "same licence
as the project":

- **Section 2 of the licence is a grant, and only the copyright holder can make it.** It re-opens
  commercial use on top of the noncommercial base. A contribution licensed merely "under the same
  licence" couldn't carry that grant, so those lines would be noncommercial-only and the combined
  work's commercial permission would break.
- **The licence may still need rewording.** Sections 1 and 2 haven't been through a lawyer. If a
  review calls for changes, they have to be possible for contributed lines too — otherwise every
  past contributor would have to be tracked down first.

If you add a dependency that ends up in a **bundle** — as opposed to build tooling — its notice has
to go into [NOTICE.md](./NOTICE.md), including any transitive dependency it brings with it.
`test/notices.test.js` will fail until it does.

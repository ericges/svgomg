<div align="center">

<img src="src/images/icon.png" width="96" alt="">

# OMSVG

**Optimize My SVG** — tune every [SVGO](https://github.com/svg/svgo) optimisation, watch the file
shrink, and see instantly if you broke the image.

Runs entirely in your browser. No upload, no backend, no tracking.

[![CI](https://github.com/ericges/omsvg/actions/workflows/ci.yml/badge.svg)](https://github.com/ericges/omsvg/actions/workflows/ci.yml)
[![Live](https://img.shields.io/website?url=https%3A%2F%2Fomsvg.app&up_message=online&down_message=offline&label=omsvg.app)](https://omsvg.app/)
[![SVGO](https://img.shields.io/github/package-json/dependency-version/ericges/omsvg/dev/svgo?label=SVGO&color=blue)](https://github.com/svg/svgo)
[![Node](https://img.shields.io/badge/node-22%20%C2%B7%2024%20%C2%B7%2026%2B-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-source--available-blue)](./LICENSE.md)

### [→ Open the app](https://omsvg.app/)

</div>

## Why

SVGO is excellent, but it's a command line tool with dozens of switches and no way to see what
you've just done to your artwork. OMSVG puts every option behind a toggle and re-optimises as you
change them, so you get the smallest file that still *looks right* — rather than the smallest file.

- **See the damage immediately.** The preview re-renders on every change, and _Show original_
  flips back for comparison.
- **All 47 plugins exposed**, 34 on by default, plus number/transform precision, multipass and
  pretty-printing.
- **Real numbers.** Before/after size and percentage, optionally measured **gzipped** — which is
  what actually travels over the wire.
- **Read the output.** A syntax-highlighted markup view, with copy-to-clipboard and download.
- **Works offline.** A service worker caches the app, so it keeps running with no connection.
- **Nothing to set up.** A demo SVG loads by itself, so the app opens with something to look at;
  drop, paste or pick a file from the toolbar to replace it.

## Privacy

There is no server. The app is a bundle of static files: your SVG is read, optimised and rendered
entirely inside the page, and never leaves your machine. Optimisation, gzip sizing and syntax
highlighting all run in web workers, and a [Content-Security-Policy][csp] defaulting to `none`
keeps it that way.

This fork additionally **removes the telemetry** present upstream. Nothing is measured, logged or
phoned home.

[csp]: ./src/index.njk

> [!NOTE]
> SVGO is an optimiser, not a sanitiser. Script and style removal are optional and off by default,
> so don't treat a downloaded SVG as trusted active content.

## Running locally

Requires Node **22**, **24**, or **26 and later**.

```sh
git clone https://github.com/ericges/omsvg.git
cd omsvg
npm install
npm run dev
```

`npm run dev` builds, watches `src/`, and serves the result on <http://localhost:8080>.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Clean, build, watch `src/`, and serve on `:8080` (unminified) |
| `npm run build` | One-off production build into `build/` (terser + CleanCSS + html-minifier) |
| `npm start` | Serve an existing `build/` without rebuilding |
| `npm run lint` | XO (JS) and Stylelint (Sass) |
| `npm run fix` | Autofix what XO can |
| `npm run test:node` | Run the test suite (needs a production build to exist) |
| `npm test` | Lint, production build, then tests — the full check |

## Tests

`npm test` is the whole suite, and covers what CI covers. Specs live in `test/` and run on
[`node --test`](https://nodejs.org/api/test.html) — no test framework, no extra dependencies.

Coverage is deliberately focused: the DOM-free logic (byte sizing, the results cache and its blob
URL lifecycle, dimension parsing, preview clamping, the worker request/abort protocol), plus a
**production-build smoke test** for the things only a real build can show — property mangling,
the page↔worker key contract, and that every precached asset actually exists.

Anything DOM-, worker- or service-worker-shaped is still verified by hand in `npm run dev`;
`src/test-svgs/` holds fixtures for that.

## How it works

Vanilla ES modules, no framework. Five Rollup bundles are produced from `src/js/`: the page, three
web workers (SVGO, gzip, Prism), and the service worker. Gulp drives Sass, Nunjucks templating and
asset copying.

The service worker's cache is named after a hash of everything the build produces, so it changes
exactly when the shipped bytes change and there's no version number to bump by hand.

Adding an SVGO plugin to the UI is a single entry in [`src/config.json`](./src/config.json) — the
template renders the checkbox and the `name` attribute carries it through to the worker.

## Deployment

Every pull request is linted, built and tested, as is every push to `main`. Only **`main`** is
published, to GitHub Pages at <https://omsvg.app/>, and only once all three pass — see
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

## Contributing

Bug reports, ideas and pull requests are welcome —
[check the issues](https://github.com/ericges/omsvg/issues) to see what's planned. Please run
`npm test` before opening a pull request.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the rest: the conventions that aren't obvious from the
code, how to report a bug usefully, and the licensing terms a contribution comes under.

## Licence

Source-available, not open source. The full terms are in [LICENSE.md](./LICENSE.md) — the **OMSVG
License 1.0**: noncommercial by default, with commercial use added back, under two conditions that
reach every permission it gives. Those two are what matter in practice:

1. **Don't make money from giving other people access to it.** No ads, no subscription, no paywall,
   no "feature of our paid plan", no lead generation, no selling usage data. This one is a condition
   on every permission the licence gives, so it holds for charities and universities too.
2. **If you host a changed version publicly, publish your source** — on these same terms, free to
   download, at a URL anyone can reach, and say in the app where to find it. "Changed" includes
   wrapping it or injecting into it, not just editing its files.

The table below is a summary; the licence governs.

|    | Usage                                                                  | Conditions                                                                                                                                                                                                   |
|:--:|------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| ✅ | Use it, at home or at work, on paid client projects                    | nothing to publish                                                                                                                                                                                           |
| ✅ | Run it on your own machines or your company's intranet, changed or not | nothing to publish                                                                                                                                                                                           |
| ✅ | Host it for your clients as part of your services                      | nothing to publish, as long as access to it isn't a material part of what they pay you and you don't also put that version online for everyone                                                               |
| ✅ | Mirror it publicly, free of charge, unchanged                          | no attribution to me, and you may keep the name and the logo — but not the domain, don't present it as the official site, and the licence and the upstream and third-party notices must travel with the copy |
| ✅ | Fork it and host your fork publicly, free of charge                    | publish your source, and give it your own name and logo                                                                                                                                                      |
| ✅ | Take donations for running a free public copy                          | as long as paying changes nothing about access                                                                                                                                                               |
| ❌ | Host it publicly with advertising on or around it                      | not permitted                                                                                                                                                                                                |
| ❌ | Charge for access, or include it in a paid product or service          | not permitted                                                                                                                                                                                                |
| ❌ | Run a free copy to market a paid product of yours                      | not permitted                                                                                                                                                                                                |
| ❌ | Sell or broker data about its use                                      | not permitted                                                                                                                                                                                                |

Everything up to and including commit `f925656` is upstream SVGOMG and stays available under the
MIT License — see [NOTICE.md](./NOTICE.md), which also carries the notices for the third-party code
the built app bundles.

Artwork here that belongs to other people stays under its own terms — the demo drawings, one of
which is AGPL-3.0-or-later and the rest public domain or MIT, and the interface icons, which are
eleven from [Lucide](https://lucide.dev) (ISC), one from [Tabler](https://tabler.io/icons) (MIT) and
GitHub's own mark. [ASSETS.md](./ASSETS.md) says which is which, where each came from, and what its
terms ask of you.

Contributions from other people are licensed under the MIT License and stay available under it — see
[CONTRIBUTING.md](./CONTRIBUTING.md#licensing-and-copyright).

## Credits

SVGOMG, which this is a [fork](https://github.com/jakearchibald/svgomg) of, was created by
[Jake Archibald](https://github.com/jakearchibald); this fork keeps it updated and free of
telemetry. It stands on [SVGO](https://github.com/svg/svgo) by Kir Belevich and contributors.

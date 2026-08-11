# SVGOMG!

[SVGOMG](https://svgomg.ges.dev/) is **[SVGO](https://github.com/svg/svgo)**'s **M**issing **G**UI, aiming to expose the majority, if not all configuration options of SVGO.

> This is a fork of [jakearchibald/svgomg](https://github.com/jakearchibald/svgomg), updated and freed from telemetry.

## Feature requests

[Check out the issues](https://github.com/ericges/svgomg/issues) to see what's planned, or suggest ideas of your own!

## Running locally

Install dependencies:

```sh
npm install
```

Run dev server:

```sh
npm run dev
```

## Deployment

Pushing to `main` builds the site and publishes it to GitHub Pages at
<https://svgomg.ges.dev/> via `.github/workflows/ci.yml`. Lint and build both
have to pass before the deploy job runs.

The repository needs two one-off settings for this to work:

- **Settings → Pages → Source**: `GitHub Actions`
- **Settings → Pages → Custom domain**: `svgomg.ges.dev`, with a DNS `CNAME`
  record pointing `svgomg.ges.dev` at `ericges.github.io`. Enable
  **Enforce HTTPS** once the certificate is issued.

The site is entirely static and has no backend — SVGs never leave the browser.

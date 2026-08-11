import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import http from 'node:http';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';
// `sirv-cli` no longer exposes a programmatic entry point, so the dev server
// uses the underlying `sirv` middleware directly. `npm start` still uses the
// `sirv` CLI that `sirv-cli` provides.
import sirv from 'sirv';
import { VERSION as SVGO_VERSION } from 'svgo';
import * as sass from 'sass';
import CleanCSS from 'clean-css';
import gulp from 'gulp';
import gulpif from 'gulp-if';
import gulpSassFactory from 'gulp-sass';
import { nunjucksCompile } from 'gulp-nunjucks';
import { minify as htmlMinify } from 'html-minifier-terser';
import * as rollup from 'rollup';
import { nodeResolve as rollupResolve } from '@rollup/plugin-node-resolve';
import rollupCommon from '@rollup/plugin-commonjs';
import rollupReplace from '@rollup/plugin-replace';
import rollupTerser from '@rollup/plugin-terser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const gulpSass = gulpSassFactory(sass);

const IS_DEV_TASK =
  process.argv.includes('dev') || process.argv.includes('--dev');

const buildConfig = {
  cleancss: {
    level: {
      1: {
        specialComments: 0,
      },
      2: {
        all: false,
        mergeMedia: true,
        removeDuplicateMediaBlocks: true,
        removeEmpty: true,
      },
    },
    sourceMap: true,
    sourceMapInlineSources: true,
  },
  htmlmin: {
    collapseBooleanAttributes: true,
    collapseInlineTagWhitespace: false,
    collapseWhitespace: true,
    decodeEntities: true,
    minifyCSS: false,
    minifyJS: true,
    removeAttributeQuotes: true,
    removeComments: true,
    removeOptionalTags: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    sortAttributes: true,
    sortClassName: true,
  },
  sass: {
    outputStyle: IS_DEV_TASK ? 'expanded' : 'compressed',
  },
  terser: {
    mangle: true,
    compress: {
      passes: 2,
    },
    format: {
      comments: false,
    },
  },
};

const readJSON = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
};

const comparePaths = (a, b) => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

// Hash everything in `build/` that the service worker may cache, to give its
// cache a name that changes exactly when the shipped bytes do. `sw.js` and
// source maps are excluded: the former embeds this hash (and is written after
// every other task for that reason), the latter are never cached.
async function buildId() {
  const entries = await fs.readdir(path.join(__dirname, 'build'), {
    recursive: true,
    withFileTypes: true,
  });

  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        !entry.name.endsWith('.map') &&
        !(
          entry.parentPath === path.join(__dirname, 'build') &&
          entry.name === 'sw.js'
        ),
    )
    .map((entry) => path.join(entry.parentPath, entry.name))
    // Directory order isn't guaranteed, but the hash must be stable
    .toSorted(comparePaths);

  const hash = crypto.createHash('sha256');

  for (const file of files) {
    hash.update(path.relative(__dirname, file));
    // eslint-disable-next-line no-await-in-loop
    hash.update(await fs.readFile(file));
  }

  return hash.digest('hex').slice(0, 16);
}

// Map each vinyl file's contents through `fn`, which takes a string and returns
// a string or a promise of one.
const mapContents = (fn) =>
  new Transform({
    objectMode: true,
    async transform(file, _encoding, callback) {
      if (file.isNull()) {
        callback(null, file);
        return;
      }

      try {
        file.contents = Buffer.from(await fn(file.contents.toString()));
      } catch (error) {
        callback(error);
        return;
      }

      callback(null, file);
    },
  });

const minifyCss = () =>
  mapContents(
    (source) => new CleanCSS(buildConfig.cleancss).minify(source).styles,
  );

const minifyHtml = () =>
  mapContents((source) => htmlMinify(source, buildConfig.htmlmin));

function copy() {
  return gulp
    .src(
      [
        'src/{images,test-svgs,fonts}/**',
        'src/*.json',
        // Tells GitHub Pages which custom domain serves this site
        'src/CNAME',
        // Exclusions must come after every positive glob: gulp applies a
        // negative glob only to the globs that follow it, and a magic-free
        // path like `src/CNAME` errors as "not found" if one precedes it.
        //
        // Exclude the test-svgs files except for `car-lite.svg`
        // which is used in the demo
        '!src/test-svgs/!(car-lite.svg)',
        '!src/images/maskable.svg',
      ],
      // `base` is explicit because gulp resolves it per-glob: without it
      // `src/*.json` would be written to `build/src/` rather than `build/`.
      { base: 'src' },
    )
    .pipe(gulp.dest('build'));
}

function css() {
  return gulp
    .src('src/styles/*.scss', { sourcemaps: true })
    .pipe(gulpSass.sync(buildConfig.sass).on('error', gulpSass.logError))
    .pipe(gulpif(!IS_DEV_TASK, minifyCss()))
    .pipe(gulp.dest('build/', { sourcemaps: '.' }));
}

async function html() {
  const [config, headCSS] = await Promise.all([
    readJSON(path.join(__dirname, 'src', 'config.json')),
    fs.readFile(path.join(__dirname, 'build', 'head.css'), 'utf8'),
  ]);

  return gulp
    .src('src/*.html')
    .pipe(
      nunjucksCompile({
        plugins: config.plugins,
        headCSS,
        SVGO_VERSION,
        liveBaseUrl: 'https://svgomg.ges.dev/',
        title: "SVGOMG - SVGO's Missing GUI for minifying SVGs",
        description: 'Easy & visual compression of SVG images.',
        iconPath: 'images/icon.png',
      }),
    )
    .pipe(gulpif(!IS_DEV_TASK, minifyHtml()))
    .pipe(gulp.dest('build'));
}

const rollupCaches = new Map();

async function js(entry, outputPath, replacements) {
  const name = path.basename(path.dirname(entry));
  const bundle = await rollup.rollup({
    cache: rollupCaches.get(entry),
    input: `src/${entry}`,
    plugins: [
      replacements
        ? rollupReplace({ preventAssignment: true, ...replacements })
        : undefined,
      rollupResolve({ browser: true }),
      rollupCommon({ include: /node_modules/ }),
      // Don't use terser on development
      IS_DEV_TASK
        ? undefined
        : rollupTerser(
            name === 'page'
              ? {
                  ...buildConfig.terser,
                  mangle: {
                    properties: {
                      regex: /^_/,
                    },
                  },
                }
              : buildConfig.terser,
          ),
    ],
  });

  rollupCaches.set(entry, bundle.cache);

  await bundle.write({
    sourcemap: true,
    format: 'iife',
    file: `build/${outputPath}/${name}.js`,
  });
}

function clean() {
  return fs.rm('build', { force: true, recursive: true });
}

const appJs = gulp.parallel(
  js.bind(null, 'js/prism-worker/index.js', 'js/'),
  js.bind(null, 'js/gzip-worker/index.js', 'js/'),
  js.bind(null, 'js/svgo-worker/index.js', 'js/'),
  js.bind(null, 'js/page/index.js', 'js/'),
);

// Bundles `sw.js`, hashing the rest of `build/` into it — so this has to run
// after every task that writes there, `appJs` included.
async function swJs() {
  await js('js/sw/index.js', '', {
    SVGOMG_BUILD_ID: JSON.stringify(await buildId()),
  });
}

const allJs = gulp.series(appJs, swJs);

const mainBuild = gulp.series(
  gulp.parallel(gulp.series(css, html), appJs, copy),
  swJs,
);

function watch() {
  gulp.watch(['src/styles/**/*.scss'], gulp.series(css, html, swJs));
  gulp.watch(['src/js/**/*.js'], allJs);
  gulp.watch(
    ['src/**/*.{html,svg,woff2}', 'src/*.json'],
    gulp.series(gulp.parallel(html, copy, appJs), swJs),
  );
}

function serve() {
  const port = 8080;
  http.createServer(sirv('build', { dev: true })).listen(port, 'localhost');
  console.log(`Serving build/ on http://localhost:${port}`);
}

const cleanBuild = gulp.series(clean, mainBuild);
const dev = gulp.series(clean, mainBuild, gulp.parallel(watch, serve));

export {
  clean,
  allJs,
  css,
  html,
  copy,
  mainBuild as build,
  cleanBuild as 'clean-build',
  dev,
};

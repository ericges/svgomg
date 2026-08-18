import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

// NOTICE.md is hand-written, and the thing that ages it is a *transitive*
// dependency arriving unannounced — `sax` and its Blue Oak licence came in that
// way, under an SVGO patch bump. So this walks the runtime closure out of
// `package-lock.json` and insists every package in it is named.
//
// It reads the lockfile rather than the installed tree so it says the same thing
// whatever `node_modules` happens to hold, and needs no build.
const repoRoot = path.join(import.meta.dirname, '..');

// The five packages the bundles pull in directly. Everything else in the closure
// is reached through one of them; the rest of `devDependencies` is build-time
// tooling that ships nothing.
const bundledRoots = ['svgo', 'pako', 'prismjs', 'nanoevents', 'css-tree'];

const readLockfile = async () =>
  JSON.parse(
    await fs.readFile(path.join(repoRoot, 'package-lock.json'), 'utf8'),
  );

// npm's own resolution order: a dependency of `node_modules/a/node_modules/b`
// is looked for in that directory first, then one level up, and so on to the
// root — so a hoisted copy and a nested one both resolve correctly.
const resolveDependency = (packages, fromPath, name) => {
  const nesting = fromPath
    .replace(/^node_modules\//, '')
    .split('/node_modules/');

  for (let depth = nesting.length; depth >= 0; depth--) {
    const prefix = nesting
      .slice(0, depth)
      .map((segment) => `${segment}/node_modules/`)
      .join('');
    const candidate = `node_modules/${prefix}${name}`;
    if (packages[candidate]) return candidate;
  }
};

const packageName = (packagePath) => packagePath.split('node_modules/').pop();

const runtimeClosure = (packages) => {
  const visited = new Set();
  const unresolved = [];

  const visit = (packagePath) => {
    if (visited.has(packagePath)) return;
    visited.add(packagePath);

    for (const name of Object.keys(packages[packagePath].dependencies ?? {})) {
      const resolved = resolveDependency(packages, packagePath, name);
      if (resolved) {
        visit(resolved);
      } else {
        unresolved.push(`${name} (from ${packagePath})`);
      }
    }
  };

  for (const root of bundledRoots) visit(`node_modules/${root}`);

  // A package can appear twice at different versions (css-tree and mdn-data
  // both do), and the notice names packages, not versions — so the first test
  // works on names. The second one must not: a nested copy is a different
  // installed tree with its own licence file, and reading the hoisted one
  // instead silently skipped `csso`'s bundled css-tree 2.2.1, whose
  // `2016-2022` copyright line ships and is not the hoisted 3.2.1's
  // `2016-2026`. So the resolved paths are returned alongside.
  const paths = [...visited].toSorted((a, b) => a.localeCompare(b));
  const names = new Set(
    paths.map((packagePath) => packagePath.split('node_modules/').pop()),
  );

  return { names, paths, unresolved };
};

test('every bundled package is named in NOTICE.md', async (t) => {
  const [{ packages }, notice] = await Promise.all([
    readLockfile(),
    fs.readFile(path.join(repoRoot, 'NOTICE.md'), 'utf8'),
  ]);

  const absentRoots = bundledRoots.filter(
    (root) => !packages[`node_modules/${root}`],
  );

  t.assert.deepStrictEqual(
    absentRoots,
    [],
    'bundled packages missing from package-lock.json — are they still dependencies?',
  );

  const { names, unresolved } = runtimeClosure(packages);

  // A name that can't be resolved would silently shrink the closure, and with
  // it whatever this test claims to have checked.
  t.assert.deepStrictEqual(
    unresolved,
    [],
    'dependencies missing from package-lock.json',
  );

  // As a whole token, so a name only ever present inside a longer one doesn't
  // count. `-` has to be part of the token or `css-tree` would match on `tree`.
  const isNamed = (name) =>
    new RegExp(String.raw`(?<![\w-])${name}(?![\w-])`).test(notice);

  const missing = [...names]
    .filter((name) => !isNamed(name))
    .toSorted((a, b) => a.localeCompare(b));

  t.assert.deepStrictEqual(
    missing,
    [],
    'packages reaching the browser without a notice — add them to NOTICE.md',
  );
});

// Naming a package is not the same as supplying its terms, and the test above
// cannot tell the difference — `pako` was listed as `MIT AND Zlib` for months
// while the zlib notice it names was nowhere in the file. So this one reads the
// *installed* licence files and insists every copyright line in them appears in
// `NOTICE.md` verbatim. It needs `node_modules`, which is the point: only the
// installed text says what the notice has to carry.
//
// A "copyright line" is one starting with `Copyright` and carrying either a
// year or a (c). Both halves matter: the case excludes MIT's own
// `COPYRIGHT HOLDERS BE LIABLE` and ISC's `copyright notice ... appear in all
// copies`, and the year-or-(c) test excludes CC0's prose about "Copyright and
// Related Rights", which is a definition rather than a notice.
const licenceFilePattern = /^licen[cs]e(?:\.\w+)?$/i;
const copyrightLinePattern = /^Copyright\b/;
const isNoticeLine = (line) =>
  /\((?:c|C)\)|©/.test(line) || /\b(?:19|20)\d\d\b/.test(line);

// The one package in the closure that publishes no licence file and no
// copyright line anywhere — it declares ISC in `package.json` and stops there.
// Listed rather than skipped silently, so a second one shows up as a failure.
const withoutLicenceFile = ['boolbase'];

// Takes the lockfile path — `node_modules/csso/node_modules/css-tree`, not
// `css-tree` — so a nested copy is read where it actually sits.
const installedCopyrightLines = async (packagePath) => {
  const dir = path.join(repoRoot, packagePath);
  let entries;

  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }

  const file = entries
    .toSorted((a, b) => a.localeCompare(b))
    .find((entry) => licenceFilePattern.test(entry));
  if (!file) return;

  const text = await fs.readFile(path.join(dir, file), 'utf8');

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => copyrightLinePattern.test(line) && isNoticeLine(line));
};

test('every bundled copyright line is reproduced verbatim', async (t) => {
  const [{ packages }, notice] = await Promise.all([
    readLockfile(),
    fs.readFile(path.join(repoRoot, 'NOTICE.md'), 'utf8'),
  ]);

  const { paths } = runtimeClosure(packages);
  const lines = await Promise.all(
    paths.map((packagePath) => installedCopyrightLines(packagePath)),
  );

  // Reported by name, so the expectation below stays a list of packages; a
  // package installed twice only counts as unlicensed if neither copy
  // publishes anything.
  const licensedNames = new Set(
    paths
      .filter((_, index) => lines[index])
      .map((packagePath) => packageName(packagePath)),
  );
  const unlicensed = [
    ...new Set(
      paths
        .filter((_, index) => !lines[index])
        .map((packagePath) => packageName(packagePath))
        .filter((name) => !licensedNames.has(name)),
    ),
  ].toSorted((a, b) => a.localeCompare(b));

  t.assert.deepStrictEqual(
    unlicensed,
    withoutLicenceFile,
    'a bundled package ships no licence file — check what it does publish',
  );

  // Deduplicated: two copies of a package usually carry the same line, and one
  // entry per missing line is what the reader needs. The path is on it because
  // that is where the text to copy actually is.
  const missing = [
    ...new Set(
      paths.flatMap((packagePath, index) =>
        (lines[index] ?? [])
          .filter((line) => !notice.includes(line))
          .map((line) => `${packagePath}: ${line}`),
      ),
    ),
  ].toSorted((a, b) => a.localeCompare(b));

  t.assert.deepStrictEqual(
    missing,
    [],
    'copyright lines absent from NOTICE.md — reproduce them exactly, do not reflow or abbreviate them',
  );
});

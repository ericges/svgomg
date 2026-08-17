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
  // both do), and the notice names packages, not versions.
  const names = new Set(
    [...visited].map((packagePath) => packagePath.split('node_modules/').pop()),
  );

  return { names, unresolved };
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

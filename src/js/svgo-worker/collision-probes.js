// Split out of the worker entry point for the same reason as `dimensions.js`:
// `index.js` ends in a `self.onmessage` assignment and exports nothing, so it
// can't be imported outside a worker. Bundles are named after their directory,
// so a sibling module here changes no output filename.
//
// Several exposed optimisations quietly do nothing depending on what the
// document contains: SVGO's own guards switch them off around a `<style>`
// element or a script, and `current-color-styles.js` backs off around a
// `<mask>`. The settings panel says so (`page/ui/setting-notes.js`), and this
// is where the evidence for those claims is gathered.
//
// **The measurement happens where the guard does.** A guard reads the document
// as it stands when its plugin runs, which is neither the input nor the
// result: `removeMetadata` can carry a `<script>` away with the `<metadata>`
// around it, and `removeUselessDefs` can drop an unreferenced `<mask>` — both
// before the plugins that would have backed off for them. So a probe is
// spliced in immediately ahead of each subject and records the state that
// subject is about to see. Nothing here decides what a plugin *did*: the flags
// are the guards' raw inputs, and `setting-notes.js` applies each plugin's own
// reading of them.

import {
  stylesheetHasConvertibleColours,
  stylesheetHasRules,
} from './current-color-styles.js';

// SVGO's `hasScripts()` (lib/svgo/tools.js) tests a fixed list of event
// attributes, so this is that list — the union of the five event groups in
// `plugins/_collections.js`, deduplicated. A `startsWith('on')` approximation
// would be wider than SVGO's: `oncustom` is not an event attribute, and a
// document carrying one would be told its IDs were left alone while SVGO
// happily minified them. `test/collision-probes.test.js` reads the collection
// straight out of `node_modules` and fails if the two ever diverge.
export const scriptEventAttributes = new Set([
  'onbegin',
  'onend',
  'onrepeat',
  'onload',
  'onabort',
  'onerror',
  'onresize',
  'onscroll',
  'onunload',
  'onzoom',
  'oncopy',
  'oncut',
  'onpaste',
  'oncancel',
  'oncanplay',
  'oncanplaythrough',
  'onchange',
  'onclick',
  'onclose',
  'oncuechange',
  'ondblclick',
  'ondrag',
  'ondragend',
  'ondragenter',
  'ondragleave',
  'ondragover',
  'ondragstart',
  'ondrop',
  'ondurationchange',
  'onemptied',
  'onended',
  'onfocus',
  'oninput',
  'oninvalid',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onloadeddata',
  'onloadedmetadata',
  'onloadstart',
  'onmousedown',
  'onmouseenter',
  'onmouseleave',
  'onmousemove',
  'onmouseout',
  'onmouseover',
  'onmouseup',
  'onmousewheel',
  'onpause',
  'onplay',
  'onplaying',
  'onprogress',
  'onratechange',
  'onreset',
  'onseeked',
  'onseeking',
  'onselect',
  'onshow',
  'onstalled',
  'onsubmit',
  'onsuspend',
  'ontimeupdate',
  'ontoggle',
  'onvolumechange',
  'onwaiting',
  'onactivate',
  'onfocusin',
  'onfocusout',
]);

// `elemsGroups.nonRendering` from the same collection: the elements
// `removeHiddenElems` defers to the end of its pass and only removes if the
// guard let it. Pinned by the same parity test.
export const nonRenderingElements = new Set([
  'clipPath',
  'filter',
  'linearGradient',
  'marker',
  'mask',
  'pattern',
  'radialGradient',
  'solidColor',
  'symbol',
]);

// An exact mirror of SVGO's `hasScripts()`, node for node.
const hasScripts = (node) => {
  if (node.name === 'script' && node.children.length !== 0) return true;

  if (node.name === 'a') {
    // The scheme is being detected in someone else's document here, not
    // authored into this one — nothing is ever navigated to it.
    // eslint-disable-next-line no-script-url
    const scriptScheme = 'javascript:';
    const hasJavaScriptHref = Object.entries(node.attributes).some(
      ([name, value]) =>
        (name === 'href' || name.endsWith(':href')) &&
        value !== undefined &&
        String(value).trimStart().toLowerCase().startsWith(scriptScheme),
    );

    if (hasJavaScriptHref) return true;
  }

  return [...scriptEventAttributes].some(
    (attribute) => node.attributes[attribute] !== undefined,
  );
};

// `removeHiddenElems` also defers a `<path>` whose *computed* opacity is `0`,
// and that one is deliberately not recorded. Reading the attribute instead of
// the cascade is not an approximation that only errs towards silence: a
// `style="opacity:0;opacity:1"` path is opaque, since CSS takes the last
// declaration, and a document containing one would have been told a
// transparent path was kept. Computing it properly means the stylesheet
// cascade SVGO builds internally, so the fact is dropped and the notice speaks
// only of the definitions below — which need no cascade to be certain of.

// The `<svg>` is defs-only when every one of its children is a `<defs>`
// element — a text node counts against it, exactly as in `cleanupIds`, so a
// pretty-printed document with the same elements is not defs-only. When it is,
// `cleanupIds` skips the whole subtree and the IDs control does nothing at all.
const isDefsOnly = (node) =>
  node.children.every(
    (child) => child.type === 'element' && child.name === 'defs',
  );

const blankSnapshot = () => ({
  // Any `<style>` element at all. `removeUselessStrokeAndFill` and
  // `moveElemsAttrsToGroup` bail on one of these…
  hasStyleElement: false,
  // …while `cleanupIds`, `removeHiddenElems` and `minifyStyles` want *children*
  // in it — SVGO's guards say `children.length !== 0` and nothing more, so this
  // means exactly that and not "has rules". The difference is an empty
  // `<style>`, on which the first pair really does stop and the second really
  // doesn't.
  hasFilledStyleElement: false,
  hasScripts: false,
  hasMask: false,
  // What each subject would have had to work on, so a notice is only shown
  // where there was something to overrule. Each is as exact as the guard it
  // gates: a mirror of SVGO's own test, or a question put to the same code the
  // pipeline runs.
  hasIds: false,
  isDefsOnlyRoot: false,
  hasNonRenderingElement: false,
  hasMultiChildGroup: false,
  // Derived from the stylesheet text at the end of the pass, because both take
  // a CSS parse and neither is answerable node by node. A `<style>` holding
  // nothing but a comment has children, no rules, and nothing to convert.
  hasStyleRules: false,
  hasConvertibleStylesheet: false,
});

/**
 * One probe: a visitor recording the state of the document it is run over.
 *
 * @returns {[object, object]} The snapshot, filled in as the pass runs, and the plugin to run.
 */
const createProbe = () => {
  const snapshot = blankSnapshot();
  let stylesheet = '';

  const plugin = {
    type: 'visitor',
    name: 'collision-probe',
    fn() {
      return {
        root: {
          exit() {
            snapshot.hasStyleRules =
              stylesheet !== '' && stylesheetHasRules(stylesheet);
            snapshot.hasConvertibleStylesheet =
              stylesheet !== '' && stylesheetHasConvertibleColours(stylesheet);
          },
          enter(root) {
            stylesheet = '';
            // Reset per pass, so multipass leaves the last pass's answer
            // standing rather than "seen at some point": a stylesheet cleared
            // on pass one is gone for everything that runs on pass two.
            Object.assign(snapshot, blankSnapshot());

            const svg = root.children.find(
              (child) => child.type === 'element' && child.name === 'svg',
            );

            snapshot.isDefsOnlyRoot = svg ? isDefsOnly(svg) : false;
          },
        },
        element: {
          enter(node) {
            if (node.name === 'style') {
              snapshot.hasStyleElement = true;

              if (node.children.length > 0) {
                snapshot.hasFilledStyleElement = true;

                for (const child of node.children) {
                  if (child.type === 'text' || child.type === 'cdata') {
                    stylesheet += `${child.value}\n`;
                  }
                }
              }
            } else if (node.name === 'mask') {
              snapshot.hasMask = true;
            }

            if (node.attributes.id !== undefined) snapshot.hasIds = true;

            if (!snapshot.hasScripts && hasScripts(node)) {
              snapshot.hasScripts = true;
            }

            if (nonRenderingElements.has(node.name)) {
              snapshot.hasNonRenderingElement = true;
            }

            if (node.name === 'g' && node.children.length > 1) {
              snapshot.hasMultiChildGroup = true;
            }
          },
        },
      };
    },
  };

  return [snapshot, plugin];
};

// The plugins whose guards the panel explains. Every one of them is named
// after the entry `buildPlugins()` puts in the array, which is how a probe
// finds its place; `current-color-styles` is ours, the rest are SVGO's.
export const collisionSubjects = [
  'minifyStyles',
  'cleanupIds',
  'current-color-styles',
  'removeUselessStrokeAndFill',
  'removeHiddenElems',
  'moveElemsAttrsToGroup',
];

/**
 * Splice a probe in front of every subject present in a built plugin array.
 *
 * Only subjects that are actually running get one — a plugin the user switched
 * off has nothing to explain, and costs no pass here either.
 *
 * @param {Array<object>} plugins The array from `buildPlugins()`.
 * @returns {[object, Array<object>]} The report, keyed by subject and filled in as the optimisation runs, and the instrumented array to hand to `optimize()`.
 */
export function withCollisionProbes(plugins) {
  const report = {};
  const instrumented = [];

  for (const plugin of plugins) {
    if (collisionSubjects.includes(plugin.name)) {
      const [snapshot, probe] = createProbe();

      report[plugin.name] = snapshot;
      instrumented.push(probe);
    }

    instrumented.push(plugin);
  }

  return [report, instrumented];
}

// Split out of the worker entry point for the same reason as `dimensions.js`:
// `index.js` ends in a `self.onmessage` assignment and exports nothing, so it
// can't be imported outside a worker. Bundles are named after their directory,
// so a sibling module here changes no output filename.
//
// What the input document contains, as far as the settings panel's collision
// notices care (`page/ui/setting-notes.js`). Three flags, each one the trigger
// of a guard that silently switches an optimisation off:
//
// - a `<style>` element deoptimises `removeUselessStrokeAndFill`,
//   `moveElemsAttrsToGroup`, `removeHiddenElems` and `cleanupIds`;
// - a script deoptimises all of those except `moveElemsAttrsToGroup`, plus
//   `minifyStyles`;
// - a `<mask>` makes `current-color-styles.js` leave every stylesheet alone.

// SVGO's guards disagree about empty `<style>` elements: `cleanupIds` and
// `removeHiddenElems` want children, `removeUselessStrokeAndFill` and
// `moveElemsAttrsToGroup` bail on the element either way. This takes the wider
// reading — an empty stylesheet is a curiosity, and a notice that names a
// construct the document really does contain is never a lie.
const isStyleElement = (name) => name === 'style';

// The same three things SVGO's own `hasScripts()` looks for (lib/svgo/tools.js).
// Its event-attribute list is 79 names long and every one of them starts with
// `on`, which no other SVG attribute does — so the prefix stands in for the
// list rather than duplicating it here, where it would rot.
const hasScripts = (name, attributes, children) => {
  if (name === 'script' && children.length > 0) return true;

  if (name === 'a') {
    // The scheme is being detected in someone else's document here, not
    // authored into this one — nothing is ever navigated to it.
    // eslint-disable-next-line no-script-url
    const scriptScheme = 'javascript:';
    const hasJavaScriptHref = Object.entries(attributes).some(
      ([attribute, value]) =>
        (attribute === 'href' || attribute.endsWith(':href')) &&
        value !== undefined &&
        value !== null &&
        String(value).trimStart().toLowerCase().startsWith(scriptScheme),
    );

    if (hasJavaScriptHref) return true;
  }

  return Object.keys(attributes).some((attribute) =>
    attribute.startsWith('on'),
  );
};

/**
 * A visitor that answers those three questions in a pass that was happening
 * anyway. Placed last in a plugin array it describes the *result*; placed alone
 * over the input it describes the input, and the panel uses both.
 *
 * @returns {[object, object]} The features object, filled in as the pass runs, and the plugin to run.
 */
export const createFeaturesExtractor = () => {
  const features = {
    hasStyleElement: false,
    hasScripts: false,
    hasMask: false,
  };

  const plugin = {
    type: 'visitor',
    name: 'extract-features',
    fn() {
      return {
        // Reset per pass, so multipass leaves the last pass's answer standing
        // rather than "seen at some point": a stylesheet cleared on pass one is
        // gone for every plugin that runs on pass two.
        root: {
          enter() {
            features.hasStyleElement = false;
            features.hasScripts = false;
            features.hasMask = false;
          },
        },
        element: {
          enter({ name, attributes, children }) {
            if (isStyleElement(name)) features.hasStyleElement = true;
            if (name === 'mask') features.hasMask = true;

            if (
              !features.hasScripts &&
              hasScripts(name, attributes, children)
            ) {
              features.hasScripts = true;
            }
          },
        },
      };
    },
  };

  return [features, plugin];
};

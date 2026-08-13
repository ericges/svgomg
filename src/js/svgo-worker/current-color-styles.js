// Split out of the worker entry point for the same reason as `dimensions.js`:
// `index.js` ends in a `self.onmessage` assignment and exports nothing, so it
// can't be imported outside a worker. Bundles are named after their directory,
// so a sibling module here changes no output filename.
//
// SVGO's `convertColors` only visits presentation attributes, so a colour the
// author wrote as `style="fill:red"` — or that `inlineStyles` moved there from
// a stylesheet — survives the "Colours to currentColor" toggle untouched. This
// companion covers the two places `convertColors` can't see: `style`
// attributes and whatever rules remain in `<style>` elements. It mirrors the
// plugin's rule for a boolean `currentColor` param: every value except `none`
// becomes `currentColor`.

const colourProperties = [
  'fill',
  'stroke',
  'stop-color',
  'flood-color',
  'lighting-color',
  'color',
];

// A declaration's property is only ever preceded by the start of the text, a
// `;`, a `{` or whitespace — which keeps `.fill:hover` (a selector) out, and
// stops bare `color` matching inside `stop-color`. The value starts on its
// first non-space character and stops before `;`, `}` and `!`, so a trailing
// `!important` survives the rewrite.
const declarationPattern = new RegExp(
  String.raw`(?<before>^|[\s;{])(?<property>${colourProperties.join('|')})(?<separator>\s*:\s*)(?<value>[^\s!;}](?:[^!;}]*[^\s!;}])?)`,
  'gi',
);

export const convertCssColoursToCurrentColor = (css) =>
  css.replaceAll(declarationPattern, (...args) => {
    // The named-groups object is the replacer's last argument.
    const { before, property, separator, value } = args.at(-1);

    return value.toLowerCase() === 'none'
      ? args[0]
      : `${before}${property}${separator}currentColor`;
  });

export const createCurrentColorStylesPlugin = () => ({
  type: 'visitor',
  name: 'current-color-styles',
  fn() {
    let maskDepth = 0;

    return {
      element: {
        enter(node) {
          if (node.name === 'mask') maskDepth++;

          // Masks read luminance, not colour — `convertColors` leaves
          // everything inside one alone, and so does this. Stylesheet rules
          // can't be scoped that way, so they're rewritten regardless.
          if (maskDepth === 0 && node.attributes.style !== undefined) {
            node.attributes.style = convertCssColoursToCurrentColor(
              node.attributes.style,
            );
          }

          if (node.name === 'style') {
            for (const child of node.children) {
              if (child.type === 'text' || child.type === 'cdata') {
                child.value = convertCssColoursToCurrentColor(child.value);
              }
            }
          }
        },
        exit(node) {
          if (node.name === 'mask') maskDepth--;
        },
      },
    };
  },
});

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
//
// The CSS goes through css-tree — the parser SVGO's own `prefixIds` uses for
// the same job — not a regex: `;`, `!` and quotes can legally appear *inside*
// a value (`url(data:image/svg+xml;base64,…)`, `content: " fill:red"`), so
// only a real declaration walk can tell a colour apart from text that merely
// looks like one. Regenerating from the tree normalises whitespace and drops
// comments, which is what SVGO's own style passes do too.

import * as csstree from 'css-tree';

const colourProperties = new Set([
  'fill',
  'stroke',
  'stop-color',
  'flood-color',
  'lighting-color',
  'color',
]);

// Whether a raw value is the `none` keyword. Comments are token separators
// that may sit anywhere around it (`none /* kept on purpose */`), so they're
// discarded before comparing — against a space, not nothing, since removing a
// comment must not fuse the tokens around it into one.
const isNoneKeyword = (rawValue) =>
  rawValue
    .replaceAll(/\/\*.*?\*\//gs, ' ')
    .trim()
    .toLowerCase() === 'none';

// What a rewrite would touch: the one place that decides it, so the panel's
// "left as they are" notice can ask the same question this pass answers.
const isConvertible = (declaration) =>
  colourProperties.has(declaration.property.toLowerCase()) &&
  !isNoneKeyword(declaration.value.value);

const rewrite = (css, context) => {
  let ast;

  try {
    // The values stay raw text: whether one is a colour doesn't matter — only
    // `none` is exempt — so there's nothing to gain from parsing them.
    ast = csstree.parse(css, { context, parseValue: false });
  } catch {
    // Unparseable styles are left exactly as they were, like `prefixIds` does.
    return css;
  }

  csstree.walk(ast, {
    visit: 'Declaration',
    enter(declaration) {
      if (!isConvertible(declaration)) return;

      declaration.value = { type: 'Raw', value: 'currentColor' };
    },
  });

  return csstree.generate(ast);
};

export const convertStyleAttribute = (css) => rewrite(css, 'declarationList');

export const convertStylesheet = (css) => rewrite(css, 'stylesheet');

/**
 * Whether a stylesheet holds a colour this pass would have rewritten.
 *
 * Comparing the rewritten text against the original wouldn't answer it:
 * regenerating from the tree normalises whitespace and drops comments, so a
 * stylesheet of nothing but a comment would come back changed. The panel needs
 * the question this asks — was anything actually held back — rather than
 * whether the bytes differ.
 *
 * @param {string} css The stylesheet text.
 * @returns {boolean} True if at least one declaration would become `currentColor`.
 */
export function stylesheetHasConvertibleColours(css) {
  let ast;

  try {
    ast = csstree.parse(css, { context: 'stylesheet', parseValue: false });
  } catch {
    // Unparseable styles are left alone by `rewrite`, so nothing is held back.
    return false;
  }

  let isFound = false;

  csstree.walk(ast, {
    visit: 'Declaration',
    enter(declaration) {
      if (isConvertible(declaration)) isFound = true;
    },
  });

  return isFound;
}

/**
 * Whether a stylesheet holds at least one rule — which is not the same as
 * holding text. `<style>/* a comment *\/</style>` has a child node and no
 * rules, and SVGO removes it outright.
 *
 * @param {string} css The stylesheet text.
 * @returns {boolean} True if at least one style rule is present.
 */
export function stylesheetHasRules(css) {
  let ast;

  try {
    ast = csstree.parse(css, { context: 'stylesheet', parseValue: false });
  } catch {
    // Unparseable, so nothing downstream can prune it either.
    return false;
  }

  let isFound = false;

  csstree.walk(ast, {
    visit: 'Rule',
    enter() {
      isFound = true;
    },
  });

  return isFound;
}

const containsMask = (node) =>
  (node.type === 'element' && node.name === 'mask') ||
  (Array.isArray(node.children) &&
    node.children.some((child) => containsMask(child)));

export const createCurrentColorStylesPlugin = () => ({
  type: 'visitor',
  name: 'current-color-styles',
  fn(root) {
    let maskDepth = 0;

    // Masks read luminance, not colour: recolouring their content changes
    // what the mask hides. `convertColors` leaves everything inside one
    // alone, and so does this. But a rule in *any* stylesheet — a sibling of
    // the mask as much as a child — can select into it, and telling which
    // ones do needs full selector matching. So a document that contains a
    // mask keeps its stylesheets wholesale, and only attribute colours
    // outside the mask convert.
    const keepStylesheets = containsMask(root);

    return {
      element: {
        enter(node) {
          if (node.name === 'mask') maskDepth++;
          if (maskDepth > 0) return;

          if (node.attributes.style !== undefined) {
            node.attributes.style = convertStyleAttribute(
              node.attributes.style,
            );
          }

          if (node.name === 'style' && !keepStylesheets) {
            for (const child of node.children) {
              if (child.type === 'text' || child.type === 'cdata') {
                child.value = convertStylesheet(child.value);
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

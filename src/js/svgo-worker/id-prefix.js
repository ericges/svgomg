// Split out of `build-plugins.js` so the rule is unit-testable on its own and
// stated in exactly one place. Sibling of its only consumer, which changes no
// output filename — bundles are named after their directory.
//
// The prefix lands verbatim in `id` attributes and, through `prefixIds`'
// stylesheet rewriting, in CSS selectors. Neither place tolerates arbitrary
// text: an ID may not start with a digit, and `#a bshape` is a descendant
// combinator, not one selector. Accept only what is safe in both, and treat
// anything else as "no prefix" — the input field carries the equivalent
// `pattern` attribute, so invalid text is flagged in the panel rather than
// silently emitting a broken document.
export const idPrefixPattern = /^[a-z_][\w-]*$/i;

export const normalizeIdPrefix = (rawPrefix) => {
  const prefix = String(rawPrefix ?? '').trim();
  return idPrefixPattern.test(prefix) ? prefix : '';
};

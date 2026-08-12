import globals from 'globals';

/** @type {import('xo').FlatXoConfig} */
const xoConfig = [
  // A config object with only `ignores` ignores those files globally.
  // The Nunjucks templates aren't valid standalone HTML, so XO's HTML linting
  // can't parse them meaningfully, and the Markdown docs aren't linted.
  {
    ignores: ['**/*.html', '**/*.md'],
  },
  {
    space: true,
    prettier: true,
  },
  {
    // Scoped to JS: XO also lints other languages, where these don't apply.
    files: ['**/*.{js,jsx,mjs,cjs}'],
    rules: {
      // Wants clarifying parentheses that Prettier then strips again.
      '@stylistic/no-mixed-operators': 'off',
      'capitalized-comments': 'off',
      // Keep the conventional leading `*` on JSDoc lines.
      'jsdoc/require-asterisk-prefix': 'off',
      // XO 4 requires braces everywhere; XO 0.x allowed single-line bodies,
      // which this codebase uses throughout.
      curly: ['error', 'multi-line'],
      'no-multi-assign': 'off',
      'no-negated-condition': 'off',
      'no-shadow': 'error',
      // The TODO comments here are intentional long-lived notes.
      'no-warning-comments': 'off',
      // XO's own Prettier options take precedence over `.prettierrc`, so the
      // repo's style has to be restated here or XO reformats the codebase.
      'prettier/prettier': [
        'error',
        {
          bracketSpacing: true,
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: 'all',
          useTabs: false,
        },
      ],
      'prefer-template': 'error',
      // The regexes here are ASCII-only, so the `v` flag buys nothing.
      'require-unicode-regexp': 'off',
      'spaced-comment': 'off',
      'unicorn/explicit-length-check': 'off',
      // Consistent with `unicorn/prevent-abbreviations` being off below.
      'unicorn/name-replacements': 'off',
      // Settings are keyed by input `name` attributes, so the lookups into the
      // settings object are necessarily dynamic.
      'unicorn/no-computed-property-existence-check': 'off',
      // Workers communicate by assigning `self.onmessage` and configuring
      // globals (e.g. `self.Prism`) before the library that reads them loads.
      'unicorn/no-global-object-property-assignment': 'off',
      // `utils.js` sets up a module-level Range, and the worker entry points
      // are side effects by nature.
      'unicorn/no-top-level-side-effects': 'off',
      // The `_` prefix is load-bearing: terser is configured to mangle
      // properties matching /^_/, so these can't become `#private` fields.
      'unicorn/no-undeclared-class-members': 'off',
      'unicorn/prefer-add-event-listener': 'off',
      // `self` is the idiomatic global in workers and the service worker.
      'unicorn/prefer-global-this': 'off',
      'unicorn/prefer-module': 'off',
      // SVG dimensions are values like "100px", where `Number()` gives NaN and
      // `Number.parseFloat()` is required.
      'unicorn/prefer-number-coercion': 'off',
      'unicorn/prefer-private-class-fields': 'off',
      // Querying within an already-scoped container is intentional.
      'unicorn/prefer-scoped-selector': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-unused-properties': 'error',
      'unicorn/numeric-separators-style': 'off',
      'unicorn/require-post-message-target-origin': 'off',
    },
  },
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.worker,
        ...globals.serviceworker,
      },
    },
  },
  {
    // The suite runs under `node --test`, so it gets Node's globals rather than
    // the browser ones above — and stands in for browser APIs (`Worker`) that
    // Node doesn't have.
    files: ['test/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
];

export default xoConfig;

import { trackFocusMethod } from './utils.js';
import MainController from './main-controller.js';

// Apply the async-preloaded stylesheet. This lives here rather than in an
// `onload` attribute on the <link> so the CSP can forbid inline scripts
// outright — html-minifier rewrites inline handlers, so hashing one would
// drift between dev and production builds.
document
  .querySelector('link[rel="preload"][as="style"]')
  ?.setAttribute('rel', 'stylesheet');

trackFocusMethod();
new MainController(); // eslint-disable-line no-new

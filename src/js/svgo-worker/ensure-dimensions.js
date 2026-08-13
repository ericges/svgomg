// Split out of the worker entry point for the same reason as `dimensions.js`:
// `index.js` ends in a `self.onmessage` assignment and exports nothing, so it
// can't be imported outside a worker. Bundles are named after their directory,
// so a sibling module here changes no output filename.
//
// SVGO can drop width/height in favour of a viewBox (`removeDimensions`) and
// drop a viewBox that merely repeats width/height (`removeViewBox`), but it has
// no plugin for the other direction: deriving one from the other. That's what
// the "width & height only" and "both" size-attribute modes need.

import { parseLength, parseViewBox } from './dimensions.js';

export const createEnsureDimensionsPlugin = () => ({
  type: 'visitor',
  name: 'ensure-dimensions',
  fn() {
    return {
      element: {
        // Node, parentNode
        enter({ name, attributes }, { type }) {
          if (name !== 'svg' || type !== 'root') return;

          if (attributes.viewBox === undefined) {
            const width = parseLength(attributes.width);
            const height = parseLength(attributes.height);

            if (width !== undefined && height !== undefined) {
              attributes.viewBox = `0 0 ${width} ${height}`;
            }

            return;
          }

          // Only a usable viewBox says what the user units are, so an
          // unparseable one leaves width/height alone rather than guessing.
          const viewBox = parseViewBox(attributes.viewBox);
          if (!viewBox) return;

          // Fill in what's absent and nothing else: `width="100%"` is a
          // deliberate responsive choice, not something to overwrite with
          // pixels. Leaving present values alone also makes this idempotent,
          // which matters under multipass.
          if (attributes.width === undefined) {
            attributes.width = String(viewBox.width);
          }

          if (attributes.height === undefined) {
            attributes.height = String(viewBox.height);
          }
        },
      },
    };
  },
});

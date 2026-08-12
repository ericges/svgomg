// Split out of the worker entry point so it can be unit-tested: `index.js` ends
// in a `self.onmessage` assignment and exports nothing, so importing it outside
// a worker is impossible. The bundle is named after its *directory*, so a
// sibling module here doesn't change any output filename.

// `width`/`height` may carry units or be percentages, neither of which gives a
// usable pixel size for the preview. Accept only bare user units or an explicit
// `px`, so `100%` and `10em` are rejected rather than silently read as 100/10.
const lengthPattern =
  /^\s*(?<number>[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:px)?\s*$/i;

export const parseLength = (value) => {
  const match = lengthPattern.exec(String(value));
  if (!match) return undefined;

  const number = Number(match.groups.number);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

export const parseViewBox = (value) => {
  const parts = String(value)
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }

  const width = parts[2];
  const height = parts[3];
  return width > 0 && height > 0 ? { width, height } : undefined;
};

export const createDimensionsExtractor = () => {
  const dimensions = {};
  const plugin = {
    type: 'visitor',
    name: 'extract-dimensions',
    fn() {
      return {
        element: {
          // Node, parentNode
          enter({ name, attributes }, { type }) {
            if (name !== 'svg' || type !== 'root') return;

            const width = parseLength(attributes.width);
            const height = parseLength(attributes.height);

            // Fall back to the viewBox whenever width/height don't *both*
            // yield a usable length, not merely when they're absent.
            if (width !== undefined && height !== undefined) {
              dimensions.width = width;
              dimensions.height = height;
              return;
            }

            const viewBox =
              attributes.viewBox === undefined
                ? undefined
                : parseViewBox(attributes.viewBox);

            if (viewBox) {
              dimensions.width = viewBox.width;
              dimensions.height = viewBox.height;
            }
          },
        },
      };
    },
  };

  return [dimensions, plugin];
};

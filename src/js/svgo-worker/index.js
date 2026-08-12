import { optimize } from 'svgo/browser';

// `width`/`height` may carry units or be percentages, neither of which gives a
// usable pixel size for the preview. Accept only bare user units or an explicit
// `px`, so `100%` and `10em` are rejected rather than silently read as 100/10.
const lengthPattern =
  /^\s*(?<number>[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?:px)?\s*$/i;

const parseLength = (value) => {
  const match = lengthPattern.exec(String(value));
  if (!match) return undefined;

  const number = Number(match.groups.number);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

const parseViewBox = (value) => {
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

const createDimensionsExtractor = () => {
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

function compress(svgInput, settings) {
  // setup plugin list
  const floatPrecision = Number(settings.floatPrecision);
  const transformPrecision = Number(settings.transformPrecision);
  const plugins = [];

  for (const [name, enabled] of Object.entries(settings.plugins)) {
    if (!enabled) continue;

    const plugin = {
      name,
      params: {},
    };

    // TODO: revisit this
    // 0 almost always breaks images when used on `cleanupNumericValues`.
    // Better to allow 0 for everything else, but switch to 1 for this plugin.
    plugin.params.floatPrecision =
      plugin.name === 'cleanupNumericValues' && floatPrecision === 0
        ? 1
        : floatPrecision;

    plugin.params.transformPrecision = transformPrecision;

    plugins.push(plugin);
  }

  // multipass optimization
  const [dimensions, extractDimensionsPlugin] = createDimensionsExtractor();
  const { data, error } = optimize(svgInput, {
    multipass: settings.multipass,
    plugins: [...plugins, extractDimensionsPlugin],
    js2svg: {
      indent: 2,
      pretty: settings.pretty,
    },
  });

  if (error) throw new Error(error);

  return { data, dimensions };
}

const actions = {
  wrapOriginal({ data }) {
    const [dimensions, extractDimensionsPlugin] = createDimensionsExtractor();
    const { error } = optimize(data, {
      plugins: [extractDimensionsPlugin],
    });

    if (error) throw new Error(error);

    return dimensions;
  },
  process({ data, settings }) {
    return compress(data, settings);
  },
};

self.onmessage = (event) => {
  try {
    self.postMessage({
      id: event.data.id,
      result: actions[event.data.action](event.data),
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error.message,
    });
  }
};

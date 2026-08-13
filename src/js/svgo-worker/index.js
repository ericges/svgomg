import { optimize } from 'svgo/browser';
import { createDimensionsExtractor } from './dimensions.js';
import { createEnsureDimensionsPlugin } from './ensure-dimensions.js';

// The checkboxes map one-to-one onto plugins, but four of the controls don't:
// the two selects, the ID prefix and the currentColor toggle each configure
// plugins that have no checkbox of their own, and two of them have to land at a
// particular point in the array — SVGO runs plugins in the order given.
function buildPlugins(settings) {
  const floatPrecision = Number(settings.floatPrecision);
  const transformPrecision = Number(settings.transformPrecision);

  // Deriving the missing size attributes goes first, so the ones it adds get
  // the same treatment as the input's own — rounded by `cleanupNumericValues`,
  // sorted by `sortAttrs` — instead of being tacked on after the fact.
  const plugins =
    settings.dimensionAttrs === 'widthHeight' ||
    settings.dimensionAttrs === 'both'
      ? [createEnsureDimensionsPlugin()]
      : [];

  // The "IDs" select drives `cleanupIds`, which is why it's no longer one of
  // the checkboxes. Fall back to the app default for the seconds-long window
  // where an old page can post to a freshly activated worker.
  const ids = settings.ids ?? 'minify';
  const idsPlugin =
    ids === 'keep'
      ? undefined
      : {
          name: 'cleanupIds',
          params: {
            remove: true,
            minify: ids === 'minify',
            floatPrecision,
            transformPrecision,
          },
        };
  let hasPlacedIdsPlugin = false;

  for (const [name, enabled] of Object.entries(settings.plugins)) {
    // `cleanupIds` has no checkbox to mark its place any more, but the place
    // still matters: `removeUselessDefs` and `mergePaths` run later and want
    // unused IDs already gone. This is the entry that followed it in
    // `config.json`.
    if (idsPlugin && !hasPlacedIdsPlugin && name === 'removeRasterImages') {
      plugins.push(idsPlugin);
      hasPlacedIdsPlugin = true;
    }

    // `currentColor` is exposed separately, so `convertColors` also has to run
    // when "Minify colours" is off — with every minification param disabled,
    // leaving nothing but the colour swap.
    const isColourSwapOnly =
      name === 'convertColors' && !enabled && Boolean(settings.currentColor);

    if (!enabled && !isColourSwapOnly) continue;

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

    if (name === 'convertColors') {
      plugin.params.currentColor = Boolean(settings.currentColor);

      if (isColourSwapOnly) {
        Object.assign(plugin.params, {
          names2hex: false,
          rgb2hex: false,
          shorthex: false,
          shortname: false,
          convertCase: false,
        });
      }
    }

    plugins.push(plugin);
  }

  if (idsPlugin && !hasPlacedIdsPlugin) plugins.push(idsPlugin);

  // Dropping the pair that isn't wanted goes last, once everything above has
  // had its say. 'both' has nothing to drop, and 'original' — along with
  // anything an older page posts mid service-worker update — touches neither.
  switch (settings.dimensionAttrs) {
    case 'viewBox': {
      plugins.push({ name: 'removeDimensions' });
      break;
    }

    case 'widthHeight': {
      plugins.push({ name: 'removeViewBox' });
      break;
    }

    default:
  }

  // After `cleanupIds`, so the prefix lands on the final — possibly minified —
  // names. `delim` has to be cleared: it defaults to `__`, which would turn a
  // typed `svgomg_` into `svgomg___id`. Running this repeatedly is safe, as it
  // skips IDs already carrying the prefix, so multipass doesn't stack them.
  const idPrefix = settings.idPrefix?.trim();

  if (idPrefix) {
    plugins.push({
      name: 'prefixIds',
      params: { prefix: idPrefix, delim: '' },
    });
  }

  return plugins;
}

function compress(svgInput, settings) {
  const plugins = buildPlugins(settings);

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

// Split out of the worker entry point for the same reason as `dimensions.js`:
// `index.js` ends in a `self.onmessage` assignment and exports nothing, so it
// can't be imported outside a worker. Bundles are named after their directory,
// so a sibling module here changes no output filename — and this one is the
// piece worth testing end-to-end, since it's where the grouped controls turn
// into a plugin array.

import { createCurrentColorStylesPlugin } from './current-color-styles.js';
import { createEnsureDimensionsPlugin } from './ensure-dimensions.js';
import { normalizeIdPrefix } from './id-prefix.js';
import { pluginOrder } from './plugin-order.js';

// The "IDs" select drives `cleanupIds`, which is why it's no longer one of
// the checkboxes. Fall back to the app default for the seconds-long window
// where an old page can post to a freshly activated worker.
const createIdsPlugin = (settings, floatPrecision, transformPrecision) => {
  const ids = settings.ids ?? 'minify';

  if (ids === 'keep') return undefined;

  return {
    name: 'cleanupIds',
    params: {
      remove: true,
      minify: ids === 'minify',
      floatPrecision,
      transformPrecision,
    },
  };
};

// Dropping the size-attribute pair that isn't wanted. 'both' has nothing to
// drop, and 'original' — along with anything an older page posts mid
// service-worker update — touches neither.
const createDimensionsRemovalPlugin = (dimensionAttrs) => {
  switch (dimensionAttrs) {
    case 'viewBox': {
      return { name: 'removeDimensions' };
    }

    case 'widthHeight': {
      return { name: 'removeViewBox' };
    }

    default: {
      return undefined;
    }
  }
};

// The checkboxes map one-to-one onto plugins, but four of the controls don't:
// the two selects, the ID prefix and the currentColor toggle each configure
// plugins that have no checkbox of their own, and some of them have to land at
// a particular point in the array — SVGO runs plugins in the order given.
export function buildPlugins(settings) {
  const floatPrecision = Number(settings.floatPrecision);
  const transformPrecision = Number(settings.transformPrecision);

  // Deriving the missing size attributes goes first, so the ones it adds get
  // the same treatment as the input's own — rounded by `cleanupNumericValues`,
  // sorted by `sortAttrs` — instead of being tacked on after the fact. The
  // 'viewBox' mode needs it too: `removeDimensions` can only derive a viewBox
  // from bare numbers, so without it `width="100px"` would survive that mode
  // whenever numeric cleanup is switched off.
  const plugins = ['viewBox', 'widthHeight', 'both'].includes(
    settings.dimensionAttrs,
  )
    ? [createEnsureDimensionsPlugin()]
    : [];

  const idsPlugin = createIdsPlugin(
    settings,
    floatPrecision,
    transformPrecision,
  );
  let hasPlacedIdsPlugin = false;

  // The canonical order, not the map's own: what the page sends carries no
  // ordering contract any more, and a key `pluginOrder` doesn't list — say, a
  // retired plugin from a stale pre-migration page in the service-worker skew
  // window — is dropped rather than run as a generic plugin.
  for (const name of pluginOrder) {
    const isEnabled = Boolean(settings.plugins[name]);

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
      name === 'convertColors' && !isEnabled && Boolean(settings.currentColor);

    if (!isEnabled && !isColourSwapOnly) continue;

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

    // `convertColors` never looks past presentation attributes, so its
    // companion picks up the same swap in `style` attributes and leftover
    // `<style>` rules. Right behind it: after `inlineStyles` and
    // `minifyStyles` have had their turn, at the slot the colour work
    // already owns.
    if (name === 'convertColors' && settings.currentColor) {
      plugins.push(createCurrentColorStylesPlugin());
    }
  }

  // Unreachable while `removeRasterImages` is in `pluginOrder`; kept so a
  // future reorder can't silently drop `cleanupIds` from the pipeline.
  if (idsPlugin && !hasPlacedIdsPlugin) plugins.push(idsPlugin);

  // The removal goes last, once everything above has had its say.
  const removalPlugin = createDimensionsRemovalPlugin(settings.dimensionAttrs);

  if (removalPlugin) plugins.push(removalPlugin);

  // After `cleanupIds`, so the prefix lands on the final — possibly minified —
  // names. `delim` has to be cleared: it defaults to `__`, which would turn a
  // typed `omsvg_` into `omsvg___id`. Running this repeatedly is safe, as it
  // skips IDs already carrying the prefix, so multipass doesn't stack them.
  const idPrefix = normalizeIdPrefix(settings.idPrefix);

  if (idPrefix) {
    plugins.push({
      name: 'prefixIds',
      params: { prefix: idPrefix, delim: '' },
    });
  }

  return plugins;
}

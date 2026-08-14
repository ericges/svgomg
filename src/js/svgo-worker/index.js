import { optimize } from 'svgo/browser';
import { buildPlugins } from './build-plugins.js';
import { createDimensionsExtractor } from './dimensions.js';
import { createFeaturesExtractor } from './document-features.js';

function compress(svgInput, settings) {
  const plugins = buildPlugins(settings);

  // multipass optimization
  const [dimensions, extractDimensionsPlugin] = createDimensionsExtractor();
  // Last in the array, so this describes the finished document: whether a
  // stylesheet survived the whole pipeline is what decides if the plugins that
  // back off for one were hobbled — and it's the only way to tell "Inline into
  // elements" that cleared the `<style>` from one that couldn't.
  const [features, extractFeaturesPlugin] = createFeaturesExtractor();
  const { data, error } = optimize(svgInput, {
    multipass: settings.multipass,
    plugins: [...plugins, extractDimensionsPlugin, extractFeaturesPlugin],
    js2svg: {
      indent: 2,
      pretty: settings.pretty,
    },
  });

  if (error) throw new Error(error);

  return { data, dimensions, features };
}

const actions = {
  wrapOriginal({ data }) {
    const [dimensions, extractDimensionsPlugin] = createDimensionsExtractor();
    // Riding along with the dimensions rather than costing a pass of its own:
    // the panel's collision notices need to know what the input contains, and
    // this is the one pass every input already makes.
    const [features, extractFeaturesPlugin] = createFeaturesExtractor();
    const { error } = optimize(data, {
      plugins: [extractDimensionsPlugin, extractFeaturesPlugin],
    });

    if (error) throw new Error(error);

    return { ...dimensions, features };
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

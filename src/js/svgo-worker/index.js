import { optimize } from 'svgo/browser';
import { buildPlugins } from './build-plugins.js';
import { createDimensionsExtractor } from './dimensions.js';

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

import { optimize } from 'svgo/browser';
import { buildPlugins } from './build-plugins.js';
import { createDimensionsExtractor } from './dimensions.js';
import { withCollisionProbes } from './collision-probes.js';

function compress(svgInput, settings) {
  // Each subject gets a probe immediately ahead of it, so the panel's collision
  // notices are backed by the document that plugin actually saw — see
  // `collision-probes.js` for why neither the input nor the result will do.
  const [collisions, plugins] = withCollisionProbes(buildPlugins(settings));

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

  return { data, dimensions, collisions };
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

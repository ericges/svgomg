// This needs to be an import so it executes before Prism
/* eslint-disable-next-line import-x/no-unassigned-import -- Imported purely
   for the side effect of configuring Prism. */
import './prism-config.js';
// eslint-disable-next-line import-x/order -- Must load after prism-config.js.
import { highlight, languages } from 'prismjs';

self.onmessage = (event) => {
  try {
    self.postMessage({
      id: event.data.id,
      result: highlight(event.data.data, languages.markup),
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error: error.message,
    });
  }
};

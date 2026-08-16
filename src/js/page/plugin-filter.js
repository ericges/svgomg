// Which plugin rows a filter query keeps. DOM-free and unit-tested, like the
// settings model beside it: the panel's part is one loop that sets `hidden`.
//
// Filtering is strictly a view concern. A row this function rejects is still
// enabled, still in `getSettings()` and still in the cache fingerprint — the
// query never reaches the model, and is deliberately never persisted.

/**
 * Does a plugin match a filter query?
 *
 * Matched against the SVGO id as well as the display name, because the panel
 * shows both and either is a reasonable thing to type. Case-insensitive, and
 * an empty query matches everything rather than nothing — the field starts
 * empty, and that state is "no filter", not "no results".
 *
 * @param {string} query What the user typed.
 * @param {{id: string, name: string}} plugin The plugin to test.
 * @returns {boolean} Whether the row stays visible.
 */
export function pluginMatches(query, plugin) {
  const needle = query.trim().toLowerCase();

  if (!needle) return true;

  return (
    plugin.id.toLowerCase().includes(needle) ||
    plugin.name.toLowerCase().includes(needle)
  );
}

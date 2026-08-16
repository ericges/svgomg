import test from 'node:test';
import SettingsModel, {
  defaultSettings,
} from '../src/js/page/settings-model.js';
import { config, panelOrder } from './panel-order.js';

// The four groups the Optimise tab renders, in the order it renders them.
const categoryIds = ['paths', 'structure', 'cleanup', 'compatibility'];

// How many plugins each group is meant to hold. Spelled out rather than
// counted off `config.json`, so moving a plugin between groups has to be a
// deliberate edit here too — and so the four still add up to the feature list.
const categorySizes = {
  paths: 7,
  structure: 15,
  cleanup: 8,
  compatibility: 4,
};

const isFlagged = (plugin) => Boolean(plugin.metadata || plugin.styles);

test('the categories are the ones the panel renders, in order', (t) => {
  t.assert.deepStrictEqual(
    config.categories.map((category) => category.id),
    categoryIds,
  );

  // `paths` and `structure` open, the rest closed: the two a visitor is most
  // likely to want, without the whole list unrolled at once.
  t.assert.deepStrictEqual(
    config.categories.map((category) => category.open),
    [true, true, false, false],
  );

  t.assert.deepStrictEqual(
    config.categories.filter((category) => !category.name),
    [],
    'categories with no display name',
  );
});

test('every plugin is either flagged or categorised, never both', (t) => {
  // The flagged plugins render inside their stage block and nowhere else; the
  // rest render inside a category. A plugin in both would get two checkboxes
  // sharing one `name`, which doubles its contribution to the fingerprint and
  // sends its collision notice to whichever came first.
  t.assert.deepStrictEqual(
    config.plugins
      .filter((plugin) => isFlagged(plugin) === Boolean(plugin.category))
      .map((plugin) => plugin.id),
    [],
    'plugins that carry a metadata/styles flag and a category, or neither',
  );

  t.assert.deepStrictEqual(
    config.plugins
      .filter((plugin) => plugin.metadata && plugin.styles)
      .map((plugin) => plugin.id),
    [],
    'plugins claimed by both stage blocks',
  );
});

test('every category names one the panel offers, and holds its share', (t) => {
  t.assert.deepStrictEqual(
    config.plugins
      .filter((plugin) => plugin.category)
      .filter((plugin) => !categoryIds.includes(plugin.category))
      .map((plugin) => [plugin.id, plugin.category]),
    [],
    'plugins filed under a category the panel does not render',
  );

  t.assert.deepStrictEqual(
    Object.fromEntries(
      categoryIds.map((id) => [
        id,
        config.plugins.filter((plugin) => plugin.category === id).length,
      ]),
    ),
    categorySizes,
  );

  // The categories are exactly the list the flat "Features" block used to be.
  t.assert.strictEqual(
    config.plugins.filter((plugin) => plugin.category).length,
    config.plugins.filter((plugin) => !isFlagged(plugin)).length,
  );
});

test('categorising the plugins left the pipeline order alone', (t) => {
  // `config.json`'s array order is the pipeline order, and the template groups
  // by filtering it rather than sorting it. Grouping the panel must therefore
  // change nothing here — `test/build-plugins.test.js` pins the array itself.
  t.assert.deepStrictEqual(
    panelOrder,
    config.plugins.map((plugin) => plugin.id),
  );
  t.assert.strictEqual(panelOrder.length, 44);
});

test('the category key changed no default and no fingerprint', (t) => {
  const defaults = defaultSettings();

  // Written out rather than derived from `config.json`: a literal is the only
  // version of this that a bad edit to that file cannot move with it.
  t.assert.strictEqual(
    new SettingsModel().fingerprint,
    '0,|3|,|5|,|original|,|minify|,||,0,0,' +
      '1,1,1,0,0,1,1,1,0,0,1,1,0,1,0,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,' +
      '1,1,0,1,1,0,0,0,1,0',
  );

  // The settings object is the plugin map plus the named controls, and nothing
  // else — `category` is markup's business and must not have leaked in.
  t.assert.strictEqual(Object.values(defaults).includes('paths'), false);
  t.assert.strictEqual(Object.hasOwn(defaults, 'category'), false);
  t.assert.strictEqual(
    Object.keys(defaults.plugins).length,
    config.plugins.length,
  );
});

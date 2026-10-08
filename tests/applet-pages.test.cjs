const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSettings, createDefaultSettings } = require('../out/main/shared/settings-schema');
const {
  parseAppletPages,
  ribbonItems,
  orderRibbon,
  pageDisplay,
} = require('../out/main/shared/applet-pages');
const manifest = {
  id: 'test.pages',
  capabilities: ['pages'],
  commands: [{ id: 'test.pages.open', activateOnExecute: true }],
  pages: [
    {
      id: 'main',
      title: 'Fixture',
      source: 'local',
      ui: 'web/index.html',
      openCommand: 'test.pages.open',
    },
  ],
};
test('Page declarations require owned activatable commands, capability, bounded IDs and content', () => {
  assert.equal(parseAppletPages(manifest)[0].id, 'main');
  for (const patch of [
    { capabilities: [] },
    { commands: [] },
    { pages: [manifest.pages[0], manifest.pages[0]] },
    { pages: [{ ...manifest.pages[0], id: '__proto__' }] },
    { pages: [{ ...manifest.pages[0], source: 'web-accounts' }] },
    { pages: [{ ...manifest.pages[0], defaultDisplay: 'invalid' }] },
  ])
    assert.throws(() => parseAppletPages({ ...manifest, ...patch }));
});
test('Legacy preferences gain ribbon defaults and retain explicit presentation across parse/save', () => {
  const settings = createDefaultSettings();
  delete settings.ribbon;
  assert.deepEqual(parseSettings(settings).ribbon, {
    order: [],
    hidden: [],
    bottom: ['theme', 'profile'],
    separators: [],
  });
  settings.ribbon = { order: ['page:test.pages:main', 'home'], hidden: ['settings'] };
  settings.extensions['test.pages'] = {
    enabled: true,
    settings: { unrelated: 3 },
    pages: { main: { display: 'window' } },
  };
  const next = parseSettings(settings);
  assert.deepEqual(next.ribbon.bottom, []);
  assert.deepEqual(next.ribbon.separators, []);
  assert.equal(pageDisplay(next, 'test.pages', manifest.pages[0]), 'window');
  assert.equal(next.extensions['test.pages'].settings.unrelated, 3);
  for (const ribbon of [
    { order: ['home', 'home'], hidden: [] },
    { order: [], hidden: ['arbitrary'] },
    { order: [], hidden: false },
  ])
    assert.throws(() => parseSettings({ ...settings, ribbon }));
  assert.throws(() =>
    parseSettings({
      ...settings,
      extensions: {
        'test.pages': { enabled: true, settings: {}, pages: { main: { display: 'invalid' } } },
      },
    }),
  );
});
test('Ribbon separators and lower placement validate and survive save', () => {
  const settings = createDefaultSettings();
  const id = 'separator:fixture-one';
  settings.ribbon = {
    order: ['home', id, 'settings'],
    hidden: [id],
    bottom: ['profile', id],
    separators: [id],
  };
  assert.deepEqual(parseSettings(settings).ribbon, settings.ribbon);
  const ordered = orderRibbon(ribbonItems([manifest], [id]), settings.ribbon.order);
  assert.equal(ordered[1].kind, 'separator');
  assert.equal(ordered[1].id, id);
  for (const patch of [
    { separators: [id, id] },
    { separators: ['home'] },
    { separators: [] },
    { bottom: ['profile', 'profile'] },
    { bottom: null },
    { separators: null },
    { separators: Array.from({ length: 51 }, (_, index) => `separator:s${index}`) },
  ])
    assert.throws(() => parseSettings({ ...settings, ribbon: { ...settings.ribbon, ...patch } }));
});
test('Ribbon inserts new Applets without dropping, duplicating or mutating saved preferences', () => {
  const source = ribbonItems([manifest]);
  const ordered = orderRibbon(source, ['page:test.pages:main', 'missing', 'settings']);
  assert.equal(ordered[0].id, 'page:test.pages:main');
  assert.equal(ordered[1].id, 'settings');
  assert.equal(ordered.length, 7);
  assert.equal(new Set(ordered.map((item) => item.id)).size, 7);
  assert.equal(source[0].id, 'home');
});

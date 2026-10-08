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
  assert.deepEqual(parseSettings(settings).ribbon, { order: [], hidden: [] });
  settings.ribbon = { order: ['page:test.pages:main', 'home'], hidden: ['settings'] };
  settings.extensions['test.pages'] = {
    enabled: true,
    settings: { unrelated: 3 },
    pages: { main: { display: 'window' } },
  };
  const next = parseSettings(settings);
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
test('Ribbon inserts new Applets without dropping, duplicating or mutating saved preferences', () => {
  const source = ribbonItems([manifest]);
  const ordered = orderRibbon(source, ['page:test.pages:main', 'missing', 'settings']);
  assert.equal(ordered[0].id, 'page:test.pages:main');
  assert.equal(ordered[1].id, 'settings');
  assert.equal(ordered.length, 7);
  assert.equal(new Set(ordered.map((item) => item.id)).size, 7);
  assert.equal(source[0].id, 'home');
});

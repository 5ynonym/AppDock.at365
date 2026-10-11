const { test } = require('node:test');
const assert = require('node:assert/strict');
const { UiPresentation, NavigationCoordinator } = require('../out/main/main/core/ui-presentation');
const { createDefaultSettings } = require('../out/main/shared/settings-schema');
function fixture() {
  const settings = createDefaultSettings();
  settings.profile.name = 'Fixture';
  let changes = 0,
    executions = [],
    toggles = 0;
  const nav = new NavigationCoordinator(() => changes++);
  const applets = [
    {
      id: 'test.page',
      enabled: true,
      state: 'running',
      commands: [{ id: 'test.page.open', available: true }],
      pages: [{ id: 'main', title: 'Page', openCommand: 'test.page.open', source: 'local' }],
    },
  ];
  const ui = new UiPresentation({
    settings: () => settings,
    applets: () => applets,
    dark: () => true,
    avatar: () => 'data:image/png;base64,AA==',
    navigation: nav,
    execute: async (c) => executions.push(c),
    theme: async () => toggles++,
  });
  return {
    ui,
    nav,
    settings,
    applets,
    get changes() {
      return changes;
    },
    executions,
    get toggles() {
      return toggles;
    },
  };
}
test('full presentation preserves order, placement, selected route and opaque assets without local paths', () => {
  const f = fixture();
  f.settings.ribbon.order = ['page:test.page:main', 'home'];
  f.settings.ribbon.bottom.push('home');
  f.nav.navigate('page:test.page:main');
  const a = f.ui.get();
  const b = f.ui.get();
  assert.deepEqual(a, b);
  assert.equal(a.items[0].selected, true);
  assert.equal(a.items.find((i) => i.id === 'home').placement, 'bottom');
  assert.ok(!JSON.stringify(a).includes('openCommand'));
  const asset = a.items.find((i) => i.id === 'profile').icon.assetId;
  assert.match(asset, /^[a-f0-9]{64}$/);
  assert.equal(f.ui.getAsset(asset).dataUrl, 'data:image/png;base64,AA==');
  assert.throws(() => f.ui.getAsset('../settings.json'));
  f.nav.navigate('logs');
  assert.ok(f.ui.get().revision > a.revision);
  assert.equal(f.settings.schemaVersion, 1);
});
test('two readers share host revision; denied projections cannot change commands or navigation', () => {
  const f = fixture(),
    a = f.ui.get(),
    b = f.ui.get((action) => !action.command);
  assert.equal(a.revision, b.revision);
  assert.equal(a.epoch, b.epoch);
  assert.equal(b.items.find((i) => i.id === 'page:test.page:main').enabled, false);
  assert.equal(f.changes, 0);
  assert.deepEqual(f.executions, []);
});
test('actions deduplicate per session, reject stale epochs and hidden actions, dispose clears cache', async () => {
  const f = fixture(),
    a = f.ui.get();
  const request = { epoch: a.epoch, requestId: 'same', actionId: 'ribbon.theme' };
  await Promise.all([f.ui.invoke(request, 'one'), f.ui.invoke(request, 'one')]);
  assert.equal(f.toggles, 1);
  await f.ui.invoke(request, 'two');
  assert.equal(f.toggles, 2);
  assert.throws(() => f.ui.invoke({ ...request, actionId: 'ribbon.home' }, 'one'));
  assert.throws(() => f.ui.invoke({ ...request, epoch: 'old' }, 'one'));
  f.settings.ribbon.hidden.push('theme');
  assert.throws(() => f.ui.invoke(request, 'one'));
  f.settings.ribbon.hidden = [];
  f.ui.disconnect('one');
  await f.ui.invoke(request, 'one');
  assert.equal(f.toggles, 3);
  await f.ui.invoke(
    { ...request, requestId: 'open', actionId: 'ribbon.page:test.page:main' },
    'one',
  );
  assert.deepEqual(f.executions, ['test.page.open']);
});
test('navigation changes never execute a page command and repeated focus sections remain observable', () => {
  const f = fixture();
  f.nav.navigate('page:test.page:main');
  f.nav.navigate('page:test.page:main');
  assert.equal(f.changes, 1);
  f.nav.navigate('settings', 'ribbon');
  f.nav.navigate('settings', 'ribbon');
  assert.equal(f.changes, 3);
  assert.deepEqual(f.executions, []);
  assert.throws(() => f.nav.navigate('private:route'));
});

test('navigation waits for pending input and only applies the latest request', async () => {
  const releases = [],
    errors = [];
  let changes = 0;
  const nav = new NavigationCoordinator(
    () => changes++,
    () => new Promise((resolve, reject) => releases.push({ resolve, reject })),
    (e) => errors.push(e),
  );
  const first = nav.navigate('settings'),
    second = nav.navigate('logs');
  assert.equal(nav.state.route, 'home');
  releases[1].resolve();
  await second;
  releases[0].resolve();
  await first;
  assert.equal(nav.state.route, 'logs');
  assert.equal(changes, 1);
  const failure = nav.navigate('home');
  releases[2].reject(Error('pending input'));
  await failure;
  assert.equal(nav.state.route, 'logs');
  assert.equal(errors.length, 1);
});

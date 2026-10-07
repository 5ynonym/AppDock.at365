const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const {
  defaultWidgetPlacement,
  parseWidgetDefinitions,
  parseWidgetPlacement,
  widgetBounds,
  widgetCatalog,
  selectWidgetDisplay,
} = require('../out/main/shared/widgets.js');
const { parseSettings, createDefaultSettings } = require('../out/main/shared/settings-schema.js');
const { SettingsStore } = require('../out/main/main/core/settings.js');
const { ExtensionManager } = require('../out/main/main/core/extensions.js');
const load = Module._load;
Module._load = function (name, ...args) {
  return name === 'electron' ? {} : load.call(this, name, ...args);
};
const { createHostApi } = require('../out/main/main/core/host-api.js');
Module._load = load;
const clock = { id: 'test.clock', title: 'Clock', content: { kind: 'clock' } };
test('legacy settings gain an empty widget layout; bad geometry and stale edits cannot overwrite a profile', (t) => {
  const legacy = createDefaultSettings();
  delete legacy.widgets;
  assert.deepEqual(parseSettings(legacy).widgets, {});
  for (const patch of [
    { width: 0 },
    { x: Infinity },
    { home: 'yes' },
    { opacity: 2 },
    { layer: 'bottom' },
    { anchor: 'bogus' },
    { color: 'url(secret)' },
  ])
    assert.throws(() => parseWidgetPlacement(patch));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-layout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = new SettingsStore(path.join(root, 'settings.json'));
  store.load();
  const revision = store.revision;
  store.save(
    { ...store.value, widgets: { 'test.clock': { ...defaultWidgetPlacement(), home: true } } },
    revision,
  );
  assert.throws(() => store.save({ ...store.value, widgets: {} }, revision));
  assert.equal(store.value.widgets['test.clock'].home, true);
});
test('definitions reject foreign IDs, duplicates, unbounded data, unsafe fonts and invalid time zones', () => {
  assert.equal(parseWidgetDefinitions('test', [clock])[0].id, clock.id);
  assert.equal(
    parseWidgetDefinitions('test', [
      { ...clock, content: { kind: 'clock', locale: 'en-GB', timeZone: null, facts: null } },
    ])[0].content.timeZone,
    undefined,
  );
  for (const items of [
    [{ ...clock, id: 'other.clock' }],
    [clock, clock],
    [{ ...clock, fontFile: '../secret.ttf' }],
    [{ ...clock, fontFile: 'C:/secret.ttf' }],
    [{ ...clock, content: { kind: 'html', body: '<script>' } }],
    [{ ...clock, content: { kind: 'clock', timeZone: 'missing-zone' } }],
    Array.from({ length: 17 }, (_, i) => ({ ...clock, id: `test.${i}` })),
  ])
    assert.throws(() => parseWidgetDefinitions('test', items));
});
test('nine anchors and free placement remain on negative-origin monitors; unplugged IDs are retained', () => {
  const d = { x: -1600, y: -200, width: 1600, height: 900 };
  const p = { ...defaultWidgetPlacement(), width: 400, height: 200, x: 20, y: 30 };
  assert.deepEqual(widgetBounds({ ...p, anchor: 'top-left' }, d), {
    x: -1580,
    y: -170,
    width: 400,
    height: 200,
  });
  assert.deepEqual(widgetBounds({ ...p, anchor: 'bottom-right' }, d), {
    x: -420,
    y: 470,
    width: 400,
    height: 200,
  });
  assert.deepEqual(widgetBounds({ ...p, anchor: 'center', x: 0, y: 0 }, d), {
    x: -1000,
    y: 150,
    width: 400,
    height: 200,
  });
  assert.deepEqual(widgetBounds({ ...p, position: 'free', x: 1500, y: -100 }, d), {
    x: -400,
    y: -200,
    width: 400,
    height: 200,
  });
  assert.deepEqual(widgetBounds({ ...p, width: 3000, height: 2000 }, d), { ...d });
  const displays = [
    { id: 'left', primary: false, bounds: d },
    { id: 'main', primary: true, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
  ];
  assert.equal(selectWidgetDisplay(displays, 'unplugged').id, 'main');
  assert.equal(p.monitor, 'primary');
});
test('host enforces declaration/capability/ownership and applies defaults once without changing pins on replacement', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-api-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'font.ttf'), 'font');
  const store = new SettingsStore(path.join(root, 'settings.json'));
  store.load();
  const e = {
    manifest: { id: 'test', folder: root, capabilities: ['widgets'], widgets: [clock] },
    state: 'starting',
  };
  const api = createHostApi(
    store,
    root,
    () => {},
    () => {},
  );
  const definition = {
    ...clock,
    fontFile: 'font.ttf',
    initialPlacement: { desktop: true, anchor: 'bottom-left' },
  };
  await api(e, 'host.widgets.replace', { widgets: [definition] });
  assert.equal(store.value.widgets['test.clock'].desktop, true);
  assert.match(e.widgets[0].fontUrl, /^appdock:\/\/host\/widget-fonts\/test.clock$/);
  store.save(
    {
      ...store.value,
      widgets: {
        'test.clock': { ...store.value.widgets['test.clock'], desktop: false, home: true, x: 333 },
      },
    },
    store.revision,
  );
  await api(e, 'host.widgets.replace', { widgets: [definition] });
  assert.equal(store.value.widgets['test.clock'].desktop, false);
  assert.equal(store.value.widgets['test.clock'].home, true);
  assert.equal(store.value.widgets['test.clock'].x, 333);
  const before = JSON.stringify(store.value);
  await assert.rejects(api(e, 'host.widgets.desktop', { ids: ['other.clock'], enabled: true }));
  await assert.rejects(
    api(e, 'host.widgets.replace', { widgets: [{ ...clock, id: 'test.undeclared' }] }),
  );
  await assert.rejects(
    api(e, 'host.widgets.replace', { widgets: [{ ...clock, fontFile: 'missing.ttf' }] }),
  );
  assert.equal(JSON.stringify(store.value), before);
  e.manifest.capabilities = [];
  await assert.rejects(api(e, 'host.widgets.placements', {}));
  e.manifest.capabilities = ['widgets'];
  e.state = 'running';
  await api(e, 'host.widgets.desktop', { ids: ['test.clock'], enabled: true });
  assert.equal(store.value.widgets['test.clock'].home, true);
  assert.equal((await api(e, 'host.widgets.placements', {}))['test.clock'].desktop, true);
  e.state = 'stopped';
  await assert.rejects(api(e, 'host.widgets.replace', { widgets: [definition] }));
  e.state = 'running';
  e.manifest.capabilities = ['ui'];
  await assert.doesNotReject(
    api(e, 'host.ui.panel', {
      title: 'SDK defaults',
      description: null,
      facts: null,
      actions: null,
      images: null,
      tabs: null,
    }),
  );
});
test('stopped applets remain catalogued; independent home and desktop layouts and order survive reload', () => {
  const settings = createDefaultSettings();
  settings.widgets = {
    'test.clock': { ...defaultWidgetPlacement(), home: true, order: 3 },
    'test.date': { ...defaultWidgetPlacement(), desktop: true, order: 1 },
  };
  const catalog = widgetCatalog(
    [
      {
        id: 'test',
        displayName: 'Test',
        state: 'stopped',
        widgets: [clock, { id: 'test.date', title: 'Date', content: { kind: 'date' } }],
      },
    ],
    parseSettings(settings),
  );
  assert.deepEqual(
    catalog.map((w) => w.id),
    ['test.date', 'test.clock'],
  );
  assert.equal(catalog[0].available, false);
  assert.equal(catalog[0].placement.home, false);
  assert.equal(catalog[1].placement.desktop, false);
});
test('real Node widgets update content without overwriting placements and clear live content on crash', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-node-'));
  const folder = path.join(root, 'extensions', 'test');
  fs.mkdirSync(folder, { recursive: true });
  const definition = {
    id: 'test.status',
    title: 'Status',
    content: { kind: 'text', body: 'Waiting' },
  };
  fs.writeFileSync(
    path.join(folder, 'extension.json'),
    JSON.stringify({
      apiVersion: 1,
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      runtime: 'node',
      entry: 'index.cjs',
      capabilities: ['widgets'],
      widgets: [definition],
    }),
  );
  fs.writeFileSync(
    path.join(folder, 'index.cjs'),
    `exports.activate = async context => {
    const publish = () => context.widgets.replace([{ id: 'test.status', title: 'Status', content: { kind: 'text', body: context.settings.get('body', 'first'), facts: [{ label: 'Count', value: '12' }] } }]);
    context.settings.onChanged(publish); await publish();
  };`,
  );
  const store = new SettingsStore(path.join(root, 'settings.json'));
  store.load();
  store.updateExtension('test', { enabled: true, settings: { body: 'first' } });
  const manager = new ExtensionManager({
    roots: [path.join(root, 'extensions')],
    settings: store,
    nodeExecutable: process.execPath,
    nodeWorker: path.resolve(__dirname, '../out/main/main/node-worker.js'),
    dotnetHost: '',
    api: createHostApi(
      store,
      root,
      () => {},
      () => {},
    ),
    log: () => {},
  });
  t.after(async () => {
    await manager.shutdown();
    fs.rmSync(root, { recursive: true, force: true });
  });
  manager.discover();
  await manager.reconcile();
  assert.equal(manager.snapshot()[0].widgets[0].content.body, 'first');
  store.save(
    {
      ...store.value,
      widgets: { 'test.status': { ...defaultWidgetPlacement(), home: true, x: 999 } },
    },
    store.revision,
  );
  store.updateExtension('test', { settings: { body: 'second' } });
  await manager.reconcile();
  assert.equal(manager.snapshot()[0].widgets[0].content.body, 'second');
  assert.equal(store.value.widgets['test.status'].x, 999);
  const item = manager.items.get('test');
  item.child.kill();
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Crash not observed')), 5000);
    const changed = () => {
      if (item.state === 'error') {
        clearTimeout(timeout);
        manager.removeListener('changed', changed);
        resolve();
      }
    };
    manager.on('changed', changed);
    changed();
  });
  assert.equal(item.widgets, undefined);
  assert.equal(manager.snapshot()[0].widgets[0].content.body, 'Waiting');
  assert.equal(store.value.widgets['test.status'].home, true);
});

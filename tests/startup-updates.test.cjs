const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ExtensionManager } = require('../out/main/main/core/extensions.js');
const { createDefaultSettings, parseSettings } = require('../out/main/shared/settings-schema.js');
const { compareVersions } = require('../out/main/shared/versions.js');
const { checkUpdate, releasesUrl } = require('../out/main/main/core/updates.js');
const {
  parseSettingDefinitions,
  validateSettingValue,
} = require('../out/main/shared/setting-definitions.js');

function fixture(t, delay = 30) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const value = createDefaultSettings();
  value.extensions.test = { enabled: true, settings: {} };
  value.extensions.fast = { enabled: true, settings: {} };
  const manager = new ExtensionManager({
    roots: [],
    settings: { value },
    log: () => {},
    api: async () => null,
  });
  for (const [id, seconds] of [
    ['test', delay],
    ['fast', 0],
  ])
    manager.items.set(id, {
      manifest: { id, name: id, startupDelaySeconds: seconds },
      state: 'stopped',
      commands: [],
      tray: [],
      panel: null,
      settingOptions: {},
      error: null,
    });
  const starts = [];
  manager.start = async (e) => {
    starts.push(e.manifest.id);
    e.state = 'running';
  };
  return { manager, value, starts, slow: manager.items.get('test') };
}
test('delayed Applet holds no process and does not delay other Applets; starts once', async (t) => {
  const { manager, slow, starts } = fixture(t);
  await manager.reconcile();
  assert.equal(slow.state, 'waiting');
  assert.equal(slow.child, undefined);
  assert.deepEqual(starts, ['fast']);
  t.mock.timers.tick(29999);
  await manager.queue;
  assert.deepEqual(starts, ['fast']);
  t.mock.timers.tick(1);
  await manager.queue;
  assert.deepEqual(starts, ['fast', 'test']);
  await manager.reconcile();
  assert.deepEqual(starts, ['fast', 'test']);
  await manager.shutdown();
});
test('disable, reschedule, restart, immediate start and shutdown cancel pending timers', async (t) => {
  const { manager, value, slow, starts } = fixture(t);
  await manager.reconcile();
  value.extensions.test.enabled = false;
  await manager.reconcile();
  t.mock.timers.tick(30000);
  await manager.queue;
  assert.deepEqual(starts, ['fast']);
  value.extensions.test.enabled = true;
  await manager.reconcile();
  t.mock.timers.tick(10000);
  const due = slow.scheduledStartAt;
  value.extensions.test.settings.message = 'other settings';
  await manager.reconcile();
  assert.equal(slow.scheduledStartAt, due);
  value.extensions.test.startupDelaySeconds = 60;
  await manager.reconcile();
  t.mock.timers.tick(30000);
  await manager.queue;
  assert.equal(slow.state, 'waiting');
  await manager.restart('test');
  t.mock.timers.tick(59999);
  await manager.queue;
  assert.equal(slow.state, 'waiting');
  await manager.restart('test', true);
  assert.equal(slow.state, 'running');
  t.mock.timers.tick(60001);
  await manager.queue;
  assert.deepEqual(starts, ['fast', 'test']);
  await manager.restart('test');
  assert.equal(slow.state, 'waiting');
  await manager.shutdown();
  t.mock.timers.tick(90000);
  await manager.queue;
  assert.deepEqual(starts, ['fast', 'test']);
  assert.equal(slow.state, 'stopped');
});
test('delay schema is backwards compatible and JSON editors reject malformed data', () => {
  for (const delay of [-1, 1.5, '30', null, NaN, Infinity, 86401]) {
    const value = createDefaultSettings();
    value.extensions.test = { enabled: true, settings: {}, startupDelaySeconds: delay };
    assert.throws(() => parseSettings(value), /秒数/);
  }
  const [definition] = parseSettingDefinitions([
    { key: 'sources', title: 'Sources', type: 'json', default: '[]' },
  ]);
  assert.doesNotThrow(() => validateSettingValue(definition, '[{"Folders":["C:/images"]}]'));
  assert.throws(() => validateSettingValue(definition, '{'), /Sources/);
});
test('minimum host version prevents process launch', async () => {
  const manager = new ExtensionManager({
    roots: [],
    settings: { value: createDefaultSettings() },
    hostVersion: '0.4.0',
    log: () => {},
  });
  const e = {
    manifest: { id: 'test', minimumHostVersion: '0.5.0' },
    commands: [],
    tray: [],
    state: 'stopped',
  };
  await manager.start(e);
  assert.equal(e.state, 'error');
  assert.match(e.error, /0.5.0/);
  assert.equal(e.child, undefined);
  e.manifest.startupDelaySeconds = 30;
  e.state = 'stopped';
  await manager.schedule(e);
  assert.equal(e.state, 'error');
  assert.equal(e.startTimer, undefined, 'incompatible Applet must fail before the delay');
  assert.equal(e.child, undefined);
});
test('release checks compare numeric versions, report 404/errors and use a fixed GitHub URL', async () => {
  assert.equal(compareVersions('v0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions('0.5.0+build', '0.5.0'), 0);
  assert.throws(() => compareVersions('0.5.1-beta', '0.5.0'));
  const fetcher = async (url, init) => {
    assert.equal(url, 'https://api.github.com/repos/owner/repo/releases/latest');
    assert.equal(init.redirect, 'error');
    return new Response(JSON.stringify({ tag_name: 'v0.10.0' }));
  };
  assert.equal((await checkUpdate('0.5.0', 'owner/repo', fetcher)).status, 'available');
  assert.equal((await checkUpdate('0.10.0', 'owner/repo', fetcher)).status, 'current');
  assert.equal((await checkUpdate('0.5.0')).status, 'unsupported');
  assert.equal(
    (await checkUpdate('0.5.0', 'owner/repo', async () => new Response('', { status: 404 })))
      .status,
    'unpublished',
  );
  await assert.rejects(
    checkUpdate('0.5.0', 'owner/repo', async () => new Response('', { status: 403 })),
    /403/,
  );
  await assert.rejects(
    checkUpdate('0.5.0', 'owner/repo', async () => {
      throw new Error('offline');
    }),
    /offline/,
  );
  await assert.rejects(
    checkUpdate('0.5.0', 'owner/repo', async () => new Response('{')),
    /JSON/,
  );
  await assert.rejects(
    checkUpdate(
      '0.5.0',
      'owner/repo',
      async () => new Response(JSON.stringify({ tag_name: 'v0.6.0', prerelease: true })),
    ),
    /正式版/,
  );
  assert.throws(() => releasesUrl('owner/repo/../../evil'));
});

const { test } = require('node:test');
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { AppDockApi, automationMethods } = require('../out/main/main/core/appdock-api');
const { AppletApiAccess, callAppletApi } = require('../out/main/main/core/applet-api-access');
const { SettingsStore } = require('../out/main/main/core/settings');
const { SettingsCommands } = require('../out/main/main/core/settings-commands');
const { createAppDockClient } = require('../out/main/shared/appdock-api');
const { AutomationService } = require('../out/main/main/core/automation');
function setup(t) {
  const base = path.resolve('.artifacts/shared-api-unit');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'case-'));
  const store = new SettingsStore(path.join(dir, 'settings.json'));
  store.load();
  t.after(() => store.close());
  const access = new AppletApiAccess(path.join(dir, 'applet-api.json'));
  const manifest = {
    id: 'test.caller',
    folder: dir,
    capabilities: ['appdock-api', 'settings'],
    settings: [
      { key: 'flag', type: 'boolean', default: false, automation: true },
      { key: 'private', type: 'boolean', default: false },
    ],
  };
  const e = { manifest, state: 'running' };
  const settingsCommands = new SettingsCommands({
    settings: store,
    applets: () => [
      { ...manifest, displayName: 'Caller', runtime: 'node', enabled: true, state: e.state },
    ],
    save: (v, r) => store.save(v, r),
  });
  store.updateExtension(manifest.id, { enabled: true, settings: {} });
  const options = {
    settings: store,
    settingsCommands,
    save: (v, r) => store.save(v, r),
    applets: () => [],
    commands: () => [],
    execute: async () => {},
    executable: () => false,
    writable: () => false,
    ready: () => true,
    version: 'test',
    instanceId: 'test',
    appletPermissions: (id) => (id === manifest.id ? access.get(manifest) : {}),
  };
  const api = new AppDockApi(options),
    audit = [];
  const call = (method, params = {}) =>
    callAppletApi(api, e, { method, params }, (...args) => audit.push(args));
  return {
    dir,
    store,
    access,
    manifest,
    e,
    api,
    options,
    settingsCommands,
    audit,
    call,
    grant: (p) => access.set(manifest, p),
  };
}
test('Applet grants are default-off, persisted per installation, independent of MCP, and revoked immediately', async (t) => {
  const f = setup(t);
  assert.equal((await f.call('system.getInfo')).error.code, 'API_DISABLED');
  f.grant({ read: true, execute: true, write: true });
  for (const method of automationMethods.filter(
    (m) => m !== 'commands.execute' && m !== 'applets.get',
  ))
    assert.equal((await f.call(method)).ok, true, method);
  assert.equal(f.api.call('system.getInfo').executable, false);
  assert.deepEqual(new AppletApiAccess(path.join(f.dir, 'applet-api.json')).get(f.manifest), {
    read: true,
    execute: true,
    write: true,
  });
  assert.deepEqual(f.access.get({ ...f.manifest, folder: path.join(f.dir, 'other') }), {});
  f.grant({ read: true });
  assert.equal(
    (await f.call('commands.execute', { id: 'appdock.settings.notifications.off' })).error.code,
    'EXECUTION_DISABLED',
  );
  f.grant({});
  assert.equal((await f.call('system.getInfo')).error.code, 'API_DISABLED');
});
test('Caller identity cannot be supplied, capability and lifetime are checked, audit excludes arguments', async (t) => {
  const f = setup(t);
  f.grant({ read: true, execute: true, write: true });
  const result = await callAppletApi(
    f.api,
    f.e,
    { method: 'settings.get', params: {}, appletId: 'other' },
    (...a) => f.audit.push(a),
  );
  assert.equal(result.error.code, 'INVALID_ARGUMENT');
  f.manifest.capabilities = [];
  assert.equal((await f.call('system.getInfo')).error.code, 'CAPABILITY_REQUIRED');
  f.manifest.capabilities = ['appdock-api'];
  f.e.state = 'stopped';
  assert.equal((await f.call('system.getInfo')).error.code, 'UNAVAILABLE');
  f.e.state = 'running';
  await f.call('commands.execute', { id: 'SECRET_VALUE' });
  assert.ok(!JSON.stringify(f.audit).includes('SECRET_VALUE'));
  assert.ok(f.audit.every((a) => a[1] === f.manifest.id));
});
test('Both transports share revision, dryRun, atomic validation, and settings permission', async (t) => {
  const f = setup(t);
  f.grant({ read: true, execute: true });
  const revision = f.api.call('settings.get').revision;
  const request = {
    id: 'appdock.settings.update',
    args: { expectedRevision: revision, changes: { notifications: false } },
  };
  assert.equal((await f.call('commands.execute', request)).error.code, 'WRITE_DISABLED');
  f.grant({ read: true, execute: true, write: true });
  assert.equal(
    (await f.call('commands.execute', { ...request, args: { ...request.args, dryRun: true } }))
      .value.dryRun,
    true,
  );
  assert.equal(f.api.call('settings.get').revision, revision);
  assert.equal((await f.call('commands.execute', request)).ok, true);
  assert.equal(f.api.call('settings.get').values.notifications, false);
  assert.equal((await f.call('commands.execute', request)).error.code, 'REVISION_CONFLICT');
  assert.equal(
    (await f.call('commands.execute', { id: 'appdock.tray.update', args: {} })).error.code,
    'TRAY_EDITING_DISABLED',
  );
});
test('MCP -> Applet -> synchronous settings works while asynchronous reentry and self lifecycle are rejected', async (t) => {
  const f = setup(t);
  f.grant({ read: true, execute: true, write: true, manageApplets: true });
  f.options.executable = () => true;
  f.options.commands = () => [
    {
      id: 'test.caller.run',
      appletId: 'test.caller',
      title: 'Run',
      available: true,
      completion: 'handlerReturned',
    },
    {
      id: 'other.run',
      appletId: 'other',
      title: 'Other',
      available: true,
      completion: 'handlerReturned',
    },
    {
      id: 'test.self.restart',
      appletId: 'test.caller',
      title: 'Restart',
      permission: 'applets.manage',
      available: true,
    },
  ];
  f.options.execute = async () => {
    assert.equal(
      (await f.call('commands.execute', { id: 'appdock.settings.notifications.off' })).ok,
      true,
    );
    assert.equal((await f.call('commands.execute', { id: 'other.run' })).error.code, 'BUSY');
    assert.equal(
      (await f.call('commands.execute', { id: 'test.caller.run' })).error.code,
      'SELF_CALL',
    );
    assert.equal(
      (await f.call('commands.execute', { id: 'test.self.restart' })).error.code,
      'SELF_CALL',
    );
  };
  await f.api.call('commands.execute', { id: 'test.caller.run' });
  assert.equal(f.store.value.host.notifications, false);
});
test('Legacy self-setting uses shared validation and revision while keeping private keys and startup behavior', (t) => {
  const f = setup(t);
  const before = f.settingsCommands.revision();
  f.e.state = 'starting';
  f.settingsCommands.setOwnSetting(f.manifest, 'flag', true);
  f.settingsCommands.setOwnSetting(f.manifest, 'private', true);
  f.settingsCommands.setOwnSetting(f.manifest, 'undeclared', { legacy: true });
  assert.notEqual(f.settingsCommands.revision(), before);
  assert.throws(() => f.settingsCommands.setOwnSetting(f.manifest, 'flag', 'bad'));
  assert.deepEqual(f.settingsCommands.get(f.manifest.id).values, { flag: true });
  assert.deepEqual(f.store.value.extensions[f.manifest.id].settings, {
    flag: true,
    private: true,
    undeclared: { legacy: true },
  });
});
test('Malformed grants fail closed; invalid edits never change stored permissions', (t) => {
  const f = setup(t);
  f.grant({ read: true });
  const file = path.join(f.dir, 'applet-api.json'),
    before = fs.readFileSync(file, 'utf8');
  assert.throws(() => f.grant({ read: 'true' }));
  assert.throws(() => f.grant({ admin: true }));
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  fs.writeFileSync(file, '{}');
  const bad = new AppletApiAccess(file);
  assert.ok(bad.error);
  assert.deepEqual(bad.get(f.manifest), {});
  assert.throws(() => bad.set(f.manifest, { read: true }));
});
test('Node SDK exposes structured error codes and unwraps the same result', async () => {
  const client = createAppDockClient(async (method, args) => {
    assert.equal(method, 'host.appdock.call');
    return args.method === 'settings.get'
      ? { ok: true, value: { revision: 'r' } }
      : { ok: false, error: { code: 'API_DISABLED', message: 'Disabled' } };
  });
  assert.deepEqual(await client.call('settings.get'), { revision: 'r' });
  await assert.rejects(client.call('system.getInfo'), { code: 'API_DISABLED' });
});

test('MCP effective permission reporting retains execution and write prerequisites', (t) => {
  const f = setup(t);
  const config = {
    version: 1,
    enabled: true,
    allowWrite: false,
    allowExecute: false,
    allowManageApplets: true,
    allowEditShortcuts: true,
    allowEditGestures: true,
    allowEditRibbon: true,
    allowEditTray: true,
    port: 0,
    token: 'a'.repeat(64),
    configFile: path.join(f.dir, 'config.toml'),
    serverName: 'Test',
    owned: {},
  };
  const service = () => {
    fs.writeFileSync(path.join(f.dir, 'automation.json'), JSON.stringify(config));
    return new AutomationService({
      localDirectory: f.dir,
      baseDirectory: f.dir,
      version: 'test',
      encrypt: (v) => v,
      decrypt: (v) => v,
      changed: () => {},
      createApi: () => f.api,
    });
  };
  let s = service();
  assert.equal(s.allowed('allowManageApplets'), false);
  assert.equal(s.allowed('allowEditTray'), false);
  config.allowExecute = true;
  s = service();
  assert.equal(s.allowed('allowManageApplets'), true);
  assert.equal(s.allowed('allowEditTray'), false);
  config.allowWrite = true;
  s = service();
  assert.equal(s.allowed('allowEditTray'), true);
  config.enabled = false;
  s = service();
  assert.equal(s.allowed('allowWrite'), false);
  assert.equal(s.allowed('allowEditTray'), false);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { SettingsStore } = require('../out/main/main/core/settings.js');
const { ExtensionManager } = require('../out/main/main/core/extensions.js');
const root = path.resolve(__dirname, '..');
test('commands are catalogued before loading; explicit start and legacy alias activate once without delay', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appdock-declared-'));
  const settings = new SettingsStore(path.join(dir, 'settings.json'));
  settings.load();
  const manager = new ExtensionManager({
    roots: [path.join(root, '.artifacts/test-extensions')],
    settings,
    hostVersion: '0.6.0',
    nodeExecutable: process.execPath,
    nodeWorker: path.join(root, 'out/main/main/node-worker.js'),
    dotnetHost: path.join(root, '.artifacts/dotnet-host'),
    log: () => {},
    api: async (e, method, p) => {
      if (method === 'host.ui.panel') e.panel = p;
      return null;
    },
  });
  t.after(async () => {
    await manager.shutdown();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  manager.discover();
  const e = manager.items.get('appdock.welcome');
  e.manifest.startupDelaySeconds = 30;
  e.manifest.commands = [
    {
      id: 'appdock.welcome.refresh',
      title: 'Start',
      activateOnExecute: true,
      aliases: ['appdock.welcome.resume'],
    },
    { id: 'appdock.welcome.stop', title: 'Stop' },
  ];
  let catalog = manager.snapshot().find((item) => item.id === e.manifest.id).commands;
  assert.equal(catalog.find((c) => c.id.endsWith('.refresh')).available, true);
  assert.equal(catalog.find((c) => c.id.endsWith('.stop')).available, false);
  assert.equal(catalog.find((c) => c.id.endsWith('.resume')).hidden, true);
  assert.throws(() => manager.execute('appdock.welcome.stop'), /利用/);
  e.manifest.minimumHostVersion = '99.0.0';
  assert.throws(() => manager.execute('appdock.welcome.refresh'), /利用/);
  assert.equal(e.child, undefined);
  e.manifest.minimumHostVersion = '0.6.0';
  await Promise.all([
    manager.execute('appdock.welcome.resume'),
    manager.execute('appdock.welcome.refresh'),
  ]);
  assert.equal(e.state, 'running');
  assert.equal(settings.value.extensions[e.manifest.id].enabled, true);
  assert.equal(e.startTimer, undefined);
  const pid = e.child.pid;
  await manager.execute('appdock.welcome.resume');
  assert.equal(e.child.pid, pid);
  settings.updateExtension(e.manifest.id, { enabled: false });
  await manager.reconcile();
  settings.updateExtension(e.manifest.id, { enabled: true });
  await manager.reconcile();
  assert.equal(e.state, 'waiting');
  await manager.execute('appdock.welcome.resume');
  assert.equal(e.state, 'running');
  assert.equal(e.startTimer, undefined);
});
test('real Node and .NET extensions: activation, commands, crash isolation, restart, settings and shutdown', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appdock-lifecycle-'));
  const settings = new SettingsStore(path.join(dir, 'settings.json'));
  settings.load();
  settings.updateExtension('appdock.welcome', { enabled: true });
  settings.updateExtension('appdock.dotnet-demo', { enabled: true });
  const manager = new ExtensionManager({
    roots: [path.join(root, '.artifacts/test-extensions')],
    settings,
    nodeExecutable: process.execPath,
    nodeWorker: path.join(root, 'out/main/main/node-worker.js'),
    dotnetHost: path.join(root, '.artifacts/dotnet-host'),
    api: async (e, method, p) => {
      if (method === 'host.ui.panel') {
        e.panel = p;
        return null;
      }
      if (method === 'host.log') return null;
      throw new Error('Unexpected API: ' + method);
    },
    log: () => {},
  });
  t.after(async () => {
    await manager.shutdown();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  manager.discover();
  await manager.reconcile();
  assert.equal(manager.snapshot().filter((e) => e.state === 'running').length, 2);
  const dotnet = manager.items.get('appdock.dotnet-demo');
  const node = manager.items.get('appdock.welcome');
  assert.notEqual(dotnet.child.pid, node.child.pid);
  assert.equal(dotnet.panel.title, 'C# is docked.');
  await manager.execute('appdock.welcome.refresh');
  await manager.execute('appdock.dotnet-demo.refresh');
  const originalPid = dotnet.child.pid;
  const crashed = once(dotnet.child, 'exit');
  dotnet.child.kill();
  await crashed;
  assert.equal(dotnet.state, 'error');
  assert.equal(node.state, 'running');
  assert.equal(dotnet.commands.length, 0);
  await manager.restart('appdock.dotnet-demo');
  assert.equal(dotnet.state, 'running');
  assert.notEqual(dotnet.child.pid, originalPid);
  settings.updateExtension('appdock.welcome', { settings: { greeting: 'テストのメッセージ' } });
  await manager.reconcile();
  await manager.execute('appdock.welcome.refresh');
  assert.equal(node.panel.description, 'テストのメッセージ');
  const children = [dotnet.child, node.child];
  settings.updateExtension('appdock.dotnet-demo', { enabled: false });
  await manager.reconcile();
  assert.equal(dotnet.state, 'stopped');
  assert.equal(dotnet.panel, null);
  await manager.shutdown();
  assert.equal(node.state, 'stopped');
  assert.ok(children.every((c) => c.exitCode !== null || c.signalCode !== null));
});

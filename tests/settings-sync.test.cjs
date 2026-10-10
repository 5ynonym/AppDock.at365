const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { SettingsStore, defaults } = require('../out/main/main/core/settings');
const { WebProfileStore } = require('../out/main/main/core/web-profiles');
const { dataPaths } = require('../out/main/main/core/data-paths');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'appdock-sync-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
async function until(fn) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > 6000) throw Error('sync timeout');
    await new Promise((r) => setTimeout(r, 30));
  }
}
test('received settings retain dirty revision, reject partial JSON and recover after rename without writeback', async (t) => {
  const root = fixture(t),
    file = path.join(root, 'settings.json'),
    store = new SettingsStore(file, path.join(root, 'local', 'backups'));
  store.load();
  t.after(() => store.close());
  store.watch(() => {});
  const old = store.revision,
    remote = defaults();
  remote.host.theme = 'light';
  fs.writeFileSync(file, '{broken');
  await until(() => store.syncError);
  assert.equal(store.value.host.theme, 'dark');
  const raw = JSON.stringify(remote);
  fs.writeFileSync(file + '.incoming', raw);
  fs.renameSync(file + '.incoming', file);
  await until(() => store.value.host.theme === 'light');
  assert.equal(fs.readFileSync(file, 'utf8'), raw);
  assert.throws(() => store.save(defaults(), old), /別の場所/);
  assert.equal(store.syncError, undefined);
  // The same valid bytes must clear an error after temporary disappearance.
  fs.renameSync(file, file + '.away');
  await until(() => store.syncError);
  fs.renameSync(file + '.away', file);
  await until(() => !store.syncError);
});
test('PC-local generations survive corruption and restart; incoming valid settings cancel explicit restoration', async (t) => {
  const root = fixture(t),
    file = path.join(root, 'settings.json'),
    backup = path.join(root, 'local', 'backups');
  const first = new SettingsStore(file, backup);
  first.load();
  for (let i = 0; i < 24; i++) {
    const next = structuredClone(first.value);
    next.profile.name = 'generation ' + i;
    first.save(next, first.revision);
  }
  assert.equal(fs.readdirSync(backup).filter((n) => n.startsWith('settings-')).length, 20);
  fs.writeFileSync(file, '{broken');
  const second = new SettingsStore(file, backup);
  second.load();
  assert.equal(second.value.profile.name, 'generation 23');
  assert.equal(second.recovered, true);
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken');
  const roster = new WebProfileStore(
    path.join(root, 'shared', 'accounts.json'),
    path.join(root, 'local', 'web-applets'),
  );
  roster.load(second);
  assert.deepEqual(roster.snapshot(), []);
  assert.throws(() => second.save(defaults(), second.revision));
  const good = defaults();
  good.profile.name = 'remote won';
  fs.writeFileSync(file, JSON.stringify(good));
  assert.throws(() => second.restoreBackup(second.revision), /正常な設定/);
  assert.equal(second.value.profile.name, 'remote won');
  fs.writeFileSync(file, '{broken');
  const third = new SettingsStore(file, backup);
  third.load();
  third.restoreBackup(third.revision);
  assert.equal(JSON.parse(fs.readFileSync(file)).profile.name, 'remote won');
  fs.unlinkSync(file);
  const missing = new SettingsStore(file, backup);
  missing.load();
  assert.equal(missing.recovered, true);
  assert.equal(fs.existsSync(file), false);
});
test('shared roster updates live while remote removal never schedules deletion of another PC login', async (t) => {
  const root = fixture(t),
    settings = new SettingsStore(path.join(root, 'settings.json'));
  settings.load();
  const file = path.join(root, 'shared', 'accounts.json');
  const a = new WebProfileStore(file, path.join(root, 'PC-A')),
    b = new WebProfileStore(file, path.join(root, 'PC-B'));
  a.load(settings);
  b.load(settings);
  t.after(() => {
    a.close();
    b.close();
  });
  a.watch(
    () => {},
    () => {},
  );
  b.watch(
    () => {},
    () => {},
  );
  const added = a.add('shared');
  await until(() => b.snapshot().length === 1);
  assert.equal(b.get(added.id).name, 'shared');
  const marker = path.join(root, 'PC-B', 'sessions', added.id, 'cookie-marker');
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, 'PC B login');
  a.rename(added.id, 'renamed');
  await until(() => b.get(added.id).name === 'renamed');
  a.remove(added.id);
  await until(() => b.snapshot().length === 0);
  assert.deepEqual(b.pendingDeletion(), []);
  b.cleanupSessions([]);
  assert.equal(fs.readFileSync(marker, 'utf8'), 'PC B login');
  assert.equal(JSON.parse(fs.readFileSync(file)).pendingDeletion, undefined);
  assert.deepEqual(a.pendingDeletion(), [added.id]);
});
test('local state paths separate placements and leave the shared asset root beside the EXE', (t) => {
  const root = fixture(t),
    local = path.join(root, 'LocalAppData');
  const a = dataPaths(path.join(root, 'A'), local),
    b = dataPaths(path.join(root, 'B'), local);
  assert.notEqual(a.local, b.local);
  assert.equal(a.local, dataPaths(path.join(root, 'A'), local).local);
  assert.equal(a.assets, path.join(root, 'A', 'data', 'assets'));
  assert.equal(a.local.startsWith(local), true);
  assert.equal(path.dirname(a.local), path.join(local, 'at365', 'AppDock', 'profiles'));
});
test('startup never writes an empty shared roster while metadata is still in transit', (t) => {
  const root = fixture(t),
    settings = new SettingsStore(path.join(root, 'settings.json'));
  settings.load();
  const file = path.join(root, 'shared', 'accounts.json');
  const empty = new WebProfileStore(file, path.join(root, 'local'));
  empty.load(settings);
  assert.equal(fs.existsSync(file), false);
  settings.value.webApplets.items = [{ accountId: 'account.00000000-0000-0000-0000-000000000001' }];
  assert.throws(() => empty.add('overwrite risk'), /同期を待って/);
  assert.equal(fs.existsSync(file), false);
  fs.writeFileSync(file, '{in-progress');
  assert.throws(() => empty.add('overwrite risk'));
  assert.equal(fs.readFileSync(file, 'utf8'), '{in-progress');
});

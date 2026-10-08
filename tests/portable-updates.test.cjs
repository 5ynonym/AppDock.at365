const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { PortableUpdates, safeRelative } = require('../out/main/main/core/portable-updates.js');
const { createDefaultSettings, parseSettings } = require('../out/main/shared/settings-schema.js');
const { validateUpdateSource } = require('../out/main/shared/update-sources.js');
const root = path.resolve(__dirname, '..');
const helper = path.join(root, 'artifacts/updater/AppDock.Updater.exe');
const hash = (data) => createHash('sha256').update(data).digest('hex');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'AppDock-update-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'publish');
  fs.mkdirSync(source);
  const manifest = {
    apiVersion: 1,
    id: 'fixture',
    name: 'Fixture',
    version: '2.0.0',
    runtime: 'node',
    entry: 'index.js',
  };
  fs.writeFileSync(path.join(source, 'extension.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(source, 'index.js'), 'module.exports = {};');
  const settings = createDefaultSettings().updates;
  const target = {
    id: 'fixture',
    name: 'Fixture',
    kind: 'applet',
    version: '1.0.0',
    source,
    destination: path.join(directory, 'extensions/fixture'),
  };
  const updater = new PortableUpdates({
    targets: () => [target],
    settings: () => settings,
    hostVersion: '0.22.0',
    helper,
    baseDirectory: directory,
    executable: '',
    restartArgs: [],
    changed() {},
    shutdown() {},
    confirm: async () => false,
    processIds: () => [],
    log() {},
  });
  return { directory, source, manifest, settings, target, updater };
}
test('update settings migrate old settings and validate local, UNC, HTTP and GitHub sources', () => {
  const value = createDefaultSettings();
  delete value.updates;
  assert.equal(parseSettings(value).updates.checkHostOnStartup, false);
  for (const source of [
    'A:\\repo\\publish',
    '\\\\server\\share\\publish',
    'https://example.org/update.json',
    'http://localhost:7777/feed/',
    'github:owner/repo',
    'https://github.com/owner/repo/releases',
  ])
    assert.doesNotThrow(() => validateUpdateSource(source));
  for (const source of [
    'relative/path',
    'file:///C:/x',
    'ftp://host/file',
    'https://user:secret@example.org/',
    '\\\\?\\C:\\device',
    'github:owner/repo/evil',
  ])
    assert.throws(() => validateUpdateSource(source));
  value.updates = { ...createDefaultSettings().updates, startupDelaySeconds: -1 };
  assert.throws(() => parseSettings(value));
  for (const name of ['../x', 'a/../../x', 'C:/x', 'a\\b', 'x:stream', 'con.exe', 'a./b'])
    assert.equal(safeRelative(name), false);
});
test('existing local publish directories, ID, minimum host and same-version reapply', async (t) => {
  const f = fixture(t);
  await f.updater.check();
  assert.equal(f.updater.state.results[0].status, 'available');
  f.target.version = '2.0.0';
  await f.updater.check();
  assert.equal(f.updater.state.results[0].installable, false);
  f.settings.allowSameVersion = true;
  await f.updater.check();
  assert.equal(f.updater.state.results[0].installable, true);
  f.target.version = '3.0.0';
  await f.updater.check();
  assert.equal(f.updater.state.results[0].installable, false);
  f.manifest.minimumHostVersion = '99.0.0';
  fs.writeFileSync(path.join(f.source, 'extension.json'), JSON.stringify(f.manifest));
  await f.updater.check();
  assert.equal(f.updater.state.results[0].status, 'incompatible');
  f.manifest.id = 'other';
  fs.writeFileSync(path.join(f.source, 'extension.json'), JSON.stringify(f.manifest));
  await f.updater.check();
  assert.match(f.updater.state.results[0].message, /ID/);
});
test('startup checks only read metadata, do not download or apply, and include disabled Applets', async (t) => {
  const f = fixture(t);
  f.settings.checkAppletsOnStartup = true;
  f.settings.startupDelaySeconds = 0;
  let notifications = 0;
  let applies = 0;
  f.updater.install = async () => {
    applies++;
  };
  await new Promise((resolve) => {
    f.updater.scheduleStartup(false, (results) => {
      assert.equal(results.length, 1);
      notifications++;
      resolve();
    });
  });
  assert.equal(applies, 0);
  assert.equal(notifications, 1);
  assert.equal(
    f.updater.scheduleStartup(true, () => assert.fail()),
    undefined,
  );
});
test('HTTP feeds and GitHub release assets share identity/hash validation; checks never fetch payloads', async (t) => {
  const f = fixture(t);
  const calls = [];
  const feed = {
    schemaVersion: 1,
    kind: 'applet',
    id: 'fixture',
    version: '2.0.0',
    payload: { file: 'update.zip', sha256: 'a'.repeat(64), size: 20, format: 'zip' },
  };
  f.target.source = 'github:owner/repo';
  const updater = new PortableUpdates({
    ...f.updater.options,
    fetcher: async (url) => {
      calls.push(url);
      return new Response(
        JSON.stringify(
          url.includes('/releases/latest')
            ? {
                tag_name: 'v2.0.0',
                assets: [
                  { name: 'update.json', browser_download_url: 'https://example.org/update.json' },
                  { name: 'update.zip', browser_download_url: 'https://example.org/update.zip' },
                ],
              }
            : feed,
        ),
      );
    },
  });
  await updater.check();
  assert.equal(updater.state.results[0].status, 'available');
  assert.equal(calls.length, 2);
  assert.equal(
    calls.some((url) => url.endsWith('.zip')),
    false,
  );
  f.target.source = 'https://example.org/feed/';
  calls.length = 0;
  await updater.check();
  assert.equal(calls[0], 'https://example.org/feed/update.json');
  feed.payload.file = '../escape.zip';
  await updater.check();
  assert.match(updater.state.results[0].message, /配布ファイル/);
});
test('turning startup checks off during the delay prevents access to update origins', async (t) => {
  const f = fixture(t);
  f.settings.checkAppletsOnStartup = true;
  f.settings.startupDelaySeconds = 0;
  await new Promise((resolve) => {
    f.updater.scheduleStartup(false, (results) => {
      assert.deepEqual(results, []);
      resolve();
    });
    f.settings.checkAppletsOnStartup = false;
  });
  assert.deepEqual(f.updater.state.results, []);
});
test('a corrupt downloaded payload never reaches approval or shutdown', async (t) => {
  const f = fixture(t);
  f.target.source = 'https://example.org/update.json';
  const feed = {
    schemaVersion: 1,
    kind: 'applet',
    id: 'fixture',
    version: '2.0.0',
    payload: { file: 'update.zip', sha256: 'a'.repeat(64), size: 9, format: 'zip' },
  };
  let approvals = 0;
  let shutdowns = 0;
  const updater = new PortableUpdates({
    ...f.updater.options,
    executable: process.execPath,
    fetcher: async (url) =>
      new Response(url.endsWith('update.json') ? JSON.stringify(feed) : 'bad bytes'),
    confirm: async () => {
      approvals++;
      return true;
    },
    shutdown() {
      shutdowns++;
    },
  });
  await assert.rejects(updater.install('fixture'), /ハッシュ/);
  assert.equal(approvals, 0);
  assert.equal(shutdowns, 0);
  assert.equal(updater.state.busy, false);
});
function digestTree(directory) {
  const names = [];
  function walk(current) {
    for (const name of fs.readdirSync(current)) {
      const file = path.join(current, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else names.push(path.relative(directory, file).replace(/\\/g, '/'));
    }
  }
  walk(directory);
  return hash(
    names
      .sort()
      .map((name) => `${name}\0${hash(fs.readFileSync(path.join(directory, name)))}\n`)
      .join(''),
  );
}
async function applyJob(directory, items, afterReady = () => {}) {
  const job = path.join(directory, 'job.json');
  const base = path.join(directory, 'installed');
  fs.mkdirSync(path.join(base, '.appdock'), { recursive: true });
  const result = path.join(base, '.appdock/update-result.json');
  fs.writeFileSync(
    job,
    JSON.stringify({
      schemaVersion: 1,
      baseDirectory: base,
      executable: path.join(process.env.SystemRoot, 'System32/cmd.exe'),
      args: ['/c', 'exit', '0'],
      items,
      processIds: [],
      result,
    }),
  );
  const child = spawn(helper, ['--apply', job], { windowsHide: true });
  let output = '';
  child.stderr.on('data', (data) => {
    output += data;
  });
  const exited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
  for (let i = 0; !fs.existsSync(job + '.ready'); i++) {
    if (i > 100 || child.exitCode !== null) throw Error(output || 'helper did not become ready');
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  afterReady();
  fs.writeFileSync(job + '.commit', 'apply');
  assert.equal(await exited, 0, output);
  return JSON.parse(fs.readFileSync(result));
}
test('shared updater swaps two Applet folders, removes obsolete payload files, and preserves host data', async (t) => {
  assert.ok(fs.existsSync(helper), 'Build the updater before running tests');
  const f = fixture(t);
  const base = path.join(f.directory, 'installed');
  const items = [];
  for (const id of ['one', 'two']) {
    const staged = path.join(f.directory, id);
    const installed = path.join(base, 'extensions', id);
    fs.mkdirSync(staged, { recursive: true });
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(path.join(staged, 'extension.json'), JSON.stringify({ id, version: '2.0.0' }));
    fs.writeFileSync(path.join(staged, 'new.dll'), 'new');
    fs.writeFileSync(
      path.join(installed, 'extension.json'),
      JSON.stringify({ id, version: '1.0.0' }),
    );
    fs.writeFileSync(path.join(installed, 'obsolete.dll'), 'old');
    items.push({
      kind: 'applet',
      id,
      version: '2.0.0',
      source: staged,
      destination: installed,
      sha256: digestTree(staged),
    });
  }
  fs.mkdirSync(path.join(base, '.appdock/web-accounts'), { recursive: true });
  fs.writeFileSync(path.join(base, 'settings.json'), 'user settings');
  fs.writeFileSync(path.join(base, '.appdock/web-accounts/cookie'), 'cookie');
  const result = await applyJob(f.directory, items);
  assert.equal(result.ok, true);
  for (const item of items) {
    assert.ok(fs.existsSync(path.join(item.destination, 'new.dll')));
    assert.equal(fs.existsSync(path.join(item.destination, 'obsolete.dll')), false);
  }
  assert.equal(fs.readFileSync(path.join(base, 'settings.json'), 'utf8'), 'user settings');
  assert.equal(fs.readFileSync(path.join(base, '.appdock/web-accounts/cookie'), 'utf8'), 'cookie');
});
test('shared updater restores the first Applet if the second destination changes after preparation', async (t) => {
  const f = fixture(t);
  const base = path.join(f.directory, 'installed');
  const items = [];
  for (const id of ['one', 'two']) {
    const staged = path.join(f.directory, id);
    const installed = path.join(base, 'extensions', id);
    fs.mkdirSync(staged, { recursive: true });
    fs.mkdirSync(installed, { recursive: true });
    for (const [folder, version] of [
      [staged, '2.0.0'],
      [installed, '1.0.0'],
    ])
      fs.writeFileSync(path.join(folder, 'extension.json'), JSON.stringify({ id, version }));
    items.push({
      kind: 'applet',
      id,
      version: '2.0.0',
      source: staged,
      destination: installed,
      sha256: digestTree(staged),
    });
  }
  const moved = items[1].destination + '-moved';
  const result = await applyJob(f.directory, items, () =>
    fs.renameSync(items[1].destination, moved),
  );
  assert.equal(result.ok, false);
  assert.equal(result.restored, true);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(items[0].destination, 'extension.json'))).version,
    '1.0.0',
  );
  assert.ok(fs.existsSync(moved));
});
test('published Applet packages are consumable and corrupted ZIP paths are rejected', (t) => {
  const f = fixture(t);
  const output = path.join(f.directory, 'feed');
  const packed = spawnSync(helper, ['--pack', 'applet', f.source, 'unused', output], {
    windowsHide: true,
    encoding: 'utf8',
  });
  assert.equal(packed.status, 0, packed.stderr);
  const feed = JSON.parse(fs.readFileSync(path.join(output, 'update.json')));
  assert.equal(feed.version, '2.0.0');
  assert.equal(feed.payload.sha256, hash(fs.readFileSync(path.join(output, 'update.zip'))));
  const extracted = path.join(f.directory, 'extracted');
  assert.equal(
    spawnSync(helper, ['--extract', path.join(output, 'update.zip'), extracted], {
      windowsHide: true,
    }).status,
    0,
  );
  assert.equal(fs.readFileSync(path.join(extracted, 'index.js'), 'utf8'), 'module.exports = {};');
  // Same byte length changes both ZIP file-name records without invalidating their layout.
  const zip = fs.readFileSync(path.join(output, 'update.zip'));
  const corrupt = Buffer.from(zip.toString('latin1').replaceAll('index.js', '../bad.x'), 'latin1');
  fs.writeFileSync(path.join(output, 'bad.zip'), corrupt);
  assert.notEqual(
    spawnSync(helper, ['--extract', path.join(output, 'bad.zip'), path.join(f.directory, 'bad')], {
      windowsHide: true,
    }).status,
    0,
  );
  assert.equal(fs.existsSync(path.join(f.directory, 'bad.x')), false);
});

const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const {
  allowedWebNavigation,
  validateWebAccounts,
  parseWebViewport,
  serializeWebReport,
} = require('../out/main/main/core/web-accounts');
const { readManifest } = require('../out/main/main/core/extensions');
const { createHostApi } = require('../out/main/main/core/host-api');

test('Worker read excludes UI reports so multi-account history cannot overflow JSON-RPC', async () => {
  const { WebAccountController } = require('../out/main/main/core/web-accounts');
  const accounts = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: 'Account ' + i }));
  const fake = {
    state: { accounts, selected: '0' },
    definition: { url: 'https://mail.google.com' },
    views: new Map(),
    deleting: new Set(),
    acknowledgements: new Set(['0']),
    statuses: new Map(
      accounts.map((a) => [
        a.id,
        { observation: 'x'.repeat(59000), data: JSON.stringify('y'.repeat(49000)) },
      ]),
    ),
    start() {},
    snapshot: WebAccountController.prototype.snapshot,
  };
  assert.ok(Buffer.byteLength(JSON.stringify(fake.snapshot())) > 1024 * 1024);
  const read = await WebAccountController.prototype.read.call(fake);
  assert.ok(Buffer.byteLength(JSON.stringify(read)) < 1024 * 1024);
  assert.ok(read.accounts.every((a) => a.data === null && a.observation.length === 59000));
  assert.deepEqual(read.acknowledged, ['0']);
  assert.equal(fake.acknowledgements.size, 0);
});
test('Web account navigation requires exact declared HTTPS origins and excludes credentials', () => {
  const origins = ['https://mail.google.com'];
  assert.equal(allowedWebNavigation('https://mail.google.com/mail/u/0/#inbox', origins), true);
  for (const url of [
    'http://mail.google.com',
    'https://mail.google.com.evil.test',
    'https://mail.google.com:8443',
    'https://u:p@mail.google.com',
    'file:///C:/',
  ])
    assert.equal(allowedWebNavigation(url, origins), false);
});

test('Web account viewport and transient UI report are bounded', () => {
  assert.equal(parseWebViewport(null), null);
  assert.deepEqual(parseWebViewport({ x: 20, y: 100, width: 800, height: 600, extra: 1 }), {
    x: 20,
    y: 100,
    width: 800,
    height: 600,
  });
  for (const v of [
    undefined,
    {},
    { x: -1, y: 1, width: 1, height: 1 },
    { x: 0, y: 0, width: NaN, height: 1 },
    { x: 0, y: 0, width: 1.5, height: 1 },
    { x: 0, y: 0, width: 100001, height: 1 },
  ])
    assert.throws(() => parseWebViewport(v), /viewport/);
  assert.equal(serializeWebReport(undefined), 'null');
  assert.deepEqual(JSON.parse(serializeWebReport({ count: 2 })), { count: 2 });
  assert.throws(() => serializeWebReport('あ'.repeat(20000)), /large/);
  const circular = {};
  circular.self = circular;
  assert.throws(() => serializeWebReport(circular));
});
test('Web assets cannot escape Applet; observer origin and capability must be declared', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-account-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'applet'));
  fs.writeFileSync(path.join(dir, 'outside.js'), '');
  const folder = path.join(dir, 'applet');
  for (const f of ['index.js', 'ui.html', 'observer.js'])
    fs.writeFileSync(path.join(folder, f), '');
  const web = {
    url: 'https://mail.google.com/mail/u/0/#inbox',
    origins: ['https://mail.google.com'],
    observeOrigin: 'https://mail.google.com',
    ui: 'ui.html',
    observer: 'observer.js',
  };
  assert.deepEqual(validateWebAccounts(folder, web), web);
  assert.throws(() => validateWebAccounts(folder, { ...web, observer: '../outside.js' }), /inside/);
  assert.throws(
    () => validateWebAccounts(folder, { ...web, observeOrigin: 'https://accounts.google.com' }),
    /origins/,
  );
  fs.writeFileSync(
    path.join(folder, 'extension.json'),
    JSON.stringify({
      apiVersion: 1,
      id: 'test.web',
      name: 'Test',
      version: '0.1.0',
      runtime: 'node',
      entry: 'index.js',
      webAccounts: web,
    }),
  );
  assert.throws(() => readManifest(folder), /capability/);
});
test('Web account API is unavailable without capability and when extension is stopped', async () => {
  const api = createHostApi(
    {},
    '',
    () => {},
    () => {},
  );
  const e = { state: 'running', manifest: { id: 'test.web', capabilities: [] } };
  for (const method of ['start', 'read', 'open', 'report'])
    await assert.rejects(api(e, 'host.webAccounts.' + method, {}), /capabilities/);
  e.state = 'stopped';
  e.manifest.capabilities = ['web-accounts'];
  await assert.rejects(api(e, 'host.webAccounts.start', {}), /停止/);
});

const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os');
const { allowedWebNavigation, validateWebAccounts } = require('../out/main/main/core/web-accounts');
const { readManifest } = require('../out/main/main/core/extensions');
const { createHostApi } = require('../out/main/main/core/host-api');
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

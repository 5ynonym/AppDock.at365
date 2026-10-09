const { _electron: electron } = require('playwright');
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const legacyExe = path.resolve(
  process.argv[2] || path.join(root, 'artifacts/web-account-legacy-0.24/win-unpacked/AppDock.at365.exe'),
);
const profile = path.join(root, 'artifacts', `web-profile-migration-${Date.now()}`);
const account = { id: `account.${randomUUID()}`, name: '0.24.0の枠' },
  id = `web.${randomUUID()}`;
const file = path.join(profile, 'settings.json'),
  roster = path.join(profile, '.appdock/web-applets/accounts.json');
let app,
  dock,
  seed = true;
const server = http.createServer((_req, res) => {
  if (seed) res.setHeader('set-cookie', 'legacy_login=retained; Max-Age=3600; SameSite=Lax');
  res.setHeader('content-type', 'text/html');
  res.end('<h1>Migration fixture</h1>');
});
async function until(fn, label) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(label);
}
async function start(legacy) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({
    executablePath: legacy ? legacyExe : require('electron'),
    args: [...(legacy ? [] : [root]), `--test-profile=${profile}`],
    env,
  });
  dock = await app.firstWindow();
  await until(
    async () => (await dock.evaluate(() => window.dock.snapshot())).startupReady,
    'startup',
  );
}
async function web() {
  await dock.evaluate((id) => window.dock.openAppletPage(id, 'main'), id);
  return until(
    () =>
      app
        .context()
        .pages()
        .find((p) => p.url().startsWith('http://127.0.0.1:')),
    'remote',
  );
}
(async () => {
  assert.ok(
    fs.existsSync(legacyExe),
    'Provide the retained 0.24.0 win-unpacked EXE before rebuilding it',
  );
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const value = require('../out/main/shared/settings-schema').createDefaultSettings();
  value.host.hardwareAcceleration = false;
  value.host.notifications = false;
  value.globalShortcutCommands = [];
  value.webApplets = {
    accounts: [account],
    items: [
      {
        id,
        name: '既存のWeb',
        url: `http://127.0.0.1:${server.address().port}/`,
        accountId: account.id,
        enabled: true,
        display: 'page',
        navigation: 'same-origin',
        allowedOrigins: [],
        icon: '',
      },
    ],
  };
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
  const legacyAsarSha256 = createHash('sha256')
    .update(fs.readFileSync(path.join(path.dirname(legacyExe), 'resources/app.asar')))
    .digest('hex');
  await start(true);
  assert.equal(
    (await dock.evaluate(() => window.dock.snapshot())).webAccounts,
    undefined,
    'The first launch must actually be the old host',
  );
  let page = await web();
  assert.ok((await page.evaluate(() => document.cookie)).includes('legacy_login=retained'));
  assert.equal(fs.existsSync(roster), false);
  await app.close();
  app = undefined;
  seed = false;
  await start(false);
  let s = await dock.evaluate(() => window.dock.snapshot());
  assert.deepEqual(s.webAccounts, [account]);
  assert.equal(JSON.parse(fs.readFileSync(file)).webApplets.accounts, undefined);
  assert.equal(JSON.parse(fs.readFileSync(roster)).accounts[0].id, account.id);
  page = await web();
  assert.ok(
    (await page.evaluate(() => document.cookie)).includes('legacy_login=retained'),
    'Login Cookie must survive without re-seeding',
  );
  const bytes = fs.readFileSync(file),
    revision = s.settings.revision;
  await dock.evaluate((id) => window.dock.renameWebAccount(id, '独立管理に移行した枠'), account.id);
  s = await dock.evaluate(() => window.dock.snapshot());
  assert.equal(s.settings.revision, revision);
  assert.deepEqual(fs.readFileSync(file), bytes);
  assert.ok((await page.evaluate(() => document.cookie)).includes('legacy_login=retained'));
  await app.close();
  app = undefined;
  const result = {
    ok: true,
    profile,
    legacyAsarSha256,
    accountId: account.id,
    checks: [
      'real 0.24.0 login Cookie survives upgrade migration with unchanged account ID/session path',
      'roster moved out of settings; immediate rename leaves settings bytes/revision and Cookie unchanged',
    ],
  };
  fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (app) await app.close().catch(() => {});
    await new Promise((r) => server.close(r));
  });

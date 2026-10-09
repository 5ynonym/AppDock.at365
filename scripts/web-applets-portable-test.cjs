// Exercise the actual single EXE without main-process test hooks or real accounts.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || path.join(root, 'publish/AppDock.at365.exe'));
const profile = path.join(root, 'artifacts', `web-portable-${Date.now()}`);
const executable = path.join(profile, 'AppDock.at365.exe');
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.mkdirSync(profile, { recursive: true });
fs.copyFileSync(source, executable);
const sha256 = hash(source);
assert.equal(hash(executable), sha256);
const checks = [];
let browser, child, dock, port;
const fixture = http.createServer((req, res) => {
  if (req.url === '/.well-known/appdock.json') {
    res.setHeader('content-type', 'application/json');
    return res.end(
      JSON.stringify({
        name: '単一EXEのWeb',
        start_url: '/start',
        appdock: { schemaVersion: 1, navigation: 'same-origin' },
      }),
    );
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(
    '<!doctype html><h1>単一EXEのWeb</h1><input aria-label="保持する入力"><a href="/next">次のページ</a>',
  );
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {}
    await wait(100);
  }
  throw Error(label);
}
async function freePort() {
  const server = net.createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const p = server.address().port;
  await new Promise((r) => server.close(r));
  return p;
}
const snapshot = () => dock.evaluate(() => window.dock.snapshot());
async function update(fn) {
  const s = await snapshot();
  fn(s.settings.value);
  await dock.evaluate((s) => window.dock.saveSettings(s.value, s.revision), s.settings);
}
async function start() {
  const debugPort = await freePort(),
    env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(executable, [`--test-profile=${profile}`, `--remote-debugging-port=${debugPort}`], {
    cwd: profile,
    env,
    windowsHide: true,
    stdio: 'ignore',
  });
  browser = await until(
    () => chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { timeout: 1000 }),
    'portable CDP',
  );
  dock = await until(
    () =>
      browser
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().startsWith('appdock://host/')),
    'host renderer',
  );
  dock.setDefaultTimeout(15000);
  await until(async () => (await snapshot()).startupReady, 'startup ready');
}
async function stop() {
  await dock.evaluate(() => {
    void window.dock.executeCommand('appdock.quit');
  });
  await until(() => child.exitCode !== null, 'portable shutdown');
  await browser.close().catch(() => {});
  browser = undefined;
  child = undefined;
}
const pages = () =>
  browser
    .contexts()
    .flatMap((c) => c.pages())
    .filter((p) => p.url().startsWith(`http://127.0.0.1:${port}/`));
async function open(id) {
  const before = new Set(pages());
  await dock.locator(`[data-ribbon-id="page:${id}:main"]`).click();
  return until(() => pages().find((p) => !before.has(p)), 'remote WebContents');
}
(async () => {
  await new Promise((r) => fixture.listen(0, '127.0.0.1', r));
  port = fixture.address().port;
  const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
  settings.host.hardwareAcceleration = false;
  settings.host.notifications = false;
  settings.globalShortcutCommands = [];
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
  const gmail = path.join(profile, '.appdock', 'web-accounts', 'at365.gmail', 'preserve.txt');
  fs.mkdirSync(path.dirname(gmail), { recursive: true });
  fs.writeFileSync(gmail, 'untouched Gmail data');
  await start();
  assert.equal((await snapshot()).version, require('../package.json').version);
  await dock.locator('[data-ribbon-id="extensions"]').click();
  await dock.getByRole('button', { name: 'WebAppletを追加', exact: true }).click();
  await dock.getByRole('button', { name: '＋ WebAppletを追加', exact: true }).click();
  await dock.getByLabel('WebAppletのURL', { exact: true }).fill(`http://127.0.0.1:${port}/start`);
  await dock.getByLabel('WebAppletの表示方法', { exact: true }).focus();
  await until(
    async () =>
      (await dock.getByLabel('WebAppletの名前', { exact: true }).inputValue()) === '単一EXEのWeb',
    'well-known defaults',
  );
  await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
  const s = await until(async () => {
    const s = await snapshot();
    return s.settings.value.webApplets.items.length ? s : null;
  }, 'saved WebApplet');
  const id = s.settings.value.webApplets.items[0].id;
  assert.equal(pages().length, 0);
  let web = await open(id);
  assert.deepEqual(await web.evaluate(() => [typeof require, typeof process, typeof window.dock]), [
    'undefined',
    'undefined',
    'undefined',
  ]);
  await web.getByLabel('保持する入力').fill('EXEで入力保持');
  await web.evaluate(() => (document.cookie = 'portable=retained; Max-Age=3600; SameSite=Lax'));
  await update((v) => {
    v.webApplets.items.find((a) => a.id === id).display = 'window';
  });
  await until(() => web.evaluate(() => innerWidth > 600), 'standalone layout');
  assert.equal(await web.getByLabel('保持する入力').inputValue(), 'EXEで入力保持');
  await web.screenshot({ path: path.join(profile, 'web-window.png') });
  await update((v) => {
    v.webApplets.items.find((a) => a.id === id).display = 'page';
  });
  await until(
    async () =>
      (await dock.locator(`[data-ribbon-id="page:${id}:main"]`).getAttribute('aria-current')) ===
      'page',
    'return to host page',
  );
  assert.equal(await web.getByLabel('保持する入力').inputValue(), 'EXEで入力保持');
  assert.equal(pages().length, 1);
  await web.screenshot({ path: path.join(profile, 'web-embedded.png') });
  await web.getByRole('link', { name: '次のページ', exact: true }).click();
  await until(() => web.url().endsWith('/next'), 'same-origin link');
  await dock.getByRole('button', { name: '戻る', exact: true }).click();
  await until(() => web.url().endsWith('/start'), 'host toolbar back');
  checks.push(
    'single portable EXE: UI registration, well-known JSON, lazy opening, remote isolation, page/window input and toolbar navigation',
  );
  const account = (await dock.evaluate(() => window.dock.createWebAccount('別アカウント'))).id,
    second = `web.${randomUUID()}`;
  await update((v) => {
    v.webApplets.items.push({
      ...v.webApplets.items.find((a) => a.id === id),
      id: second,
      accountId: account,
      name: '別枠のWeb',
    });
  });
  const other = await open(second);
  assert.ok(!(await other.evaluate(() => document.cookie)).includes('portable=retained'));
  assert.equal(fs.readFileSync(gmail, 'utf8'), 'untouched Gmail data');
  await stop();
  await start();
  web = await open(id);
  assert.ok((await web.evaluate(() => document.cookie)).includes('portable=retained'));
  await dock.evaluate((id) => window.dock.toggleExtension(id, false), id);
  await until(() => web.isClosed(), 'disable closes remote');
  assert.equal(fs.readFileSync(gmail, 'utf8'), 'untouched Gmail data');
  checks.push(
    'single portable EXE: multiple ribbons, account Cookie separation, restart persistence, disable disposal and Gmail storage preservation',
  );
  await stop();
  assert.equal(hash(executable), sha256);
  const result = { ok: true, version: require('../package.json').version, sha256, profile, checks };
  fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) {
      try {
        await dock.evaluate(() => {
          void window.dock.executeCommand('appdock.quit');
        });
        await until(() => child.exitCode !== null, 'cleanup exit');
      } catch {}
      await browser.close().catch(() => {});
    }
    if (child && child.exitCode === null) child.kill();
    await new Promise((r) => fixture.close(r));
  });

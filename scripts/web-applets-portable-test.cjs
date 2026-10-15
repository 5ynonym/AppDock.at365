const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const http = require('node:http'),
  net = require('node:net'),
  fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'),
  profile = path.join(root, '.artifacts', 'web-portable-' + Date.now());
const source = path.resolve(process.argv[2] || path.join(root, 'publish/AppDock.at365.exe'));
const executable = path.join(profile, 'AppDock.at365.exe');
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.mkdirSync(profile, { recursive: true });
fs.copyFileSync(source, executable);
const sha256 = hash(source);
assert.equal(hash(executable), sha256);
fs.cpSync(
  path.resolve(root, '../Applet.WebApplet.at365/publish/extensions/at365.web-applet'),
  path.join(profile, 'extensions/at365.web-applet'),
  { recursive: true },
);
const fixture = http.createServer((req, res) => {
  if (req.url === '/.well-known/appdock.json') {
    res.setHeader('content-type', 'application/json');
    return res.end(
      JSON.stringify({
        name: '配布物のWeb',
        start_url: '/start',
        appdock: { schemaVersion: 1, navigation: 'same-origin' },
      }),
    );
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('<h1>Portable fixture</h1><input aria-label="保持する入力"><a href="/next">次へ</a>');
});
const until = async (fn, label) => {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(label);
};
let browser, child, dock, port;
const checks = [];
const pages = () => browser.contexts().flatMap((c) => c.pages());
const snapshot = () => dock.evaluate(() => window.dock.snapshot());
async function start() {
  const probe = net.createServer();
  await new Promise((r) => probe.listen(0, '127.0.0.1', r));
  const debugPort = probe.address().port;
  await new Promise((r) => probe.close(r));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  child = spawn(executable, ['--test-profile=' + profile, '--remote-debugging-port=' + debugPort], {
    cwd: profile,
    env,
    windowsHide: true,
    stdio: 'ignore',
  });
  browser = await until(
    () => chromium.connectOverCDP('http://127.0.0.1:' + debugPort, { timeout: 1000 }),
    'CDP',
  );
  dock = await until(() => pages().find((p) => p.url().startsWith('appdock://host/')), 'host');
  await until(
    async () =>
      (await snapshot()).extensions.some(
        (e) => e.id === 'at365.web-applet' && e.state === 'running',
      ),
    'Applet running',
  );
}
async function stop() {
  await dock.evaluate(() => {
    void window.dock.executeCommand('appdock.quit');
  });
  await until(() => child.exitCode !== null, 'shutdown');
  await browser.close().catch(() => {});
  browser = child = null;
}
(async () => {
  try {
    await new Promise((r) => fixture.listen(0, '127.0.0.1', r));
    port = fixture.address().port;
    const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
    settings.host.hardwareAcceleration = false;
    settings.host.notifications = false;
    settings.globalShortcutCommands = [];
    settings.extensions['at365.web-applet'] = { enabled: true, settings: {} };
    fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
    await start();
    assert.equal((await snapshot()).version, require('../package.json').version);
    await dock.evaluate(() => window.dock.executeCommand('at365.web-applet.manage'));
    let ui = await until(
      () => pages().find((p) => p.url().endsWith('/at365.web-applet/web/index.html')),
      'manager',
    );
    await ui.getByRole('button', { name: 'サイトを追加', exact: true }).click();
    await ui.locator('[name=url]').fill('http://127.0.0.1:' + port + '/');
    await ui.getByRole('button', { name: 'Web側の推奨設定を取得', exact: true }).click();
    await until(
      async () => (await ui.locator('[name=name]').inputValue()) === '配布物のWeb',
      'metadata in Node',
    );
    await ui.locator('[name=name]').fill('手動名');
    await ui.getByRole('button', { name: 'Web側の推奨設定を取得', exact: true }).click();
    await until(
      async () => (await ui.locator('#discovery-message').textContent()).includes('読み込み'),
      'metadata again',
    );
    assert.equal(await ui.locator('[name=name]').inputValue(), '手動名');
    await ui.getByRole('button', { name: 'OK', exact: true }).click();
    await until(async () => !(await ui.locator('#editor').evaluate((e) => e.open)), 'saved');
    let s = await snapshot();
    const item = s.extensions.find((e) => e.displayName === '手動名');
    assert.ok(item.collection);
    checks.push('single EXE + external Node Applet; metadata and manual edits');
    await dock.evaluate((id) => window.dock.openAppletPage(id, 'main'), item.id);
    let remote = await until(
      () => pages().find((p) => p.url().startsWith('http://127.0.0.1:' + port)),
      'remote',
    );
    await remote.getByLabel('保持する入力').fill('保持');
    await remote.evaluate(() => {
      document.cookie = 'portable_login=retained; Max-Age=3600';
    });
    assert.deepEqual(
      await remote.evaluate(() => [typeof require, typeof window.appletPage, typeof window.dock]),
      ['undefined', 'undefined', 'undefined'],
    );
    await dock.evaluate(async (id) => {
      const s = await window.dock.snapshot();
      s.settings.value.extensions['at365.web-applet'].settings.items.find(
        (row) => row.id === id,
      ).display = 'window';
      await window.dock.saveSettings(s.settings.value, s.settings.revision);
    }, item.collection.itemId);
    assert.equal(await remote.getByLabel('保持する入力').inputValue(), '保持');
    checks.push('page/window preserves View; remote has no bridge');
    await stop();
    await start();
    await dock.evaluate((id) => window.dock.openAppletPage(id, 'main'), item.id);
    remote = await until(
      () => pages().find((p) => p.url().startsWith('http://127.0.0.1:' + port)),
      'restart page',
    );
    assert.ok((await remote.evaluate(() => document.cookie)).includes('portable_login=retained'));
    checks.push('restart preserves site, identity and real Cookie');
    await dock.evaluate(() => window.dock.executeCommand('at365.web-applet.manage'));
    ui = await until(
      () => pages().find((p) => p.url().endsWith('/at365.web-applet/web/index.html')),
      'manager restart',
    );
    for (const theme of ['light', 'dark']) {
      await dock.evaluate(async (theme) => {
        const s = await window.dock.snapshot();
        s.settings.value.host.theme = theme;
        await window.dock.saveSettings(s.settings.value, s.settings.revision);
      }, theme);
      await until(
        async () =>
          (await ui.locator('body').evaluate((e) => e.classList.contains('dark'))) ===
          (theme === 'dark'),
        'theme',
      );
      await until(async () => {
        if (!(await ui.evaluate(() => innerWidth > 100 && innerHeight > 100))) return false;
        await ui.screenshot({ path: path.join(profile, 'manager-' + theme + '.png') });
        return true;
      }, 'manager layout and screenshot');
    }
    await dock.evaluate(() => window.dock.toggleExtension('at365.web-applet', false));
    await until(
      () => !pages().some((p) => p.url().startsWith('http://127.0.0.1:' + port)),
      'stop cleanup',
    );
    checks.push('themes and parent stop cleanup');
    await stop();
    assert.equal(hash(executable), sha256);
    assert.equal(hash(source), sha256);
    fs.writeFileSync(
      path.join(profile, 'result.json'),
      JSON.stringify({ ok: true, sha256, checks }, null, 2),
    );
    console.log(JSON.stringify({ ok: true, profile, sha256, checks }));
  } catch (error) {
    console.error(error);
    fs.writeFileSync(
      path.join(profile, 'result.json'),
      JSON.stringify({ ok: false, error: String(error), checks }, null, 2),
    );
    if (browser && dock) await stop().catch(() => {});
    process.exitCode = 1;
  } finally {
    await new Promise((r) => fixture.close(r));
  }
})();

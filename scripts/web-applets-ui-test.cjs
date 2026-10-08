const { _electron: electron } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `web-applets-${Date.now()}`);
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.host.notifications = false;
settings.globalShortcutCommands = [];
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const gmailMarker = path.join(profile, '.appdock', 'web-accounts', 'at365.gmail', 'accounts.json');
fs.mkdirSync(path.dirname(gmailMarker), { recursive: true });
fs.writeFileSync(gmailMarker, '{"gmail":"preserve-this-authentication-area"}');
const markerBytes = fs.readFileSync(gmailMarker);
const checks = [];
let app, dock, port, otherPort;
let manifestName = 'オフラインWeb';
let png,
  otherRequests = 0;
const other = http.createServer((req, res) => {
  otherRequests++;
  res.end('<h1>Other origin</h1>');
});
const server = http.createServer((req, res) => {
  if (req.url === '/metadata-hop' || req.url === '/metadata-cross' || req.url === '/metadata-large')
    return res.end(`<link rel="manifest" href="${req.url.replace('metadata', 'manifest')}">`);
  if (req.url === '/manifest-hop') {
    res.writeHead(302, { location: '/assets/manifest.json' });
    return res.end();
  }
  if (req.url === '/manifest-cross') {
    res.writeHead(302, { location: `http://127.0.0.1:${otherPort}/private-manifest` });
    return res.end();
  }
  if (req.url === '/manifest-large') return res.end(JSON.stringify({ name: 'x'.repeat(70000) }));
  if (req.url === '/assets/manifest.json')
    return res.end(
      JSON.stringify({
        name: '転送先の設定',
        start_url: '../start',
        icons: [{ src: '../icon.png' }],
      }),
    );
  if (req.url === '/manifest.json') {
    res.setHeader('content-type', 'application/manifest+json');
    return res.end(
      JSON.stringify({
        name: manifestName,
        start_url: '/start',
        icons: [{ src: '/icon.png' }],
        appdock: {
          schemaVersion: 1,
          navigation: 'none',
          accountId: 'at365.gmail',
          commands: ['unsafe'],
        },
      }),
    );
  }
  if (req.url === '/icon.png') {
    res.setHeader('content-type', 'image/png');
    return res.end(png);
  }
  if (req.url === '/redirect') {
    res.writeHead(302, { location: `http://127.0.0.1:${otherPort}/` });
    return res.end();
  }
  res.setHeader('content-type', 'text/html');
  res.end(
    `<!doctype html><link rel="manifest" href="/manifest.json"><h1>Web fixture</h1><input id="keep"><a id="inside" href="/other">Inside</a><a id="outside" href="http://127.0.0.1:${otherPort}/">Outside</a><a id="redirect" href="/redirect">Redirect</a><button id="popup" onclick="window.open('http://127.0.0.1:${otherPort}/')">Popup</button>`,
  );
});
const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', r));
async function until(fn, label) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(label);
}
const snapshot = () => dock.evaluate(() => window.dock.snapshot());
const update = async (fn, arg) => {
  const s = await snapshot();
  fn(s.settings.value, arg);
  return dock.evaluate(({ value, revision }) => window.dock.saveSettings(value, revision), {
    value: s.settings.value,
    revision: s.settings.revision,
  });
};
async function start() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({
    executablePath: process.argv[2] ? path.resolve(process.argv[2]) : require('electron'),
    args: [...(process.argv[2] ? [] : [root]), `--test-profile=${profile}`],
    env,
  });
  dock = await app.firstWindow();
  dock.setDefaultTimeout(15000);
  await until(async () => (await snapshot()).startupReady, 'startup');
}
async function remote(id) {
  await dock.evaluate((id) => window.dock.openAppletPage(id, 'main'), id);
  return until(
    () =>
      app
        .context()
        .pages()
        .find((p) => p.url().startsWith(`http://127.0.0.1:${port}/`)),
    'remote page',
  );
}
(async () => {
  await listen(other);
  otherPort = other.address().port;
  await listen(server);
  port = server.address().port;
  await start();
  png = Buffer.from(
    await app.evaluate(({ nativeImage }) =>
      Array.from(
        nativeImage
          .createFromBitmap(Buffer.alloc(16 * 16 * 4, 255), { width: 16, height: 16 })
          .toPNG(),
      ),
    ),
  );
  const redirected = await dock.evaluate(
    (url) => window.dock.webDefaults(url),
    `http://127.0.0.1:${port}/metadata-hop`,
  );
  assert.equal(redirected.name, '転送先の設定');
  assert.equal(redirected.url, `http://127.0.0.1:${port}/start`);
  assert.ok(redirected.icon);
  const externalRequests = otherRequests;
  const forbidden = await dock.evaluate(
    (url) => window.dock.webDefaults(url),
    `http://127.0.0.1:${port}/metadata-cross`,
  );
  assert.equal(forbidden.name, undefined);
  assert.equal(otherRequests, externalRequests);
  const oversized = await dock.evaluate(
    (url) => window.dock.webDefaults(url),
    `http://127.0.0.1:${port}/metadata-large`,
  );
  assert.equal(oversized.name, undefined);
  checks.push(
    'metadata follows bounded same-origin redirects and resolves final manifest paths; external redirects and oversized JSON denied before import',
  );
  await dock.locator('[data-ribbon-id="extensions"]').click();
  await dock.getByRole('button', { name: 'WebAppletを追加', exact: true }).click();
  await dock.getByRole('button', { name: '＋ WebAppletを追加', exact: true }).click();
  await dock.getByLabel('WebAppletのURL', { exact: true }).fill(`http://127.0.0.1:${port}/start`);
  await dock.getByLabel('WebAppletの表示方法', { exact: true }).focus();
  await until(
    async () =>
      (await dock.getByLabel('WebAppletの名前', { exact: true }).inputValue()) === 'オフラインWeb',
    'automatic manifest defaults',
  );
  await until(
    async () =>
      (await dock.getByLabel('WebAppletのページ遷移', { exact: true }).inputValue()) === 'none',
    'manifest navigation',
  );
  await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
  let s = await until(async () => {
    const s = await snapshot();
    return s.settings.value.webApplets.items.length ? s : null;
  }, 'save new applet');
  const id = s.settings.value.webApplets.items[0].id,
    accountId = s.settings.value.webApplets.accounts[0].id;
  assert.ok(s.settings.value.webApplets.items[0].icon.startsWith('data:image/png;base64,'));
  assert.equal(s.extensions.find((a) => a.id === id).runtime, 'web');
  checks.push(
    'UI add, automatic standard manifest name/icon/navigation, saved virtual Applet and ribbon',
  );
  await dock.getByRole('button', { name: 'アカウント枠を追加', exact: true }).click();
  await dock.locator('.web-account-row input').last().fill('予備のアカウント');
  assert.equal(
    await dock
      .locator('.web-account-row')
      .first()
      .getByRole('button', { name: '枠の登録を削除', exact: true })
      .isDisabled(),
    true,
  );
  await dock.getByLabel('WebAppletの名前', { exact: true }).fill('ユキのWeb');
  await dock.getByLabel('WebAppletのページ遷移', { exact: true }).selectOption('same-origin');
  manifestName = 'Web側の変更';
  await dock.getByRole('button', { name: 'Web側の推奨設定を取得', exact: true }).click();
  await until(
    () =>
      dock
        .getByRole('status')
        .textContent()
        .then((t) => t.includes('内容を確認')),
    'refresh defaults',
  );
  assert.equal(await dock.getByLabel('WebAppletの名前', { exact: true }).inputValue(), 'ユキのWeb');
  assert.equal(
    await dock.getByLabel('WebAppletのページ遷移', { exact: true }).inputValue(),
    'same-origin',
  );
  await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
  await until(
    async () => (await snapshot()).settings.value.webApplets.items[0].name === 'ユキのWeb',
    'save manual overrides',
  );
  checks.push('manual name/navigation override survives explicit defaults refresh');
  let web = await remote(id);
  const wcId = await app.evaluate(
    ({ webContents }, url) => webContents.getAllWebContents().find((w) => w.getURL() === url).id,
    web.url(),
  );
  assert.deepEqual(
    await web.evaluate(() => [
      typeof window.dock,
      typeof window.appletPage,
      typeof require,
      typeof process,
    ]),
    ['undefined', 'undefined', 'undefined', 'undefined'],
  );
  await web.locator('#keep').fill('保持する入力');
  await web.evaluate(() => (document.cookie = 'proof=first; Max-Age=3600; SameSite=Lax'));
  await update((v, id) => {
    v.webApplets.items.find((a) => a.id === id).display = 'window';
  }, id);
  await until(
    async () =>
      app.evaluate(
        ({ webContents }, id) => webContents.fromId(id)?.getOwnerBrowserWindow()?.isVisible(),
        wcId,
      ),
    'standalone',
  );
  assert.equal(await web.locator('#keep').inputValue(), '保持する入力');
  await update((v, id) => {
    v.webApplets.items.find((a) => a.id === id).display = 'page';
  }, id);
  await until(
    async () => app.evaluate(({ webContents }, id) => webContents.fromId(id)?.id === id, wcId),
    'same contents',
  );
  checks.push(
    'remote has no Node/host bridge; page/window/page keeps WebContents, input and session',
  );
  await web.locator('#inside').click();
  await until(() => web.url().endsWith('/other'), 'same origin navigation');
  await web.locator('#outside').click({ noWaitAfter: true });
  await until(async () => (await snapshot()).webPages[id].error, 'cross-origin block');
  assert.ok(web.url().endsWith('/other'));
  await web.evaluate(() => document.querySelector('#redirect').click());
  await until(async () => (await snapshot()).webPages[id].error, 'redirect blocked');
  assert.ok(!web.url().includes(String(otherPort)));
  await web.evaluate(() => document.querySelector('#popup').click());
  assert.equal(
    app
      .context()
      .pages()
      .some((p) => p.url().includes(String(otherPort))),
    false,
  );
  await update((v, id) => {
    v.webApplets.items.find((a) => a.id === id).navigation = 'none';
  }, id);
  await dock.evaluate((id) => window.dock.webNavigate(id, 'home'), id);
  await until(() => web.url().endsWith('/start'), 'home');
  await web.evaluate(() => document.querySelector('#inside').click());
  await until(async () => (await snapshot()).webPages[id].error, 'fixed page blocked');
  assert.ok(web.url().endsWith('/start'));
  await update((v, id) => {
    v.webApplets.items.find((a) => a.id === id).navigation = 'same-origin';
  }, id);
  checks.push(
    'same-origin links work; different ports, redirects and popups blocked; fixed-page mode blocks links',
  );
  await update(
    (v, { id, otherPort }) => {
      v.webApplets.items.find((a) => a.id === id).allowedOrigins = [
        `http://127.0.0.1:${otherPort}`,
      ];
    },
    { id, otherPort },
  );
  await web.evaluate(() => document.querySelector('#outside').click());
  await until(() => web.url().includes(String(otherPort)), 'explicit allowed origin');
  await dock.evaluate((id) => window.dock.webNavigate(id, 'back'), id);
  await until(() => web.url().endsWith('/start'), 'history back');
  await dock.evaluate((id) => window.dock.webNavigate(id, 'forward'), id);
  await until(() => web.url().includes(String(otherPort)), 'history forward');
  await dock.evaluate((id) => window.dock.webNavigate(id, 'home'), id);
  await until(() => web.url().endsWith('/start'), 'return home');
  await update((v, id) => {
    const item = v.webApplets.items.find((a) => a.id === id);
    item.allowedOrigins = [];
    item.navigation = 'any';
    v.shortcuts[`${id}.home`] = ['Alt+H'];
  }, id);
  await web.evaluate(() => document.querySelector('#outside').click());
  await until(() => web.url().includes(String(otherPort)), 'explicit any navigation');
  await app.evaluate(({ webContents }, id) => {
    const wc = webContents.fromId(id);
    wc.focus();
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'H', modifiers: ['alt'] });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'H', modifiers: ['alt'] });
  }, wcId);
  await until(() => web.url().endsWith('/start'), 'Web focused local shortcut');
  await update((v, id) => {
    v.webApplets.items.find((a) => a.id === id).navigation = 'same-origin';
  }, id);
  checks.push(
    'UI account add/rename/use guard; explicit extra origins, any mode, back/forward/home and focused Web shortcuts',
  );
  const second = `account.${randomUUID()}`;
  await update(
    (v, { id, second }) => {
      v.webApplets.accounts.push({ id: second, name: '仕事用' });
      v.webApplets.items.find((a) => a.id === id).accountId = second;
    },
    { id, second },
  );
  web = await remote(id);
  assert.ok(!(await web.evaluate(() => document.cookie)).includes('proof=first'));
  await web.evaluate(() => (document.cookie = 'proof=second; Max-Age=3600; SameSite=Lax'));
  await update(
    (v, { id, accountId }) => {
      v.webApplets.items.find((a) => a.id === id).accountId = accountId;
    },
    { id, accountId },
  );
  web = await remote(id);
  assert.ok((await web.evaluate(() => document.cookie)).includes('proof=first'));
  const copied = `web.${randomUUID()}`;
  await update(
    (v, { id, copied }) =>
      v.webApplets.items.push({
        ...v.webApplets.items.find((a) => a.id === id),
        id: copied,
        name: '同じアカウントのページ',
      }),
    { id, copied },
  );
  await dock.evaluate((id) => window.dock.openAppletPage(id, 'main'), copied);
  const remotes = app
    .context()
    .pages()
    .filter((p) => p.url().startsWith(`http://127.0.0.1:${port}/`));
  assert.equal(remotes.length, 2);
  for (const p of remotes)
    assert.ok((await p.evaluate(() => document.cookie)).includes('proof=first'));
  assert.deepEqual(fs.readFileSync(gmailMarker), markerBytes);
  checks.push(
    'different Web profiles isolate Cookies; same Web profile shares Cookies; Gmail storage untouched',
  );
  await dock.locator('[data-ribbon-id="settings"]').click();
  await dock.getByRole('button', { name: 'WebApplet', exact: true }).click();
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().startsWith('appdock://host/'),
    );
    w.unmaximize();
    w.setSize(1000, 780);
  });
  await until(() => dock.evaluate(() => innerWidth <= 1000), 'compact width');
  await dock.screenshot({ path: path.join(profile, 'settings-dark.png') });
  await update((v) => {
    v.host.theme = 'light';
  });
  await until(
    () => dock.evaluate(() => document.documentElement.dataset.theme === 'light'),
    'light theme rendered',
  );
  await dock.screenshot({ path: path.join(profile, 'settings-light.png') });
  await app.close();
  app = undefined;
  await start();
  web = await remote(id);
  assert.ok((await web.evaluate(() => document.cookie)).includes('proof=first'));
  await app.evaluate(({ dialog }) => {
    globalThis.webTestDialog = dialog.showMessageBox;
    dialog.showMessageBox = async (options) => {
      if (options.defaultId !== 0 || options.cancelId !== 0 || options.buttons.length !== 2)
        throw Error('Unsafe clear dialog');
      return { response: 0, checkboxChecked: false };
    };
  });
  await dock.evaluate((id) => window.dock.clearWebAccount(id), accountId);
  assert.ok(!web.isClosed());
  assert.ok((await web.evaluate(() => document.cookie)).includes('proof=first'));
  await dock.evaluate((id) => window.dock.openAppletPage(id, 'main'), copied);
  const shared = app
    .context()
    .pages()
    .filter((p) => p.url().startsWith(`http://127.0.0.1:${port}/`));
  assert.equal(shared.length, 2);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  });
  await dock.evaluate((id) => window.dock.clearWebAccount(id), accountId);
  await until(() => shared.every((p) => p.isClosed()), 'clear shared views');
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = globalThis.webTestDialog;
    delete globalThis.webTestDialog;
  });
  web = await remote(id);
  assert.ok(!(await web.evaluate(() => document.cookie)).includes('proof=first'));
  await update(
    (v, { id, second }) => {
      v.webApplets.items.find((a) => a.id === id).accountId = second;
    },
    { id, second },
  );
  web = await remote(id);
  assert.ok((await web.evaluate(() => document.cookie)).includes('proof=second'));
  assert.deepEqual(fs.readFileSync(gmailMarker), markerBytes);
  checks.push(
    'account clear confirmation cancellation preserves data; confirmed clear closes shared views and clears only that Web account',
  );
  await dock.evaluate((id) => window.dock.toggleExtension(id, false), id);
  await until(() => web.isClosed(), 'disable closes view');
  await dock.evaluate((id) => window.dock.toggleExtension(id, true), id);
  web = await remote(id);
  await update((v, id) => {
    v.webApplets.items = v.webApplets.items.filter((a) => a.id !== id);
  }, id);
  await until(() => web.isClosed(), 'delete closes view');
  assert.deepEqual(fs.readFileSync(gmailMarker), markerBytes);
  checks.push(
    'restart retains cookies/settings; disable/delete destroys the right view; Gmail storage still unchanged',
  );
  assert.ok(!(await snapshot()).logs.some((x) => x.level === 'error' && x.source === 'host'));
  await app.close();
  app = undefined;
  fs.writeFileSync(
    path.join(profile, 'result.json'),
    JSON.stringify({ ok: true, checks, profile }, null, 2),
  );
  console.log(JSON.stringify({ ok: true, checks, profile }, null, 2));
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (app) await app.close().catch(() => {});
    await Promise.all([new Promise((r) => server.close(r)), new Promise((r) => other.close(r))]);
  });

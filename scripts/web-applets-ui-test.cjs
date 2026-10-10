const { _electron: electron } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.artifacts', `web-applets-${Date.now()}`);
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.host.notifications = false;
settings.globalShortcutCommands = [];
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const gmailMarker = path.join(profile, 'data', 'web-accounts', 'at365.gmail', 'accounts.json');
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
const manageWeb = async () => {
  await dock.locator('[data-ribbon-id="extensions"]').click();
  await dock
    .locator('.applet-select')
    .filter({ has: dock.locator('span[title="WebApplet"]') })
    .click();
  await dock.getByRole('tab', { name: '設定', exact: true }).click();
};
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
  await dock.getByRole('tab', { name: 'ショートカット', exact: true }).click();
  await dock.getByLabel('既定のショートカット1', { exact: true }).press('Control+F6');
  await dock.getByLabel('既定の割り当て2を有効にする', { exact: true }).uncheck();
  await dock.getByRole('tab', { name: '設定', exact: true }).click();
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
    accountId = s.webAccounts[0].id;
  assert.deepEqual(
    s.settings.value.keybindings
      .filter((binding) => binding.command.startsWith(`${id}.`))
      .map((binding) => [binding.command, binding.key, binding.enabled, binding.when.scope]),
    [
      [`${id}.reload`, 'Ctrl+F6', true, 'owner'],
      [`${id}.back`, 'Alt+Left', false, 'owner'],
      [`${id}.forward`, 'Alt+Right', true, 'owner'],
    ],
  );
  assert.ok(s.settings.value.webApplets.items[0].icon.startsWith('data:image/png;base64,'));
  assert.equal(s.extensions.find((a) => a.id === id).runtime, 'web');
  checks.push(
    'UI template edits copy into new WebApplet bindings; automatic manifest name/icon/navigation, saved virtual Applet and ribbon',
  );
  assert.equal(await dock.locator('.web-account-row').count(), 0);
  assert.equal(
    await dock.getByRole('button', { name: 'アカウント枠を追加', exact: true }).count(),
    0,
  );
  await dock.getByLabel('WebAppletの名前', { exact: true }).fill('編集中のWeb');
  const beforeAccounts = await snapshot(),
    settingsBytes = fs.readFileSync(path.join(profile, 'settings.json'));
  const accountFile = path.join(profile, 'data', 'web-applets', 'accounts.json');
  await dock.getByRole('button', { name: 'Webアカウントを管理', exact: true }).click();
  await dock.getByRole('heading', { name: 'Webアカウント', exact: true }).waitFor();
  const originalAccountFile = fs.readFileSync(accountFile);
  const initialName = (await snapshot()).webAccounts[0].name;
  const initialInput = dock.locator('.web-account-row').first().locator('input');
  await initialInput.fill('Escapeで破棄する名前');
  await initialInput.press('Escape');
  assert.equal(await initialInput.inputValue(), initialName);
  await initialInput.press('Tab');
  assert.deepEqual(fs.readFileSync(accountFile), originalAccountFile);
  assert.equal(
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).count(),
    1,
  );
  await dock.getByRole('button', { name: 'アカウント枠を追加', exact: true }).click();
  await until(async () => (await snapshot()).webAccounts.length === 2, 'immediate add');
  await until(
    async () => (await dock.locator('.web-account-row').count()) === 2,
    'new account row rendered',
  );
  await dock.locator('.web-account-row').last().locator('input').fill('予備のアカウント');
  await dock
    .locator('.web-account-row')
    .last()
    .getByRole('button', { name: '名前を変更', exact: true })
    .click();
  await until(
    async () => (await snapshot()).webAccounts[1].name === '予備のアカウント',
    'immediate rename',
  );
  const spareInput = dock.locator('.web-account-row').last().locator('input');
  await spareInput.fill('Enterで確定');
  await spareInput.press('Enter');
  await spareInput.press('Tab');
  await until(
    async () => (await snapshot()).webAccounts[1].name === 'Enterで確定',
    'Enter and blur keep the confirmed name',
  );
  await spareInput.fill('予備のアカウント');
  await dock.getByRole('heading', { name: 'Webアカウント', exact: true }).click();
  await until(
    async () => (await snapshot()).webAccounts[1].name === '予備のアカウント',
    'mouse focus loss commits the name',
  );
  await dock.locator('.web-account-row').first().locator('input').fill('個人用（変更）');
  await dock.locator('.web-account-row').first().locator('input').press('Tab');
  await until(
    async () => (await snapshot()).webAccounts[0].name === '個人用（変更）',
    'rename used account on focus loss',
  );
  await until(
    async () =>
      (await dock.locator('.web-account-row input').first().getAttribute('aria-label')) ===
      'アカウント名 個人用（変更）',
    'renamed account rendered',
  );
  const categories = dock.locator('.settings-categories .sidebar-extensions').first();
  assert.equal(
    await categories
      .getByRole('button', { name: /^Webアカウント/ })
      .locator('.unsaved-mark')
      .count(),
    0,
  );
  assert.equal(await categories.getByRole('button', { name: /^WebApplet/ }).count(), 0);
  await dock.getByText('未保存の変更があります', { exact: true }).waitFor();
  assert.equal(
    await dock
      .getByRole('button', { name: 'ログイン情報をクリア', exact: true })
      .first()
      .isDisabled(),
    false,
  );
  assert.equal(
    await dock
      .locator('.web-account-row')
      .first()
      .getByRole('button', { name: '枠を削除', exact: true })
      .isDisabled(),
    true,
  );
  await manageWeb();
  assert.equal(
    await dock.getByLabel('WebAppletの名前', { exact: true }).inputValue(),
    '編集中のWeb',
  );
  assert.equal(
    await dock
      .getByLabel('WebAppletのアカウント', { exact: true })
      .locator('option:checked')
      .textContent(),
    '個人用（変更）',
  );
  await dock.locator('[data-ribbon-id="settings"]').click();
  await categories.getByRole('button', { name: /^一般/ }).click();
  await dock.getByRole('button', { name: 'JSON', exact: true }).click();
  const validJson = await dock.getByLabel('設定JSON', { exact: true }).inputValue(),
    invalidJson = '{unfinished settings';
  await dock.getByLabel('設定JSON', { exact: true }).fill(invalidJson);
  await categories.getByRole('button', { name: /^Webアカウント/ }).click();
  await dock.getByRole('button', { name: 'アカウント枠を追加', exact: true }).click();
  await until(
    async () => (await snapshot()).webAccounts.length === 3,
    'add while invalid settings JSON',
  );
  await until(
    async () => (await dock.locator('.web-account-row').count()) === 3,
    'third account row rendered',
  );
  const beforeDelete = fs.readFileSync(accountFile);
  const unusedId = (await snapshot()).webAccounts[2].id;
  const unusedPath = path.join(profile, 'data', 'web-applets', 'sessions', unusedId);
  fs.mkdirSync(path.join(unusedPath, 'Cache'), { recursive: true });
  fs.writeFileSync(path.join(unusedPath, 'Cache', 'fixture'), 'remove this entire folder');
  await app.evaluate(({ dialog }) => {
    globalThis.webTestDialog = dialog.showMessageBox;
    dialog.showMessageBox = async (options) => {
      if (
        options.type !== 'warning' ||
        options.defaultId !== 0 ||
        options.cancelId !== 0 ||
        options.buttons.length !== 2
      )
        throw Error('Unsafe account warning');
      return { response: 0, checkboxChecked: false };
    };
  });
  await dock
    .locator('.web-account-row')
    .last()
    .getByRole('button', { name: '枠を削除', exact: true })
    .click();
  await until(
    () =>
      dock
        .locator('.web-account-settings [role="status"]')
        .textContent()
        .then((t) => t.includes('キャンセル')),
    'cancel account deletion',
  );
  assert.equal((await snapshot()).webAccounts.length, 3);
  assert.deepEqual(fs.readFileSync(accountFile), beforeDelete);
  assert.ok(fs.existsSync(unusedPath));
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async (options) => {
      if (options.type !== 'warning') throw Error('Missing warning');
      return { response: 1, checkboxChecked: false };
    };
  });
  await dock
    .locator('.web-account-row')
    .last()
    .getByRole('button', { name: '枠を削除', exact: true })
    .click();
  await until(
    async () => (await snapshot()).webAccounts.length === 2,
    'confirmed immediate deletion',
  );
  assert.equal(fs.existsSync(unusedPath), false);
  assert.ok(!JSON.parse(fs.readFileSync(accountFile)).pendingDeletion.includes(unusedId));
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = globalThis.webTestDialog;
    delete globalThis.webTestDialog;
  });
  assert.equal((await snapshot()).settings.revision, beforeAccounts.settings.revision);
  assert.deepEqual(fs.readFileSync(path.join(profile, 'settings.json')), settingsBytes);
  assert.equal(JSON.parse(settingsBytes).webApplets.accounts, undefined);
  assert.equal(JSON.parse(fs.readFileSync(accountFile)).accounts[0].name, '個人用（変更）');
  await dock
    .locator('.settings-categories')
    .getByRole('button', { name: 'ショートカット', exact: true })
    .click();
  assert.equal(await dock.getByLabel('設定JSON', { exact: true }).inputValue(), invalidJson);
  await categories.getByRole('button', { name: /^Webアカウント/ }).click();
  await categories.getByRole('button', { name: /^一般/ }).click();
  assert.equal(await dock.getByLabel('設定JSON', { exact: true }).inputValue(), invalidJson);
  await dock.getByLabel('設定JSON', { exact: true }).fill(validJson);
  await dock.getByRole('button', { name: 'フォーム', exact: true }).click();
  await manageWeb();
  await dock.getByLabel('WebAppletの名前', { exact: true }).fill('ユキのWeb');
  await dock.getByLabel('WebAppletのページ遷移', { exact: true }).selectOption('same-origin');
  manifestName = 'Web側の変更';
  await dock.getByRole('button', { name: 'Web側の推奨設定を取得', exact: true }).click();
  await until(
    () =>
      dock
        .locator('.web-applet-settings [role="status"]')
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
  assert.equal((await snapshot()).webAccounts[0].name, '個人用（変更）');
  await dock.locator('[data-ribbon-id="extensions"]').click();
  await dock.getByRole('tab', { name: '設定', exact: true }).click();
  assert.equal(await dock.locator('.web-account-row').count(), 0);
  await dock.getByRole('button', { name: 'Webアカウントを管理', exact: true }).click();
  await dock.getByRole('heading', { name: 'Webアカウント', exact: true }).waitFor();
  checks.push(
    'independent account page and file: immediate add/rename/delete, cancellation/confirmation warnings, used-account guard, unchanged settings revision/bytes and retained valid/invalid drafts',
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
    v.keybindings.push({
      id: 'web-test.home',
      command: `${id}.home`,
      key: 'Alt+H',
      enabled: true,
      when: { scope: 'owner', appletIds: [] },
    });
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
  const second = (await dock.evaluate(() => window.dock.createWebAccount('仕事用'))).id;
  await update(
    (v, { id, second }) => {
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
  await manageWeb();
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().startsWith('appdock://host/'),
    );
    w.unmaximize();
    w.setSize(1000, 780);
  });
  await until(() => dock.evaluate(() => innerWidth <= 1000), 'compact width');
  await dock.screenshot({ path: path.join(profile, 'settings-dark.png') });
  await dock.locator('[data-ribbon-id="settings"]').click();
  await categories.getByRole('button', { name: /^Webアカウント/ }).click();
  await dock.screenshot({ path: path.join(profile, 'accounts-dark.png') });
  await update((v) => {
    v.host.theme = 'light';
  });
  await until(
    () => dock.evaluate(() => document.documentElement.dataset.theme === 'light'),
    'light theme rendered',
  );
  await dock.screenshot({ path: path.join(profile, 'accounts-light.png') });
  await manageWeb();
  await dock.screenshot({ path: path.join(profile, 'settings-light.png') });
  await app.close();
  app = undefined;
  await start();
  web = await remote(id);
  assert.ok((await web.evaluate(() => document.cookie)).includes('proof=first'));
  await app.evaluate(({ dialog }) => {
    globalThis.webTestDialog = dialog.showMessageBox;
    dialog.showMessageBox = async (options) => {
      if (
        options.type !== 'warning' ||
        options.defaultId !== 0 ||
        options.cancelId !== 0 ||
        options.buttons.length !== 2
      )
        throw Error('Unsafe clear dialog');
      return { response: 0, checkboxChecked: false };
    };
  });
  await dock.locator('[data-ribbon-id="settings"]').click();
  await dock
    .locator('.settings-categories')
    .getByRole('button', { name: /^Webアカウント/ })
    .click();
  await dock.getByRole('button', { name: 'ログイン情報をクリア', exact: true }).first().click();
  await until(
    () =>
      dock
        .locator('.web-account-settings [role="status"]')
        .textContent()
        .then((t) => t.includes('キャンセル')),
    'cancel clear from account page',
  );
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
  await dock.locator('[data-ribbon-id="settings"]').click();
  await dock
    .locator('.settings-categories')
    .getByRole('button', { name: /^Webアカウント/ })
    .click();
  await dock.getByRole('button', { name: 'ログイン情報をクリア', exact: true }).first().click();
  await until(() => shared.every((p) => p.isClosed()), 'clear shared views');
  await until(
    () =>
      dock
        .locator('.web-account-settings [role="status"]')
        .textContent()
        .then((t) => t.includes('クリアしました')),
    'clear data completed',
  );
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
  const ribbonId = `page:${id}:main`;
  await update((v, ribbonId) => {
    v.ribbon.order = [ribbonId, ...v.ribbon.order.filter((key) => key !== ribbonId)];
    v.ribbon.bottom = [...v.ribbon.bottom.filter((key) => key !== ribbonId), ribbonId];
  }, ribbonId);
  const ribbonPreferences = structuredClone((await snapshot()).settings.value.ribbon);
  await until(
    async () =>
      (await dock
        .locator('.ribbon-bottom [data-ribbon-id]')
        .first()
        .getAttribute('data-ribbon-id')) === ribbonId,
    'saved ribbon placement rendered',
  );
  const ribbonOrder = () =>
    dock
      .locator('.ribbon-buttons [data-ribbon-id]')
      .evaluateAll((items) => items.map((item) => item.dataset.ribbonId));
  const beforeStop = await ribbonOrder();
  assert.ok(beforeStop.includes(ribbonId));
  await dock.locator('[data-ribbon-id="extensions"]').click();
  await dock
    .locator('.sidebar-extensions')
    .getByRole('button', { name: /^ユキのWeb/ })
    .click();
  const toggle = dock.getByRole('switch', { name: 'ユキのWebを有効にする', exact: true });
  await toggle.click();
  await until(() => web.isClosed(), 'disable closes view');
  await until(
    async () => (await dock.locator(`[data-ribbon-id="${ribbonId}"]`).count()) === 0,
    'disabled WebApplet ribbon disappears',
  );
  assert.equal(await dock.locator(`[data-ribbon-id="page:${copied}:main"]`).count(), 1);
  assert.deepEqual((await snapshot()).settings.value.ribbon, ribbonPreferences);
  await toggle.click();
  await until(
    async () => (await dock.locator(`[data-ribbon-id="${ribbonId}"]`).count()) === 1,
    'enabled WebApplet ribbon returns',
  );
  assert.deepEqual(await ribbonOrder(), beforeStop);
  await dock.locator(`[data-ribbon-id="${ribbonId}"]`).click();
  web = await until(
    () =>
      app
        .context()
        .pages()
        .find((p) => p.url().startsWith(`http://127.0.0.1:${port}/`)),
    'reopened from restored ribbon',
  );
  assert.ok((await web.evaluate(() => document.cookie)).includes('proof=second'));
  checks.push(
    'Applet page stop hides only the disabled WebApplet ribbon; resume restores saved order/placement and opens without error',
  );
  await update((v, id) => {
    v.webApplets.items = v.webApplets.items.filter((a) => a.id !== id);
  }, id);
  await until(() => web.isClosed(), 'delete closes view');
  assert.deepEqual(fs.readFileSync(gmailMarker), markerBytes);
  checks.push(
    'restart retains cookies/settings; disable/delete destroys the right view; Gmail storage still unchanged',
  );
  const survivor = await remote(copied);
  await survivor.evaluate(() => (document.cookie = 'proof=survivor; Max-Age=3600; SameSite=Lax'));
  const removedPath = path.join(profile, 'data', 'web-applets', 'sessions', second);
  const beforeDeletionSettings = fs.readFileSync(path.join(profile, 'settings.json'));
  await dock.locator('[data-ribbon-id="settings"]').click();
  await dock
    .locator('.settings-categories')
    .getByRole('button', { name: /^Webアカウント/ })
    .click();
  await app.evaluate(({ dialog }) => {
    globalThis.webTestDialog = dialog.showMessageBox;
    dialog.showMessageBox = async (options) => {
      assertWarning(options);
      return { response: 0, checkboxChecked: false };
      function assertWarning(options) {
        if (
          options.type !== 'warning' ||
          options.defaultId !== 0 ||
          !options.detail.includes('元に戻せません')
        )
          throw Error('Missing destructive deletion warning');
      }
    };
  });
  const removeRow = dock
    .locator('.web-account-card')
    .filter({ has: dock.getByLabel('アカウント名 仕事用', { exact: true }) });
  await removeRow.getByRole('button', { name: '枠を削除', exact: true }).click();
  await until(
    () =>
      dock
        .locator('.web-account-settings [role="status"]')
        .textContent()
        .then((t) => t.includes('キャンセル')),
    'cancel real account deletion',
  );
  assert.ok(fs.existsSync(removedPath));
  assert.ok((await snapshot()).webAccounts.some((a) => a.id === second));
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
  });
  await removeRow.getByRole('button', { name: '枠を削除', exact: true }).click();
  await until(
    () =>
      dock
        .locator('.web-account-settings [role="status"]')
        .textContent()
        .then((t) => t.includes('次回起動')),
    'deferred physical cleanup notice',
  );
  assert.ok(!(await snapshot()).webAccounts.some((a) => a.id === second));
  assert.ok(JSON.parse(fs.readFileSync(accountFile)).pendingDeletion.includes(second));
  const deletedCookies = await app.evaluate(
    async ({ session }, target) => session.fromPath(target).cookies.get({ name: 'proof' }),
    removedPath,
  );
  assert.equal(deletedCookies.length, 0);
  assert.equal(await survivor.evaluate(() => document.cookie.includes('proof=survivor')), true);
  assert.deepEqual(fs.readFileSync(path.join(profile, 'settings.json')), beforeDeletionSettings);
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = globalThis.webTestDialog;
    delete globalThis.webTestDialog;
  });
  assert.ok(!(await snapshot()).logs.some((x) => x.level === 'error' && x.source === 'host'));
  await app.close();
  app = undefined;
  await start();
  assert.equal(fs.existsSync(removedPath), false);
  assert.ok(!JSON.parse(fs.readFileSync(accountFile)).pendingDeletion.includes(second));
  assert.deepEqual(fs.readFileSync(gmailMarker), markerBytes);
  const retained = await remote(copied);
  assert.ok((await retained.evaluate(() => document.cookie)).includes('proof=survivor'));
  assert.ok(!(await snapshot()).logs.some((x) => x.level === 'error' && x.source === 'host'));
  await app.close();
  app = undefined;
  checks.push(
    'account deletion cancels safely or clears real Cookies; tracked session files disappear on next startup while other account/Gmail data survive',
  );
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

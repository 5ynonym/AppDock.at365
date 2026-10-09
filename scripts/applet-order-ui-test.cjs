const { _electron: electron, chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `applet-order-${Date.now()}`);
const settings = require('../out/main/shared/settings-schema.js').createDefaultSettings();
settings.host.notifications = false;
settings.host.hardwareAcceleration = false;
settings.keybindings = [
  {
    id: 'first',
    command: 'test.a.run',
    key: 'Ctrl+F8',
    enabled: true,
    when: { scope: 'app', appletIds: [] },
  },
  {
    id: 'second',
    command: 'test.b.run',
    key: 'Ctrl+F8',
    enabled: true,
    when: { scope: 'app', appletIds: [] },
  },
];
settings.appletOrder = ['test.a', 'test.b'];
settings.webApplets.accounts = [
  { id: 'account.11111111-1111-1111-1111-111111111111', name: '検証枠' },
];
settings.webApplets.items.push({
  id: 'web.11111111-1111-1111-1111-111111111111',
  name: 'Web順序テスト',
  url: 'https://example.invalid/',
  accountId: 'account.11111111-1111-1111-1111-111111111111',
  enabled: false,
  allowedOrigins: [],
  icon: '',
  navigation: 'none',
  display: 'page',
});
for (const id of ['test.a', 'test.b', 'test.c']) {
  const folder = path.join(profile, 'extensions', id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, 'extension.json'),
    JSON.stringify({
      apiVersion: 1,
      id,
      name: `順序 ${id}`,
      version: '1.0.0',
      runtime: 'node',
      entry: 'index.js',
      commands: [{ id: `${id}.run`, title: `${id}の操作` }],
      settings: [{ key: 'text', title: '保持する入力', type: 'string', default: '' }],
    }),
  );
  fs.writeFileSync(
    path.join(folder, 'index.js'),
    `exports.activate = context => { context.commands.register('${id}.run', '${id}の操作', async () => {}); };`,
  );
  settings.extensions[id] = { enabled: true, settings: {} };
}
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const checks = [];
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const portable = process.argv[2] ? path.join(profile, 'AppDock.at365.exe') : null;
if (portable) {
  fs.copyFileSync(path.resolve(process.argv[2]), portable);
  assert.equal(hash(portable), hash(path.resolve(process.argv[2])));
}
async function until(fn, message) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(message);
}
async function launch() {
  if (!portable)
    return electron.launch({
      executablePath: require('electron'),
      args: [root, `--test-profile=${profile}`],
      env,
    });
  // NSIS launches the Electron child without piping its inspector output to Playwright.
  // Match the existing real-portable harness: connect to an isolated local CDP port.
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const child = spawn(portable, [`--test-profile=${profile}`, `--remote-debugging-port=${port}`], {
    cwd: profile,
    env,
    windowsHide: true,
    stdio: 'ignore',
  });
  const browser = await until(
    () => chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 }),
    'portable CDP connection',
  );
  const page = await until(
    () =>
      browser
        .contexts()
        .flatMap((context) => context.pages())
        .find((page) => page.url().startsWith('appdock://host/')),
    'portable host renderer',
  );
  return {
    firstWindow: async () => page,
    close: async () => {
      await page
        .evaluate(() => {
          void window.dock.executeCommand('appdock.quit');
        })
        .catch(() => {});
      await until(() => child.exitCode !== null, 'portable shutdown');
      await browser.close().catch(() => {});
    },
  };
}
(async () => {
  let app = await launch();
  try {
    let page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.setDefaultTimeout(12000);
    await page.waitForFunction(async () => (await window.dock?.snapshot())?.startupReady);
    const button = (name) => page.getByRole('button', { name, exact: true });
    const tab = (name) => page.getByRole('tab', { name, exact: true });
    const ids = () =>
      page.locator('[data-applet-id]').evaluateAll((rows) => rows.map((r) => r.dataset.appletId));
    const saved = () => JSON.parse(fs.readFileSync(path.join(profile, 'settings.json')));
    const initial = await page.evaluate(() => window.dock.snapshot());
    assert.equal(initial.version, require('../package.json').version);
    const originalBindings = initial.settings.value.keybindings;
    const originalRibbon = initial.settings.value.ribbon;
    await button('Applet').click();
    assert.deepEqual(await ids(), [
      'test.a',
      'test.b',
      'test.c',
      'web.11111111-1111-1111-1111-111111111111',
    ]);
    assert.equal(await page.locator('.applet-drag-handle').count(), 0);
    await page.locator('[data-applet-id="test.a"] .applet-select').click();
    assert.deepEqual(
      await page
        .getByRole('tablist', { name: 'Applet詳細の切り替え' })
        .getByRole('tab')
        .allTextContents(),
      ['説明', '設定', 'ショートカット', 'ログ'],
    );
    await tab('設定').click();
    await page.getByLabel('保持する入力', { exact: true }).fill('未保存の入力');
    await tab('ショートカット').click();
    assert.equal(await page.locator('[data-shortcut-command]').count(), 1);
    await tab('設定').click();
    assert.equal(
      await page.getByLabel('保持する入力', { exact: true }).inputValue(),
      '未保存の入力',
    );
    await page.getByRole('switch', { name: 'Appletの並べ替え' }).click();
    assert(await page.getByLabel('Appletを検索', { exact: true }).isDisabled());
    await button('順序 test.bを上へ移動').click();
    assert.deepEqual(await ids(), [
      'test.b',
      'test.a',
      'test.c',
      'web.11111111-1111-1111-1111-111111111111',
    ]);
    await page
      .getByLabel('Web順序テストをドラッグして移動')
      .dragTo(page.locator('[data-applet-id="test.b"]'));
    assert.deepEqual(await ids(), [
      'web.11111111-1111-1111-1111-111111111111',
      'test.b',
      'test.a',
      'test.c',
    ]);
    await page.getByLabel('順序 test.cをドラッグして移動').press('ArrowUp');
    assert.deepEqual(await ids(), [
      'web.11111111-1111-1111-1111-111111111111',
      'test.b',
      'test.c',
      'test.a',
    ]);
    assert.equal(
      await page.getByLabel('保持する入力', { exact: true }).inputValue(),
      '未保存の入力',
    );
    await button('変更をすべて保存').click();
    await page.waitForFunction(
      async () =>
        (await window.dock.snapshot()).settings.value.appletOrder[0] ===
        'web.11111111-1111-1111-1111-111111111111',
    );
    assert.equal(saved().extensions['test.a'].settings.text, '未保存の入力');
    assert.deepEqual(saved().keybindings, originalBindings);
    assert.deepEqual(saved().ribbon, originalRibbon);
    checks.push(
      'toggle / up button / native drag / keyboard move / WebApplet order / shared draft save / dispatcher and ribbon unchanged',
    );
    await page.getByRole('switch', { name: 'Appletの並べ替え' }).click();
    await button('設定').click();
    assert.equal(await page.getByText('Applet別の設定').count(), 0);
    await page
      .locator('.settings-categories')
      .getByRole('button', { name: 'ショートカット', exact: true })
      .click();
    const owners = () =>
      page
        .locator('.shortcut-group')
        .evaluateAll((groups) => groups.map((g) => g.dataset.shortcutOwner));
    assert.deepEqual(await owners(), [
      'appdock',
      'web.11111111-1111-1111-1111-111111111111',
      'test.b',
      'test.c',
      'test.a',
    ]);
    await page
      .locator('[data-shortcut-owner="test.a"] [data-shortcut-recorder]')
      .press('Control+F9');
    await button('Applet').click();
    await tab('ショートカット').click();
    assert.equal(await page.locator('[data-shortcut-recorder]').inputValue(), 'Ctrl+F9');
    await button('変更を破棄して再読み込み').click();
    assert.equal(await page.locator('[data-shortcut-recorder]').inputValue(), 'Ctrl+F8');
    checks.push(
      'AppDock-first grouped shortcuts / same Applet order / shared key draft and discard across pages',
    );
    for (const theme of ['dark', 'light']) {
      await button('設定').click();
      await page
        .locator('.settings-categories')
        .getByRole('button', { name: '表示', exact: true })
        .click();
      await page.getByLabel('テーマ', { exact: true }).selectOption(theme);
      await button('変更をすべて保存').click();
      await page.waitForFunction(
        async (theme) => (await window.dock.snapshot()).settings.value.host.theme === theme,
        theme,
      );
      for (const width of [1280, 900, 700]) {
        await page.setViewportSize({ width, height: 720 });
        await button('Applet').click();
        await tab('設定').click();
        assert(await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth));
        assert(
          await page.locator('.detail-tabs').evaluate((el) => el.scrollWidth <= el.clientWidth),
        );
        await page.getByRole('switch', { name: 'Appletの並べ替え' }).click();
        await page.screenshot({ path: path.join(profile, `${theme}-${width}-order.png`) });
        assert(
          await page
            .getByRole('complementary', { name: 'Applet一覧' })
            .evaluate((el) => el.scrollWidth <= el.clientWidth),
        );
        await page.getByRole('switch', { name: 'Appletの並べ替え' }).click();
        await button('設定').click();
        await page
          .locator('.settings-categories')
          .getByRole('button', { name: 'ショートカット', exact: true })
          .click();
        assert(await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth));
        await page.screenshot({ path: path.join(profile, `${theme}-${width}-groups.png`) });
      }
    }
    checks.push(
      'dark/light screenshots / 1280, 900, 700 px / four tabs and reorder controls without overflow',
    );
    assert.deepEqual(errors, []);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.waitForFunction(async () => (await window.dock?.snapshot())?.startupReady);
    await button('Applet').click();
    assert.deepEqual(await ids(), [
      'web.11111111-1111-1111-1111-111111111111',
      'test.b',
      'test.c',
      'test.a',
    ]);
    assert.equal(
      await page.getByRole('switch', { name: 'Appletの並べ替え' }).getAttribute('aria-checked'),
      'false',
    );
    await page.getByRole('switch', { name: 'Appletの並べ替え' }).click();
    await button('順序 test.bを下へ移動').click();
    await button('変更を破棄して再読み込み').click();
    assert.deepEqual(await ids(), [
      'web.11111111-1111-1111-1111-111111111111',
      'test.b',
      'test.c',
      'test.a',
    ]);
    checks.push('restart persistence / mode resets / discard restores saved order');
    fs.writeFileSync(
      path.join(profile, 'result.json'),
      JSON.stringify(
        { ok: true, checks, ...(portable ? { sha256: hash(portable) } : {}) },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ ok: true, profile, checks }));
  } finally {
    await app.close();
  }
})().catch((error) => {
  fs.writeFileSync(path.join(profile, 'failure.txt'), String(error.stack));
  console.error(error);
  process.exitCode = 1;
});

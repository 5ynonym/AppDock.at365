const { _electron: electron, chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `settings-notice-${Date.now()}`);
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.notifications = false;
settings.host.hardwareAcceleration = false;
fs.mkdirSync(profile, { recursive: true });
for (const id of ['a', 'b']) {
  const folder = path.join(profile, 'extensions', `test.${id}`);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, 'extension.json'),
    JSON.stringify({
      apiVersion: 1,
      id: `test.${id}`,
      name: `Fixture ${id}`,
      version: '1.0.0',
      runtime: 'node',
      entry: 'index.js',
      settings: [{ key: 'value', title: '検証値', type: 'string', default: '' }],
    }),
  );
  fs.writeFileSync(path.join(folder, 'index.js'), 'module.exports = {};');
}
const settingsFile = path.join(profile, 'settings.json');
fs.writeFileSync(settingsFile, JSON.stringify(settings));
const checks = [];
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const server = http.createServer((_req, res) =>
  res.end(
    '<html><body style="background:#124057"><h1>Overlay fixture</h1><input id="keep" style="margin-top:220px"></body></html>',
  ),
);
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function until(fn, message) {
  const end = Date.now() + 25000;
  while (Date.now() < end) {
    const result = await fn();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(message);
}
let app, browser, page, child;
const portable = process.argv[2] ? path.join(profile, 'AppDock.at365.exe') : undefined;
if (portable) {
  fs.copyFileSync(path.resolve(process.argv[2]), portable);
  assert.equal(hash(portable), hash(path.resolve(process.argv[2])));
}
async function launch(restore = false) {
  if (!portable) {
    app = await electron.launch({
      executablePath: require('electron'),
      args: [root, `--test-profile=${profile}`, ...(restore ? ['--restore-view'] : [])],
      env,
    });
    browser = app.context();
    page = await app.firstWindow();
  } else {
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    child = spawn(
      portable,
      [
        `--test-profile=${profile}`,
        `--remote-debugging-port=${port}`,
        ...(restore ? ['--restore-view'] : []),
      ],
      {
        cwd: profile,
        env,
        windowsHide: true,
        stdio: 'ignore',
      },
    );
    browser = await until(async () => {
      try {
        return await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 });
      } catch {
        return null;
      }
    }, 'portable CDP');
    page = await until(
      () =>
        browser
          .contexts()
          .flatMap((c) => c.pages())
          .find(
            (p) => p.url().startsWith('appdock://host/') && !p.url().includes('settingsNotice'),
          ),
      'host renderer',
    );
  }
  page.setDefaultTimeout(12000);
  await page.waitForFunction(async () => (await window.dock?.snapshot())?.startupReady);
}
const pages = () => (portable ? browser.contexts().flatMap((c) => c.pages()) : browser.pages());
const button = (name) => page.getByRole('button', { name, exact: true });
const ribbon = (name) => page.locator(`[data-ribbon-id="${name}"]`);
const tab = (name) => page.getByRole('tab', { name, exact: true });
const select = (name) =>
  page
    .locator('.applet-select')
    .filter({ has: page.locator('span[title]').filter({ hasText: new RegExp(`^${name}$`) }) })
    .click();
const snapshot = () => page.evaluate(() => window.dock.snapshot());
const notice = () =>
  until(() => pages().find((p) => p.url().includes('settingsNotice=1')), 'notice renderer');
const noticeVisible = async (expected) => {
  const p = await notice();
  await until(
    async () =>
      (await p.getByRole('region', { name: '未保存の変更', exact: true }).count()) ===
      (expected ? 1 : 0),
    `notice visible ${expected}`,
  );
  return p;
};
const save = async () => {
  await button('変更をすべて保存').click();
  await page.getByText('すべて保存されています', { exact: true }).waitFor();
};
async function close() {
  if (!portable) await app.close();
  else {
    await page
      .evaluate(() => {
        void window.dock.executeCommand('appdock.quit');
      })
      .catch(() => {});
    await until(() => child.exitCode !== null, 'portable shutdown');
    await browser.close();
  }
}
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  await launch();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await ribbon('settings').click();
    assert.deepEqual(await page.locator('.settings-categories span[title]').allTextContents(), [
      '表示',
      '一般',
      'リボン',
      'タスクトレイ',
      'ショートカット',
      'マウスジェスチャー',
      'Webアカウント',
      'プロフィール',
      'バージョン情報・更新',
    ]);
    const toolbar = await page
      .getByRole('button', { name: '変更をすべて保存', exact: true })
      .boundingBox();
    await ribbon('extensions').click();
    assert.equal((await button('変更をすべて保存').boundingBox()).y, toolbar.y);
    assert.equal(await page.locator('.detail-settings .settings-toolbar').count(), 0);
    for (const name of ['説明', '設定', 'ショートカット', 'ログ']) {
      await select('Fixture a');
      await tab(name).click();
      await select('Fixture b');
      assert.equal(await tab(name).getAttribute('aria-selected'), 'true');
      await select('WebApplet');
      assert.equal(await tab(name).getAttribute('aria-selected'), 'true');
    }
    checks.push(
      'category order / one toolbar at same position / all four tabs retained across native and built-in entries',
    );
    await tab('ショートカット').click();
    await page.getByLabel('既定のショートカット1', { exact: true }).press('Control+F6');
    await tab('設定').click();
    await button('＋ WebAppletを追加').click();
    await page.getByLabel('WebAppletの名前', { exact: true }).fill('浮動通知Web');
    await page
      .getByLabel('WebAppletのURL', { exact: true })
      .fill(`http://127.0.0.1:${server.address().port}/`);
    await page.getByLabel('WebAppletの名前', { exact: true }).focus();
    await select('Fixture a');
    await page.getByLabel('検証値', { exact: true }).fill('shared value');
    await save();
    let stored = (await snapshot()).settings.value;
    const webId = stored.webApplets.items[0].id;
    assert.equal(stored.extensions['test.a'].settings.value, 'shared value');
    assert.equal(stored.keybindings.find((b) => b.command === `${webId}.reload`).key, 'Ctrl+F6');
    assert.equal(
      (await snapshot()).extensions.some((e) => e.id === 'appdock.web-manager'),
      false,
    );
    checks.push(
      'WebApplet add and shortcut defaults from Applet tabs / save entire shared draft / manager excluded from runtime',
    );
    await page.getByLabel('検証値', { exact: true }).fill('from floating save');
    await ribbon('home').click();
    const original = await page.locator('h1').boundingBox();
    const n = await noticeVisible(true);
    assert.equal(await n.evaluate(() => typeof window.dock), 'undefined');
    assert.equal(await n.evaluate(() => typeof require), 'undefined');
    n.on('pageerror', (error) => errors.push(error.message));
    assert.deepEqual(await page.locator('h1').boundingBox(), original);
    await page.screenshot({ path: path.join(profile, 'home-dark.png') });
    await n.screenshot({ path: path.join(profile, 'notice-dark.png') });
    await n.getByRole('button', { name: 'すべて保存', exact: true }).click();
    await noticeVisible(false);
    assert.equal(
      (await snapshot()).settings.value.extensions['test.a'].settings.value,
      'from floating save',
    );
    checks.push('floating save on home / no layout movement / dark screenshot');
    await ribbon('extensions').click();
    await page.getByLabel('検証値', { exact: true }).fill('unsaved on Web');
    await page.evaluate((id) => window.dock.openAppletPage(id, 'main'), webId);
    const remote = await until(
      () => pages().find((p) => p.url().startsWith(`http://127.0.0.1:${server.address().port}/`)),
      'remote Web',
    );
    await noticeVisible(true);
    await remote.locator('#keep').fill('kept input');
    if (app) {
      const info = await app.evaluate(async ({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().startsWith('appdock://host/'),
        );
        const views = w.contentView.children;
        const last = views.at(-1);
        return {
          top: last.webContents?.getURL(),
          bounds: last.getBounds(),
          focused: w.webContents.isFocused(),
        };
      });
      assert.ok(info.top.endsWith('?settingsNotice=1'));
      assert.equal(info.bounds.y, 48);
      // Capture the whole window and each native surface; parent-only screenshots omit child views.
      const capture = await app.evaluate(async ({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().startsWith('appdock://host/'),
        );
        return (await w.capturePage()).toPNG().toString('base64');
      });
      fs.writeFileSync(path.join(profile, 'web-window-dark.png'), Buffer.from(capture, 'base64'));
    }
    await n.getByRole('button', { name: 'すべて保存', exact: true }).click();
    await noticeVisible(false);
    assert.equal(await remote.locator('#keep').inputValue(), 'kept input');
    assert.equal(
      (await snapshot()).settings.value.extensions['test.a'].settings.value,
      'unsaved on Web',
    );
    checks.push(
      'native overlay above Web surface / remote input retained / floating save while Web selected',
    );
    await ribbon('settings').click();
    await button('JSON').click();
    await page.getByLabel('設定JSON').fill('{broken');
    await ribbon('home').click();
    await noticeVisible(true);
    const conflictHeading = await page.locator('h1').boundingBox();
    await n.getByRole('button', { name: 'すべて保存', exact: true }).click();
    await n.getByText('変更を保存できません', { exact: true }).waitFor();
    assert.deepEqual(await page.locator('h1').boundingBox(), conflictHeading);
    assert.equal(await page.locator('.error-banner').count(), 0);
    await n.getByRole('button', { name: '設定を確認', exact: true }).click();
    await noticeVisible(false);
    assert.equal(await page.getByLabel('設定JSON').inputValue(), '{broken');
    await button('変更を破棄して再読み込み').click();
    await button('フォーム').click();
    checks.push('invalid JSON remains intact / floating validation error and return to editor');
    await ribbon('extensions').click();
    await page.getByLabel('検証値', { exact: true }).fill('stale draft');
    await page.evaluate(async () => {
      const s = await window.dock.snapshot();
      s.settings.value.profile.name = 'external revision';
      await window.dock.saveSettings(s.settings.value, s.settings.revision);
    });
    const externalRevision = (await snapshot()).settings.revision;
    await ribbon('home').click();
    await noticeVisible(true);
    const staleHeading = await page.locator('h1').boundingBox();
    await n.getByRole('button', { name: 'すべて保存', exact: true }).click();
    await n.getByText('変更を保存できません', { exact: true }).waitFor();
    assert.deepEqual(await page.locator('h1').boundingBox(), staleHeading);
    assert.equal(await page.locator('.error-banner').count(), 0);
    assert.equal((await snapshot()).settings.revision, externalRevision);
    await n.getByRole('button', { name: '設定を確認', exact: true }).click();
    await noticeVisible(false);
    assert.equal(await page.getByLabel('検証値', { exact: true }).inputValue(), 'stale draft');
    await button('変更を破棄して再読み込み').click();
    checks.push(
      'revision conflict refuses overwrite / draft retained / notice has no general host or Node bridge',
    );
    if (app) {
      await ribbon('extensions').click();
      await page.getByLabel('検証値', { exact: true }).fill('discard me');
      await ribbon('home').click();
      await noticeVisible(true);
      await app.evaluate(({ dialog }) => {
        globalThis.originalDiscardDialog = dialog.showMessageBox;
        dialog.showMessageBox = async (_window, options) => {
          if (
            options.message !== '未保存の変更をすべて破棄しますか？' ||
            options.defaultId !== 0 ||
            options.cancelId !== 0
          )
            throw Error('invalid discard warning');
          return { response: 0, checkboxChecked: false };
        };
      });
      await n.getByRole('button', { name: 'すべて破棄…', exact: true }).click();
      await until(
        async () =>
          !(await n.getByRole('button', { name: 'すべて保存', exact: true }).isDisabled()),
        'cancel ready',
      );
      await noticeVisible(true);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
      });
      await n.getByRole('button', { name: 'すべて破棄…', exact: true }).click();
      await noticeVisible(false);
      await app.evaluate(({ dialog }) => {
        dialog.showMessageBox = globalThis.originalDiscardDialog;
      });
      await ribbon('extensions').click();
      assert.equal(await page.getByLabel('検証値', { exact: true }).inputValue(), 'unsaved on Web');
      checks.push(
        'floating discard warning cancel and accept / all draft discarded (dialog response fixture)',
      );
    }
    await ribbon('settings').click();
    await page.getByRole('combobox', { name: 'テーマ', exact: true }).selectOption('light');
    await save();
    await ribbon('extensions').click();
    await page.getByLabel('検証値', { exact: true }).fill('light');
    await ribbon('home').click();
    await noticeVisible(true);
    await n.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await n.screenshot({ path: path.join(profile, 'notice-light.png') });
    if (app)
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().startsWith('appdock://host/'),
        );
        w.setSize(820, 680);
      });
    await n.screenshot({ path: path.join(profile, 'notice-narrow.png') });
    await n.getByRole('button', { name: 'すべて保存', exact: true }).click();
    await noticeVisible(false);
    assert.equal(errors.length, 0, errors.join('\n'));
    checks.push('light theme / resize / save and hide / no renderer errors');
    await close();
    await launch(true);
    await ribbon('extensions').click();
    assert.equal(await tab('設定').getAttribute('aria-selected'), 'true');
    assert.equal(await page.getByLabel('検証値', { exact: true }).inputValue(), 'light');
    checks.push('published settings and retained tab survive restart');
    const result = {
      ok: true,
      portable: !!portable,
      version: (await snapshot()).version,
      checks,
      profile,
      ...(portable ? { sha256: hash(portable) } : {}),
    };
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

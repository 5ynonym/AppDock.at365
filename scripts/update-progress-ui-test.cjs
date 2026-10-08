const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `update-progress-${Date.now()}`);
const source = path.join(profile, 'source');
const installed = path.join(profile, 'extensions/fixture');
fs.mkdirSync(source, { recursive: true });
fs.mkdirSync(installed, { recursive: true });
for (const [dir, version] of [
  [source, '2.0.0'],
  [installed, '1.0.0'],
]) {
  fs.writeFileSync(
    path.join(dir, 'extension.json'),
    JSON.stringify({
      apiVersion: 1,
      id: 'fixture',
      name: '更新進捗テスト',
      version,
      runtime: 'node',
      entry: 'index.js',
    }),
  );
  fs.writeFileSync(path.join(dir, 'index.js'), 'exports.activate = async () => {};');
}
fs.writeFileSync(path.join(source, 'asset.bin'), randomBytes(3 * 1024 * 1024));
const feedDir = path.join(profile, 'feed');
const helper = path.join(root, 'artifacts/updater/AppDock.Updater.exe');
assert.equal(
  spawnSync(helper, ['--pack', 'applet', source, 'unused', feedDir], { windowsHide: true }).status,
  0,
);
const zip = fs.readFileSync(path.join(feedDir, 'update.zip'));
const feed = fs.readFileSync(path.join(feedDir, 'update.json'));
let slow = true,
  disconnected = 0;
const server = http.createServer((request, response) => {
  if (request.url === '/update.json') {
    response.end(feed);
    return;
  }
  if (!slow) {
    response.end(zip);
    return;
  }
  let offset = 0;
  const timer = setInterval(() => {
    if (offset >= zip.length) {
      clearInterval(timer);
      response.end();
      return;
    }
    response.write(zip.subarray(offset, offset + 32768));
    offset += 32768;
  }, 60);
  response.on('close', () => {
    disconnected++;
    clearInterval(timer);
  });
});
let app;
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
  settings.host.hardwareAcceleration = false;
  settings.host.notifications = false;
  settings.globalShortcutCommands = [];
  settings.extensions.fixture = {
    enabled: false,
    settings: {},
    updateSource: `http://127.0.0.1:${server.address().port}/update.json`,
  };
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  try {
    app = await electron.launch({
      executablePath: path.join(root, 'publish/win-unpacked/AppDock.at365.exe'),
      args: [`--test-profile=${profile}`],
      env,
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    await page.getByRole('heading', { name: 'ホーム', exact: true }).waitFor();
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page
      .locator('.settings-categories')
      .getByRole('button', { name: 'バージョン情報・更新', exact: true })
      .click();
    const update = page
      .locator('.about-applets')
      .getByRole('button', { name: 'このAppletを更新', exact: true });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(async (theme) => {
        const s = await window.dock.snapshot();
        s.settings.value.host.theme = theme;
        await window.dock.saveSettings(s.settings.value, s.settings.revision);
      }, theme);
      await page.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        theme,
      );
      await update.click();
      await page.waitForFunction(() =>
        window.dock.snapshot().then((s) => s.updates.progress?.receivedBytes > 131072),
      );
      await page.waitForFunction(
        () => document.querySelector('.update-operation progress')?.value > 131072,
      );
      const progress = await page.getByRole('progressbar').getAttribute('value');
      assert.ok(Number(progress) > 0 && Number(progress) < zip.length);
      await page.screenshot({ path: path.join(profile, `progress-${theme}.png`) });
      await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
      await page.waitForFunction(() => window.dock.snapshot().then((s) => !s.updates.busy));
      await page
        .getByText('更新を取り消しました。インストール済みのファイルは変更していません。', {
          exact: true,
        })
        .waitFor();
      assert.equal(await update.isEnabled(), true);
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(installed, 'extension.json'))).version,
        '1.0.0',
      );
      assert.equal(fs.existsSync(path.join(profile, '.appdock/update-transaction.json')), false);
    }
    slow = false;
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    await update.click();
    await page.getByText('更新を取り消しました。', { exact: true }).waitFor();
    assert.equal(await update.isEnabled(), true);
    assert.ok(disconnected >= 2);
    assert.equal(fs.existsSync(path.join(installed, 'asset.bin')), false);
    const result = {
      ok: true,
      profile,
      checks: [
        'real IPC and local HTTP streaming progress',
        'dark/light screenshots',
        'cancel aborts transfer without replacing installed Applet',
        'retry and final confirmation cancellation',
      ],
    };
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (app) await app.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

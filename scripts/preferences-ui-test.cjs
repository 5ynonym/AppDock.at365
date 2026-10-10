const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.artifacts', `preferences-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const { createDefaultSettings } = require('../out/main/shared/settings-schema.js');
const legacy = createDefaultSettings();
delete legacy.shortcuts;
delete legacy.profile;
delete legacy.pinnedCommands;
legacy.host.notifications = false;
require('../tests/fixtures/install.cjs')(profile, legacy);
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(legacy, null, 2));
const hash = () =>
  createHash('sha256')
    .update(
      fs.readFileSync(
        path.join(
          profile,
          JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8')).profile.avatar,
        ),
      ),
    )
    .digest('hex');
let application;
async function launch() {
  application = await electron.launch({
    executablePath: process.argv[2] ? path.resolve(process.argv[2]) : require('electron'),
    args: [...(process.argv[2] ? [] : [root]), `--test-profile=${profile}`],
    timeout: 30000,
  });
  const page = await application.firstWindow();
  await page.getByRole('heading', { name: 'ホーム', exact: true }).waitFor();
  await application.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().startsWith('appdock:'),
    );
    w.show();
    w.focus();
  });
  await page.waitForTimeout(200);
  return page;
}
async function waitPins(page, pins) {
  await page.waitForFunction(
    (expected) =>
      Array.from(document.querySelectorAll('.palette-command.pinned'))
        .map((e) => e.dataset.commandId)
        .join('|') === expected.join('|'),
    pins,
  );
}
(async () => {
  try {
    let page = await launch();
    await page.keyboard.press('Control+p');
    await page.getByRole('dialog', { name: 'コマンドパレット' }).waitFor();
    await page.getByRole('button', { name: '保存APIを確認をピン留め', exact: true }).click();
    await waitPins(page, ['appdock.welcome.verify-storage']);
    await page.getByRole('button', { name: 'ウェルカムを更新をピン留め', exact: true }).click();
    await waitPins(page, ['appdock.welcome.verify-storage', 'appdock.welcome.refresh']);
    await page.getByRole('button', { name: 'ウェルカムを更新を上に移動', exact: true }).click();
    await waitPins(page, ['appdock.welcome.refresh', 'appdock.welcome.verify-storage']);
    await page.screenshot({ path: path.join(profile, 'pins.png') });
    await page.getByPlaceholder('コマンドを入力…').fill('ウェルカムを更新');
    await waitPins(page, ['appdock.welcome.refresh']);
    assert.deepEqual(
      (await page.evaluate(() => window.dock.snapshot())).settings.value.pinnedCommands,
      ['appdock.welcome.refresh', 'appdock.welcome.verify-storage'],
    );
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+,');
    await page.getByRole('button', { name: 'ショートカット', exact: true }).click();
    await page
      .getByLabel('コマンドを検索のショートカット 1', { exact: true })
      .press('Control+Alt+p');
    await page
      .getByLabel('ウェルカムを更新のショートカット 1', { exact: true })
      .press('Control+Alt+p');
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await page.getByText('すべて保存されています', { exact: true }).waitFor();
    assert.equal(
      (await page.evaluate(() => window.dock.snapshot())).settings.value.shortcuts[
        'appdock.commands.search'
      ][0],
      'Ctrl+Alt+P',
    );
    await page
      .getByLabel('ウェルカムを更新のショートカット 1', { exact: true })
      .press('Control+Alt+r');
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '設定を保存' }).waitFor();
    await page.screenshot({ path: path.join(profile, 'shortcuts.png') });
    await page.getByRole('button', { name: 'ホーム', exact: true }).first().click();
    await page.keyboard.press('Control+p');
    assert.equal(await page.getByRole('dialog').count(), 0);
    await page.keyboard.press('Control+Alt+p');
    await page.getByRole('dialog', { name: 'コマンドパレット' }).waitFor();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+Alt+r');
    await page.getByRole('status').filter({ hasText: 'コマンドを実行' }).waitFor();
    // Assign and execute a real .NET command through the same shortcut settings.
    await page.getByRole('button', { name: 'Applet', exact: true }).click();
    await page
      .getByRole('complementary', { name: 'Applet一覧' })
      .getByRole('button', { name: /.NET Connection Demo/ })
      .click();
    await page.getByRole('switch', { name: '.NET Connection Demoを有効にする' }).click();
    await page.getByRole('heading', { name: 'C# is docked.' }).waitFor();
    await page.keyboard.press('Control+,');
    await page
      .getByLabel('.NET拡張の状態を更新のショートカット 1', { exact: true })
      .press('Control+Alt+d');
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    const before = (await page.evaluate(() => window.dock.snapshot())).extensions
      .find((e) => e.id === 'appdock.dotnet-demo')
      .panel.facts.find((f) => f.label === 'Refresh').value;
    await page.getByRole('button', { name: 'ホーム', exact: true }).first().click();
    await page.keyboard.press('Control+Alt+d');
    await page.waitForFunction(
      (previous) =>
        window.dock
          .snapshot()
          .then(
            (s) =>
              Number(
                s.extensions
                  .find((e) => e.id === 'appdock.dotnet-demo')
                  .panel.facts.find((f) => f.label === 'Refresh').value,
              ) > Number(previous),
          ),
      before,
    );
    await page.getByRole('button', { name: 'プロフィール設定を開く' }).click();
    await page.getByLabel('ユーザー名').fill('ユキちゃん');
    await page.getByLabel('アバター画像を選択').setInputFiles(path.join(root, 'assets/icon.png'));
    await page.getByAltText('プロフィール画像').waitFor();
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await page.locator('.avatar img').waitFor();
    await page.waitForFunction(() => {
      const img = document.querySelector('.avatar img');
      return img?.complete && img.naturalWidth > 0;
    });
    assert.equal(
      (await page.evaluate(() => window.dock.snapshot())).settings.value.profile.name,
      'ユキちゃん',
    );
    const firstHash = hash();
    await page.getByLabel('アバター画像を選択').setInputFiles(path.join(profile, 'pins.png'));
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await page.getByText('すべて保存されています', { exact: true }).waitFor();
    assert.notEqual(hash(), firstHash);
    const finalHash = hash();
    const conflict = path.join(profile, 'conflict', 'icon.png');
    fs.mkdirSync(path.dirname(conflict), { recursive: true });
    fs.copyFileSync(path.join(profile, 'pins.png'), conflict);
    await page.getByLabel('アバター画像を選択').setInputFiles(conflict);
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await page
      .getByText(/同名の別画像が登録されています/)
      .first()
      .waitFor();
    assert.equal(hash(), finalHash);
    await page.getByRole('button', { name: '変更を破棄して再読み込み', exact: true }).click();
    assert.deepEqual(fs.readdirSync(path.join(profile, 'data/assets/profile')).sort(), [
      'icon.png',
      'pins.png',
    ]);
    const rejected = await page.evaluate(async () => {
      const s = await window.dock.snapshot();
      try {
        await window.dock.saveSettings(
          { ...s.settings.value, profile: { ...s.settings.value.profile, name: 'invalid upload' } },
          s.settings.revision,
          new Uint8Array([1, 2, 3]),
        );
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(rejected, true);
    assert.equal(hash(), finalHash);
    assert.equal(
      (await page.evaluate(() => window.dock.snapshot())).settings.value.profile.name,
      'ユキちゃん',
    );
    await page.screenshot({ path: path.join(profile, 'profile.png') });
    await application.close();
    application = undefined;
    page = await launch();
    await page.locator('.avatar img').waitFor();
    assert.equal(
      (await page.evaluate(() => window.dock.snapshot())).settings.value.profile.name,
      'ユキちゃん',
    );
    assert.equal(hash(), finalHash);
    await page.keyboard.press('Control+Alt+p');
    await waitPins(page, ['appdock.welcome.refresh', 'appdock.welcome.verify-storage']);
    await page.getByRole('button', { name: '保存APIを確認をピン留め解除', exact: true }).click();
    await waitPins(page, ['appdock.welcome.refresh']);
    await page.keyboard.press('Escape');
    console.log(
      JSON.stringify(
        {
          ok: true,
          profile,
          checks: [
            'legacy settings / Ctrl+P default',
            'pin / order / filter / unpin',
            'shortcut recording / shared bindings / remapping',
            'TypeScript and .NET keyboard commands',
            'profile name / image upload / original filenames / retained assets',
            'same-name different image and invalid image preserve profile and registered originals',
            'restart persistence',
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await application?.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

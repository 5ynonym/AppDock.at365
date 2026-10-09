const { _electron: electron } = require('playwright');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `hotkeys-${Date.now()}`);
const clockFolder = path.join(profile, 'extensions', 'Applet.Watch.at365');
fs.mkdirSync(clockFolder, { recursive: true });
for (const name of ['extension.json', 'Applet.Watch.at365.exe'])
  fs.copyFileSync(
    path.join(root, '../Applet.Watch.at365/publish/Applet.Watch.at365', name),
    path.join(clockFolder, name),
  );
const settings = require('../out/main/shared/settings-schema.js').createDefaultSettings();
settings.extensions['at365.watch'] = { enabled: true, settings: { visible: true } };
settings.host.notifications = false;
require('../tests/fixtures/install.cjs')(profile, settings);
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const { WindowsHotKeyBackend } = require('../out/main/main/core/global-hotkeys.js');
const checks = [];
let application;
let contender;
function send(key) {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(root, 'scripts/send-test-hotkey.ps1'),
      '-VirtualKey',
      String(key),
    ],
    { windowsHide: true, encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}
async function until(check, message) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
}
(async () => {
  try {
    const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : require('electron');
    application = await electron.launch({
      executablePath,
      args: process.argv[2] ? [`--test-profile=${profile}`] : [root, `--test-profile=${profile}`],
      timeout: 30000,
    });
    const page = await application.firstWindow();
    const snapshot = () => page.evaluate(() => window.dock.snapshot());
    const registered = async (key) =>
      (await snapshot()).globalHotKeys.some(
        (status) => status.shortcut === key && status.registered,
      );
    await until(
      () => registered('Pause'),
      'Pause registration failed; check whether another app owns Pause.',
    );
    const visible = async () =>
      (await snapshot()).settings.value.extensions['at365.watch'].settings.visible;
    checks.push('global Pause registered by default');
    contender = new WindowsHotKeyBackend(
      path.join(root, 'artifacts/dotnet-host/AppDock.ExtensionHost.exe'),
      assert.fail,
      () => {},
    );
    assert.equal((await contender.sync(['Pause']))[0].registered, false);
    checks.push('second Windows host cannot register an occupied Pause');

    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
      false,
    );
    send(0x13);
    await until(
      async () => (await visible()) === false,
      'Hidden AppDock did not toggle Watch off.',
    );
    send(0x13);
    await until(async () => (await visible()) === true, 'Hidden AppDock did not toggle Watch on.');
    checks.push('Windows Pause toggles Watch both ways while AppDock is hidden');
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.show();
      window.focus();
    });
    await page.keyboard.press('Control+,');
    await page.getByRole('button', { name: 'ショートカット', exact: true }).click();
    await page.getByLabel('ショートカットのコマンドを検索').fill('at365.watch.toggle');
    const row = page.locator('[data-shortcut-command="at365.watch.toggle"]');
    const input = row.locator('[data-shortcut-recorder]');
    assert.equal(await input.inputValue(), 'Pause');
    assert.equal(
      (await row.getByRole('switch', { name: /割り当てを有効/ }).getAttribute('aria-checked')) ===
        'true',
      true,
    );
    await input.focus();
    await until(async () => !(await registered('Pause')), 'Recorder did not release Pause.');
    send(0x13);
    assert.equal(await visible(), true);
    send(0x87);
    await until(
      async () => (await input.inputValue()) === 'F24',
      'Recorder did not capture single F24.',
    );
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(() => registered('F24'), 'F24 remapping did not register.');
    assert.equal((await contender.sync(['Pause']))[0].registered, true);
    checks.push('recording suspends Pause; single F24 remapping releases Pause');

    await row.getByRole('button', { name: /その他の操作/ }).click();
    await page.getByRole('menuitem', { name: '既定に戻す', exact: true }).click();
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      async () =>
        (await snapshot()).globalHotKeys.some(
          (status) => status.shortcut === 'Pause' && !!status.error,
        ),
      'Conflict status not displayed.',
    );
    await row.getByRole('alert').waitFor();
    await page.screenshot({ path: path.join(profile, 'conflict.png') });
    await contender.sync([]);
    await row.getByRole('button', { name: '登録を再試行', exact: true }).click();
    await until(() => registered('Pause'), 'Pause retry after conflict failed.');
    checks.push('conflict appears in settings; retry button registers after release');
    send(0x13);
    await until(async () => (await visible()) === false, 'Focused AppDock did not toggle Watch.');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(await visible(), false);
    checks.push('focused AppDock executes global key once');

    await row.locator('select[aria-label*="いつ・どこで"]').selectOption('app');
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(async () => !(await registered('Pause')), 'Global opt-out did not release Pause.');
    assert.equal((await contender.sync(['Pause']))[0].registered, true);
    await contender.sync([]);
    await row.getByRole('button', { name: /その他の操作/ }).click();
    await page.getByRole('menuitem', { name: '既定に戻す', exact: true }).click();
    await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(() => registered('Pause'), 'Default restore did not restore global Pause.');
    await page.screenshot({ path: path.join(profile, 'registered.png') });
    await page.evaluate(() => window.dock.toggleExtension('at365.watch', false));
    await until(async () => !(await registered('Pause')), 'Applet stop did not release Pause.');
    assert.equal((await contender.sync(['Pause']))[0].registered, true);
    await contender.sync([]);
    await page.evaluate(() => window.dock.toggleExtension('at365.watch', true));
    await until(() => registered('Pause'), 'Applet reactivation did not register Pause.');
    checks.push('global opt-out/default restore and Applet stop/restart update registration');
    await page.evaluate(async () => {
      const snapshot = await window.dock.snapshot();
      const value = snapshot.settings.value;
      value.keybindings = value.keybindings.filter(
        (row) =>
          !['appdock.commands.search', 'appdock.welcome.verify-storage'].includes(row.command),
      );
      value.keybindings.push(
        ...[
          ['appdock.commands.search', 'F24'],
          ['appdock.welcome.verify-storage', 'F23'],
        ].map(([command, key]) => ({
          id: crypto.randomUUID(),
          command,
          key,
          enabled: true,
          when: { scope: 'global', appletIds: [] },
        })),
      );
      await window.dock.saveSettings(value, snapshot.settings.revision);
    });
    await until(() => registered('F24'), 'Host command did not register globally.');
    await until(() => registered('F23'), 'TypeScript command did not register globally.');
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    send(0x86);
    await until(
      async () =>
        (await snapshot()).logs.some((entry) => entry.message.includes('Storage / Secrets API')),
      'Background TypeScript command did not execute.',
    );
    send(0x87);
    await page.getByRole('dialog', { name: 'コマンドパレット' }).waitFor();
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
      true,
    );
    checks.push('background TypeScript command and global host palette command execute');
    await application.close();
    application = undefined;
    await until(
      async () => (await contender.sync(['Pause']))[0].registered,
      'Shutdown did not release Pause.',
    );
    checks.push('AppDock shutdown releases Windows registration');
    const result = { ok: true, profile, checks };
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await application?.close();
    await contender?.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

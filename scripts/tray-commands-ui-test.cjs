const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `tray-ui-${Date.now()}`);
const folder = path.join(profile, 'extensions', 'test-tray');
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(
  path.join(folder, 'extension.json'),
  JSON.stringify({
    apiVersion: 1,
    id: 'test.tray',
    name: 'Tray Test',
    version: '1.0.0',
    runtime: 'node',
    entry: 'index.js',
    capabilities: ['ui'],
    commands: [{ id: 'test.tray.run', title: 'トレイテストを実行' }],
  }),
);
fs.writeFileSync(
  path.join(folder, 'index.js'),
  `exports.activate = async context => {
  let count = 0;
  const show = () => context.ui.showPanel({ title: 'Tray test', facts: [{ label: 'Count', value: String(count) }] });
  context.commands.register('test.tray.run', 'トレイテストを実行', async () => { count++; await show(); });
  context.tray.add('トレイテストを実行', 'test.tray.run');
  await show();
};`,
);
const { createDefaultSettings } = require('../out/main/shared/settings-schema.js');
const legacy = createDefaultSettings();
delete legacy.trayCommands;
delete legacy.host.trayClickCommand;
legacy.extensions = {
  'test.tray': { enabled: true, settings: {} },
  'appdock.dotnet-demo': { enabled: false, settings: {} },
};
legacy.shortcuts['appdock.dotnet-demo.refresh'] = [];
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(legacy));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let application;
async function launch() {
  const executablePath = process.argv[2] ? path.resolve(process.argv[2]) : require('electron');
  application = await electron.launch({
    executablePath,
    args: [...(process.argv[2] ? [] : [root]), `--test-profile=${profile}`],
    env,
    timeout: 30000,
  });
  const page = await application.firstWindow();
  await page.getByRole('heading', { name: 'ホーム', exact: true }).waitFor();
  await page.waitForFunction(() =>
    window.dock.snapshot().then((s) => s.extensions[0]?.state === 'running'),
  );
  // Capture the real tray/menu on the next settings update, without production test hooks.
  await application.evaluate(({ Tray }) => {
    const original = Tray.prototype.setContextMenu;
    Tray.prototype.setContextMenu = function (menu) {
      globalThis.testTray = this;
      globalThis.testTrayMenu = menu;
      return original.call(this, menu);
    };
  });
  return page;
}
async function save(page) {
  await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll('button')).some(
        (button) => button.textContent.includes('変更をすべて保存') && button.disabled,
      ) &&
      Array.from(document.querySelectorAll('[role="status"]')).some((e) =>
        e.textContent.includes('設定を保存'),
      ),
  );
}
const count = (page) =>
  page.evaluate(() => window.dock.snapshot().then((s) => s.extensions[0].panel.facts[0].value));
const trayItems = () =>
  application.evaluate(() =>
    globalThis.testTrayMenu.items.flatMap((item) =>
      item.submenu
        ? item.submenu.items.map((child) => ({ label: child.label, enabled: child.enabled }))
        : [],
    ),
  );
(async () => {
  try {
    let page = await launch();
    let snapshot = await page.evaluate(() => window.dock.snapshot());
    assert.equal(snapshot.settings.value.shortcuts['appdock.dotnet-demo.refresh'], undefined);
    assert.equal(snapshot.settings.value.extensions['appdock.dotnet-demo'], undefined);
    assert.deepEqual(snapshot.settings.value.trayCommands, []);
    assert.equal(snapshot.settings.value.host.trayClickCommand, 'appdock.open');
    await page.keyboard.press('Control+,');
    await page.getByRole('button', { name: 'ショートカット', exact: true }).click();
    assert.equal(
      await page.locator('[data-shortcut-command="appdock.dotnet-demo.refresh"]').count(),
      0,
    );
    const checkbox = page.getByRole('checkbox', {
      name: 'トレイテストを実行をトレイに表示',
      exact: true,
    });
    assert.equal(await checkbox.isChecked(), false);
    await checkbox.check();
    await save(page);
    assert.deepEqual(await trayItems(), [{ label: 'トレイテストを実行', enabled: true }]);
    await page.screenshot({ path: path.join(profile, 'commands-1280.png') });
    await application.evaluate(() =>
      globalThis.testTrayMenu.items.find((i) => i.label === 'Tray Test').submenu.items[0].click(),
    );
    await page.waitForFunction(() =>
      window.dock.snapshot().then((s) => s.extensions[0].panel.facts[0].value === '1'),
    );
    await page.getByRole('button', { name: '一般', exact: true }).click();
    await page
      .getByLabel('トレイクリックのコマンド', { exact: true })
      .selectOption('test.tray.run');
    await save(page);
    await application.evaluate(() => globalThis.testTray.emit('click'));
    await page.waitForFunction(() =>
      window.dock.snapshot().then((s) => s.extensions[0].panel.facts[0].value === '2'),
    );
    await application.evaluate(() => globalThis.testTray.emit('double-click'));
    await page.waitForTimeout(200);
    assert.equal(await count(page), '2');
    await application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(900, 700),
    );
    await page.screenshot({ path: path.join(profile, 'general-900.png') });
    await page.evaluate(() => window.dock.windowAction('quit'));
    await application.close();
    application = null;
    page = await launch();
    snapshot = await page.evaluate(() => window.dock.snapshot());
    assert.deepEqual(snapshot.settings.value.trayCommands, ['test.tray.run']);
    assert.equal(snapshot.settings.value.host.trayClickCommand, 'test.tray.run');
    await page.evaluate(() => window.dock.toggleExtension('test.tray', false));
    assert.deepEqual(await trayItems(), [{ label: 'トレイテストを実行', enabled: false }]);
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].hide();
      globalThis.testTray.emit('click');
    });
    await page.waitForFunction(() =>
      window.dock.snapshot().then((s) => s.logs.some((entry) => entry.source === 'tray')),
    );
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
      true,
    );
    await page.keyboard.press('Control+,');
    await page.getByRole('button', { name: '一般', exact: true }).click();
    assert.equal(
      await page.getByLabel('トレイクリックのコマンド', { exact: true }).inputValue(),
      'test.tray.run',
    );
    await page.getByLabel('トレイクリックのコマンド', { exact: true }).selectOption('appdock.open');
    await save(page);
    await application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].hide();
      globalThis.testTray.emit('click');
    });
    assert.equal(
      await application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].isVisible(),
      ),
      true,
    );
    await page.getByRole('button', { name: 'ショートカット', exact: true }).click();
    await page.getByRole('checkbox', { name: 'AppDockを開くをトレイに表示', exact: true }).check();
    await save(page);
    assert.deepEqual(await trayItems(), [
      { label: 'AppDockを開く', enabled: true },
      { label: 'トレイテストを実行', enabled: false },
    ]);
    await page
      .getByRole('checkbox', { name: 'AppDockを開くをトレイに表示', exact: true })
      .uncheck();
    await page
      .getByRole('checkbox', { name: 'トレイテストを実行をトレイに表示', exact: true })
      .uncheck();
    await save(page);
    assert.deepEqual(await trayItems(), []);
    console.log(
      JSON.stringify({
        ok: true,
        profile,
        checks:
          'legacy migration, opt-in/out, real menu callback and click events, Applet execution, persistence, default open, 900/1280px UI',
      }),
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (application) {
      await application.evaluate(({ app }) => app.quit()).catch(() => {});
      await application.close().catch(() => {});
    }
  }
})();

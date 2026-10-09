const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.artifacts', `applet-default-shortcuts-${Date.now()}`);
const folder = path.join(profile, 'extensions', 'test.defaults');
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(path.join(folder, 'index.js'), 'exports.activate = async () => {};');
fs.writeFileSync(
  path.join(folder, 'extension.json'),
  JSON.stringify({
    apiVersion: 1,
    id: 'test.defaults',
    name: '初期値テスト',
    version: '1.0.0',
    runtime: 'node',
    entry: 'index.js',
    commands: [{ id: 'test.defaults.run', title: '実行' }],
    defaultKeybindings: [
      {
        command: 'test.defaults.run',
        key: 'Ctrl+F8',
        enabled: true,
        when: { scope: 'owner', appletIds: [] },
      },
    ],
  }),
);
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.host.notifications = false;
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));

(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: process.argv[2] ? path.resolve(process.argv[2]) : require('electron'),
    args: [...(process.argv[2] ? [] : [root]), `--test-profile=${profile}`],
    env,
  });
  try {
    const dock = await app.firstWindow();
    await dock.waitForFunction(async () => (await window.dock?.snapshot())?.startupReady);
    const snapshot = () => dock.evaluate(() => window.dock.snapshot());
    const initial = await snapshot();
    assert.deepEqual(
      initial.settings.value.keybindings
        .filter((row) => row.command === 'test.defaults.run')
        .map((row) => [row.key, row.enabled, row.when.scope]),
      [['Ctrl+F8', true, 'owner']],
    );
    await dock.evaluate(async () => {
      const current = await window.dock.snapshot();
      const row = current.settings.value.keybindings.find(
        (binding) => binding.command === 'test.defaults.run',
      );
      row.key = 'Alt+F9';
      row.when = { scope: 'global', appletIds: [] };
      current.settings.value.keybindings.push({
        id: 'other.binding',
        command: 'appdock.open',
        key: 'Ctrl+F7',
        enabled: true,
        when: { scope: 'app', appletIds: [] },
      });
      await window.dock.saveSettings(current.settings.value, current.settings.revision);
      await window.dock.executeCommand('appdock.settings.open');
    });
    await dock.getByRole('button', { name: 'Applet', exact: true }).click();
    await dock
      .getByRole('complementary', { name: 'Applet一覧' })
      .getByRole('button', { name: /初期値テスト/ })
      .click();
    await dock.getByRole('tab', { name: 'ショートカット', exact: true }).click();
    await dock.getByRole('button', { name: 'このAppletのショートカットを初期値に戻す' }).click();
    assert.equal(
      (await snapshot()).settings.value.keybindings.find(
        (row) => row.command === 'test.defaults.run',
      ).key,
      'Alt+F9',
    );
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await dock.waitForFunction(async () =>
      (await window.dock.snapshot()).settings.value.keybindings.some(
        (row) => row.command === 'test.defaults.run' && row.key === 'Ctrl+F8',
      ),
    );
    const result = await snapshot();
    assert.deepEqual(
      result.settings.value.keybindings
        .filter((row) => row.command === 'test.defaults.run')
        .map((row) => [row.key, row.when.scope]),
      [['Ctrl+F8', 'owner']],
    );
    assert.equal(
      result.settings.value.keybindings.find((row) => row.id === 'other.binding').key,
      'Ctrl+F7',
    );
    console.log(
      JSON.stringify(
        {
          ok: true,
          profile,
          checks: [
            'manifest first-install default',
            'Applet tab reset stays draft until save',
            'save restores only that Applet',
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

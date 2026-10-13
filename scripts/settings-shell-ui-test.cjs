const { settleSettings } = require('./settings-immediate-helper.cjs');
const { _electron: electron, chromium } = require('playwright');
const { spawn } = require('node:child_process'),
  net = require('node:net');
const { createHash } = require('node:crypto');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.artifacts', `settings-shell-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.host.notifications = false;
settings.globalShortcutCommands = [];
settings.extensions['missing.applet'] = { enabled: false, settings: { private: 'never-in-shell' } };
settings.host.closeToTray = false;
for (const id of ['fixture.settings-shell', 'fixture.stalled-settings', 'fixture.old-settings'])
  settings.extensions[id] = { enabled: true, settings: {} };
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const fixture = path.join(profile, 'extensions', 'fixture.settings');
fs.mkdirSync(fixture, { recursive: true });
fs.writeFileSync(
  path.join(fixture, 'extension.json'),
  JSON.stringify({
    apiVersion: 1,
    id: 'fixture.settings',
    name: 'Settings fixture',
    version: '1.0.0',
    runtime: 'node',
    entry: 'index.js',
    settings: [
      { key: 'text.value', title: 'Fixture text', type: 'string', default: '' },
      { key: 'amount', title: 'Fixture amount', type: 'number', default: 1 },
    ],
  }),
);
fs.writeFileSync(path.join(fixture, 'index.js'), 'module.exports = {};');
const external = path.join(profile, 'extensions', 'fixture.settings-shell');
fs.cpSync(path.join(root, 'out/shells/default'), external, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(external, 'extension.json')));
manifest.id = 'fixture.settings-shell';
manifest.name = 'Settings shell fixture';
manifest.minimumHostVersion = '0.33.0';
manifest.shell = { apiVersion: 1, views: { 'page.settings': 'settings.html' } };
fs.writeFileSync(path.join(external, 'extension.json'), JSON.stringify(manifest));
const stalled = path.join(profile, 'extensions', 'fixture.stalled-settings');
fs.mkdirSync(stalled, { recursive: true });
fs.writeFileSync(
  path.join(stalled, 'extension.json'),
  JSON.stringify({ ...manifest, id: 'fixture.stalled-settings', name: 'Stalled settings' }),
);
fs.writeFileSync(path.join(stalled, 'worker.cjs'), 'exports.activate=async()=>{};');
fs.writeFileSync(path.join(stalled, 'settings.html'), '<body>Not ready</body>');
const old = path.join(profile, 'extensions', 'fixture.old-settings');
fs.cpSync(external, old, { recursive: true });
fs.writeFileSync(
  path.join(old, 'extension.json'),
  JSON.stringify({ ...manifest, id: 'fixture.old-settings', minimumHostVersion: '0.32.0' }),
);
const hash = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
async function until(fn, label) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const r = await fn();
    if (r) return r;
    await new Promise((r) => setTimeout(r, 75));
  }
  throw Error(label);
}
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  let app, context, child, connection, portable;
  async function launch(extra = []) {
    if (process.argv[2]) {
      portable = path.join(profile, 'AppDock.at365.exe');
      fs.copyFileSync(path.resolve(process.argv[2]), portable);
      assert.equal(hash(portable), hash(path.resolve(process.argv[2])));
      const probe = net.createServer();
      await new Promise((r) => probe.listen(0, '127.0.0.1', r));
      const port = probe.address().port;
      await new Promise((r) => probe.close(r));
      child = spawn(
        portable,
        [`--test-profile=${profile}`, `--remote-debugging-port=${port}`, ...extra],
        { env, windowsHide: true, stdio: 'ignore' },
      );
      connection = await until(async () => {
        try {
          return await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 });
        } catch {}
      }, 'portable CDP');
      context = connection.contexts()[0];
    } else {
      app = await electron.launch({
        executablePath: require('electron'),
        args: [root, `--test-profile=${profile}`, ...extra],
        env,
      });
      context = app.context();
    }
    return until(
      () => context.pages().find((p) => p.url().startsWith('appdock://host/index.html')),
      'host',
    );
  }
  let host = await launch();
  async function close() {
    if (app) {
      await app.close();
      app = undefined;
    } else {
      await host.evaluate(() => window.dock.executeCommand('appdock.quit')).catch(() => {});
      await until(() => child.exitCode !== null, 'portable shutdown');
      await connection.close();
    }
  }
  const settingsPage = () => require('./settings-shell-helper.cjs').settingsPage(host);
  const provider = async (id) => {
    await host.evaluate(async (id) => {
      const s = await window.dock.snapshot();
      await window.dock.saveSettings(
        { ...s.settings.value, host: { ...s.settings.value.host, shellProvider: id } },
        s.settings.revision,
      );
    }, id);
  };
  const modelOf = (p) => p.evaluate(() => window.appdockPage.connect().then((c) => c.snapshot));
  const providerPage = (id) =>
    until(async () => {
      const p = await settingsPage();
      try {
        if ((await p.evaluate(() => window.appdockPage.connect())).providerAppletId === id)
          return p;
      } catch {}
    }, `provider ${id}`);
  const checks = [];
  try {
    await until(
      () => host.evaluate(() => window.dock.snapshot().then((s) => s.startupReady)),
      'startup',
    );
    await host.evaluate(() => window.dock.navigate('settings'));
    let shell = await settingsPage();
    assert.equal((await modelOf(shell)).schemaVersion, 2);
    assert.equal((await modelOf(shell)).content.editing.dirty, undefined);
    assert.equal(
      await shell.getByRole('button', { name: '変更をすべて保存', exact: true }).count(),
      0,
    );
    assert.equal(JSON.stringify(await modelOf(shell)).includes('never-in-shell'), false);
    assert.equal(await shell.evaluate(() => typeof window.dock), 'undefined');
    await require('./shell-page-layout-helper.cjs').exerciseLayout(host, shell, app, 'settings');
    await shell.getByLabel('テーマ', { exact: true }).selectOption('light');
    await settleSettings(shell);
    assert.equal(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.host.theme,
      'light',
    );
    checks.push(
      'schema 2 page-only public model, no global save or dirty state, immediate durable theme and native layout',
    );
    const category = async (name) => {
      await shell
        .locator('.settings-categories button')
        .filter({ has: shell.locator('span[title="' + name + '"]') })
        .click();
    };
    await category('プロフィール');
    await shell.getByLabel('ユーザー名', { exact: true }).fill('Immediate profile');
    await settleSettings(shell);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'))).profile.name,
      'Immediate profile',
    );
    const name = shell.getByLabel('ユーザー名', { exact: true });
    await name.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '変換確定');
      el.dispatchEvent(
        new InputEvent('input', { bubbles: true, isComposing: true, data: '変換確定' }),
      );
    });
    assert.equal(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.profile.name,
      'Immediate profile',
    );
    await name.evaluate((el) =>
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '変換確定' })),
    );
    await settleSettings(shell);
    assert.equal(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.profile.name,
      '変換確定',
    );
    // Rapid confirmed events must serialize without losing a newer character.
    await name.fill('');
    await name.pressSequentially('Rapid typing');
    await settleSettings(shell);
    assert.equal(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.profile.name,
      'Rapid typing',
    );
    await shell
      .getByLabel('アバター画像を選択', { exact: true })
      .setInputFiles(path.join(root, 'assets/icon.png'));
    await until(
      async () =>
        !!(await host.evaluate(() => window.dock.snapshot())).settings.value.profile.avatar,
      'avatar immediate',
    );
    assert.equal(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.profile.avatar,
      'data/assets/profile/icon.png',
    );
    checks.push(
      'text and rapid typing persist immediately; IME remains local until confirmed; avatar saves original bytes/name without staging',
    );
    if (app) {
      await app.evaluate(() => {
        const r = process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json')(
          './out/main/main/core/settings',
        );
        globalThis.immediateSaveFixture = {
          original: r.SettingsStore.prototype.save,
          prototype: r.SettingsStore.prototype,
        };
        r.SettingsStore.prototype.save = function () {
          throw Error('synthetic disk save failure');
        };
      });
      await name.fill('Rejected input');
      await shell.getByRole('alert').first().waitFor();
      assert.equal(await name.inputValue(), 'Rejected input');
      assert.equal(
        (await host.evaluate(() => window.dock.snapshot())).settings.value.profile.name,
        'Rapid typing',
      );
      await app.evaluate(() => {
        globalThis.immediateSaveFixture.prototype.save = globalThis.immediateSaveFixture.original;
        delete globalThis.immediateSaveFixture;
      });
      await name.fill('Retry confirmed');
      await settleSettings(shell);
      assert.equal(
        (await host.evaluate(() => window.dock.snapshot())).settings.value.profile.name,
        'Retry confirmed',
      );
      checks.push(
        'save-failure fixture preserves local input and durable value; explicit corrected input saves after recovery',
      );
    }
    await category('Settings fixture');
    await shell.getByLabel('Fixture amount', { exact: true }).fill('-');
    await shell.getByRole('alert').first().waitFor();
    assert.equal(await shell.getByLabel('Fixture amount', { exact: true }).inputValue(), '-');
    assert.notEqual(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.extensions[
        'fixture.settings'
      ]?.settings.amount,
      '-',
    );
    await shell.getByLabel('Fixture amount', { exact: true }).fill('9');
    await settleSettings(shell);
    assert.equal(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.extensions[
        'fixture.settings'
      ].settings.amount,
      9,
    );
    await shell.getByLabel('Fixture text', { exact: true }).fill('Shared durable text');
    await settleSettings(shell);
    await shell.getByRole('button', { name: 'JSON', exact: true }).click();
    await shell.getByLabel('設定JSON').fill('{invalid');
    await shell.getByRole('alert').first().waitFor();
    assert.equal('text' in (await host.evaluate(() => window.dock.settingsEditing())), false);
    await category('表示');
    await category('Settings fixture');
    assert.equal(
      await shell.getByLabel('Fixture text', { exact: true }).inputValue(),
      'Shared durable text',
    );
    await shell.getByRole('button', { name: 'JSON', exact: true }).click();
    const before = JSON.parse(await shell.getByLabel('設定JSON').inputValue());
    before.extensions['fixture.settings'].settings.amount = 11;
    await shell.getByLabel('設定JSON').fill(JSON.stringify(before));
    await settleSettings(shell);
    assert.equal(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.extensions[
        'fixture.settings'
      ].settings.amount,
      11,
    );
    await shell.getByRole('button', { name: 'フォーム', exact: true }).click();
    checks.push(
      'incomplete numbers/JSON never enter main state; correction and valid scoped JSON save, leaving the page drops local incomplete input',
    );
    await provider('fixture.settings-shell');
    shell = await providerPage('fixture.settings-shell');
    assert.equal(
      await shell.getByLabel('Fixture text', { exact: true }).inputValue(),
      'Shared durable text',
    );
    // A stale page projection cannot overwrite an externally changed field.
    const stale = await modelOf(shell);
    await host.evaluate(async () => {
      const s = await window.dock.snapshot();
      const v = structuredClone(s.settings.value);
      v.extensions['fixture.settings'].settings.amount = 12;
      await window.dock.saveSettings(v, s.settings.revision);
    });
    const rejected = await shell.evaluate(async (old) => {
      const m = (await window.appdockPage.connect()).snapshot;
      const next = structuredClone(old.content.values);
      next.extensions['fixture.settings'].settings.amount = 13;
      try {
        await window.appdockPage.act({
          id: m.id,
          type: 'settings',
          sessionId: m.content.editing.sessionId,
          editRevision: m.content.editing.editRevision,
          operationId: crypto.randomUUID(),
          operation: {
            kind: 'edit',
            action: {
              type: 'page-values',
              pageId: m.content.page.id,
              before: old.content.values,
              value: next,
            },
          },
        });
        return false;
      } catch {
        return true;
      }
    }, stale);
    assert.equal(rejected, true);
    assert.equal(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.extensions[
        'fixture.settings'
      ].settings.amount,
      12,
    );
    checks.push(
      'public compatible custom Shell shares persisted values; stale same-field edit cannot overwrite an external update',
    );
    if (app) {
      await app.evaluate(({ webContents }) =>
        webContents
          .getAllWebContents()
          .find(
            (w) =>
              w.getURL().includes('/fixture.settings-shell/') &&
              w.getURL().endsWith('/settings.html'),
          )
          .forcefullyCrashRenderer(),
      );
      shell = await providerPage('appdock.default-shell');
      assert.equal(await shell.getByLabel('Fixture amount', { exact: true }).inputValue(), '12');
      checks.push('crashed settings provider falls back with persisted settings intact');
    }
    await provider('fixture.old-settings');
    shell = await providerPage('appdock.default-shell');
    assert.equal(await shell.getByLabel('Fixture amount', { exact: true }).inputValue(), '12');
    checks.push(
      'pre-0.33 settings provider falls back per region without loading incompatible controls',
    );
    await provider('fixture.stalled-settings');
    shell = await providerPage('appdock.default-shell');
    assert.equal(await shell.getByLabel('Fixture amount', { exact: true }).inputValue(), '12');
    await host.evaluate(() => window.dock.navigate('home'));
    const state = await host.evaluate(() => window.dock.settingsEditing());
    for (const key of ['draft', 'dirty', 'buffers', 'text', 'avatarChanged', 'saveError'])
      assert.equal(key in state, false);
    assert.equal(
      context.pages().some((p) => p.url().endsWith('/notifications.html')),
      false,
    );
    checks.push(
      'no global draft, partial buffer, staged avatar or unsaved banner survives navigation',
    );
    await close();
    host = await launch(['--safe-shell']);
    await until(
      () => host.evaluate(() => window.dock.snapshot().then((s) => s.startupReady)),
      'restart',
    );
    await host.evaluate(() => window.dock.navigate('settings'));
    shell = await providerPage('appdock.default-shell');
    const saved = JSON.parse(fs.readFileSync(path.join(profile, 'settings.json')));
    assert.equal(saved.extensions['fixture.settings'].settings.amount, 12);
    assert.equal(saved.profile.avatar, 'data/assets/profile/icon.png');
    assert.equal(saved.extensions['missing.applet'].settings.private, 'never-in-shell');
    checks.push(
      'restart and safe Shell retain immediate settings/assets and unrelated private values',
    );
    const result = {
      success: true,
      profile,
      checks,
      mode: portable ? 'portable' : 'source',
      sha256: portable ? hash(portable) : null,
    };
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally {
    if (app)
      await app
        .evaluate(() => {
          if (globalThis.immediateSaveFixture)
            globalThis.immediateSaveFixture.prototype.save =
              globalThis.immediateSaveFixture.original;
        })
        .catch(() => {});
    await close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

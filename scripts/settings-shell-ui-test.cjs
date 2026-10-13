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
for (const id of ['fixture.settings-shell', 'fixture.stalled-settings'])
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
    await shell.getByLabel('テーマ', { exact: true }).waitFor();
    await require('./shell-page-layout-helper.cjs').exerciseLayout(host, shell, app, 'settings');
    checks.push('settings fill the host area across notification, resize and zoom changes');
    const model = await shell.evaluate(() => window.appdockPage.connect().then((c) => c.snapshot));
    assert.deepEqual(Object.keys(model.content.values), ['host']);
    assert.deepEqual(Object.keys(model.content.values.host), ['theme']);
    assert.equal(JSON.stringify(model).includes('never-in-shell'), false);
    assert.equal(await shell.evaluate(() => typeof window.dock), 'undefined');
    await shell.getByLabel('テーマ', { exact: true }).selectOption('light');
    await shell.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      () =>
        host.evaluate(() =>
          window.dock.snapshot().then((s) => s.settings.value.host.theme === 'light'),
        ),
      'save theme',
    );
    checks.push('public settings region / page-only values / shared session save');
    for (const [name, label] of [
      ['一般', 'スタートアップに登録'],
      ['通知', 'Appletからの通知を許可'],
      ['リボン', 'リボン設定'],
      ['タスクトレイ', 'タスクトレイ設定'],
      ['ショートカット', 'ショートカットの絞り込み'],
      ['マウスジェスチャー', 'マウスジェスチャーを有効にする'],
      ['Webアカウント', 'Webアカウント設定'],
      ['操作の許可', '操作の許可'],
      ['Codex連携', 'Codex連携'],
      ['プロフィール', 'ユーザー名'],
      ['バージョン情報・更新', 'バージョン情報・更新'],
    ]) {
      await shell
        .getByRole('complementary', { name: '設定一覧' })
        .getByRole('button', { name, exact: true })
        .click();
      await shell.getByLabel(label, { exact: true }).first().waitFor();
      assert.deepEqual(await shell.getByRole('alert').allTextContents(), [], `category ${name}`);
    }
    checks.push('all twelve host categories render with page-scoped models');
    await shell.getByRole('button', { name: 'プロフィール', exact: true }).click();
    await shell.getByLabel('ユーザー名', { exact: true }).fill('Shared unsaved profile');
    const savedProfile = (await host.evaluate(() => window.dock.snapshot())).settings.value.profile
      .name;
    await shell.getByRole('button', { name: 'Webアカウント', exact: true }).click();
    await shell.getByRole('button', { name: 'アカウント枠を追加', exact: true }).click();
    await until(
      () => host.evaluate(() => window.dock.snapshot().then((s) => s.webAccounts.length === 1)),
      'immediate web account',
    );
    await shell.getByRole('button', { name: '操作の許可', exact: true }).click();
    const grant = shell.getByRole('switch', { name: 'Applet：公開情報の取得', exact: true });
    await grant.click();
    await until(
      () =>
        host.evaluate(() =>
          window.dock.snapshot().then((s) => s.appletApi.permissions.read === false),
        ),
      'immediate permission',
    );
    assert.equal(
      (await host.evaluate(() => window.dock.snapshot())).settings.value.profile.name,
      savedProfile,
    );
    assert.equal(
      (await host.evaluate(() => window.dock.settingsEditing())).draft.profile.name,
      'Shared unsaved profile',
    );
    await shell.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await shell.getByText('すべて保存されています', { exact: true }).waitFor();
    checks.push('Web account and permission immediate saves preserve independent shared draft');
    await shell
      .getByRole('complementary', { name: '設定一覧' })
      .getByRole('button', { name: '表示', exact: true })
      .click();
    for (const width of [1280, 900, 700]) {
      if (app)
        await app.evaluate(
          ({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 680),
          width,
        );
      await shell.waitForTimeout(100);
      assert.ok(await shell.getByLabel('テーマ', { exact: true }).isVisible());
      const sizes = await shell.evaluate(() => ({
        w: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(sizes.scroll <= sizes.w + 1);
      await shell.screenshot({ path: path.join(profile, `settings-${width}.png`) });
    }
    checks.push(
      app
        ? 'full settings area at 1280 / 900 / 700; no horizontal overflow'
        : 'fixed EXE settings area at initial window size; no horizontal overflow',
    );
    await shell.getByRole('button', { name: 'JSON', exact: true }).click();
    await shell.getByLabel('設定JSON').fill('{bad');
    await until(() => shell.getByRole('alert').count(), 'invalid JSON');
    await shell.getByRole('button', { name: '一般', exact: true }).click();
    assert.equal(await shell.getByLabel('設定JSON').inputValue(), '{bad');
    checks.push('partial JSON rejects navigation and keeps raw text');
    await host.evaluate(() => window.dock.navigate('home'));
    await host.evaluate(() => window.dock.navigate('settings'));
    shell = await settingsPage();
    assert.equal(await shell.getByLabel('設定JSON').inputValue(), '{bad');
    await shell.getByLabel('設定JSON').fill('{"host":{"theme":"light"}}');
    await shell.getByRole('button', { name: 'フォーム', exact: true }).click();
    await host.evaluate(() => window.dock.navigate('extensions'));
    await host
      .getByRole('complementary', { name: 'Applet一覧' })
      .getByRole('button', { name: /Settings fixture/ })
      .click();
    await host.getByRole('tab', { name: '設定', exact: true }).click();
    shell = await settingsPage();
    await require('./shell-page-layout-helper.cjs').assertLayout(host, shell, app, true);
    await shell.getByLabel('Fixture text', { exact: true }).fill('shared from detail');
    await shell.getByLabel('Fixture amount', { exact: true }).fill('-');
    await host.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await host.getByRole('alert').first().waitFor();
    assert.equal(await shell.getByLabel('Fixture amount', { exact: true }).inputValue(), '-');
    await host.evaluate(() => window.dock.navigate('settings'));
    shell = await settingsPage();
    assert.equal(
      await shell.getByLabel('Fixture text', { exact: true }).inputValue(),
      'shared from detail',
    );
    assert.equal(await shell.getByLabel('Fixture amount', { exact: true }).inputValue(), '-');
    await shell.getByLabel('Fixture amount', { exact: true }).fill('7');
    await shell.getByRole('button', { name: 'JSON', exact: true }).click();
    const part = JSON.parse(await shell.getByLabel('設定JSON').inputValue());
    assert.deepEqual(Object.keys(part.extensions), ['fixture.settings']);
    assert.equal(part.extensions['fixture.settings'].settings['text.value'], 'shared from detail');
    await shell.getByRole('button', { name: 'フォーム', exact: true }).click();
    await shell.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      () =>
        host.evaluate(() =>
          window.dock
            .snapshot()
            .then((s) => s.settings.value.extensions['fixture.settings'].settings.amount === 7),
        ),
      'save shared detail',
    );
    assert.notEqual(
      (await host.evaluate(() => window.dock.snapshot())).extensions.find(
        (a) => a.id === 'fixture.settings',
      ).state,
      'running',
    );
    checks.push(
      'detail/full body reuse, numeric raw buffer, dotted key JSON, whole-session save without starting Applet',
    );
    // Composition is not accepted until compositionend; simulate the browser event contract.
    const input = shell.getByLabel('Fixture text', { exact: true });
    await input.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '変換中');
      el.dispatchEvent(
        new InputEvent('input', { bubbles: true, isComposing: true, data: '変換中' }),
      );
    });
    assert.equal(
      (await modelOf(shell)).content.values.extensions['fixture.settings'].settings['text.value'],
      'shared from detail',
    );
    await input.evaluate((el) =>
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '変換中' })),
    );
    await until(
      async () =>
        (await modelOf(shell)).content.values.extensions['fixture.settings'].settings[
          'text.value'
        ] === '変換中',
      'IME confirmed',
    );
    checks.push('composition held locally until confirmation');
    await provider('fixture.settings-shell');
    shell = await providerPage('fixture.settings-shell');
    assert.equal(await shell.getByLabel('Fixture text', { exact: true }).inputValue(), '変換中');
    assert.equal((await modelOf(shell)).content.editing.conflict, true);
    const denied = await shell.evaluate(async () => {
      const m = (await window.appdockPage.connect()).snapshot;
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
              value: { host: { theme: 'dark' } },
            },
          },
        });
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(denied, true);
    checks.push(
      'independent public Shell fixture, revision conflict and out-of-scope edit rejected',
    );
    if (app) {
      await app.evaluate(({ webContents }) => {
        webContents
          .getAllWebContents()
          .find(
            (w) =>
              w.getURL().includes('/fixture.settings-shell/') &&
              w.getURL().endsWith('/settings.html'),
          )
          .forcefullyCrashRenderer();
      });
      shell = await providerPage('appdock.default-shell');
      assert.equal(await shell.getByLabel('Fixture text', { exact: true }).inputValue(), '変換中');
      checks.push('crashed custom Shell restores accepted input in Default Shell');
    }
    await provider('fixture.stalled-settings');
    await until(
      () =>
        context
          .pages()
          .some(
            (p) =>
              p.url().includes('/fixture.stalled-settings/') && p.url().endsWith('/settings.html'),
          ),
      'unready settings surface created',
    );
    shell = await providerPage('appdock.default-shell');
    assert.equal(await shell.getByLabel('Fixture text', { exact: true }).inputValue(), '変換中');
    await shell.getByRole('button', { name: '変更を破棄して再読み込み', exact: true }).click();
    await shell.getByText('すべて保存されています', { exact: true }).waitFor();
    await close();
    host = await launch(['--safe-shell']);
    await until(
      () => host.evaluate(() => window.dock.snapshot().then((s) => s.startupReady)),
      'safe startup',
    );
    await host.evaluate(() => window.dock.navigate('settings'));
    await providerPage('appdock.default-shell');
    checks.push('unready provider fallback / safe-shell / session-wide reload');
    fs.writeFileSync(
      path.join(profile, 'result.json'),
      JSON.stringify(
        {
          success: true,
          checks,
          profile,
          mode: portable ? 'portable' : 'source',
          sha256: portable ? hash(portable) : undefined,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        {
          success: true,
          checks,
          profile,
          mode: portable ? 'portable' : 'source',
          sha256: portable ? hash(portable) : undefined,
        },
        null,
        2,
      ),
    );
  } finally {
    await close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

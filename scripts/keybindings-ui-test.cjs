const { _electron: electron } = require('playwright');
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `keybindings-${Date.now()}`);
const fixture = path.join(profile, 'extensions', 'test.keys');
fs.mkdirSync(fixture, { recursive: true });
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.host.notifications = false;
settings.globalShortcutCommands = [];
settings.extensions['test.keys'] = { enabled: true, settings: {} };
settings.extensions['at365.gmail'] = { enabled: false, settings: { notifications: false } };
fs.cpSync(
  path.resolve(root, '../Applet.Gmail.at365/publish/Applet.Gmail.at365'),
  path.join(profile, 'extensions', 'Applet.Gmail.at365'),
  { recursive: true },
);
fs.writeFileSync(
  path.join(fixture, 'extension.json'),
  JSON.stringify({
    apiVersion: 1,
    id: 'test.keys',
    name: 'Shortcut fixture',
    displayName: 'キー検証',
    version: '1.0.0',
    runtime: 'node',
    entry: 'index.js',
    capabilities: ['pages', 'storage'],
    commands: [
      { id: 'test.keys.open', title: '検証ページを開く', activateOnExecute: true },
      ...['a', 'b', 'c', 'd'].map((x) => ({
        id: `test.keys.${x}`,
        title: `記録${x.toUpperCase()}`,
      })),
    ],
    pages: [
      {
        id: 'main',
        title: 'キー検証',
        source: 'local',
        ui: 'index.html',
        openCommand: 'test.keys.open',
      },
    ],
  }),
);
fs.writeFileSync(
  path.join(fixture, 'index.js'),
  `exports.activate=async c=>{let calls=[];c.commands.register('test.keys.open','Open',()=>c.pages.open('main'));for(const x of ['a','b','c','d'])c.commands.register('test.keys.'+x,'Record '+x,async()=>{calls.push(x);await c.storage.set('calls'+String(calls.length).padStart(5,'0'),x);});};`,
);
fs.writeFileSync(path.join(fixture, 'index.html'), '<h1>Keys</h1><input aria-label="Text">');
const webId = 'web.' + randomUUID(),
  accountId = 'account.' + randomUUID();
const make = (id, command, scope, appletIds = [], key = 'Ctrl+F12') => ({
  id,
  command,
  key,
  enabled: true,
  when: { scope, appletIds },
});
settings.keybindings = [
  make('all', 'test.keys.a', 'app'),
  make('pages', 'test.keys.b', 'pages'),
  make('selected', 'test.keys.c', 'applets', ['test.keys', webId]),
  make('duplicate', 'test.keys.a', 'pages'),
  make('global', 'test.keys.d', 'global', [], 'Ctrl+Alt+F10'),
  make('local-global', 'test.keys.a', 'app', [], 'Ctrl+Alt+F10'),
  make('search', 'appdock.commands.search', 'app', [], 'Ctrl+P'),
];
const server = http.createServer((_, res) => res.end('<h1>Remote fixture</h1><input id="text">'));
const calls = () => {
  const d = path.join(profile, '.appdock/storage/test.keys');
  try {
    return fs
      .readdirSync(d)
      .filter((n) => /^calls[0-9]+[.]json$/.test(n))
      .sort()
      .map((n) => JSON.parse(fs.readFileSync(path.join(d, n), 'utf8')));
  } catch {
    return [];
  }
};
const until = async (fn, label) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    const result = await fn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(label);
};
let app, dock;
const checks = [];
const save = async (rows) =>
  dock.evaluate(async (keybindings) => {
    const s = await window.dock.snapshot();
    s.settings.value.keybindings = keybindings;
    await window.dock.saveSettings(s.settings.value, s.settings.revision);
  }, rows);
const send = async (suffix, key = 'F12', modifiers = ['control']) =>
  app.evaluate(
    async ({ webContents, BrowserWindow }, { suffix, key, modifiers }) => {
      const wc = webContents.getAllWebContents().find((w) => w.getURL().endsWith(suffix));
      if (!wc) throw Error('Missing ' + suffix);
      const windows = BrowserWindow.getAllWindows();
      const contains = (view) => view.webContents === wc || (view.children ?? []).some(contains);
      const win = windows.find((w) => w.webContents === wc || contains(w.contentView));
      if (!win) throw Error('No owning window');
      win.show();
      win.focus();
      await new Promise((r) => setTimeout(r, 150));
      if (!win.isFocused()) throw Error('Focus denied');
      wc.focus();
      wc.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers });
      wc.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers });
    },
    { suffix, key, modifiers },
  );
const sendGlobal = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(root, 'scripts/send-test-hotkey.ps1'),
        '-VirtualKey',
        '121',
        '-Control',
        '-Alt',
        '-ScanCode',
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
    });
    child.stderr.on('data', (data) => {
      output += data;
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(Error(output || `SendInput helper exit ${code}`)),
    );
  });
const expectCalls = async (before, expected) => {
  await until(() => calls().length >= before + expected.length, 'Expected ' + expected);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(calls().slice(before), expected);
};
(async () => {
  try {
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    settings.webApplets = {
      accounts: [{ id: accountId, name: 'Test' }],
      items: [
        {
          id: webId,
          name: 'Webキー検証',
          url: `http://127.0.0.1:${server.address().port}/`,
          accountId,
          enabled: true,
          display: 'page',
          navigation: 'none',
          allowedOrigins: [],
          icon: '',
        },
      ],
    };
    fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
    app = await electron.launch({
      executablePath: process.argv[2] ? path.resolve(process.argv[2]) : require('electron'),
      args: process.argv[2] ? [`--test-profile=${profile}`] : [root, `--test-profile=${profile}`],
      timeout: 30000,
    });
    dock = await app.firstWindow();
    await dock.waitForFunction(() => !!window.dock);
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).extensions.find(
          (e) => e.id === 'test.keys',
        )?.state === 'running',
      'Fixture ready',
    );
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.show();
      w.focus();
    });
    // Exercise native input separately, before Chromium synthetic key events.
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).globalHotKeys.some(
          (s) => s.shortcut === 'Ctrl+Alt+F10' && s.registered,
        ),
      'F10 Windows registration',
    );
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find(
        (w) => w.isVisible() && w.webContents.getURL().startsWith('appdock:'),
      );
      w?.focus();
    });
    await new Promise((r) => setTimeout(r, 300));
    const globalBefore = calls().length;
    await sendGlobal();
    await expectCalls(globalBefore, ['d', 'a']);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.hide()),
    );
    const hiddenBefore = calls().length;
    await sendGlobal();
    await expectCalls(hiddenBefore, ['d']);
    checks.push('real Windows global key: local overlap once, hidden global only');
    let before = calls().length;
    await send('appdock://host/index.html');
    await expectCalls(before, ['a']);
    checks.push('host scope excludes pages');
    await dock.evaluate(() => window.dock.executeCommand('test.keys.open'));
    await until(
      () =>
        app
          .context()
          .pages()
          .find((p) => p.url().endsWith('/test.keys/index.html')),
      'Local page',
    );
    await new Promise((r) => setTimeout(r, 500));
    before = calls().length;
    await send('/test.keys/index.html');
    await expectCalls(before, ['a', 'b', 'c']);
    checks.push('local page: ordered all-match and dedup');
    await save([...settings.keybindings, make('owner', 'test.keys.d', 'owner')]);
    before = calls().length;
    await send('/test.keys/index.html');
    await expectCalls(before, ['a', 'b', 'c', 'd']);
    // First action opens a different page: later commands still use captured matching rules.
    await save([make('switch', `${webId}.open`, 'pages'), ...settings.keybindings]);
    before = calls().length;
    await send('/test.keys/index.html');
    await expectCalls(before, ['a', 'b', 'c']);
    const remote = await until(
      () =>
        app
          .context()
          .pages()
          .find((p) => p.url() === settings.webApplets.items[0].url),
      'Web page',
    );
    await new Promise((r) => setTimeout(r, 500));
    await save([...settings.keybindings, make('owner', 'test.keys.d', 'owner')]);
    before = calls().length;
    await send(settings.webApplets.items[0].url);
    await expectCalls(before, ['a', 'b', 'c']);
    await save(settings.keybindings);
    checks.push('owner scope runs only on the command provider page, not another Applet');
    checks.push(
      'WebApplet supports cross-Applet commands, multi-target conditions, captured context',
    );
    await remote.locator('#text').fill('入力保持');
    await send(settings.webApplets.items[0].url, 'A', []);
    assert.equal(await remote.locator('#text').inputValue(), '入力保持'); // sendInputEvent keyDown is not a char event
    await remote.locator('#text').press('b');
    assert.equal(await remote.locator('#text').inputValue(), '入力保持b');
    await dock.evaluate(async (id) => {
      const s = await window.dock.snapshot();
      s.settings.value.webApplets.items.find((i) => i.id === id).display = 'window';
      await window.dock.saveSettings(s.settings.value, s.settings.revision);
      await window.dock.executeCommand(id + '.open');
    }, webId);
    before = calls().length;
    await send(settings.webApplets.items[0].url);
    await expectCalls(before, ['a', 'b', 'c']);
    checks.push('standalone page retains context and input');
    await app.evaluate(({ app }) =>
      app.on('session-created', (ses) => {
        if (ses.isPersistent())
          ses.protocol.handle(
            'https',
            () =>
              new Response(
                '<main role="main"><h1>Offline Gmail</h1><input aria-label="mail input"></main>',
                { headers: { 'content-type': 'text/html; charset=utf-8' } },
              ),
          );
      }),
    );
    await dock.evaluate(() => window.dock.executeCommand('at365.gmail.open'));
    const gmailUi = await until(
      () =>
        app
          .context()
          .pages()
          .find((p) => p.url().endsWith('/web/index.html')),
      'Gmail UI',
    );
    const gmail = await until(
      () =>
        app
          .context()
          .pages()
          .find((p) => p.url().startsWith('https://mail.google.com/')),
      'Gmail body',
    );
    await new Promise((r) => setTimeout(r, 600));
    before = calls().length;
    await send(gmailUi.url());
    await expectCalls(before, ['a', 'b']);
    const gmailRows = settings.keybindings.map((r) =>
      r.id === 'selected'
        ? { ...r, when: { ...r.when, appletIds: [...r.when.appletIds, 'at365.gmail'] } }
        : r,
    );
    await save(gmailRows);
    before = calls().length;
    await send(gmail.url());
    await expectCalls(before, ['a', 'b', 'c']);
    await save(settings.keybindings);
    await dock.evaluate((id) => window.dock.executeCommand(id + '.open'), webId);
    checks.push('Gmail local UI and offline remote body use shared scope resolver');
    await dock.evaluate(() => window.dock.executeCommand('appdock.settings.open'));
    await dock.getByRole('button', { name: 'ショートカット', exact: true }).click();
    await dock.getByLabel('ショートカットのコマンドを検索').fill('test.keys.c');
    const row = dock.locator('[data-binding-id="selected"]');
    await row.getByRole('button', { name: /キー検証/ }).click();
    assert.equal(
      await row
        .getByRole('group', { name: '対象Applet' })
        .getByRole('checkbox', { checked: true })
        .count(),
      2,
    );
    await row.getByRole('button', { name: '閉じる', exact: true }).click();
    await row.getByRole('button', { name: '割り当てを追加' }).click();
    assert.equal(await dock.locator('[data-shortcut-command="test.keys.c"]').count(), 2);
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).settings.value.keybindings.filter(
          (r) => r.command === 'test.keys.c',
        ).length === 2,
      'Saved extra binding',
    );
    const recorder = row.locator('[data-shortcut-recorder]');
    await recorder.focus();
    await until(
      async () =>
        !(await dock.evaluate(() => window.dock.snapshot())).globalHotKeys.some(
          (s) => s.registered,
        ),
      'Recorder suspends OS keys',
    );
    await recorder.press('Control+Shift+F11');
    await recorder.press('Escape');
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).settings.value.keybindings.find(
          (r) => r.id === 'selected',
        ).key === 'Ctrl+Shift+F11',
      'Recorded key saved',
    );
    await row.getByRole('button', { name: '実行順を上げる' }).click();
    await row.getByRole('checkbox', { name: /割り当てを有効/ }).uncheck();
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      async () =>
        !(await dock.evaluate(() => window.dock.snapshot())).settings.value.keybindings.find(
          (r) => r.id === 'selected',
        ).enabled,
      'Disabled state saved',
    );
    const saved = JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8'));
    assert.equal(saved.keybindings[1].id, 'selected');
    assert.equal(saved.keybindings[1].enabled, false);
    assert.equal(saved.keybindings[1].key, 'Ctrl+Shift+F11');
    assert.equal(saved.keybindings[1].when.scope, 'applets');
    assert.deepEqual(await row.locator('select option').allTextContents(), [
      'グローバル',
      'AppDock全体',
      'すべてのApplet',
      'キー検証',
      '指定したApplet',
    ]);
    await row.locator('select').selectOption('owner');
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).settings.value.keybindings.find(
          (r) => r.id === 'selected',
        ).when.scope === 'owner',
      'Owner scope saved',
    );
    const ownerSaved = JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'), 'utf8'));
    assert.deepEqual(ownerSaved.keybindings.find((r) => r.id === 'selected').when, {
      scope: 'owner',
      appletIds: [],
    });
    await save([...ownerSaved.keybindings, make('gmail-owner', 'at365.gmail.open', 'owner')]);
    await dock.getByLabel('ショートカットのコマンドを検索').fill('at365.gmail.open');
    assert.equal(
      await dock.locator('[data-binding-id="gmail-owner"] option[value="owner"]').textContent(),
      'Gmail',
    );
    await dock.getByLabel('ショートカットのコマンドを検索').fill('appdock.commands.search');
    assert.equal(await dock.locator('[data-binding-id="search"] option[value="owner"]').count(), 0);
    await dock.getByLabel('ショートカットのコマンドを検索').fill('test.keys.c');
    checks.push(
      'scope options ordered with provider name only, host exclusion and owner persistence',
    );
    assert.equal(await row.locator('.command-id').textContent(), 'test.keys.c');
    for (const [command, key, scope] of [
      ['test.keys.open', 'Control+Shift+F9', 'owner'],
      ['appdock.restart', 'Control+Shift+F8', 'app'],
    ]) {
      await dock.getByLabel('ショートカットのコマンドを検索').fill(command);
      const entry = dock.locator(`[data-shortcut-command="${command}"]`);
      await entry.locator('[data-shortcut-recorder]').focus();
      await entry.locator('[data-shortcut-recorder]').press(key);
      assert.equal(await entry.locator('select').inputValue(), scope);
      assert.equal(await entry.locator('.command-id').textContent(), command);
      await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
      await until(
        async () =>
          (await dock.evaluate(() => window.dock.snapshot())).settings.value.keybindings.some(
            (r) => r.command === command && r.when.scope === scope,
          ),
        'Default scope saved',
      );
    }
    await dock.getByLabel('ショートカットのコマンドを検索').fill('test.keys.c');
    await dock.screenshot({ path: path.join(profile, 'shortcuts-dark.png') });
    await dock.evaluate(async () => {
      const s = await window.dock.snapshot();
      s.settings.value.host.theme = 'light';
      await window.dock.saveSettings(s.settings.value, s.settings.revision);
    });
    await new Promise((r) => setTimeout(r, 300));
    await dock.screenshot({ path: path.join(profile, 'shortcuts-light.png') });
    checks.push(
      'table, multi-select, duplicate binding, recording suspension, order, disable, persistence and themes',
    );
    await dock.evaluate(async () => {
      const s = await window.dock.snapshot();
      s.settings.value.pinnedCommands = ['test.keys.a'];
      await window.dock.saveSettings(s.settings.value, s.settings.revision);
    });
    await dock.locator('[data-ribbon-id="home"]').click();
    assert.equal(await dock.locator('.home-pins .command-id').textContent(), 'test.keys.a');
    await dock.evaluate(() => window.dock.executeCommand('appdock.commands.search'));
    await dock.getByPlaceholder('コマンドを入力…').fill('test.keys.a');
    assert.equal(await dock.locator('.palette-command .command-id').textContent(), 'test.keys.a');
    await dock.screenshot({ path: path.join(profile, 'command-ids.png') });
    await dock.getByPlaceholder('コマンドを入力…').fill('キー検証');
    assert.ok((await dock.locator('.palette-command').count()) >= 5);
    checks.push(
      'new Applet/host binding defaults, unchanged existing scopes and full searchable IDs in settings, palette and home',
    );
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify({ checks }, null, 2));
    console.log(JSON.stringify({ profile, checks }, null, 2));
  } finally {
    if (app) await app.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

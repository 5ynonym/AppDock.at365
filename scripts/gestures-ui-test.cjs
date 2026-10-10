const { _electron: electron, chromium } = require('playwright');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const { randomUUID, createHash } = require('node:crypto');
const net = require('node:net');
const webId = 'web.' + randomUUID(),
  accountId = 'account.' + randomUUID();
const server = http.createServer((req, res) =>
  res.end('<h1>Gesture web fixture</h1><input aria-label="Web入力">'),
);
const root = path.resolve(__dirname, '..'),
  profile = path.join(root, '.artifacts', `gestures-ui-${Date.now()}`);
const fixture = path.join(profile, 'extensions', 'test.gestures');
fs.mkdirSync(fixture, { recursive: true });
fs.writeFileSync(
  path.join(fixture, 'extension.json'),
  JSON.stringify({
    apiVersion: 1,
    id: 'test.gestures',
    name: 'ジェスチャー検証',
    version: '1.0.0',
    runtime: 'node',
    entry: 'index.js',
    capabilities: ['storage', 'pages'],
    commands: [
      { id: 'test.gestures.open', title: 'ページを開く', activateOnExecute: true },
      ...['a', 'b', 'c'].map((x) => ({ id: `test.gestures.${x}`, title: '記録' + x })),
    ],
    pages: [
      {
        id: 'main',
        title: '検証ページ',
        source: 'local',
        ui: 'index.html',
        openCommand: 'test.gestures.open',
      },
    ],
  }),
);
fs.writeFileSync(
  path.join(fixture, 'index.js'),
  `exports.activate=async c=>{let n=0;c.commands.register('test.gestures.open','Open',()=>c.pages.open('main'));for(const x of ['a','b','c'])c.commands.register('test.gestures.'+x,'記録'+x,async()=>{await c.storage.set('call'+String(++n).padStart(5,'0'),x);});};`,
);
fs.writeFileSync(
  path.join(fixture, 'index.html'),
  '<h1>Gesture fixture</h1><input aria-label="文字入力"><p>右ボタンを使う隔離試験ページ</p>',
);
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.host.notifications = false;
settings.extensions['test.gestures'] = { enabled: true, settings: {} };
const row = (id, command, scope, gesture = 'move-left', appletIds = []) => ({
  id,
  command: 'test.gestures.' + command,
  gesture,
  enabled: true,
  when: { scope, appletIds, processes: [] },
});
settings.gestures.bindings = [
  row('global', 'a', 'global'),
  row('app', 'b', 'app'),
  row('duplicate', 'a', 'app'),
];
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const calls = () => {
  const dir = path.join(profile, 'data/storage/test.gestures');
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => /^call\d+\.json$/.test(n))
      .sort()
      .map((n) => JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')));
  } catch {
    return [];
  }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, label) => {
  for (let i = 0; i < 100; i++) {
    if (await fn()) return;
    await wait(100);
  }
  throw Error(label);
};
const checks = [];
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  settings.webApplets = {
    accounts: [{ id: accountId, name: 'Test' }],
    items: [
      {
        id: webId,
        name: 'Webジェスチャー',
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
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  let portableChild, portableBrowser, portableHash;
  const portable = process.argv.includes('--portable');
  const app = portable
    ? await (async () => {
        const source = path.join(root, 'publish/AppDock.at365.exe'),
          executable = path.join(profile, 'AppDock.at365.exe');
        fs.copyFileSync(source, executable);
        const hash = (p) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        portableHash = hash(source);
        assert.equal(hash(executable), portableHash);
        const listener = net.createServer();
        await new Promise((r) => listener.listen(0, '127.0.0.1', r));
        const port = listener.address().port;
        await new Promise((r) => listener.close(r));
        portableChild = spawn(
          executable,
          [`--test-profile=${profile}`, `--remote-debugging-port=${port}`],
          { cwd: profile, env, windowsHide: true, stdio: 'ignore' },
        );
        await until(async () => {
          try {
            portableBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
              timeout: 1000,
            });
            return true;
          } catch {
            return false;
          }
        }, 'portable browser');
        const session = await portableBrowser.newBrowserCDPSession();
        const info = await session.send('SystemInfo.getProcessInfo');
        const pid = info.processInfo.find((p) => p.type === 'browser').id;
        const dock = portableBrowser.contexts()[0].pages()[0];
        return {
          firstWindow: async () => dock,
          evaluate: async () => `pid:${pid}`,
          close: async () => {
            await dock
              .evaluate(() => {
                void window.dock.executeCommand('appdock.quit');
              })
              .catch(() => {});
            await until(() => portableChild.exitCode !== null, 'portable exit');
            await portableBrowser.close();
            assert.equal(hash(executable), portableHash);
          },
        };
      })()
    : await electron.launch({
        executablePath: process.argv[2] ? path.resolve(process.argv[2]) : require('electron'),
        args: [...(process.argv[2] ? [] : [root]), `--test-profile=${profile}`],
        env,
      });
  try {
    const dock = await app.firstWindow();
    await dock.waitForFunction(async () => (await window.dock?.snapshot())?.startupReady);
    await dock.evaluate(() => window.dock.executeCommand('appdock.open'));
    await dock.bringToFront();
    await wait(300);
    const save = async (bindings) => {
      await dock.evaluate(async (bindings) => {
        const s = await window.dock.snapshot();
        s.settings.value.gestures.bindings = bindings;
        await window.dock.saveSettings(s.settings.value, s.settings.revision);
      }, bindings);
      await wait(250);
    };
    const send = async (gesture = 'move-left') => {
      const handle = await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
        w.show();
        w.focus();
        return w.getNativeWindowHandle().readBigUInt64LE().toString();
      });
      await wait(150);
      await new Promise((resolve, reject) => {
        const child = spawn(
          path.join(root, 'tests/InputTests/bin/Release/net10.0-windows/AppDock.InputTests.exe'),
          ['--send', handle, gesture],
          { windowsHide: true, stdio: 'pipe' },
        );
        child.on('error', reject);
        child.stdout.on('data', (d) => process.stdout.write(d));
        child.stderr.on('data', (d) => process.stderr.write(d));
        child.on('exit', (code) => (code === 0 ? resolve() : reject(Error('input ' + code))));
      });
    };
    const expect = async (expected) => {
      const n = calls().length;
      await send();
      try {
        await until(() => calls().length >= n + expected.length, 'expected ' + expected);
      } catch (error) {
        console.log('CALLS', calls());
        console.log('STATE', JSON.stringify(await dock.evaluate(() => window.dock.snapshot())));
        throw error;
      }
      assert.deepEqual(calls().slice(n), expected);
    };
    if (process.env.APPDOCK_GESTURE_UI_ONLY === '1') {
      await save([row('key', 'a', 'global', 'key:Ctrl+A')]);
      checks.push('native input checks skipped explicitly: UI-only mode');
    } else {
      await expect(['a', 'b']);
      checks.push('global/app order and duplicate suppression');
      await save([
        row('pages', 'a', 'pages'),
        row('owner', 'b', 'owner'),
        row('selected', 'c', 'applets', 'move-left', ['test.gestures']),
      ]);
      let n = calls().length;
      await send();
      await wait(200);
      assert.equal(calls().length, n);
      await dock.evaluate(() => window.dock.executeCommand('test.gestures.open'));
      await wait(400);
      await expect(['a', 'b', 'c']);
      checks.push('pages/owner/selected conditions');
      await dock.evaluate(async () => {
        const s = await window.dock.snapshot();
        s.settings.value.extensions['test.gestures'].pages = { main: { display: 'window' } };
        await window.dock.saveSettings(s.settings.value, s.settings.revision);
        await window.dock.executeCommand('test.gestures.open');
      });
      await wait(400);
      await expect(['a', 'b', 'c']);
      checks.push('detached Applet window conditions');
      await dock.evaluate(async () => {
        const s = await window.dock.snapshot();
        s.settings.value.extensions['test.gestures'].pages = { main: { display: 'page' } };
        await window.dock.saveSettings(s.settings.value, s.settings.revision);
      });
      await save([
        row('web-pages', 'a', 'pages'),
        row('other-owner', 'b', 'owner'),
        row('web-selected', 'c', 'applets', 'move-left', [webId]),
      ]);
      await dock.evaluate((id) => window.dock.executeCommand(id + '.open'), webId);
      await wait(500);
      await expect(['a', 'c']);
      checks.push('WebApplet scope without leaking provider condition');
      await dock.evaluate(async (id) => {
        const s = await window.dock.snapshot();
        s.settings.value.webApplets.items.find((i) => i.id === id).display = 'window';
        await window.dock.saveSettings(s.settings.value, s.settings.revision);
        await window.dock.executeCommand(id + '.open');
      }, webId);
      await wait(400);
      await expect(['a', 'c']);
      checks.push('detached WebApplet conditions');
      await save([row('key', 'a', 'global', 'key:A')]);
      n = calls().length;
      await send('key:A');
      await until(() => calls().length === n + 1, 'key gesture');
      checks.push('native key through host dispatcher');
      await save([row('key', 'a', 'global', 'key:Ctrl+A')]);
      n = calls().length;
      await send('key:Ctrl+A');
      await until(() => calls().length === n + 1, 'modified key gesture');
      checks.push('modifier key gesture');
    }
    await dock.evaluate(() => window.dock.executeCommand('appdock.settings.open'));
    await dock.getByRole('button', { name: 'マウスジェスチャー', exact: true }).click();
    const callCount = calls().length;
    await dock.getByLabel('追加するジェスチャー').selectOption('move-left');
    await dock.getByRole('button', { name: '割り当てを追加', exact: true }).click();
    const picker = dock.getByRole('dialog', { name: 'コマンドを選択', exact: true });
    const search = picker.getByRole('combobox', { name: 'コマンドを検索' });
    await search.fill('記録');
    await search.press('ArrowDown');
    assert.equal(
      await picker.locator('[aria-selected="true"]').getAttribute('data-command-id'),
      'test.gestures.b',
    );
    await search.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
    assert.equal(await picker.count(), 1);
    await dock.screenshot({ path: path.join(profile, 'palette-select.png') });
    await search.press('Enter');
    await until(async () => (await picker.count()) === 0, 'selected command closes picker');
    assert.equal(calls().length, callCount);
    const left = dock.locator('[data-gesture-group="move-left"]');
    await left.getByRole('button', { name: '← 左に割り当てを追加', exact: true }).click();
    await search.fill('test.gestures.a');
    await search.press('Enter');
    const rows = () => left.locator('[data-gesture-row]');
    assert.equal(await rows().count(), 2);
    assert.equal(
      (await dock.evaluate(() => window.dock.snapshot())).settings.value.gestures.bindings.length,
      1,
    );
    await left.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await dock.screenshot({ path: path.join(profile, 'before-drag.png') });
    await rows()
      .first()
      .getByRole('button', { name: /並べ替え/ })
      .dragTo(
        rows()
          .last()
          .getByRole('button', { name: /並べ替え/ }),
      );
    assert.deepEqual(await rows().locator('.command-id').allTextContents(), [
      'test.gestures.a',
      'test.gestures.b',
    ]);
    await rows()
      .first()
      .getByRole('button', { name: /並べ替え/ })
      .focus();
    await dock.keyboard.press('ArrowDown');
    assert.deepEqual(await rows().locator('.command-id').allTextContents(), [
      'test.gestures.b',
      'test.gestures.a',
    ]);
    await dock.keyboard.press('ArrowUp');
    assert.deepEqual(await rows().locator('.command-id').allTextContents(), [
      'test.gestures.a',
      'test.gestures.b',
    ]);
    const actions = () =>
      rows()
        .first()
        .getByRole('button', { name: /その他の操作/ });
    await actions().scrollIntoViewIfNeeded();
    const rowHeight = (await rows().first().boundingBox()).height;
    await actions().click();
    const menu = dock.getByRole('menu');
    assert.equal((await rows().first().boundingBox()).height, rowHeight);
    const popup = await menu.boundingBox();
    const viewport = await dock.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert.ok(
      popup.x >= 0 &&
        popup.y >= 0 &&
        popup.x + popup.width <= viewport.width &&
        popup.y + popup.height <= viewport.height,
    );
    await dock.screenshot({ path: path.join(profile, 'gestures-dropdown.png') });
    await dock.keyboard.press('ArrowDown');
    assert.equal(await dock.evaluate(() => document.activeElement?.textContent), '削除…');
    await dock.keyboard.press('Escape');
    assert.equal(await menu.count(), 0);
    assert.equal(await actions().evaluate((el) => el === document.activeElement), true);
    await actions().click();
    await actions().click();
    assert.equal(await menu.count(), 0);
    await actions().click();
    await left.getByRole('heading').click();
    assert.equal(await menu.count(), 0);
    await actions().press('ArrowDown');
    await menu.getByRole('menuitem', { name: '複製', exact: true }).click();
    assert.equal(await rows().count(), 3);
    await rows()
      .nth(1)
      .getByRole('button', { name: /その他の操作/ })
      .click();
    await menu.getByRole('menuitem', { name: '削除…', exact: true }).click();
    const confirmation = dock.getByRole('alertdialog', { name: '割り当ての削除確認' });
    assert.equal(await rows().count(), 3);
    await confirmation.getByRole('button', { name: 'キャンセル', exact: true }).click();
    assert.equal(await rows().count(), 3);
    await menu.getByRole('menuitem', { name: '削除…', exact: true }).click();
    await confirmation.getByRole('button', { name: '削除する', exact: true }).click();
    assert.equal(await rows().count(), 2);
    checks.push(
      'floating dropdown preserves row height, stays in viewport, supports arrows, Escape/focus return, toggle and outside click',
    );
    await rows().first().getByRole('switch').click();
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).settings.value.gestures.bindings
          .length === 3,
      'group save',
    );
    const savedRows = (await dock.evaluate(() => window.dock.snapshot())).settings.value.gestures
      .bindings;
    assert.equal(
      savedRows.find((r) => r.gesture === 'move-left' && r.command === 'test.gestures.a').enabled,
      false,
    );
    assert.equal(savedRows[0].gesture, 'key:Ctrl+A');
    await left.getByRole('button', { name: '← 左に割り当てを追加', exact: true }).click();
    await search.fill('test.gestures.c');
    await picker.getByRole('button', { name: '記録cをピン留め', exact: true }).click();
    await search.press('Escape');
    assert.equal(await picker.count(), 0);
    assert.equal(
      await dock.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      '← 左に割り当てを追加',
    );
    assert.equal(await rows().count(), 2);
    assert.equal(calls().length, callCount);
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).settings.value.pinnedCommands.includes(
          'test.gestures.c',
        ),
      'pin save',
    );
    await dock.screenshot({ path: path.join(profile, 'gestures-dark.png') });
    checks.push(
      'group-local drag and keyboard order, switches, menu duplicate, confirmed deletion and shared draft',
    );
    await dock
      .locator('[data-gesture-group="key:Ctrl+A"]')
      .getByLabel('割り当て1のキー', { exact: true })
      .press('B');
    await until(
      async () => (await dock.locator('[data-gesture-group="key:B"]').count()) === 1,
      'key group changes',
    );
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).settings.value.gestures.bindings.find(
          (r) => r.id === 'key',
        )?.gesture === 'key:B',
      'key change saved',
    );
    await dock.keyboard.press('Control+p');
    const executePalette = dock.getByRole('dialog', { name: 'コマンドパレット', exact: true });
    assert.equal(
      await executePalette.locator('[role="option"]').first().getAttribute('data-command-id'),
      'test.gestures.c',
    );
    await executePalette.getByRole('combobox', { name: 'コマンドを検索' }).fill('test.gestures.c');
    await executePalette.getByRole('combobox', { name: 'コマンドを検索' }).press('Enter');
    await until(() => calls().length === callCount + 1, 'execution mode');
    assert.equal(calls().at(-1), 'c');
    checks.push(
      'shared palette search, arrow keys, IME guard, selection without execution, focus restore, pins, key recording cleanup and execution mode',
    );
    await dock.getByText('対象ブラウザ・除外・操作感・待機表示', { exact: true }).click();
    await dock.getByLabel('Webブラウザのexe', { exact: true }).fill('firefox.exe, msedge.exe');
    await dock.getByLabel('移動距離（px）').fill('70');
    await dock.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
    await until(
      async () =>
        (await dock.evaluate(() => window.dock.snapshot())).settings.value.gestures.distance === 70,
      'tuning save',
    );
    const s = await dock.evaluate(() => window.dock.snapshot());
    assert.deepEqual(s.settings.value.gestures.browsers, ['firefox', 'msedge']);
    checks.push('browser settings saved through shared draft');
    await dock.evaluate(async () => {
      const s = await window.dock.snapshot();
      s.settings.value.host.theme = 'light';
      await window.dock.saveSettings(s.settings.value, s.settings.revision);
    });
    await dock.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await dock.getByText('対象ブラウザ・除外・操作感・待機表示', { exact: true }).click();
    await dock.screenshot({ path: path.join(profile, 'gestures-light.png') });
    const errors = (await dock.evaluate(() => window.dock.snapshot())).logs.filter(
      (l) => l.level === 'error',
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(profile, 'result.json'),
      JSON.stringify({ checks, profile, portable, sha256: portableHash }, null, 2),
    );
    console.log(JSON.stringify({ checks, profile, portable, sha256: portableHash }, null, 2));
  } finally {
    await app.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

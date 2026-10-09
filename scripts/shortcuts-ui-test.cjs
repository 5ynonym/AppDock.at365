const { _electron: electron, chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs'),
  path = require('node:path'),
  net = require('node:net');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `shortcuts-ui-${Date.now()}`);
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.notifications = false;
settings.host.hardwareAcceleration = false;
for (const owner of ['a', 'b']) {
  const id = `test.${owner}`,
    directory = path.join(profile, 'extensions', id);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'extension.json'),
    JSON.stringify({
      apiVersion: 1,
      id,
      name: owner === 'a' ? 'UI A' : 'UI B — 長い名前のAppletでも列の位置を揃える確認用グループ',
      version: '1.0.0',
      runtime: 'node',
      entry: 'index.js',
      capabilities: ['storage'],
      commands: ['first', 'second', 'new'].map((command) => ({
        id: `${id}.${command}`,
        title: `${owner.toUpperCase()} ${command}`,
      })),
    }),
  );
  fs.writeFileSync(
    path.join(directory, 'index.js'),
    `exports.activate = async c => { let calls=0; for (const command of ['first','second','new']) c.commands.register('${id}.'+command, '${owner.toUpperCase()} '+command, async () => c.storage.set('calls', ++calls)); };`,
  );
  settings.extensions[id] = { enabled: true, settings: {} };
}
const binding = (id, command) => ({
  id,
  command,
  key: 'Ctrl+F8',
  enabled: true,
  when: { scope: 'app', appletIds: [] },
});
settings.keybindings = [
  {
    ...binding('a1', 'test.a.first'),
    key: 'Ctrl+Alt+F10',
    when: { scope: 'global', appletIds: [] },
  },
  binding('b1', 'test.b.first'),
  binding('a2', 'test.a.second'),
];
settings.gestures.bindings = [
  {
    id: 'gesture.first',
    command: 'test.a.first',
    gesture: 'move-left',
    enabled: true,
    when: { scope: 'app', appletIds: [], processes: [] },
  },
  {
    id: 'gesture.second',
    command: 'test.b.first',
    gesture: 'key:Ctrl+Shift+F12',
    enabled: true,
    when: { scope: 'app', appletIds: [], processes: [] },
  },
];
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const portable = process.argv[2] ? path.join(profile, 'AppDock.at365.exe') : null;
if (portable) {
  fs.copyFileSync(path.resolve(process.argv[2]), portable);
  assert.equal(hash(portable), hash(path.resolve(process.argv[2])));
}
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
async function until(fn, message) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(message);
}
async function launch(testProfile = profile) {
  if (!portable)
    return electron.launch({
      executablePath: require('electron'),
      args: [root, `--test-profile=${testProfile}`],
      env,
    });
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const child = spawn(
    portable,
    [`--test-profile=${testProfile}`, `--remote-debugging-port=${port}`],
    {
      env,
      cwd: testProfile,
      windowsHide: true,
      stdio: 'ignore',
    },
  );
  const browser = await until(
    () => chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 }),
    'portable CDP',
  );
  const page = await until(
    () =>
      browser
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().startsWith('appdock://host/')),
    'host renderer',
  );
  return {
    firstWindow: async () => page,
    close: async () => {
      await page
        .evaluate(() => {
          void window.dock.executeCommand('appdock.quit');
        })
        .catch(() => {});
      await until(() => child.exitCode !== null, 'portable shutdown');
      await browser.close().catch(() => {});
    },
  };
}
const checks = [];
const columnWidths = [];
const groupColumns = [];
(async () => {
  let app = await launch();
  try {
    let page = await app.firstWindow();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForFunction(async () => (await window.dock?.snapshot())?.startupReady);
    const snapshot = () => page.evaluate(() => window.dock.snapshot());
    const original = (await snapshot()).settings.value.keybindings;
    const button = (name) => page.getByRole('button', { name, exact: true });
    const row = (id) => page.locator(`[data-binding-id="${id}"]`);
    const menu = (id) => row(id).getByRole('button', { name: /その他の操作/ });
    const openMenu = async (id) => {
      await menu(id).scrollIntoViewIfNeeded();
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      await menu(id).click();
      await page.getByRole('menu').waitFor();
    };
    const nav = (name) =>
      page.locator('.settings-categories').getByRole('button', { name, exact: true });
    const checkColumns = async (editor) => {
      const tables = await page.locator(`${editor} .gesture-table`).evaluateAll((tables) =>
        tables.map((table) => ({
          group: table.closest('section').getAttribute('aria-label'),
          columns: [...table.querySelectorAll('thead th')].map((cell) => {
            const bounds = cell.getBoundingClientRect();
            return { left: bounds.left, width: bounds.width };
          }),
        })),
      );
      assert(tables.length >= 2, 'compare multiple groups');
      fs.writeFileSync(
        path.join(profile, 'group-columns-latest.json'),
        JSON.stringify(tables, null, 2),
      );
      for (const table of tables)
        for (let index = 0; index < 6; index++) {
          assert(
            Math.abs(table.columns[index].left - tables[0].columns[index].left) < 0.5,
            `${editor}: ${table.group} column ${index + 1} position differs`,
          );
          assert(
            Math.abs(table.columns[index].width - tables[0].columns[index].width) < 0.5,
            `${editor}: ${table.group} column ${index + 1} width differs`,
          );
        }
      return tables;
    };
    const save = async () => {
      await button('変更をすべて保存').click();
      await page
        .locator('.settings-toolbar:visible')
        .getByText('すべて保存されています', { exact: true })
        .waitFor();
    };
    const reset = () => button('変更を破棄して再読み込み').click();
    await button('設定').click();
    await nav('ショートカット').click();
    await checkColumns('.shortcuts-editor');
    await until(
      async () =>
        (await snapshot()).globalHotKeys.some(
          (s) => s.commandId === 'test.a.first' && s.registered,
        ),
      'fixture global key registered',
    );
    const rowGeometry = () =>
      page.locator('.shortcuts-editor tbody tr').evaluateAll((rows) =>
        rows.map((row) => ({
          height: row.getBoundingClientRect().height,
          top: row.getBoundingClientRect().top - row.closest('table').getBoundingClientRect().top,
        })),
      );
    const beforeRecording = await rowGeometry();
    const assertStableRows = async () => {
      const after = await rowGeometry();
      assert.equal(after.length, beforeRecording.length);
      for (let index = 0; index < after.length; index++) {
        assert(Math.abs(after[index].height - beforeRecording[index].height) < 0.5);
        assert(Math.abs(after[index].top - beforeRecording[index].top) < 0.5);
      }
    };
    assert.equal(await page.getByText('登録済み', { exact: true }).count(), 0);
    assert.equal(await page.getByText('未登録', { exact: true }).count(), 0);
    await page.evaluate(() => window.dock.executeCommand('appdock.open'));
    await row('a2').locator('[data-shortcut-recorder]').focus();
    await until(
      async () => !(await snapshot()).globalHotKeys.length,
      'recording releases global registration',
    );
    await assertStableRows();
    await row('a2').locator('[data-shortcut-recorder]').press('Escape');
    await until(
      async () => (await snapshot()).globalHotKeys.some((s) => s.registered),
      'global registration restored',
    );
    await assertStableRows();
    const conflictProfile = path.join(profile, 'conflict');
    fs.mkdirSync(conflictProfile);
    const conflictSettings = require('../out/main/shared/settings-schema').createDefaultSettings();
    conflictSettings.host.notifications = false;
    conflictSettings.keybindings = [
      {
        ...binding('conflict', 'appdock.open'),
        key: 'Ctrl+Alt+F10',
        when: { scope: 'global', appletIds: [] },
      },
    ];
    fs.writeFileSync(path.join(conflictProfile, 'settings.json'), JSON.stringify(conflictSettings));
    const conflictApp = await launch(conflictProfile);
    try {
      const conflictPage = await conflictApp.firstWindow();
      await conflictPage.evaluate(() => window.dock.executeCommand('appdock.open'));
      await until(
        async () =>
          (await conflictPage.evaluate(() => window.dock.snapshot())).globalHotKeys.some(
            (s) => s.error,
          ),
        'real Windows registration conflict',
      );
      await conflictPage.getByRole('button', { name: '設定', exact: true }).click();
      await conflictPage
        .locator('.settings-categories')
        .getByRole('button', { name: 'ショートカット', exact: true })
        .click();
      const conflictRow = conflictPage.locator('[data-binding-id="conflict"]');
      await conflictRow.getByRole('alert').waitFor();
      assert.match(await conflictRow.getByRole('alert').innerText(), /Windowsエラー/);
      await conflictPage.getByRole('button', { name: '登録エラー', exact: true }).click();
      const conflictHeight = (await conflictRow.boundingBox()).height;
      await conflictRow.locator('[data-shortcut-recorder]').focus();
      await until(
        async () =>
          !(await conflictPage.evaluate(() => window.dock.snapshot())).globalHotKeys.length,
        'conflict recorder suspension',
      );
      assert.equal(await conflictRow.getByRole('alert').isVisible(), true);
      assert.equal((await conflictRow.boundingBox()).height, conflictHeight);
      await conflictRow.locator('[data-shortcut-recorder]').press('Escape');
      await page.evaluate(async () => {
        const snapshot = await window.dock.snapshot();
        snapshot.settings.value.keybindings.find((row) => row.id === 'a1').enabled = false;
        await window.dock.saveSettings(snapshot.settings.value, snapshot.settings.revision);
      });
      await until(
        async () => !(await snapshot()).globalHotKeys.length,
        'release occupied key for retry',
      );
      await conflictRow.getByRole('button', { name: '登録を再試行', exact: true }).click();
      await until(
        async () =>
          (await conflictPage.evaluate(() => window.dock.snapshot())).globalHotKeys.some(
            (s) => s.registered,
          ),
        'retry succeeds after owner releases key',
      );
      await conflictRow.getByRole('alert').waitFor({ state: 'hidden' });
      assert.equal(await conflictPage.getByText('登録済み', { exact: true }).count(), 0);
    } finally {
      await conflictApp.close();
      await page.evaluate(async () => {
        const snapshot = await window.dock.snapshot();
        snapshot.settings.value.keybindings.find((row) => row.id === 'a1').enabled = true;
        await window.dock.saveSettings(snapshot.settings.value, snapshot.settings.revision);
      });
    }
    await until(
      async () => (await row('a1').getByRole('switch').getAttribute('aria-checked')) === 'true',
      'restored fixture is reflected in the renderer',
    );
    checks.push(
      'normal status hidden / focus-blur preserves all row geometry / real Windows conflict stays visible while recording / retry clears resolved error',
    );
    const order = (id) => row(id).locator('.gesture-drag-handle').innerText();
    assert.match(await order('a1'), /1$/);
    assert.match(await order('b1'), /1$/);
    assert.match(await order('a2'), /2$/);
    await page.getByLabel('ショートカットのコマンドを検索').fill('A second');
    assert.match(await order('a2'), /2$/);
    await page.getByLabel('ショートカットのコマンドを検索').fill('');
    assert.deepEqual(await page.locator('[data-shortcut-owner="test.a"] th').allTextContents(), [
      '順番',
      '有効',
      'コマンド',
      'キーバインド',
      'いつ・どこで',
      'その他',
    ]);
    const enabled = row('a1').getByRole('switch');
    await enabled.click();
    assert.equal(await enabled.getAttribute('aria-checked'), 'false');
    assert.deepEqual((await snapshot()).settings.value.keybindings, original);
    await reset();
    assert.equal(await enabled.getAttribute('aria-checked'), 'true');
    await row('a2')
      .getByRole('button', { name: /並べ替え/ })
      .dragTo(row('a1'));
    assert.deepEqual(
      await page
        .locator('[data-shortcut-owner="test.a"] [data-binding-id]')
        .evaluateAll((rows) => rows.map((r) => r.dataset.bindingId)),
      ['a2', 'a1'],
    );
    assert.match(await order('a2'), /1$/);
    assert.match(await order('a1'), /2$/);
    await save();
    assert.deepEqual(
      (await snapshot()).settings.value.keybindings.map((r) => r.id),
      ['a2', 'b1', 'a1'],
    );
    await row('a2')
      .getByRole('button', { name: /並べ替え/ })
      .press('ArrowDown');
    await save();
    assert.deepEqual(
      (await snapshot()).settings.value.keybindings.map((r) => r.id),
      ['a1', 'b1', 'a2'],
    );
    await row('a1')
      .getByRole('button', { name: /並べ替え/ })
      .dragTo(row('b1'));
    assert.equal(await button('変更をすべて保存').isDisabled(), true);
    checks.push(
      'common six-column layout / group-local numbering retained during search / Toggle drafts / drag and arrows / other-provider slots preserved / cross-provider drop rejected',
    );
    await menu('a1').scrollIntoViewIfNeeded();
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    const before = await row('a1').boundingBox();
    await openMenu('a1');
    const popup = page.getByRole('menu');
    await popup.waitFor();
    assert(
      await popup
        .getByRole('menuitem')
        .evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth)),
      'all menu captions fit without truncation',
    );
    assert(Math.abs((await row('a1').boundingBox()).height - before.height) < 0.5);
    assert.equal(await popup.evaluate((el) => !el.closest('table')), true);
    const bounds = await popup.boundingBox(),
      viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert(
      bounds.x >= 0 &&
        bounds.x + bounds.width <= viewport.width &&
        bounds.y >= 0 &&
        bounds.y + bounds.height <= viewport.height,
    );
    await page.keyboard.press('End');
    assert.equal(
      await page
        .getByRole('menuitem', { name: 'キーのクリア…', exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press('Escape');
    assert.equal(await popup.count(), 0);
    await openMenu('a1');
    await page.getByRole('menuitem', { name: '複製', exact: true }).click();
    assert.equal(
      await page.locator('[data-shortcut-command="test.a.first"][data-binding-id]').count(),
      2,
    );
    const cloneId = await page
      .locator('[data-shortcut-command="test.a.first"][data-binding-id]')
      .last()
      .getAttribute('data-binding-id');
    await openMenu(cloneId);
    await page.getByRole('menuitem', { name: 'キーのクリア…', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'キャンセル', exact: true })
      .click();
    await page.keyboard.press('Escape');
    assert.equal(await row(cloneId).count(), 1);
    await openMenu(cloneId);
    await page.getByRole('menuitem', { name: 'キーのクリア…', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'クリアする', exact: true })
      .click();
    assert.equal(await row(cloneId).count(), 0);
    await reset();
    checks.push(
      'portal menu / stable row height / viewport bounds / keyboard navigation / duplicate / delete cancellation and confirmation',
    );
    await page.evaluate(async () => {
      const snapshot = await window.dock.snapshot();
      snapshot.settings.value.keybindings.find((row) => row.id === 'b1').enabled = false;
      snapshot.settings.value.extensions['test.b'].enabled = false;
      await window.dock.saveSettings(snapshot.settings.value, snapshot.settings.revision);
    });
    await row('b1').getByText('現在利用できません', { exact: true }).waitFor();
    await until(
      async () => (await row('b1').getByRole('switch').getAttribute('aria-checked')) === 'false',
      'disabled binding visible',
    );
    await openMenu('b1');
    await page.getByRole('menuitem', { name: 'キーのクリア…', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'クリアする', exact: true })
      .click();
    await row('b1').waitFor({ state: 'detached' });
    assert.equal(
      await page
        .locator('[data-shortcut-command="test.b.first"] [data-shortcut-recorder]')
        .inputValue(),
      '',
    );
    assert.equal(
      (await snapshot()).settings.value.keybindings.some((row) => row.id === 'b1'),
      true,
    );
    await save();
    assert.deepEqual(
      (await snapshot()).settings.value.keybindings,
      original.filter((row) => row.id !== 'b1'),
    );
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.waitForFunction(async () => (await window.dock?.snapshot())?.startupReady);
    assert.equal(
      (await snapshot()).settings.value.keybindings.some((row) => row.id === 'b1'),
      false,
    );
    await page.evaluate(async (keybindings) => {
      const snapshot = await window.dock.snapshot();
      snapshot.settings.value.keybindings = keybindings;
      snapshot.settings.value.extensions['test.b'].enabled = true;
      await window.dock.saveSettings(snapshot.settings.value, snapshot.settings.revision);
    }, original);
    await button('設定').click();
    await nav('ショートカット').click();
    await row('b1').waitFor();
    checks.push(
      'disabled binding in stopped Applet clears only the selected assignment / valid save / other bindings preserved / restart stays cleared',
    );
    await page.getByRole('button', { name: 'UI Aに割り当てを追加', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'コマンドを選択' })
      .getByRole('combobox')
      .fill('test.a.new');
    await page.getByRole('dialog', { name: 'コマンドを選択' }).getByRole('combobox').press('Enter');
    const added = page.locator('[data-shortcut-command="test.a.new"][data-binding-id]');
    await added.waitFor();
    assert.equal(await added.locator('select[aria-label*="いつ・どこで"]').inputValue(), 'owner');
    assert.equal(await added.locator('[data-shortcut-recorder]').inputValue(), '');
    await button('変更をすべて保存').click();
    await page.locator('.error-text[role="alert"]').waitFor();
    assert.equal(
      (await snapshot()).settings.value.keybindings.some((r) => r.command === 'test.a.new'),
      false,
    );
    await added.locator('[data-shortcut-recorder]').focus();
    await added.locator('[data-shortcut-recorder]').press('Delete');
    assert.equal(await added.locator('[data-shortcut-recorder]').inputValue(), 'Delete');
    await added.locator('select[aria-label*="特殊キー"]').selectOption('Ctrl+Tab');
    await save();
    assert.equal(
      (await snapshot()).settings.value.keybindings.find((r) => r.command === 'test.a.new').key,
      'Ctrl+Tab',
    );
    for (const owner of ['a', 'b'])
      assert.equal(
        fs.existsSync(path.join(profile, '.appdock', 'storage', `test.${owner}`, 'calls.json')),
        false,
      );
    checks.push(
      'provider-limited command picker never executes / new binding starts owner-scoped / special key selection and save',
    );
    for (const theme of ['dark', 'light']) {
      await nav('表示').click();
      await page.getByLabel('テーマ', { exact: true }).selectOption(theme);
      await save();
      await nav('ショートカット').click();
      for (const width of [1280, 900, 700]) {
        await page.setViewportSize({ width, height: 760 });
        assert(await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth));
        const shortcuts = await checkColumns('.shortcuts-editor');
        await page.getByLabel('ショートカットのコマンドを検索').fill('A first');
        await row('a1').evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await openMenu('a1');
        const menuBounds = await page.getByRole('menu').boundingBox();
        assert(
          menuBounds.x >= 0 &&
            menuBounds.x + menuBounds.width <= width &&
            menuBounds.y + menuBounds.height <= 760,
        );
        await page.screenshot({ path: path.join(profile, `${theme}-${width}-shortcuts.png`) });
        const shortcutWidth = (await row('a1').locator('td').last().boundingBox()).width;
        assert(shortcutWidth <= 64);
        await page.keyboard.press('Escape');
        await page.getByLabel('ショートカットのコマンドを検索').fill('');
        await nav('マウスジェスチャー').click();
        const gestures = await checkColumns('.gestures-editor');
        groupColumns.push({ theme, viewport: width, shortcuts, gestures });
        await page
          .locator('[data-gesture-row="gesture.first"]')
          .evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page
          .locator('[data-gesture-row="gesture.first"] .gesture-menu-trigger')
          .scrollIntoViewIfNeeded();
        const gestureWidth = (
          await page.locator('[data-gesture-row="gesture.first"] td').last().boundingBox()
        ).width;
        assert(gestureWidth <= 64);
        columnWidths.push({
          theme,
          viewport: width,
          shortcut: shortcutWidth,
          gesture: gestureWidth,
        });
        await page.screenshot({ path: path.join(profile, `${theme}-${width}-gestures.png`) });
        await nav('ショートカット').click();
      }
    }
    checks.push(
      'dark/light / 1280, 900, 700px / all group column positions match / table scrolling and bounded menu without main overflow',
    );
    assert.deepEqual(errors, []);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await page.waitForFunction(async () => (await window.dock?.snapshot())?.startupReady);
    assert.equal(
      (await snapshot()).settings.value.keybindings.find((r) => r.command === 'test.a.new').key,
      'Ctrl+Tab',
    );
    assert.deepEqual(
      (await snapshot()).settings.value.keybindings.find((r) => r.command === 'test.a.new').when,
      { scope: 'owner', appletIds: [] },
    );
    checks.push('restart retains the selected special key and binding condition');
    const result = {
      ok: true,
      checks,
      columnWidths,
      groupColumns,
      ...(portable ? { sha256: hash(portable) } : {}),
    };
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ profile, ...result, groupColumns: undefined }));
  } finally {
    await app.close();
  }
})().catch((error) => {
  fs.writeFileSync(path.join(profile, 'failure.txt'), String(error.stack));
  console.error(error);
  process.exitCode = 1;
});

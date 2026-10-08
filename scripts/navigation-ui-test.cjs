const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `navigation-${Date.now()}`);
const settings = require('../out/main/shared/settings-schema.js').createDefaultSettings();
settings.host.notifications = false;
settings.globalShortcutCommands = [];
settings.shortcuts['missing.command'] = ['Ctrl+Alt+9'];
settings.extensions['appdock.dotnet-demo'] = { enabled: true, settings: {} };
require('../tests/fixtures/install.cjs')(profile, settings);
for (let i = 0; i < 24; i++) {
  const id = `test.applet-${i}`;
  const folder = path.join(profile, 'extensions', id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, 'extension.json'),
    JSON.stringify({
      apiVersion: 1,
      id,
      name: `検証Applet ${String(i).padStart(2, '0')}`,
      version: '1.0.0',
      runtime: 'node',
      entry: 'index.js',
      capabilities: [],
      settings:
        i === 0
          ? []
          : [
              ...Array.from({ length: 24 }, (_, n) => ({
                key: `value${n}`,
                title: `検証項目 ${n}`,
                type: 'string',
                default: `初期値 ${n}`,
              })),
              { key: 'flag', title: '検証スイッチ', type: 'boolean', default: true },
              {
                key: 'amount',
                title: '検証数値',
                type: 'number',
                default: 2,
                minimum: 1,
                maximum: 10,
              },
              {
                key: 'choice',
                title: '検証選択',
                type: 'select',
                default: 'a',
                options: [
                  { value: 'a', label: '選択A' },
                  { value: 'b', label: '選択B' },
                ],
              },
              {
                key: 'monitor',
                title: '未接続の選択',
                type: 'select',
                default: 'disconnected',
                dynamic: true,
                options: [],
              },
            ],
    }),
  );
  fs.writeFileSync(path.join(folder, 'index.js'), 'module.exports = {};');
}
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const checks = [];
(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({
    executablePath: process.argv[2] ? path.resolve(process.argv[2]) : require('electron'),
    args: [...(process.argv[2] ? [] : [root]), `--test-profile=${profile}`],
    env,
  });
  const page = await app.firstWindow();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const button = (name) => page.getByRole('button', { name, exact: true });
  const switchAppearance = () =>
    page.locator('.detail-settings-toggle').evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const heading = document.querySelector('.detail-heading').getBoundingClientRect();
      return {
        bounds: [bounds.x, bounds.y, bounds.width, bounds.height],
        heading: [heading.x, heading.y, heading.width, heading.height],
        style: [
          style.backgroundColor,
          style.color,
          style.border,
          style.borderRadius,
          style.padding,
        ],
      };
    });
  const settingsNav = () => page.locator('.settings-categories');
  const save = async () => {
    await button('変更をすべて保存').click();
    await page
      .locator('.settings-toolbar:visible')
      .getByText('すべて保存されています', { exact: true })
      .waitFor();
  };
  const chooseApplet = async (name) => {
    await page.getByLabel('設定するAppletを検索').fill(name);
    await settingsNav()
      .getByRole('button', { name: new RegExp(name) })
      .click();
  };
  try {
    await page.getByRole('heading', { name: 'ホーム', exact: true }).waitFor();
    await page.waitForFunction(() =>
      window.dock
        .snapshot()
        .then((s) => s.extensions.find((e) => e.id === 'appdock.dotnet-demo')?.state === 'running'),
    );
    for (const name of ['ホーム', 'Applet', '設定', 'ログ'])
      assert.equal(await button(name).count(), 1);
    assert.equal(await page.getByText('My Dock', { exact: true }).count(), 0);
    await button('Applet').click();
    const selected = page.locator('.sidebar-extensions [aria-current="true"]');
    const selectedName = await selected.locator('span').textContent();
    assert.equal(await page.locator('.detail h2').textContent(), selectedName);
    const descriptionAppearance = await switchAppearance();
    await button('設定を開く').click();
    assert.deepEqual(await switchAppearance(), descriptionAppearance);
    assert.equal(await page.locator('.detail h2').textContent(), selectedName);
    assert.equal(await page.getByRole('complementary', { name: 'Applet一覧' }).count(), 1);
    assert.equal(await button('ショートカットを設定').count(), 0);
    await button('説明に戻る').click();
    await page.getByLabel('Appletを検索', { exact: true }).fill('検証Applet 01');
    await page
      .getByRole('complementary', { name: 'Applet一覧' })
      .getByRole('button', { name: /検証Applet 01/ })
      .click();
    await button('設定を開く').click();
    await page.getByLabel('検証項目 0', { exact: true }).fill('詳細からの編集');
    await page.getByLabel('検証数値', { exact: true }).fill('');
    await button('変更をすべて保存').click();
    await page.getByRole('alert').filter({ hasText: '検証数値' }).waitFor();
    await page.getByLabel('検証数値', { exact: true }).fill('3');
    await button('説明に戻る').click();
    await button('設定を開く').click();
    assert.equal(
      await page.getByLabel('検証項目 0', { exact: true }).inputValue(),
      '詳細からの編集',
    );
    await button('設定').click();
    await chooseApplet('検証Applet 01');
    assert.equal(
      await page.getByLabel('検証項目 0', { exact: true }).inputValue(),
      '詳細からの編集',
    );
    checks.push(
      'inline settings / description return / unified shortcut entry / shared draft / validation',
    );

    await chooseApplet('検証Applet 01');
    await page.getByLabel('検証項目 0', { exact: true }).fill('編集した値');
    await page.getByLabel('Appletの設定項目を検索').fill('検証項目 23');
    assert.equal(
      await page.locator('.applet-settings .setting-row').count(),
      2,
      'the matched setting and the common startup delay remain visible',
    );
    await page.getByLabel('検証項目 23', { exact: true }).fill('末尾の値');
    await chooseApplet('検証Applet 02');
    await page.getByLabel('検証項目 0', { exact: true }).fill('別Appletの値');
    await button('Appletに戻る').click();
    assert.equal(await page.locator('.detail h2').textContent(), '検証Applet 02');
    await button('設定を開く').click();
    assert.equal(await page.getByLabel('検証項目 0', { exact: true }).inputValue(), '別Appletの値');
    await button('設定').click();
    await chooseApplet('検証Applet 01');
    assert.equal(await page.getByLabel('検証項目 0', { exact: true }).inputValue(), '編集した値');
    await settingsNav().getByRole('button', { name: 'バージョン情報・更新', exact: true }).click();
    await page.getByRole('region', { name: 'バージョン情報・更新', exact: true }).waitFor();
    assert.equal(await page.locator('.settings-toolbar:visible').count(), 0);
    await chooseApplet('検証Applet 01');
    assert.equal(await page.getByLabel('検証項目 0', { exact: true }).inputValue(), '編集した値');
    await save();
    const stored = JSON.parse(fs.readFileSync(path.join(profile, 'settings.json')));
    assert.equal(stored.extensions['test.applet-1'].settings.value23, '末尾の値');
    assert.equal(stored.extensions['test.applet-2'].settings.value0, '別Appletの値');
    checks.push('search / multiple applet drafts / return link / save all');
    await page.getByRole('switch', { name: '検証スイッチ' }).click();
    await page.getByLabel('検証選択', { exact: true }).selectOption('b');
    assert.equal(
      await page.getByLabel('未接続の選択', { exact: true }).inputValue(),
      'disconnected',
    );
    await page.getByLabel('検証数値', { exact: true }).fill('');
    await button('変更をすべて保存').click();
    await page.getByRole('alert').filter({ hasText: '検証数値' }).waitFor();
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'))).extensions['test.applet-1']
        .settings.flag,
      undefined,
    );
    await page.getByLabel('検証数値', { exact: true }).fill('5');
    await save();
    const typed = JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'))).extensions[
      'test.applet-1'
    ].settings;
    assert.equal(typed.flag, false);
    assert.equal(typed.choice, 'b');
    assert.equal(typed.amount, 5);
    checks.push(
      'boolean / select / unavailable dynamic option / numeric validation and persistence',
    );

    await chooseApplet('検証Applet 00');
    await page.getByText('このAppletには設定項目がありません。').waitFor();
    await button('Appletに戻る').click();
    await button('設定を開く').click();
    await button('ショートカットキー').click();
    await page.getByRole('heading', { name: 'ショートカットキー', exact: true }).waitFor();
    assert.equal(await page.locator('.shortcut-row').count(), 0);
    checks.push('no settings / no commands / inline shortcuts');
    await button('設定').click();
    await chooseApplet('検証Applet 00');
    await button('ショートカットキー').click();

    await chooseApplet('Welcome to your Dock');
    assert.equal(await page.locator('.shortcut-row').count(), 3);
    await page.getByLabel('ウェルカムを更新のショートカット 1', { exact: true }).press('Control+p');
    await page.getByRole('alert').filter({ hasText: 'AppDock / コマンドを検索' }).waitFor();
    await page
      .getByRole('group', { name: 'ショートカットの絞り込み' })
      .getByRole('button', { name: '競合・エラー', exact: true })
      .click();
    assert.equal(await page.locator('.shortcut-row').count(), 1);
    await page
      .getByLabel('ウェルカムを更新のショートカット 1', { exact: true })
      .press('Control+Alt+r');
    await page
      .getByRole('group', { name: 'ショートカットの絞り込み' })
      .getByRole('button', { name: '割り当て済み', exact: true })
      .click();
    assert.equal(await page.locator('.shortcut-row').count(), 1);
    const statusButtons = page.getByRole('group', { name: 'ショートカットの絞り込み' });
    const unassigned = statusButtons.getByRole('button', { name: '未設定', exact: true });
    await unassigned.focus();
    await unassigned.press('Space');
    assert.equal(await unassigned.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.shortcut-row').count(), 2);
    await statusButtons.getByRole('button', { name: 'すべて', exact: true }).click();
    assert.equal(await page.locator('.shortcut-row').count(), 3);
    await save();
    await button('ショートカット').click();
    await page.getByRole('heading', { name: '未確認のコマンド', exact: true }).waitFor();
    await page.getByLabel('設定するAppletを検索').fill('');
    assert.equal(
      await page
        .locator('.settings-applet-list .sidebar-extensions button')
        .first()
        .locator('span')
        .textContent(),
      'AppDock',
    );
    await page
      .locator('.settings-applet-list')
      .getByRole('button', { name: 'AppDock', exact: true })
      .click();
    assert.equal(await page.locator('.shortcut-row').count(), 5);
    checks.push(
      'owner scope / cross-applet conflicts / status filters / unknown commands / host keys',
    );
    await page.evaluate(() => window.dock.toggleExtension('appdock.welcome', false));
    await chooseApplet('Welcome to your Dock');
    await page.getByText('現在利用できません', { exact: false }).first().waitFor();
    assert.equal(
      await page.getByLabel('ウェルカムを更新のショートカット 1', { exact: true }).inputValue(),
      'Ctrl+Alt+R',
    );
    await page.evaluate(() => window.dock.toggleExtension('appdock.welcome', true));
    await page.waitForFunction(() =>
      window.dock
        .snapshot()
        .then((s) => s.extensions.find((e) => e.id === 'appdock.welcome')?.state === 'running'),
    );
    checks.push('stopped applet retains known ownership and key bindings');

    await button('JSON').click();
    await page.getByLabel('設定JSON').fill('{broken');
    await button('Applet').click();
    await button('設定を開く').click();
    assert.equal(await page.locator('.detail h2').count(), 1);
    await page.locator('.error-banner').filter({ hasText: 'JSONの内容を修正' }).waitFor();
    await button('設定').click();
    assert.equal(await page.getByLabel('設定JSON').inputValue(), '{broken');
    await page.locator('.error-text').filter({ hasText: 'JSONの内容を修正' }).waitFor();
    await button('変更を破棄して再読み込み').click();
    await button('フォーム').click();
    await button('エラーを閉じる').click();
    checks.push('direct navigation preserves invalid JSON');

    await button('JSON').click();
    const jsonDraft = JSON.parse(await page.getByLabel('設定JSON').inputValue());
    jsonDraft.extensions['test.applet-1'].settings.value0 = 'JSONから共通編集';
    await page.getByLabel('設定JSON').fill(JSON.stringify(jsonDraft));
    await button('Applet').click();
    await page.getByLabel('Appletを検索', { exact: true }).fill('検証Applet 01');
    await page
      .getByRole('complementary', { name: 'Applet一覧' })
      .getByRole('button', { name: /検証Applet 01/ })
      .click();
    await button('設定を開く').click();
    assert.equal(
      await page.getByLabel('検証項目 0', { exact: true }).inputValue(),
      'JSONから共通編集',
    );
    await button('設定').click();
    await chooseApplet('検証Applet 01');
    await button('設定項目').click();
    assert.equal(
      await page.getByLabel('検証項目 0', { exact: true }).inputValue(),
      'JSONから共通編集',
    );
    await button('変更を破棄して再読み込み').click();
    await chooseApplet('Welcome to your Dock');
    await button('Appletに戻る').click();
    await button('設定を開く').click();
    await button('ショートカットキー').click();
    await page
      .getByLabel('ウェルカムを更新のショートカット 1', { exact: true })
      .press('Control+Alt+w');
    await button('設定').click();
    await chooseApplet('Welcome to your Dock');
    await button('ショートカットキー').click();
    assert.equal(
      await page.getByLabel('ウェルカムを更新のショートカット 1', { exact: true }).inputValue(),
      'Ctrl+Alt+W',
    );
    await button('変更を破棄して再読み込み').click();
    await button('Appletに戻る').click();
    await button('設定を開く').click();
    await button('ショートカットキー').click();
    assert.equal(
      await page.getByLabel('ウェルカムを更新のショートカット 1', { exact: true }).inputValue(),
      'Ctrl+Alt+R',
    );
    await button('設定').click();
    checks.push(
      'valid JSON shared with inline form / shortcut draft shared / discard from either surface',
    );

    await chooseApplet('検証Applet 01');
    await button('設定項目').click();
    await page.getByLabel('検証項目 0', { exact: true }).fill('競合しても残す');
    await button('Appletに戻る').click();
    await button('設定を開く').click();
    const external = JSON.parse(fs.readFileSync(path.join(profile, 'settings.json')));
    external.profile.name = '外部変更';
    fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(external));
    await page.getByText(/別の場所で設定が変わりました/).waitFor();
    await button('変更をすべて保存').click();
    await page.locator('.error-banner').waitFor();
    assert.equal(
      await page.getByLabel('検証項目 0', { exact: true }).inputValue(),
      '競合しても残す',
    );
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'))).profile.name,
      '外部変更',
    );
    await button('変更を破棄して再読み込み').click();
    await button('エラーを閉じる').click();
    await button('設定').click();
    assert.equal(await page.getByLabel('検証項目 0', { exact: true }).inputValue(), '編集した値');
    checks.push('inline external update refuses overwrite and retains draft / shared discard');

    await button('Applet').click();
    await page.getByLabel('Appletを検索', { exact: true }).fill('Welcome');
    await page.locator('.sidebar-extensions button').click();
    await button('ログを見る').click();
    assert.equal(await page.getByLabel('ログのApplet').inputValue(), 'appdock.welcome');
    for (const source of await page.locator('.log-row > div > span').allTextContents())
      assert.equal(source, 'appdock.welcome');
    checks.push('applet log deep link');

    const searchButton = page.locator('.titlebar-search');
    await searchButton.click();
    await page.getByPlaceholder('コマンドを入力…').fill('Welcome');
    assert.equal(await page.locator('.palette-command').count(), 3);
    await page.getByPlaceholder('コマンドを入力…').press('ArrowDown');
    assert.equal(await page.locator('.palette-command[aria-selected="true"]').count(), 1);
    await page.getByPlaceholder('コマンドを入力…').press('Escape');
    assert.equal(await searchButton.evaluate((el) => el === document.activeElement), true);
    await searchButton.click();
    await page.getByPlaceholder('コマンドを入力…').fill('ウェルカムを更新');
    await page.getByPlaceholder('コマンドを入力…').press('Enter');
    await page.getByRole('status').filter({ hasText: 'コマンドを実行' }).waitFor();
    checks.push('palette owner search / arrows / Enter / focus restoration');

    for (const theme of ['dark', 'light']) {
      await button('設定').click();
      await button('表示').click();
      await page.getByLabel('テーマ', { exact: true }).selectOption(theme);
      await save();
      await chooseApplet('検証Applet 01');
      await button('設定項目').click();
      for (const size of [
        { width: 1280, height: 840 },
        { width: 900, height: 620 },
      ]) {
        await page.setViewportSize(size);
        await page.locator('main').evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        const bounds = await button('変更をすべて保存').boundingBox();
        assert(
          bounds && bounds.y >= 40 && bounds.y + bounds.height < size.height - 20,
          'sticky save remains visible',
        );
        assert.equal(
          await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth),
          true,
          'no horizontal overflow',
        );
        await page.locator('main').evaluate((el) => {
          el.scrollTop = 0;
        });
        await page.screenshot({ path: path.join(profile, `${theme}-${size.width}-settings.png`) });
      }
      await button('Appletに戻る').click();
      await page.getByLabel('Appletを検索', { exact: true }).fill('');
      await button('設定を開く').click();
      await page.getByLabel('検証項目 0', { exact: true }).fill(`詳細で保存 ${theme}`);
      await page.screenshot({ path: path.join(profile, `${theme}-inline-settings-top.png`) });
      for (const width of [1280, 900]) {
        await page.setViewportSize({ width, height: 620 });
        await button('説明に戻る').click();
        await page.locator('main').evaluate((el) => {
          el.scrollTop = 0;
        });
        const appearance = await switchAppearance();
        await page.screenshot({
          path: path.join(profile, `${theme}-${width}-description-switch.png`),
        });
        await button('設定を開く').click();
        assert.deepEqual(
          await switchAppearance(),
          appearance,
          'switch and heading stay in place with identical button styling',
        );
        await page.locator('.detail-settings > .applet-settings-panel').evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        const bounds = await button('変更をすべて保存').boundingBox();
        assert(
          bounds && bounds.y >= 40 && bounds.y + bounds.height < 600,
          'inline save stays visible',
        );
        assert(await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth));
        await page.screenshot({
          path: path.join(profile, `${theme}-${width}-inline-settings.png`),
        });
      }
      await save();
      checks.push(`${theme}: stable description/settings switch at 1280 and 900px`);
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'))).extensions['test.applet-1']
          .settings.value0,
        `詳細で保存 ${theme}`,
      );
      await button('ショートカットキー').click();
      await button('説明に戻る').click();
      await button('設定を開く').click();
      await button('設定').click();
      await chooseApplet('検証Applet 01');
      assert.equal(
        await page.getByLabel('検証項目 0', { exact: true }).inputValue(),
        `詳細で保存 ${theme}`,
      );
      await button('ショートカットキー').click();
      await chooseApplet('Welcome to your Dock');
      for (const width of [1280, 900, 700]) {
        await page.setViewportSize({ width, height: 620 });
        const search = await page.getByLabel('ショートカットのコマンドを検索').boundingBox();
        const statusGroup = page.getByRole('group', { name: 'ショートカットの絞り込み' });
        const status = await statusGroup.boundingBox();
        assert.equal(await statusGroup.locator('[aria-pressed="true"]').count(), 1);
        assert.equal(search.y, status.y, 'search and status filter share one row');
        assert.equal(search.height, status.height, 'filter controls have equal height');
        assert(search.x + search.width < status.x, 'filter controls do not overlap');
        assert(await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth));
        await page.screenshot({ path: path.join(profile, `${theme}-${width}-shortcuts.png`) });
      }
      await page.setViewportSize({ width: 900, height: 620 });
      for (const name of ['ホーム', 'Applet', 'ログ']) {
        await button(name).click();
        await page.locator('main').evaluate((el) => {
          el.scrollTop = 0;
        });
        assert.equal(
          await page.locator('main').evaluate((el) => el.scrollWidth <= el.clientWidth),
          true,
          `${name} fits minimum width`,
        );
        await page.screenshot({ path: path.join(profile, `${theme}-900-${name}.png`) });
      }
    }
    checks.push(
      '24 applets / long forms / dark and light / 1280x840 and 900x620 / sticky save / no overflow',
      'command search and status filter share a row at 1280 / 900 / 700px in both themes',
    );
    assert.deepEqual(errors, []);
    const result = { ok: true, profile, checks };
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(profile, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

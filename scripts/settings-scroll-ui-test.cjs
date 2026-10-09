const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.artifacts', `settings-scroll-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const { createDefaultSettings } = require('../out/main/shared/settings-schema.js');
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(createDefaultSettings()));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let application;
(async () => {
  try {
    application = await electron.launch({
      executablePath: require('electron'),
      args: [root, `--test-profile=${profile}`],
      env,
    });
    const page = await application.firstWindow();
    await page.getByRole('heading', { name: 'ホーム', exact: true }).waitFor();
    await page.keyboard.press('Control+,');
    for (const width of [1280, 900, 760]) {
      await page.setViewportSize({ width, height: 600 });
      await page.getByRole('button', { name: '一般', exact: true }).click();
      const heading = await page
        .locator('.settings-page:not([hidden]) .page-heading')
        .boundingBox();
      const toolbar = await page
        .locator('.settings-page:not([hidden]) .settings-toolbar')
        .boundingBox();
      const form = await page.locator('.settings-form').boundingBox();
      const scrollTop = await page
        .locator('.settings-page:not([hidden]) .settings-body')
        .evaluate((element) => {
          element.scrollTop = element.scrollHeight;
          return element.scrollTop;
        });
      assert.ok(scrollTop > 0, `long category scrolls at ${width}`);
      assert.deepEqual(
        await page.locator('.settings-page:not([hidden]) .page-heading').boundingBox(),
        heading,
      );
      assert.deepEqual(
        await page.locator('.settings-page:not([hidden]) .settings-toolbar').boundingBox(),
        toolbar,
      );
      await page.getByRole('button', { name: '表示', exact: true }).click();
      assert.equal(
        await page
          .locator('.settings-page:not([hidden]) .settings-body')
          .evaluate((element) => element.scrollTop),
        0,
      );
      assert.deepEqual(
        await page.locator('.settings-page:not([hidden]) .page-heading').boundingBox(),
        heading,
      );
      assert.deepEqual(
        await page.locator('.settings-page:not([hidden]) .settings-toolbar').boundingBox(),
        toolbar,
      );
      const shortForm = await page.locator('.settings-form').boundingBox();
      assert.equal(shortForm.x, form.x);
      assert.equal(shortForm.width, form.width);
      assert.equal(await page.locator('main').evaluate((element) => element.scrollTop), 0);
      await page.getByRole('button', { name: 'JSON', exact: true }).click();
      await page.locator('.settings-page:not([hidden]) .settings-body').evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      assert.deepEqual(
        await page.locator('.settings-page:not([hidden]) .page-heading').boundingBox(),
        heading,
      );
      assert.deepEqual(
        await page.locator('.settings-page:not([hidden]) .settings-toolbar').boundingBox(),
        toolbar,
      );
      await page.getByRole('button', { name: 'フォーム', exact: true }).click();
      await page.screenshot({ path: path.join(profile, `settings-${width}.png`) });
    }
    console.log(
      'PASS: fixed heading/toolbar, long-to-short category width, JSON mode at 1280/900/760px',
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (application) {
      await application.evaluate(({ app }) => app.quit()).catch(() => {});
      await application.close();
    }
  }
})();

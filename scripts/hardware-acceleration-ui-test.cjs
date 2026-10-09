const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.artifacts', `hardware-acceleration-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const { createDefaultSettings } = require('../out/main/shared/settings-schema.js');
const settings = createDefaultSettings();
delete settings.host.hardwareAcceleration;
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let application;
async function launch() {
  application = await electron.launch({
    executablePath: process.argv[2] ? path.resolve(process.argv[2]) : require('electron'),
    args: [...(process.argv[2] ? [] : [root]), `--test-profile=${profile}`],
    env,
    timeout: 30000,
  });
  const page = await application.firstWindow();
  await page.getByRole('heading', { name: 'ホーム', exact: true }).waitFor();
  await application.evaluate(async ({ app }) => {
    await app.getGPUInfo('basic');
  });
  await page.keyboard.press('Control+,');
  await page.getByRole('button', { name: '一般', exact: true }).click();
  return page;
}
const enabled = () => application.evaluate(({ app }) => app.isHardwareAccelerationEnabled());
async function save(page, value) {
  const toggle = page.getByRole('switch', { name: 'ハードウェアアクセラレーション', exact: true });
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), String(value));
  await page.getByRole('button', { name: '変更をすべて保存', exact: true }).click();
  await page.waitForFunction(
    (expected) =>
      window.dock.snapshot().then((s) => s.settings.value.host.hardwareAcceleration === expected),
    value,
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(profile, 'settings.json'))).host.hardwareAcceleration,
    value,
  );
}
async function close() {
  await application.evaluate(({ app }) => app.quit());
  await application.close();
  application = null;
}
(async () => {
  try {
    let page = await launch();
    assert.equal(await enabled(), true);
    assert.equal(
      await page
        .getByRole('switch', { name: 'ハードウェアアクセラレーション', exact: true })
        .getAttribute('aria-checked'),
      'true',
    );
    await save(page, false);
    assert.equal(await enabled(), true); // Saving leaves the current process unchanged.
    await page.screenshot({ path: path.join(profile, 'hardware-acceleration-off.png') });
    await close();
    page = await launch();
    assert.equal(await enabled(), false);
    const offFeatures = await application.evaluate(({ app }) => app.getGPUFeatureStatus());
    assert.match(offFeatures.gpu_compositing, /^disabled/);
    assert.equal(
      await page
        .getByRole('switch', { name: 'ハードウェアアクセラレーション', exact: true })
        .getAttribute('aria-checked'),
      'false',
    );
    await save(page, true);
    assert.equal(await enabled(), false);
    await close();
    page = await launch();
    assert.equal(await enabled(), true);
    assert.equal(
      await page
        .getByRole('switch', { name: 'ハードウェアアクセラレーション', exact: true })
        .getAttribute('aria-checked'),
      'true',
    );
    console.log(
      JSON.stringify({
        ok: true,
        profile,
        checks:
          'legacy default on, UI off/on persistence, restart required, actual Electron acceleration and GPU compositing disabled',
        offFeatures,
      }),
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (application) await close().catch(() => {});
  }
})();

const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.artifacts', `shell-page-theme-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.theme = 'light';
settings.host.hardwareAcceleration = !process.argv.includes('--software');
settings.host.closeToTray = false;
settings.globalShortcutCommands = [];
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const observeOnly = process.argv.includes('--observe');
(async () => {
  let app;
  const result = {
    profile,
    hardwareAcceleration: settings.host.hardwareAcceleration,
    success: false,
    samples: [],
  };
  try {
    app = await electron.launch({
      executablePath: require('electron'),
      args: [root, `--test-profile=${profile}`],
      env,
    });
    const host = await app.firstWindow();
    await host.waitForFunction(async () => (await window.dock.snapshot()).startupReady);
    result.initialBackground = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].getBackgroundColor(),
    );
    if (!observeOnly) assert.equal(result.initialBackground.toLowerCase(), '#fafbfc');
    await app.evaluate(({ app, BrowserWindow, WebContentsView }) => {
      globalThis.__themeFrames = [];
      globalThis.__pageBackgrounds = new WeakMap();
      const setBackground = WebContentsView.prototype.setBackgroundColor;
      WebContentsView.prototype.setBackgroundColor = function (color) {
        globalThis.__pageBackgrounds.set(this, color);
        return setBackground.call(this, color);
      };
      app.on('web-contents-created', (_event, wc) => {
        let watching = false;
        wc.on('did-start-navigation', (_event, url) => {
          if (watching || !/\/(home|logs|settings)\.html$/.test(url)) return;
          watching = true;
          wc.beginFrameSubscription((frame) => {
            const w = BrowserWindow.getAllWindows().find((w) =>
              w.webContents.getURL().startsWith('appdock://host/'),
            );
            const view = w?.contentView.children.find((v) => v.webContents === wc);
            const size = frame.getSize();
            if (!size.width || !size.height) return;
            const pixel = frame.crop({ x: 2, y: 2, width: 1, height: 1 }).toBitmap();
            globalThis.__themeFrames.push({
              url,
              visible: view?.getVisible() ?? false,
              color: [...pixel],
              time: Date.now(),
            });
          });
        });
      });
    });
    for (const theme of ['light', 'dark']) {
      await host.evaluate(async (theme) => {
        const s = await window.dock.snapshot();
        await window.dock.saveSettings(
          { ...s.settings.value, host: { ...s.settings.value.host, theme } },
          s.settings.revision,
        );
      }, theme);
      await host.waitForFunction(
        (theme) => document.documentElement.dataset.theme === theme,
        theme,
      );
      for (let round = 0; round < 3; round++) {
        for (const route of ['logs', 'settings', 'home']) {
          await app.evaluate(() => {
            globalThis.__themeFrames = [];
          });
          await host.evaluate((route) => window.dock.navigate(route), route);
          const shell = await (async () => {
            for (let i = 0; i < 200; i++) {
              const p = app
                .context()
                .pages()
                .find((p) => p.url().endsWith(`/${route}.html`));
              if (p) return p;
              await new Promise((r) => setTimeout(r, 25));
            }
            throw Error('Shell page not created');
          })();
          await shell.waitForFunction(
            (theme) => document.documentElement.dataset.theme === theme,
            theme,
          );
          await shell.waitForTimeout(180);
          const frames = await app.evaluate(() => globalThis.__themeFrames);
          const native = await app.evaluate(({ BrowserWindow }, route) => {
            const w = BrowserWindow.getAllWindows().find((w) =>
              w.webContents.getURL().startsWith('appdock://host/'),
            );
            const v = w.contentView.children.find((v) =>
              v.webContents?.getURL().endsWith(`/${route}.html`),
            );
            return {
              window: w.getBackgroundColor(),
              page: globalThis.__pageBackgrounds.get(v),
              visible: v?.getVisible(),
            };
          }, route);
          const hostColor = await host.evaluate(() => ({
            root: getComputedStyle(document.documentElement).backgroundColor,
            main: getComputedStyle(document.querySelector('main')).backgroundColor,
            slot: getComputedStyle(document.querySelector('.shell-page-slot')).backgroundColor,
          }));
          result.samples.push({ theme, route, round, hostColor, native, frames });
          const wrong = frames.filter(
            (f) =>
              f.visible &&
              (theme === 'light'
                ? f.color[0] < 100 && f.color[1] < 100 && f.color[2] < 100
                : f.color[0] > 200 && f.color[1] > 200 && f.color[2] > 200),
          );
          console.log(
            JSON.stringify({
              theme,
              route,
              round,
              hostColor,
              native,
              frames: frames.length,
              wrong: wrong.length,
            }),
          );
          if (!observeOnly) {
            const expected = theme === 'light' ? '#fafbfc' : '#101116';
            assert.equal(native.window.toLowerCase(), expected);
            assert.equal(native.page, expected);
            assert.equal(native.visible, true);
            assert.ok(
              frames.some((f) => f.visible),
              'No visible frame captured',
            );
            assert.equal(wrong.length, 0, `${theme} ${route} painted the opposite background`);
          }
        }
      }
    }
    result.success = true;
  } finally {
    if (app) await app.close();
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
    console.log(profile);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

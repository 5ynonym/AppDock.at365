const { _electron: electron, chromium } = require('playwright');
const fs = require('node:fs'),
  path = require('node:path'),
  net = require('node:net');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.artifacts', `shell-page-${Date.now()}`);
fs.mkdirSync(profile, { recursive: true });
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.host.closeToTray = false;
settings.globalShortcutCommands = [];
const external = path.join(profile, 'extensions', 'fixture-shell');
fs.cpSync(path.join(root, 'out/shells/default'), external, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(external, 'extension.json')));
manifest.id = 'fixture.logs';
manifest.name = 'Fixture Logs';
manifest.shell = { apiVersion: 1, views: { 'page.logs': 'logs.html' } };
manifest.capabilities.push('settings');
manifest.settings = [{ key: 'compact', title: 'Compact', type: 'boolean', default: false }];
manifest.commands = [
  { id: 'fixture.logs.write', title: 'Write log' },
  { id: 'fixture.logs.mark', title: 'Mark' },
];
fs.writeFileSync(path.join(external, 'extension.json'), JSON.stringify(manifest));
fs.writeFileSync(
  path.join(external, 'worker.cjs'),
  `exports.activate=async c=>{c.commands.register('fixture.logs.write','Write log',async()=>{await c.log.info('Fixture live log');await c.log.error('Fixture error');});c.commands.register('fixture.logs.mark','Mark',async()=>c.settings.set('compact',true));};`,
);
settings.extensions[manifest.id] = { enabled: true, settings: {} };
const stalled = path.join(profile, 'extensions', 'stalled');
fs.mkdirSync(stalled, { recursive: true });
fs.writeFileSync(
  path.join(stalled, 'extension.json'),
  JSON.stringify({
    apiVersion: 1,
    id: 'fixture.stalled',
    name: 'Stalled',
    version: '1.0.0',
    runtime: 'node',
    entry: 'worker.cjs',
    capabilities: ['shell'],
    shell: { apiVersion: 1, views: { 'page.logs': 'logs.html' } },
  }),
);
fs.writeFileSync(path.join(stalled, 'worker.cjs'), 'exports.activate=async()=>{};');
fs.writeFileSync(path.join(stalled, 'logs.html'), '<!doctype html><body>Not ready</body>');
settings.extensions['fixture.stalled'] = { enabled: true, settings: {} };
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const checks = [];
let app, browser, dock, child;
let success = false;
const hash = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const until = async (fn, label, timeout = 20000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(label);
};
let portable;
if (process.argv[2]) {
  portable = path.join(profile, 'AppDock.at365.exe');
  fs.copyFileSync(path.resolve(process.argv[2]), portable);
  assert.equal(hash(portable), hash(path.resolve(process.argv[2])));
}
async function launch(extra = []) {
  if (!portable) {
    app = await electron.launch({
      executablePath: require('electron'),
      args: [root, `--test-profile=${profile}`, ...extra],
      env,
    });
    browser = app.context();
  } else {
    const probe = net.createServer();
    await new Promise((r) => probe.listen(0, '127.0.0.1', r));
    const port = probe.address().port;
    await new Promise((r) => probe.close(r));
    child = spawn(
      portable,
      [`--test-profile=${profile}`, `--remote-debugging-port=${port}`, ...extra],
      { env, windowsHide: true, stdio: 'ignore' },
    );
    const connection = await until(async () => {
      try {
        return await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
      } catch {}
    }, 'CDP');
    browser = connection.contexts()[0];
  }
  dock = await until(
    () =>
      browser
        .pages()
        .find(
          (p) =>
            p.url().startsWith('appdock://host/index.html') &&
            !p.url().endsWith('/notifications.html'),
        ),
    'host page',
  );
  dock.setDefaultTimeout(12000);
  await until(
    async () => (await dock.evaluate(() => window.dock.snapshot())).startupReady,
    'startup',
  );
  assert.equal(
    (await dock.evaluate(() => window.dock.snapshot())).version,
    require('../package.json').version,
  );
}
async function close() {
  if (app) {
    await app.close();
    app = undefined;
  } else if (dock && !dock.isClosed()) {
    await dock.evaluate(() => window.dock.executeCommand('appdock.quit')).catch(() => {});
    await until(() => child.exitCode !== null, 'portable stopped');
  }
}
async function navigate(route) {
  await dock.evaluate((route) => window.dock.navigate(route), route);
}
async function select(id) {
  await dock.evaluate(async (id) => {
    const s = await window.dock.snapshot();
    await window.dock.saveSettings(
      { ...s.settings.value, host: { ...s.settings.value.host, shellProvider: id } },
      s.settings.revision,
    );
  }, id);
}
const logs = (provider = 'appdock.default-shell') =>
  until(async () => {
    for (const p of browser.pages().filter((p) => p.url().endsWith('/logs.html'))) {
      try {
        if (
          (await p.evaluate(async () => (await window.appdockPage.connect()).providerAppletId)) ===
            provider &&
          (await p.locator('.log-toolbar').count())
        )
          return p;
      } catch {}
    }
  }, `logs provider ${provider}`);
const countRows = (p) => p.locator('.log-row').count();
async function check(name, action) {
  await action();
  checks.push(name);
  console.log('PASS ' + name);
}
(async () => {
  try {
    await launch();
    await check('lazy page and unchanged live filters', async () => {
      assert.equal(browser.pages().filter((p) => p.url().endsWith('/logs.html')).length, 0);
      await dock.evaluate(() => window.dock.executeCommand('fixture.logs.write'));
      await navigate('logs');
      const p = await logs();
      assert.equal(await dock.locator('.log-toolbar').count(), 0);
      await p.getByLabel('ログのApplet').selectOption('fixture.logs');
      await until(
        async () =>
          (await p.locator('.log-row').filter({ hasText: 'Fixture live log' }).count()) === 1 &&
          (await p.locator('.log-row').filter({ hasText: 'Fixture error' }).count()) === 1,
        'source filter',
      );
      await until(
        async () =>
          (await p.locator('.log-row > div > span').allTextContents()).every(
            (s) => s === 'fixture.logs',
          ),
        'filtered sources',
      );
      await p.getByLabel('ログレベル').selectOption('error');
      await until(async () => (await countRows(p)) === 1, 'level filter');
      await p.getByLabel('ログを検索').fill('missing');
      await p.getByText('該当するログはありません。').waitFor();
      await p.getByLabel('ログを検索').fill('Fixture');
      await until(async () => (await countRows(p)) === 1, 'search');
      await p.screenshot({ path: path.join(profile, 'logs-dark.png') });
      const ribbon = await require('./shell-overlay-helper.cjs').ribbonPage(dock);
      await ribbon.evaluate(() => window.appdockShell.focusHost('after'));
      await until(
        async () => await p.evaluate(() => document.hasFocus()),
        'ribbon enters log page',
      );
      const pageId = await p.evaluate(async () => (await window.appdockPage.connect()).snapshot.id);
      await navigate('logs');
      await dock.waitForTimeout(150);
      assert.equal(
        await p.evaluate(async () => (await window.appdockPage.connect()).snapshot.id),
        pageId,
      );
      assert.equal(await p.getByLabel('ログを検索').inputValue(), 'Fixture');
    });
    await check(
      'logs fill the host area across notification, resize and zoom changes',
      async () => {
        await require('./shell-page-layout-helper.cjs').exerciseLayout(
          dock,
          await logs(),
          app,
          'logs',
        );
      },
    );
    await check(
      'partial provider switch keeps query; normal commands/settings and stale actions',
      async () => {
        const old = await logs();
        const id = await old.evaluate(async () => (await window.appdockPage.connect()).snapshot.id);
        await select('fixture.logs');
        const p = await logs('fixture.logs');
        assert.equal(await p.getByLabel('ログを検索').inputValue(), 'Fixture');
        assert.equal(await p.getByLabel('ログレベル').inputValue(), 'error');
        assert.equal(
          (await dock.evaluate(() => window.dock.snapshot())).shell.active,
          'appdock.default-shell',
        );
        await p.evaluate(() => window.appdockPage.executeCommand('fixture.logs.mark'));
        assert.equal(
          await p.evaluate(async () => (await window.appdockPage.getSettings()).compact),
          true,
        );
        assert(
          await p.evaluate(async () => {
            try {
              await window.appdockPage.executeCommand('appdock.quit');
              return false;
            } catch {
              return true;
            }
          }),
        );
        assert(
          await p.evaluate(async () => {
            try {
              await window.appdockPage.act({ id: 'old', type: 'open-directory' });
              return false;
            } catch {
              return true;
            }
          }),
        );
        assert.equal(
          await p.evaluate(async () => (await window.appdockPage.connect()).snapshot.id),
          id,
        );
        assert.equal(await p.evaluate(() => typeof window.dock), 'undefined');
      },
    );
    await check('modal palette remains above page and restores focus', async () => {
      const p = await logs('fixture.logs');
      await dock.evaluate(async () => {
        const s = await window.dock.settingsEditing();
        await window.dock.editSettings({
          sessionId: s.sessionId,
          editRevision: s.editRevision,
          operationId: crypto.randomUUID(),
          action: {
            type: 'draft',
            value: { ...s.draft, profile: { ...s.draft.profile, name: 'Notification fixture' } },
          },
        });
      });
      await until(
        () => browser.pages().some((p) => p.url().endsWith('/notifications.html')),
        'notification renderer',
      );
      await p.getByLabel('ログを検索').focus();
      await p.keyboard.press('Control+p');
      const palette = await require('./shell-overlay-helper.cjs').overlayPage(dock);
      if (app) {
        const urls = await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].contentView.children.map(
            (v) => v.webContents?.getURL() ?? '',
          ),
        );
        const pageIndex = urls.findIndex((u) => u.endsWith('/logs.html'));
        const noticeIndex = urls.findIndex((u) => u.endsWith('/notifications.html'));
        const overlayIndex = urls.findIndex((u) => u.endsWith('/overlay.html'));
        assert(pageIndex >= 0 && noticeIndex > pageIndex && overlayIndex > noticeIndex);
      }
      await require('./shell-overlay-helper.cjs').closingAction(palette.keyboard.press('Escape'));
      await until(async () => await p.evaluate(() => document.hasFocus()), 'page focus restored');
      assert.equal(await p.getByLabel('ログを検索').inputValue(), 'Fixture');
      await dock.evaluate(async () => {
        const s = await window.dock.settingsEditing();
        await window.dock.editSettings({
          sessionId: s.sessionId,
          editRevision: s.editRevision,
          operationId: crypto.randomUUID(),
          action: { type: 'reload' },
        });
      });
    });
    await check(
      'renderer failure falls back with filters; retry and intentional disable',
      async () => {
        const p = await logs('fixture.logs');
        const cdp = await browser.newCDPSession(p);
        void cdp.send('Page.crash').catch(() => {});
        const fallback = await logs();
        assert.equal(await fallback.getByLabel('ログを検索').inputValue(), 'Fixture');
        await dock.evaluate(() => window.dock.retryShell());
        await logs('fixture.logs');
        await dock.evaluate(() => window.dock.toggleExtension('fixture.logs', false));
        await logs();
        await dock.evaluate(() => window.dock.toggleExtension('fixture.logs', true));
        await logs('fixture.logs');
      },
    );
    await check('timeout fallback, route teardown and persisted source', async () => {
      await select('fixture.stalled');
      const p = await logs();
      assert.equal(await p.getByLabel('ログを検索').inputValue(), 'Fixture');
      await navigate('home');
      await until(
        () => !browser.pages().some((p) => p.url().endsWith('/logs.html')),
        'unmounted logs',
      );
      await select('appdock.default-shell');
      await navigate('logs');
      const again = await logs();
      assert.equal(await again.getByLabel('ログのApplet').inputValue(), 'fixture.logs');
    });
    await check('Applet detail shares page renderer with fixed scope', async () => {
      await navigate('extensions');
      await dock.locator('[data-applet-id="fixture.logs"] .applet-select').click();
      await dock.getByRole('tab', { name: 'ログ', exact: true }).click();
      const p = await logs();
      assert.equal(await p.getByLabel('ログのApplet').count(), 0);
      assert(
        await p.evaluate(async () =>
          (await window.appdockPage.connect()).snapshot.content.entries.every(
            (e) => e.source === 'fixture.logs',
          ),
        ),
      );
      await p.screenshot({ path: path.join(profile, 'detail-dark.png') });
      await require('./shell-page-layout-helper.cjs').assertLayout(dock, p, app, true);
    });
    await check('theme and resized layout, source isolation from root', async () => {
      await dock.evaluate(async () => {
        const s = await window.dock.snapshot();
        await window.dock.saveSettings(
          { ...s.settings.value, host: { ...s.settings.value.host, theme: 'light' } },
          s.settings.revision,
        );
      });
      const p = await logs();
      await until(
        async () => (await p.evaluate(() => document.documentElement.dataset.theme)) === 'light',
        'light theme',
      );
      await p.screenshot({ path: path.join(profile, 'detail-light.png') });
      assert.equal(await dock.locator('.log-row').count(), 0);
      const oldWidth = await p.evaluate(() => innerWidth);
      await dock.evaluate(() => window.dock.windowAction('maximize'));
      await until(async () => (await p.evaluate(() => innerWidth)) !== oldWidth, 'resized page');
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (app) {
        const area = await app.evaluate(({ BrowserWindow }) => {
          const w = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().startsWith('appdock://host/'),
          );
          const child = w.contentView.children.find((v) =>
            v.webContents?.getURL().endsWith('/logs.html'),
          );
          return {
            bounds: child.getBounds(),
            zoom: w.webContents.getZoomFactor(),
            size: w.getContentSize(),
          };
        });
        const slot = await dock.locator('.shell-page-slot').boundingBox();
        assert(Math.abs(area.bounds.x - Math.round(slot.x * area.zoom)) <= 1);
        assert(Math.abs(area.bounds.y - Math.round(slot.y * area.zoom)) <= 1);
        assert(area.bounds.y + area.bounds.height < area.size[1]);
      }
      await p.getByRole('button', { name: '保存先を開く' }).focus();
      await p.keyboard.press('Shift+Tab');
      await until(async () => await dock.evaluate(() => document.hasFocus()), 'focus exits page');
      await dock.locator('.shell-page-slot').focus();
      await until(async () => await p.evaluate(() => document.hasFocus()), 'focus enters page');
    });
    await check('WebApplet log scope uses the same renderer', async () => {
      await dock.locator('.applet-select').filter({ hasText: 'WebApplet' }).click();
      await dock.getByRole('tab', { name: 'ログ', exact: true }).click();
      const p = await require('./shell-overlay-helper.cjs').logsPage(dock, { type: 'web' });
      assert.equal(await p.getByLabel('ログのApplet').count(), 0);
    });
    await select('fixture.logs');
    await close();
    await launch(['--safe-shell']);
    await navigate('logs');
    await check('safe-shell uses Default Shell for pages', async () => {
      await logs();
      assert.equal((await dock.evaluate(() => window.dock.snapshot())).shell.safeMode, true);
    });
    success = true;
  } catch (error) {
    for (const [i, p] of browser?.pages().entries() ?? []) {
      if (p.url().endsWith('/logs.html')) {
        await p.screenshot({ path: path.join(profile, `failure-page-${i}.png`) }).catch(() => {});
        fs.writeFileSync(
          path.join(profile, `failure-page-${i}.txt`),
          await p
            .locator('body')
            .innerText()
            .catch(() => ''),
        );
      }
    }
    fs.writeFileSync(path.join(profile, 'error.txt'), String(error.stack || error));
    if (dock && !dock.isClosed())
      await dock.screenshot({ path: path.join(profile, 'failure.png') }).catch(() => {});
    throw error;
  } finally {
    await close();
    fs.writeFileSync(
      path.join(profile, 'result.json'),
      JSON.stringify({ ok: success, checks, portable: portable && hash(portable) }, null, 2),
    );
    console.log(profile);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

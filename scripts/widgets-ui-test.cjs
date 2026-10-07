const { _electron: electron } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `widgets-ui-${Date.now()}`);
const watch = path.resolve(root, '../Applet.Watch.at365/publish/Applet.Watch.at365');
const target = path.join(profile, 'extensions/Watch');
fs.mkdirSync(target, { recursive: true });
for (const file of ['Applet.Watch.at365.dll', 'Applet.Watch.at365.deps.json', 'extension.json'])
  fs.copyFileSync(path.join(watch, file), path.join(target, file));
fs.cpSync(path.join(watch, 'Resources'), path.join(target, 'Resources'), { recursive: true });
const { createDefaultSettings } = require('../out/main/shared/settings-schema.js');
const config = createDefaultSettings();
config.extensions['at365.watch'] = {
  enabled: true,
  settings: { visible: false, showSeconds: true, alignment: 'bottom', opacity: 0.4 },
};
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(config));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app;
let page;
const snap = () => page.evaluate(() => window.dock.snapshot());
async function until(check, message) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(message);
}
async function launch() {
  const packaged = process.argv[2];
  app = await electron.launch({
    executablePath: packaged ? path.resolve(packaged) : require('electron'),
    args: packaged ? [`--test-profile=${profile}`] : [root, `--test-profile=${profile}`],
    env,
  });
  page =
    (await app.windows()).find((w) => !w.url().includes('surface=widget')) ??
    (await app.firstWindow());
  await page.getByRole('heading', { name: 'ホーム', exact: true }).waitFor();
  await until(
    async () => (await snap()).extensions[0]?.state === 'running',
    'Watch DLL activation failed',
  );
}
async function placement(id, patch) {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.evaluate(
        async ({ id, patch }) => {
          const s = await window.dock.snapshot();
          const w = s.widgets.find((w) => w.id === id);
          await window.dock.setWidgetPlacement(
            id,
            { ...w.placement, ...patch },
            s.settings.revision,
          );
        },
        { id, patch },
      );
      return;
    } catch (error) {
      // Windows scanners can briefly hold the test profile's JSON during atomic replacement.
      if (attempt >= 2 || !String(error).includes('EPERM')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
const planes = () =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter((w) => w.webContents.getURL().includes('surface=widget'))
      .map((w) => ({
        id: w.id,
        url: w.webContents.getURL(),
        visible: w.isVisible(),
        top: w.isAlwaysOnTop(),
        focusable: w.isFocusable(),
        bounds: w.getBounds(),
        handle: w.getNativeWindowHandle().readBigUInt64LE().toString(),
      })),
  );
const nativeProbe = (handle) =>
  JSON.parse(
    execFileSync(
      'pwsh',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(root, 'scripts/widget-native-probe.ps1'),
        '-WindowHandle',
        handle,
      ],
      { encoding: 'utf8', windowsHide: true },
    ),
  );
(async () => {
  try {
    await launch();
    let s = await snap();
    assert.equal(s.widgets.length, 2);
    assert.equal(s.extensions[0].runtime, 'dotnet');
    assert.equal(s.widgets[0].placement.anchor, 'bottom-left');
    assert.equal(s.widgets[0].placement.opacity, 0.4);
    assert.equal((await planes()).length, 0);
    await page.getByRole('button', { name: 'ウィジェット', exact: true }).click();
    await page
      .locator('[data-widget-id="at365.watch.clock"]')
      .getByRole('button', { name: 'ホームにピン留め', exact: true })
      .click();
    await until(async () => (await snap()).widgets[0].placement.home, 'pin did not persist');
    await page.getByLabel('文字の左右揃え').selectOption('left');
    await page.getByLabel('文字の上下揃え').selectOption('top');
    await page.getByLabel('幅', { exact: true }).fill('520');
    await page.getByLabel('高さ', { exact: true }).fill('150');
    await page.getByLabel('文字サイズ', { exact: true }).fill('128');
    await page.getByRole('button', { name: '配置を保存', exact: true }).click();
    await until(async () => (await snap()).widgets[0].placement.width === 520, 'form did not save');
    await page
      .locator('[data-widget-id="at365.watch.clock"]')
      .getByRole('button', { name: 'デスクトップに表示', exact: true })
      .click();
    await placement('at365.watch.date', {
      desktop: true,
      home: true,
      width: 400,
      height: 100,
      fontSize: 72,
    });
    await until(
      async () => (await planes()).length === 1 && (await planes())[0].visible,
      'front plane did not open',
    );
    assert.equal((await planes())[0].top, true);
    assert.equal((await planes())[0].focusable, false);
    const nativeFront = nativeProbe((await planes())[0].handle);
    assert.equal(nativeFront.clickThrough, true);
    assert.equal(nativeFront.noActivate, true);
    assert.equal(nativeFront.topmost, true);
    assert.equal(nativeFront.layered, true);
    const alpha = await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes('surface=widget'),
      );
      return (await w.webContents.capturePage()).toBitmap()[3];
    });
    assert.equal(alpha, 0, 'empty desktop plane pixels must be transparent');
    let surface = (await app.windows()).find((w) => w.url().includes('surface=widget'));
    await surface.locator('[data-widget-id]').nth(1).waitFor();
    const rendered = await surface
      .locator('.widget-clock .widget-time-text')
      .getAttribute('aria-label');
    await until(
      async () =>
        (await surface.locator('.widget-clock .widget-time-text').getAttribute('aria-label')) !==
        rendered,
      'clock did not tick',
    );
    assert.equal(await surface.evaluate(() => typeof window.dock), 'undefined');
    await surface.clock.install({ time: new Date('2026-10-07T12:34:00Z') });
    await surface.clock.pauseAt(new Date('2026-10-07T12:34:00.500Z'));
    await surface.reload();
    await surface.waitForFunction(() =>
      getComputedStyle(document.querySelector('.widget-clock svg')).fontFamily.includes(
        'widget-at365-watch-clock',
      ),
    );
    const textBounds = () =>
      surface.evaluate(() => {
        const svg = document.querySelector('.widget-clock svg');
        const r = svg.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          runs: [...svg.querySelectorAll('text')].map((t) => t.textContent),
        };
      });
    const stable = await textBounds();
    const widths = new Set([stable.width]);
    for (let second = 1; second < 60; second++) {
      await surface.clock.runFor(1000);
      const current = await textBounds();
      assert.equal(current.x, stable.x, 'left-aligned ink must retain its anchor distance');
      assert.equal(current.y, stable.y, 'top-aligned ink must retain its anchor distance');
      assert.deepEqual(current.runs, [stable.runs[0], ':' + String(second).padStart(2, '0')]);
      widths.add(current.width);
    }
    assert.ok(widths.size > 1, 'real font ink widths must remain proportional');
    assert.equal(await surface.locator('.widget-date svg').getAttribute('aria-label'), '10/7 Wed');
    for (const horizontal of ['left', 'center', 'right'])
      for (const vertical of ['top', 'center', 'bottom']) {
        await placement('at365.watch.clock', {
          anchor: 'top-left',
          x: 0,
          y: 0,
          horizontalAlign: horizontal,
          verticalAlign: vertical,
        });
        // Frozen page clocks need an explicit tick to flush the changed snapshot.
        await surface.clock.runFor(100);
        await surface.waitForFunction(
          ({ horizontal, vertical }) => {
            const v = document.querySelector('.widget-clock');
            return (
              getComputedStyle(v).justifyContent ===
                { left: 'flex-start', center: 'center', right: 'flex-end' }[horizontal] &&
              getComputedStyle(v).alignItems ===
                { top: 'flex-start', center: 'center', bottom: 'flex-end' }[vertical]
            );
          },
          { horizontal, vertical },
        );
        const alignedEdges = () =>
          surface.evaluate(() => {
            const box = document.querySelector('.widget-clock').getBoundingClientRect();
            const text = document.querySelector('.widget-clock svg').getBoundingClientRect();
            return {
              left: text.left - box.left,
              right: box.right - text.right,
              top: text.top - box.top,
              bottom: box.bottom - text.bottom,
              cx: text.left + text.width / 2 - box.left - box.width / 2,
              cy: text.top + text.height / 2 - box.top - box.height / 2,
            };
          });
        for (let second = 0; second < 60; second++) {
          const edges = await alignedEdges();
          assert.ok(
            Math.abs(edges[horizontal === 'center' ? 'cx' : horizontal]) <= 0.5,
            `${horizontal} alignment moved: ${JSON.stringify(edges)}`,
          );
          assert.ok(
            Math.abs(edges[vertical === 'center' ? 'cy' : vertical]) <= 0.5,
            `${vertical} alignment moved: ${JSON.stringify(edges)}`,
          );
          await surface.clock.runFor(1000);
        }
      }
    const ink = await surface.evaluate(() =>
      [...document.querySelectorAll('.widget-time-text')].map((svg) => {
        const v = svg.viewBox.baseVal;
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(v.width) + 4;
        canvas.height = Math.ceil(v.height) + 4;
        const context = canvas.getContext('2d');
        const style = getComputedStyle(svg);
        for (const text of svg.querySelectorAll('text')) {
          context.font = `${style.fontWeight} ${text.getAttribute('font-size')}px ${style.fontFamily}`;
          context.fillText(
            text.textContent,
            +text.getAttribute('x') + 2,
            +text.getAttribute('y') + 2,
          );
        }
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width,
          top = canvas.height,
          right = 0,
          bottom = 0;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++)
            if (pixels[(y * canvas.width + x) * 4 + 3] > 16) {
              left = Math.min(left, x);
              top = Math.min(top, y);
              right = Math.max(right, x + 1);
              bottom = Math.max(bottom, y + 1);
            }
        return {
          label: svg.getAttribute('aria-label'),
          left: left - 2,
          top: top - 2,
          right: right - 2 - v.width,
          bottom: bottom - 2 - v.height,
        };
      }),
    );
    for (const edges of ink)
      for (const edge of ['left', 'right', 'top', 'bottom'])
        assert.ok(Math.abs(edges[edge]) <= 2, JSON.stringify(edges));
    fs.writeFileSync(path.join(profile, 'typography-ink.json'), JSON.stringify(ink, null, 2));
    await placement('at365.watch.clock', {
      horizontalAlign: 'left',
      verticalAlign: 'top',
      x: 20,
      y: 20,
    });
    await surface.clock.resume();
    await surface.screenshot({ path: path.join(profile, 'front-plane.png'), omitBackground: true });
    const displays = (await snap()).widgetDisplays;
    if (displays.length > 1) {
      const other = displays.find((d) => !d.primary);
      await placement('at365.watch.date', { monitor: other.id });
      await until(
        async () => (await planes()).length === 2 && (await planes()).every((p) => p.visible),
        'independent monitor plane missing',
      );
      const boundsMatch = (await planes()).some((p) =>
        ['x', 'y', 'width', 'height'].every(
          (key) => Math.abs(p.bounds[key] - other.bounds[key]) <= 1,
        ),
      );
      assert.ok(boundsMatch, JSON.stringify({ planes: await planes(), expected: other.bounds }));
      await placement('at365.watch.date', { monitor: 'unplugged-test-display' });
      await until(
        async () => (await planes()).length === 1,
        'disconnected monitor fallback failed',
      );
      assert.equal(
        (await snap()).widgets.find((w) => w.id === 'at365.watch.date').placement.monitor,
        'unplugged-test-display',
      );
      await placement('at365.watch.date', { monitor: 'primary' });
    }
    await page.getByRole('button', { name: 'ホーム', exact: true }).first().click();
    await page.locator('.home-widget-card').nth(1).waitFor();
    await page.screenshot({ path: path.join(profile, 'home.png') });
    await placement('at365.watch.clock', { layer: 'desktop' });
    await placement('at365.watch.date', { layer: 'desktop' });
    await until(
      async () =>
        (await planes()).length === 1 &&
        !(await planes())[0].top &&
        (await snap()).widgetErrors.length === 0,
      'desktop attach failed',
    );
    await new Promise((r) => setTimeout(r, 300));
    const desktop = (await planes())[0];
    const nativeDesktop = nativeProbe(desktop.handle);
    assert.match(nativeDesktop.parentClass, /^(Progman|WorkerW)$/);
    assert.equal(nativeDesktop.child, true);
    assert.equal(nativeDesktop.clickThrough, true);
    assert.equal(nativeDesktop.noActivate, true);
    assert.equal(nativeDesktop.topmost, false);
    assert.equal(
      nativeDesktop.foreground,
      nativeFront.foreground,
      'desktop attach must not steal focus',
    );
    fs.writeFileSync(
      path.join(profile, 'native-desktop.json'),
      JSON.stringify(nativeDesktop, null, 2),
    );
    if (displays.length > 1) {
      const other = displays.find((d) => !d.primary);
      await placement('at365.watch.date', { monitor: other.id });
      await until(
        async () => (await planes()).length === 2 && (await planes()).every((p) => p.visible),
        'second desktop monitor not attached',
      );
      const secondary = (await planes()).find(
        (p) => p.bounds.x !== desktop.bounds.x || p.bounds.y !== desktop.bounds.y,
      );
      const nativeSecondary = nativeProbe(secondary.handle);
      assert.match(nativeSecondary.parentClass, /^(Progman|WorkerW)$/);
      assert.equal(nativeSecondary.clickThrough, true);
      const expected = await app.evaluate(
        ({ screen }, bounds) => screen.dipToScreenRect(null, bounds),
        other.bounds,
      );
      for (const key of ['x', 'y', 'width', 'height'])
        assert.ok(Math.abs(nativeSecondary.rectangle[key] - expected[key]) <= 1);
      await placement('at365.watch.date', { monitor: 'primary' });
      await until(
        async () => (await planes()).length === 1,
        'secondary desktop plane not released',
      );
    }
    fs.writeFileSync(path.join(profile, 'desktop-window.json'), JSON.stringify(desktop, null, 2));
    assert.equal(desktop.focusable, false);
    await page.evaluate(() => window.dock.moveWidget('at365.watch.clock'));
    await until(async () => (await planes()).length === 2, 'move editor not created');
    let editor = (await app.windows()).find(
      (w) => w.url().includes('surface=widget') && w !== surface,
    );
    for (const candidate of await app.windows())
      if (
        candidate.url().includes('surface=widget') &&
        (await candidate.evaluate(async () => (await window.widgetSurface.snapshot()).editing))
      )
        editor = candidate;
    await editor.getByRole('button', { name: '完了', exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find(
        (w) => w.isFocusable() && w.webContents.getURL().includes('surface=widget'),
      );
      const b = w.getBounds();
      w.setBounds({ ...b, x: 90, y: 120 });
    });
    await editor.getByRole('button', { name: '完了', exact: true }).click();
    await until(
      async () =>
        (await snap()).widgets.find((w) => w.id === 'at365.watch.clock').placement.position ===
        'free',
      'drag placement was not saved',
    );
    const moved = (await snap()).widgets.find((w) => w.id === 'at365.watch.clock').placement;
    await page.evaluate(() => window.dock.moveWidget('at365.watch.clock'));
    for (const candidate of await app.windows())
      if (
        candidate.url().includes('surface=widget') &&
        (await candidate.evaluate(async () => (await window.widgetSurface.snapshot()).editing))
      )
        editor = candidate;
    await editor.getByRole('button', { name: '取消', exact: true }).click();
    assert.deepEqual(
      (await snap()).widgets.find((w) => w.id === 'at365.watch.clock').placement,
      moved,
    );
    await page.evaluate(async () => {
      await window.dock.executeCommand('at365.watch.hide');
    });
    await until(async () => (await planes()).length === 0, 'hide did not release planes');
    assert.equal((await snap()).widgets.filter((w) => w.placement.home).length, 2);
    await page.evaluate(async () => {
      await window.dock.executeCommand('at365.watch.toggle');
    });
    await until(
      async () => (await planes()).length === 1,
      'show after toggle did not restore plane',
    );
    await page.evaluate(() => window.dock.toggleExtension('at365.watch', false));
    await until(async () => (await planes()).length === 0, 'disable did not destroy planes');
    assert.equal((await snap()).widgets.length, 2);
    await page.evaluate(() => window.dock.toggleExtension('at365.watch', true));
    await until(async () => (await planes()).length === 1, 'enable did not restore widgets');
    assert.deepEqual((await snap()).widgets.find((w) => w.id === 'at365.watch.clock').placement, {
      ...moved,
      desktop: true,
    });
    await page.getByRole('button', { name: 'ウィジェット', exact: true }).click();
    await page.getByLabel('X座標', { exact: true }).fill('777');
    await page.getByRole('button', { name: 'ホーム', exact: true }).first().click();
    await page.getByRole('button', { name: 'ウィジェット', exact: true }).click();
    assert.equal(await page.getByLabel('X座標', { exact: true }).inputValue(), '777');
    await page.getByRole('button', { name: '再読み込み', exact: true }).click();
    await page.screenshot({ path: path.join(profile, 'widgets-dark.png') });
    await page.evaluate(async () => {
      const s = await window.dock.snapshot();
      await window.dock.saveSettings(
        { ...s.settings.value, host: { ...s.settings.value.host, theme: 'light' } },
        s.settings.revision,
      );
    });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.screenshot({ path: path.join(profile, 'widgets-light.png') });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => !w.webContents.getURL().includes('surface=widget'))
        .setSize(900, 760),
    );
    await page.screenshot({ path: path.join(profile, 'widgets-900.png') });
    const overflow = await page.evaluate(() => {
      const m = document.querySelector('main');
      return m.scrollWidth > m.clientWidth + 1;
    });
    assert.equal(overflow, false, 'widget management must fit the narrow host window');
    for (const width of [1280, 900, 760]) {
      await app.evaluate(
        ({ BrowserWindow }, width) =>
          BrowserWindow.getAllWindows()
            .find((w) => !w.webContents.getURL().includes('surface=widget'))
            .setSize(width, 760),
        width,
      );
      const body = page.locator('.widget-management-body');
      await body.evaluate((el) => {
        el.scrollTop = 0;
      });
      const before = await page
        .getByRole('button', { name: '配置を保存', exact: true })
        .boundingBox();
      await body.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const after = await page
        .getByRole('button', { name: '配置を保存', exact: true })
        .boundingBox();
      assert.deepEqual(
        after,
        before,
        'save toolbar must remain fixed while the widget form scrolls',
      );
      await page.screenshot({ path: path.join(profile, `toolbar-${width}.png`) });
    }
    await app.close();
    app = undefined;
    await launch();
    assert.deepEqual((await snap()).widgets.find((w) => w.id === 'at365.watch.clock').placement, {
      ...moved,
      desktop: true,
    });
    const errors = (await snap()).logs.filter((l) => l.level === 'error');
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          ok: true,
          profile,
          desktop,
          checks: [
            'DLL activation',
            'legacy migration once',
            'home pin/form persistence',
            'shared transparent front plane',
            'rendered clock tick',
            'proportional runs and variable ink width',
            '60 ticks in all 9 text alignments',
            'tight clock/date ink bounds',
            'invariant Watch date format',
            'fixed save toolbar at 1280/900/760',
            'restricted surface IPC',
            'Windows desktop shell attach',
            'move/save/cancel',
            'visibility commands',
            'stop/restart cleanup',
            'themes',
            'restart layout',
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await app?.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

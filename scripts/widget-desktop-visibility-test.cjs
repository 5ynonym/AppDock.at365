const { _electron: electron } = require('playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, 'artifacts', `widget-visibility-${Date.now()}`);
const folder = path.join(profile, 'extensions', 'test.desktop');
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(
  path.join(folder, 'extension.json'),
  JSON.stringify({
    apiVersion: 1,
    id: 'test.desktop',
    name: 'Desktop visibility fixture',
    version: '1.0.0',
    runtime: 'node',
    entry: 'index.cjs',
    capabilities: ['widgets'],
    widgets: [
      {
        id: 'test.desktop.marker',
        title: 'Visibility',
        content: { kind: 'text', body: 'Visibility' },
      },
    ],
  }),
);
fs.writeFileSync(path.join(folder, 'index.cjs'), 'exports.activate = async () => {};');
const { createDefaultSettings } = require('../out/main/shared/settings-schema.js');
const { defaultWidgetPlacement } = require('../out/main/shared/widgets.js');
const settings = createDefaultSettings();
settings.extensions['test.desktop'] = { enabled: true, settings: {} };
settings.widgets['test.desktop.marker'] = {
  ...defaultWidgetPlacement(),
  desktop: true,
  layer: 'desktop',
  width: 180,
  height: 120,
};
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
function probe(script, args = []) {
  return JSON.parse(
    execFileSync(
      'pwsh',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(root, 'scripts', script),
        ...args,
      ],
      { encoding: 'utf8', windowsHide: true },
    ),
  );
}
const capture = (region, name) =>
  probe('widget-screen-capture.ps1', [
    '-X',
    String(region.x),
    '-Y',
    String(region.y),
    '-Width',
    String(region.width),
    '-Height',
    String(region.height),
    '-OutputPath',
    path.join(profile, name + '.png'),
  ]);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app;
(async () => {
  try {
    app = await electron.launch({
      executablePath: process.argv[2] ? path.resolve(process.argv[2]) : require('electron'),
      args: process.argv[2] ? [`--test-profile=${profile}`] : [root, `--test-profile=${profile}`],
      env,
    });
    const main =
      (await app.windows()).find((w) => !w.url().includes('surface=widget')) ??
      (await app.firstWindow());
    await main.waitForFunction(
      async () => (await window.dock.snapshot()).extensions[0]?.state === 'running',
    );
    await app.evaluate(({ BrowserWindow }) => {
      for (const w of BrowserWindow.getAllWindows())
        if (!w.webContents.getURL().includes('surface=widget')) w.hide();
    });
    let surface;
    const end = Date.now() + 10000;
    while (!surface && Date.now() < end) {
      surface = (await app.windows()).find((w) => w.url().includes('surface=widget'));
      if (!surface) await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(surface, 'desktop plane missing');
    await surface.locator('.widget-view').waitFor();
    const shell = probe('widget-shell-probe.ps1');
    fs.writeFileSync(path.join(profile, 'shell-before.json'), JSON.stringify(shell, null, 2));
    const display = await app.evaluate(({ screen }) =>
      screen.dipToScreenRect(null, screen.getPrimaryDisplay().bounds),
    );
    const region = shell.exposed.find(
      (r) =>
        r.x >= display.x &&
        r.y >= display.y &&
        r.x + r.width <= display.x + display.width &&
        r.y + r.height <= display.y + display.height,
    );
    assert.ok(region, 'No exposed desktop patch is available; other windows were left untouched.');
    const local = await app.evaluate(({ screen }, region) => {
      const d = screen.screenToDipRect(null, region);
      const origin = screen.getPrimaryDisplay().bounds;
      return { x: d.x - origin.x, y: d.y - origin.y, width: d.width, height: d.height };
    }, region);
    const results = { region, baseline: capture(region, 'baseline') };
    const waitForColour = async (name, colour) => {
      const until = Date.now() + 8000;
      let pixels;
      do {
        await new Promise((r) => setTimeout(r, 200));
        pixels = capture(region, name);
      } while (pixels[colour] < region.width * region.height * 0.9 && Date.now() < until);
      return pixels;
    };
    for (const [name, color] of [
      ['green', '#12e7a6'],
      ['magenta', '#ed12d7'],
    ]) {
      await surface.evaluate(
        ({ local, color }) => {
          document
            .querySelectorAll('.widget-desktop-item')
            .forEach((el) => (el.style.display = 'none'));
          let marker = document.getElementById('visibility-test-marker');
          if (!marker) {
            marker = document.createElement('div');
            marker.id = 'visibility-test-marker';
            document.body.append(marker);
          }
          Object.assign(marker.style, {
            position: 'fixed',
            left: local.x + 'px',
            top: local.y + 'px',
            width: local.width + 'px',
            height: local.height + 'px',
            background: color,
          });
        },
        { local, color },
      );
      results[name] = await waitForColour(name, name);
    }
    const coverId = await app.evaluate(async ({ BrowserWindow, screen }, region) => {
      const bounds = screen.screenToDipRect(null, region);
      const cover = new BrowserWindow({
        ...bounds,
        frame: false,
        show: false,
        focusable: false,
        skipTaskbar: true,
        backgroundColor: '#000000',
        webPreferences: { sandbox: true },
      });
      await cover.loadURL('data:text/html,<body style="margin:0;background:black"></body>');
      cover.showInactive();
      return cover.id;
    }, region);
    results.covered = await waitForColour('covered-by-normal-window', 'black');
    await app.evaluate(({ BrowserWindow }, id) => BrowserWindow.fromId(id).destroy(), coverId);
    results.uncovered = await waitForColour('uncovered', 'magenta');
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes('surface=widget'))
        .hide();
    });
    // Simulate the hidden-plane recovery path after a transient attachment failure.
    await main.evaluate(async () => {
      const s = await window.dock.snapshot();
      const w = s.widgets[0];
      await window.dock.setWidgetPlacement(
        w.id,
        { ...w.placement, fontSize: w.placement.fontSize + 1 },
        s.settings.revision,
      );
    });
    results.recovered = await waitForColour('recovered-after-hidden', 'magenta');
    await surface.evaluate(() => document.getElementById('visibility-test-marker').remove());
    await new Promise((r) => setTimeout(r, 350));
    results.transparent = capture(region, 'transparent-again');
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ profile, ...results }, null, 2));
    assert.ok(
      results.green.green > region.width * region.height * 0.9,
      'green marker is missing from the actual desktop composition',
    );
    assert.ok(
      results.magenta.magenta > region.width * region.height * 0.9,
      'updated marker is missing from the actual desktop composition',
    );
    assert.ok(
      results.covered.black > region.width * region.height * 0.9,
      'desktop widgets must stay below normal application windows',
    );
    for (const name of ['uncovered', 'recovered'])
      assert.ok(
        results[name].magenta > region.width * region.height * 0.9,
        `${name}: the desktop plane did not resume painting`,
      );
    assert.ok(
      results.transparent.green < region.width * region.height * 0.1 &&
        results.transparent.magenta < region.width * region.height * 0.1,
      'empty plane pixels must reveal the underlying desktop',
    );
    console.log(
      'PASS: actual desktop composition, updates, normal-window occlusion, hidden-plane recovery and transparency',
    );
  } finally {
    await app?.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

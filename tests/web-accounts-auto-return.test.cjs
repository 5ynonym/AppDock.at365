const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { WebAccountController, validateWebAccounts } = require('../out/main/main/core/web-accounts');
const { readManifest } = require('../out/main/main/core/extensions');
const proto = WebAccountController.prototype;
const definition = {
  url: 'https://mail.google.com/mail/u/0/#inbox',
  origins: ['https://mail.google.com', 'https://accounts.google.com'],
  observeOrigin: 'https://mail.google.com',
  returnToStartOnHideSetting: 'returnToInboxOnHide',
  ui: 'ui.html',
  observer: 'observer.js',
};
function fixture() {
  const controller = Object.create(proto);
  const calls = [];
  const location = new URL('https://mail.google.com/mail/u/0/?fixture=keep#sent');
  let loading = false,
    destroyed = false;
  const view = {
    webContents: {
      getURL: () => location.href,
      isLoadingMainFrame: () => loading,
      isDestroyed: () => destroyed,
      async executeJavaScriptInIsolatedWorld(world, sources) {
        assert.equal(world, 1001);
        calls.push('route');
        vm.runInNewContext(sources[0].code, { URL, location });
      },
    },
  };
  Object.assign(controller, {
    definition,
    services: {
      settings: () => ({ returnToInboxOnHide: true }),
      failed: () => calls.push('failed'),
    },
    surface: { visible: false, window: {} },
    attached: view,
    surfaceWasVisible: false,
    visibilityCheckPending: false,
    returnAfterLoad: new WeakSet(),
    navigationRevision: 0,
    changed: () => calls.push('changed'),
  });
  return {
    controller,
    view,
    calls,
    location,
    loading: (value) => (loading = value),
    destroy: () => (destroyed = true),
  };
}
test('Automatic return requires its own boolean setting and a same-origin start URL', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'appdock-return-'));
  try {
    for (const file of ['ui.html', 'observer.js', 'index.js'])
      fs.writeFileSync(path.join(folder, file), '');
    const manifest = {
      apiVersion: 1,
      id: 'test.return',
      name: 'Test',
      version: '1.0.0',
      runtime: 'node',
      entry: 'index.js',
      capabilities: ['web-accounts', 'settings'],
      webAccounts: definition,
      settings: [{ key: 'returnToInboxOnHide', title: 'Return', type: 'boolean', default: false }],
    };
    const check = (patch) => {
      fs.writeFileSync(
        path.join(folder, 'extension.json'),
        JSON.stringify({ ...manifest, ...patch }),
      );
      return readManifest(folder);
    };
    assert.equal(check({}).webAccounts.returnToStartOnHideSetting, 'returnToInboxOnHide');
    assert.throws(() => check({ settings: [] }), /boolean/);
    assert.throws(() => check({ capabilities: ['web-accounts'] }), /settings capability/);
    assert.throws(
      () => check({ settings: [{ ...manifest.settings[0], type: 'string', default: '' }] }),
      /boolean/,
    );
    for (const key of [true, '', '../other', 'x'.repeat(81)])
      assert.throws(
        () => validateWebAccounts(folder, { ...definition, returnToStartOnHideSetting: key }),
        /setting key/,
      );
    assert.throws(
      () =>
        validateWebAccounts(folder, { ...definition, url: 'https://accounts.google.com/#inbox' }),
      /start URL/,
    );
    assert.doesNotThrow(() =>
      validateWebAccounts(folder, { ...definition, url: 'https://mail.google.com/mail/u/0/' }),
    );
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
test('Automatic return changes only the hidden settled document route, preserving query and input', async () => {
  const f = fixture();
  await f.controller.returnHiddenViewToStart(f.view);
  assert.equal(f.location.hash, '#inbox');
  assert.equal(f.location.search, '?fixture=keep');
  assert.deepEqual(f.calls, ['route']);
  await f.controller.returnHiddenViewToStart(f.view);
  assert.deepEqual(f.calls, ['route']);
  for (const url of [
    'https://accounts.google.com/login#step',
    'https://mail.google.com/login#step',
  ]) {
    f.location.href = url;
    await f.controller.returnHiddenViewToStart(f.view);
    assert.equal(f.location.href, url);
  }
  f.location.href = definition.url.replace('#inbox', '#sent');
  f.loading(true);
  await f.controller.returnHiddenViewToStart(f.view);
  assert.equal(f.location.hash, '#sent');
  assert.equal(f.controller.returnAfterLoad.has(f.view), true);
  f.loading(false);
  f.controller.surface.visible = true;
  await f.controller.returnHiddenViewToStart(f.view);
  assert.equal(f.location.hash, '#sent');
  f.controller.surface.visible = false;
  f.controller.services.settings = () => ({ returnToInboxOnHide: false });
  await f.controller.returnHiddenViewToStart(f.view);
  assert.equal(f.location.hash, '#sent');
  f.controller.services.settings = () => ({ returnToInboxOnHide: true });
  f.controller.disposed = true;
  await f.controller.returnHiddenViewToStart(f.view);
  assert.equal(f.location.hash, '#sent');
});
test('Surface visibility resets once per hide, ignores viewport and transient host transfer', async () => {
  const f = fixture(),
    c = f.controller;
  c.surface.visible = true;
  c.checkSurfaceVisibility();
  await Promise.resolve();
  c.viewport = null;
  c.checkSurfaceVisibility();
  await Promise.resolve();
  assert.equal(f.location.hash, '#sent');
  c.surface.visible = false;
  c.checkSurfaceVisibility();
  c.surface.visible = true;
  c.checkSurfaceVisibility();
  await Promise.resolve();
  assert.equal(f.location.hash, '#sent');
  c.surface.visible = false;
  c.checkSurfaceVisibility();
  c.checkSurfaceVisibility();
  await Promise.resolve();
  assert.equal(f.location.hash, '#inbox');
  assert.equal(c.navigationRevision, 1);
  c.checkSurfaceVisibility();
  await Promise.resolve();
  assert.equal(c.navigationRevision, 1);
  c.surface.visible = true;
  c.checkSurfaceVisibility();
  await Promise.resolve();
  c.surface.visible = false;
  c.checkSurfaceVisibility();
  c.disposed = true;
  await Promise.resolve();
  assert.equal(c.navigationRevision, 1);
});
test('Account switch returns the previous view only and keeps the new view and local tab', async () => {
  const f = fixture(),
    c = f.controller;
  const next = { webContents: {} };
  c.surface.visible = true;
  c.view = () => next;
  c.park = () => {};
  c.layout = () => {};
  c.show('second');
  await Promise.resolve();
  assert.equal(c.attached, next);
  assert.equal(f.location.hash, '#inbox');
  assert.equal(c.navigationRevision, 0);
  f.location.hash = '#sent';
  c.show('second');
  await Promise.resolve();
  assert.equal(f.location.hash, '#sent');
});

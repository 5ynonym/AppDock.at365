const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { keepWebPageActive } = require('../out/main/main/core/web-page-activity');
function page() {
  const wc = new EventEmitter(),
    debuggerApi = new EventEmitter();
  let attached = false;
  wc.url = 'https://mail.google.com/mail/u/0/#inbox';
  wc.commands = [];
  wc.isDestroyed = () => false;
  wc.isLoadingMainFrame = () => false;
  wc.isDevToolsOpened = () => false;
  wc.focused = false;
  wc.isFocused = () => wc.focused;
  wc.getURL = () => wc.url;
  debuggerApi.isAttached = () => attached;
  debuggerApi.attach = () => {
    attached = true;
  };
  debuggerApi.detach = () => {
    attached = false;
    debuggerApi.emit('detach');
  };
  debuggerApi.sendCommand = async (...args) => wc.commands.push(args);
  wc.debugger = debuggerApi;
  return wc;
}
test('active-page policy is restricted to the observation origin and released on authentication or destruction', () => {
  const wc = page();
  let errors = 0;
  const activity = keepWebPageActive(wc, 'https://mail.google.com', () => errors++);
  wc.emit('did-finish-load');
  assert.equal(wc.debugger.isAttached(), false);
  activity.ready();
  assert.equal(wc.debugger.isAttached(), true);
  assert.deepEqual(wc.commands, [['Emulation.setFocusEmulationEnabled', { enabled: true }]]);
  wc.emit('did-start-navigation', { isMainFrame: false });
  assert.equal(wc.debugger.isAttached(), true);
  wc.emit('did-start-navigation', { isMainFrame: true });
  assert.equal(wc.debugger.isAttached(), false);
  wc.url = 'https://accounts.google.com/login?fixture=secret';
  wc.emit('did-finish-load');
  assert.equal(wc.debugger.isAttached(), false);
  wc.url = 'https://mail.google.com/mail/u/0/#inbox';
  wc.emit('did-finish-load');
  activity.ready();
  assert.equal(wc.debugger.isAttached(), true);
  wc.emit('destroyed');
  assert.equal(wc.debugger.isAttached(), false);
  assert.equal(wc.listenerCount('did-finish-load'), 0);
  assert.equal(errors, 0);
});
test('active-page policy leaves another debugger alone and resumes after user DevTools close', () => {
  const wc = page();
  let errors = 0;
  const activity = keepWebPageActive(wc, 'https://mail.google.com', () => errors++);
  wc.debugger.attach();
  activity.ready();
  assert.equal(errors, 1);
  assert.equal(wc.commands.length, 0);
  wc.emit('did-start-navigation', { isMainFrame: true });
  assert.equal(wc.debugger.isAttached(), true);
  wc.debugger.detach();
  activity.ready();
  wc.emit('devtools-closed');
  assert.equal(wc.commands.length, 1);
  activity.dispose();
  assert.equal(wc.debugger.isAttached(), false);
});

test('destruction does not access the WebContents debugger getter after its native object is gone', () => {
  const wc = page();
  const debuggerApi = wc.debugger;
  const activity = keepWebPageActive(wc, 'https://mail.google.com', () =>
    assert.fail('unexpected failure'),
  );
  wc.emit('did-finish-load');
  activity.ready();
  Object.defineProperty(wc, 'debugger', {
    get: () => {
      throw Error('Object has been destroyed');
    },
  });
  assert.doesNotThrow(() => wc.emit('destroyed'));
  assert.equal(debuggerApi.isAttached(), false);
});

test('same-document Gmail navigation preserves active state without another load event', () => {
  const wc = page();
  const activity = keepWebPageActive(wc, 'https://mail.google.com', () =>
    assert.fail('unexpected failure'),
  );
  wc.emit('did-stop-loading');
  activity.ready();
  wc.emit('did-start-navigation', { isMainFrame: true, isSameDocument: true });
  wc.url = 'https://mail.google.com/mail/u/0/#sent';
  wc.emit('did-navigate-in-page', {}, wc.url, true);
  assert.equal(wc.debugger.isAttached(), true);
  activity.dispose();
});

test('readiness activates once per document and waits again after reload', () => {
  const wc = page();
  const activity = keepWebPageActive(wc, 'https://mail.google.com', () =>
    assert.fail('unexpected failure'),
  );
  wc.emit('did-finish-load');
  wc.emit('did-stop-loading');
  assert.equal(wc.commands.length, 0);
  activity.ready();
  activity.ready();
  wc.emit('did-stop-loading');
  assert.equal(wc.commands.length, 1);
  wc.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });
  wc.emit('did-stop-loading');
  assert.equal(wc.debugger.isAttached(), false);
  activity.ready();
  assert.equal(wc.commands.length, 2);
  activity.dispose();
  activity.ready();
  assert.equal(wc.commands.length, 2);
});

test('background activity renews without overriding native user focus and cancels on dispose', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const wc = page();
  const activity = keepWebPageActive(wc, 'https://mail.google.com', () =>
    assert.fail('unexpected failure'),
  );
  activity.ready();
  t.mock.timers.tick(30_000);
  assert.deepEqual(
    wc.commands.map((c) => c[1].enabled),
    [true, false],
  );
  t.mock.timers.tick(250);
  assert.deepEqual(
    wc.commands.map((c) => c[1].enabled),
    [true, false, true],
  );
  wc.focused = true;
  wc.emit('focus');
  t.mock.timers.tick(30_000);
  assert.deepEqual(
    wc.commands.map((c) => c[1].enabled),
    [true, false, true, false],
  );
  wc.focused = false;
  wc.emit('blur');
  assert.equal(wc.commands.at(-1)[1].enabled, true);
  t.mock.timers.tick(30_000);
  assert.equal(wc.commands.at(-1)[1].enabled, false);
  const count = wc.commands.length;
  activity.dispose();
  t.mock.timers.tick(60_000);
  assert.equal(wc.commands.length, count);
});

test('navigation cancels a pending renewal before reaching an authentication page', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const wc = page();
  const activity = keepWebPageActive(wc, 'https://mail.google.com', () =>
    assert.fail('unexpected failure'),
  );
  activity.ready();
  t.mock.timers.tick(30_000);
  wc.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });
  wc.url = 'https://accounts.google.com/';
  const count = wc.commands.length;
  t.mock.timers.tick(60_000);
  assert.equal(wc.commands.length, count);
  assert.equal(wc.debugger.isAttached(), false);
  activity.dispose();
});

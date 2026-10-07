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
  keepWebPageActive(wc, 'https://mail.google.com', () => errors++);
  wc.emit('did-finish-load');
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
  assert.equal(wc.debugger.isAttached(), true);
  wc.emit('destroyed');
  assert.equal(wc.debugger.isAttached(), false);
  assert.equal(wc.listenerCount('did-finish-load'), 0);
  assert.equal(errors, 0);
});
test('active-page policy leaves another debugger alone and resumes after user DevTools close', () => {
  const wc = page();
  let errors = 0;
  const dispose = keepWebPageActive(wc, 'https://mail.google.com', () => errors++);
  wc.debugger.attach();
  wc.emit('did-finish-load');
  assert.equal(errors, 1);
  assert.equal(wc.commands.length, 0);
  wc.emit('did-start-navigation', { isMainFrame: true });
  assert.equal(wc.debugger.isAttached(), true);
  wc.debugger.detach();
  wc.emit('devtools-closed');
  assert.equal(wc.commands.length, 1);
  dispose();
  assert.equal(wc.debugger.isAttached(), false);
});

test('destruction does not access the WebContents debugger getter after its native object is gone', () => {
  const wc = page();
  const debuggerApi = wc.debugger;
  keepWebPageActive(wc, 'https://mail.google.com', () => assert.fail('unexpected failure'));
  wc.emit('did-finish-load');
  Object.defineProperty(wc, 'debugger', {
    get: () => {
      throw Error('Object has been destroyed');
    },
  });
  assert.doesNotThrow(() => wc.emit('destroyed'));
  assert.equal(debuggerApi.isAttached(), false);
});

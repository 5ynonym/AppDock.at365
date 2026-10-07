const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TrayClickDispatcher } = require('../out/main/main/core/tray-clicks.js');
const { createDefaultSettings, parseSettings } = require('../out/main/shared/settings-schema.js');

function fixture(t, delay = () => Promise.resolve(500)) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(performance, 'now', () => 0);
  const host = createDefaultSettings().host;
  const executed = [];
  const dispatcher = new TrayClickDispatcher(
    () => host,
    (id) => executed.push(id),
    delay,
  );
  t.after(() => dispatcher.close());
  return { host, executed, dispatcher };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
test('double-click setting defaults off and validates null or a stable command ID', () => {
  const settings = createDefaultSettings();
  delete settings.host.trayDoubleClickCommand;
  assert.equal(parseSettings(settings).host.trayDoubleClickCommand, null);
  assert.equal(settings.host.trayDoubleClickCommand, undefined);
  settings.host.trayDoubleClickCommand = 'test.applet.run';
  assert.equal(parseSettings(settings).host.trayDoubleClickCommand, 'test.applet.run');
  for (const invalid of ['', 'bad id', false, 123, {}, []])
    assert.throws(
      () =>
        parseSettings({ ...settings, host: { ...settings.host, trayDoubleClickCommand: invalid } }),
      /trayDoubleClickCommand/,
    );
});
test('without a double assignment single clicks run immediately and double notifications add no execution', (t) => {
  const { executed, dispatcher } = fixture(t, () => {
    throw new Error('Must not query Windows');
  });
  dispatcher.click();
  dispatcher.doubleClick();
  assert.deepEqual(executed, ['appdock.open']);
});
test('assigned double action cancels the single action; standalone single waits for the Windows interval', async (t) => {
  const { host, executed, dispatcher } = fixture(t);
  host.trayDoubleClickCommand = 'double.run';
  dispatcher.click();
  await flush();
  t.mock.timers.tick(499);
  assert.deepEqual(executed, []);
  dispatcher.doubleClick();
  t.mock.timers.tick(1000);
  assert.deepEqual(executed, ['double.run']);
  dispatcher.click();
  await flush();
  t.mock.timers.tick(525);
  assert.deepEqual(executed, ['double.run', 'appdock.open']);
});
test('double-click and cancellation win while the native delay query is still pending', async (t) => {
  let resolve;
  const { host, executed, dispatcher } = fixture(
    t,
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  host.trayDoubleClickCommand = 'double.run';
  dispatcher.click();
  dispatcher.doubleClick();
  resolve(500);
  await flush();
  t.mock.timers.tick(1000);
  assert.deepEqual(executed, ['double.run']);
  dispatcher.click();
  dispatcher.cancel();
  resolve(500);
  await flush();
  t.mock.timers.tick(1000);
  assert.deepEqual(executed, ['double.run']);
});
test('independent single notifications remain independent; a following double cancels only its preceding single', async (t) => {
  const { host, executed, dispatcher } = fixture(t);
  host.trayDoubleClickCommand = 'double.run';
  dispatcher.click();
  dispatcher.click();
  await flush();
  dispatcher.doubleClick();
  t.mock.timers.tick(525);
  assert.deepEqual(executed, ['double.run', 'appdock.open']);
});
test('shutdown and configuration/menu cancellation discard delayed work; native query failure uses the Windows default', async (t) => {
  const { host, executed, dispatcher } = fixture(t, () =>
    Promise.reject(new Error('native unavailable')),
  );
  host.trayDoubleClickCommand = 'double.run';
  dispatcher.click();
  await flush();
  t.mock.timers.tick(500);
  assert.deepEqual(executed, []);
  t.mock.timers.tick(25);
  assert.deepEqual(executed, ['appdock.open']);
  dispatcher.click();
  await flush();
  t.mock.timers.tick(499);
  dispatcher.doubleClick();
  t.mock.timers.tick(1000);
  assert.deepEqual(executed, ['appdock.open', 'double.run']);
  dispatcher.click();
  await flush();
  dispatcher.cancel();
  t.mock.timers.tick(6000);
  assert.deepEqual(executed, ['appdock.open', 'double.run']);
  dispatcher.click();
  dispatcher.close();
  await flush();
  dispatcher.click();
  dispatcher.doubleClick();
  t.mock.timers.tick(6000);
  assert.deepEqual(executed, ['appdock.open', 'double.run']);
});

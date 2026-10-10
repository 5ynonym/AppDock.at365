const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHostApi } = require('../out/main/main/core/host-api');

test('common logging remains available during deactivation; other APIs and inactive processes stay rejected', async () => {
  const entries = [];
  const api = createHostApi(
    {},
    '',
    (...entry) => entries.push(entry),
    () => {},
  );
  const extension = {
    state: 'starting',
    manifest: { id: 'test.cleanup', capabilities: ['settings', 'ui'] },
  };
  for (const state of ['starting', 'running', 'stopping']) {
    extension.state = state;
    await api(extension, 'host.log', {
      level: 'error',
      source: 'another.applet',
      message: 'cleanup: ' + state,
    });
  }
  assert.deepEqual(
    entries,
    ['starting', 'running', 'stopping'].map((state) => [
      'error',
      'test.cleanup',
      'cleanup: ' + state,
    ]),
  );
  for (const method of ['host.settings.set', 'host.ui.panel', 'host.notifications.show'])
    await assert.rejects(api(extension, method, {}), /停止/);
  for (const state of ['stopped', 'error']) {
    extension.state = state;
    await assert.rejects(
      api(extension, 'host.log', { level: 'error', message: 'too late' }),
      /停止/,
    );
  }
  assert.equal(entries.length, 3);
});

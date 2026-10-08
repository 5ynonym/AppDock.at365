const { test } = require('node:test');
const assert = require('node:assert/strict');
const { trayIdentity } = require('../out/main/main/core/tray-identity');

test('Tray identity survives Windows path casing and normalization, but isolates installations and profiles', () => {
  const id = trayIdentity('C:\\Temp\\AppDock\\AppDock.at365.exe', 'A:\\Tools\\AppDock');
  assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(id, trayIdentity('c:/temp/appdock/./AppDock.at365.exe', 'a:/tools/appdock/'));
  assert.notEqual(id, trayIdentity('C:\\Temp\\Other\\AppDock.at365.exe', 'A:\\Tools\\AppDock'));
  assert.notEqual(id, trayIdentity('C:\\Temp\\AppDock\\AppDock.at365.exe', 'A:\\Tools\\Other'));
});

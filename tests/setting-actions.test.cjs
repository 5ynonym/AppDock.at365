const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSettingActions } = require('../out/main/shared/setting-actions.js');
const commands = [{ id: 'test.applet.apply', title: 'Apply' }];
const action = {
  command: commands[0].id,
  title: 'Apply',
  description: 'Manual instructions',
  successMessage: 'Done',
};
test('settings actions only reference declared commands and keep action data out of settings', () => {
  assert.equal(parseSettingActions(undefined, commands), undefined);
  assert.deepEqual(parseSettingActions([action], commands), [action]);
  for (const value of [
    null,
    {},
    [null],
    [action, action],
    [{ ...action, command: 'appdock.quit' }],
    [{ ...action, command: 'test.applet.undeclared' }],
    [{ ...action, title: ' ' }],
    [{ ...action, description: 12 }],
    [{ ...action, successMessage: '' }],
    Array(17).fill(action),
  ])
    assert.throws(() => parseSettingActions(value, commands));
});

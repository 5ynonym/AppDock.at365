const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseSettingDefinitions,
  parseSettingOptions,
  validateSettingValue,
  validateAppletSettings,
} = require('../out/main/shared/setting-definitions.js');
const { createDefaultSettings } = require('../out/main/shared/settings-schema.js');
test('Applet selections validate definitions, unique options, defaults and ranges', () => {
  const [position] = parseSettingDefinitions([
    {
      key: 'position',
      title: '時計の位置',
      type: 'select',
      default: 'top',
      options: [
        { label: '上端', value: 'top' },
        { label: '下端', value: 'bottom' },
      ],
    },
  ]);
  assert.doesNotThrow(() => validateSettingValue(position, 'bottom'));
  assert.throws(() => validateSettingValue(position, 'invalid'), /時計の位置/);
  assert.throws(() => parseSettingDefinitions([{ ...position, default: 'invalid' }]), /時計の位置/);
  assert.throws(
    () =>
      parseSettingOptions([
        { label: 'A', value: 'a' },
        { label: 'B', value: 'a' },
      ]),
    /重複/,
  );
  assert.throws(
    () =>
      parseSettingDefinitions([
        { key: 'number', title: 'サイズ', type: 'number', minimum: 10, maximum: 0 },
      ]),
    /範囲/,
  );
});
test('dynamic monitor selections preserve a disconnected monitor but enforce string values', () => {
  const [monitor] = parseSettingDefinitions([
    {
      key: 'monitor',
      title: 'モニター',
      type: 'select',
      dynamic: true,
      default: 'primary',
      options: [{ label: 'メイン', value: 'primary' }],
    },
  ]);
  assert.doesNotThrow(() => validateSettingValue(monitor, 'disconnected-display'));
  assert.throws(() => validateSettingValue(monitor, 123), /モニター/);
});
test('Applet numeric and boolean settings reject invalid saves without constraining undeclared data', () => {
  const value = createDefaultSettings();
  value.extensions['at365.watch'] = {
    enabled: true,
    settings: { opacity: 0.4, arbitraryData: { a: 1 } },
  };
  const applets = [
    {
      id: 'at365.watch',
      settings: [
        { key: 'opacity', title: '不透明度', type: 'number', minimum: 0.05, maximum: 1 },
        { key: 'visible', title: '時計を表示', type: 'boolean' },
      ],
    },
  ];
  assert.doesNotThrow(() => validateAppletSettings(value, applets));
  value.extensions['at365.watch'].settings.opacity = 2;
  assert.throws(() => validateAppletSettings(value, applets), /不透明度/);
  value.extensions['at365.watch'].settings.opacity = 0.4;
  value.extensions['at365.watch'].settings.visible = 'true';
  assert.throws(() => validateAppletSettings(value, applets), /時計を表示/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSettings, createDefaultSettings } = require('../out/main/shared/settings-schema.js');
const {
  normalizeShortcut,
  shortcutFromEvent,
  rankCommands,
  movePinnedCommand,
} = require('../out/main/shared/commands.js');
test('legacy settings gain Ctrl+P, profile and pins without losing existing data', () => {
  const original = {
    schemaVersion: 1,
    host: { theme: 'light', closeToTray: false, notifications: false, startMinimized: true },
    extensions: { 'test.custom': { enabled: true, settings: { answer: 42 } } },
  };
  const result = parseSettings(original);
  assert.deepEqual(result.extensions, original.extensions);
  assert.deepEqual(result.host, original.host);
  assert.equal(result.shortcuts['appdock.commands.search'][0], 'Ctrl+P');
  assert.deepEqual(result.pinnedCommands, []);
  assert.equal(result.profile.avatar, null);
  assert.equal(original.shortcuts, undefined);
});
test('shortcut normalization, duplicate detection, disabling and persisted unknown commands', () => {
  assert.equal(normalizeShortcut(' shift + control + p '), 'Ctrl+Shift+P');
  assert.equal(normalizeShortcut('ctrl+,'), 'Ctrl+,');
  assert.equal(normalizeShortcut('F12'), 'F12');
  assert.equal(normalizeShortcut('P'), 'P');
  assert.equal(normalizeShortcut(' pause '), 'Pause');
  assert.equal(normalizeShortcut('shift+Pause'), 'Shift+Pause');
  assert.throws(() => normalizeShortcut('Ctrl+Ctrl+P'), /修飾/);
  const settings = createDefaultSettings();
  settings.shortcuts['test.extension.run'] = ['Ctrl+Alt+R'];
  assert.deepEqual(parseSettings(settings).shortcuts['test.extension.run'], ['Ctrl+Alt+R']);
  settings.shortcuts['test.extension.run'] = ['Ctrl+P'];
  assert.throws(() => parseSettings(settings), /重複/);
  settings.shortcuts['appdock.commands.search'] = [];
  assert.deepEqual(parseSettings(settings).shortcuts['appdock.commands.search'], []);
});
test('keyboard matching ignores IME/modifier keys and canonicalizes shifted digits and comma', () => {
  const event = {
    key: 'p',
    code: 'KeyP',
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    metaKey: false,
  };
  assert.equal(shortcutFromEvent(event), 'Ctrl+P');
  assert.equal(shortcutFromEvent({ ...event, isComposing: true }), null);
  assert.equal(shortcutFromEvent({ ...event, key: 'Control' }), null);
  assert.equal(
    shortcutFromEvent({ ...event, key: '!', code: 'Digit1', shiftKey: true }),
    'Ctrl+Shift+1',
  );
  assert.equal(shortcutFromEvent({ ...event, key: ',', code: 'Comma' }), 'Ctrl+,');
});
test('pins rank commands without mutating source and reorder around inactive or filtered commands', () => {
  const commands = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(
    rankCommands(commands, ['c', 'a']).map((c) => c.id),
    ['c', 'a', 'b'],
  );
  assert.deepEqual(
    commands.map((c) => c.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(movePinnedCommand(['a', 'inactive', 'c'], 'c', -1, ['a', 'c']), [
    'c',
    'inactive',
    'a',
  ]);
  assert.deepEqual(movePinnedCommand(['a', 'c'], 'a', -1), ['a', 'c']);
  const settings = createDefaultSettings();
  settings.pinnedCommands = ['a', 'a'];
  assert.throws(() => parseSettings(settings), /重複/);
});
test('profile limits prevent arbitrary filenames and preserve normalized names', () => {
  const settings = createDefaultSettings();
  settings.profile = { name: '  ユキちゃん  ', avatar: 'avatar.png' };
  assert.equal(parseSettings(settings).profile.name, 'ユキちゃん');
  settings.profile.avatar = '../other.png';
  assert.throws(() => parseSettings(settings), /プロフィール/);
  settings.profile.avatar = null;
  settings.profile.name = '';
  assert.throws(() => parseSettings(settings), /プロフィール/);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSettings, createDefaultSettings } = require('../out/main/shared/settings-schema');
const {
  getKeybindings,
  parseKeybindings,
  resolveKeybindings,
  withKeybindings,
  safePageShortcut,
} = require('../out/main/shared/keybindings');
const { ShortcutDispatcher } = require('../out/main/main/core/shortcut-dispatcher');
const { GlobalHotKeyManager } = require('../out/main/main/core/global-hotkeys');
const row = (id, command, scope = 'app', appletIds = []) => ({
  id,
  command,
  key: 'Ctrl+F12',
  enabled: true,
  when: { scope, appletIds },
});
test('new settings round-trip beyond legacy limits and include bindings in the size limit', () => {
  const keybindings = Array.from({ length: 501 }, (_, i) =>
    row(`r.${i}`, `test.command.${i}`, 'global'),
  );
  const parsed = parseSettings({ ...createDefaultSettings(), keybindings });
  assert.deepEqual(parseSettings(parsed), parsed);
  const appletIds = Array.from({ length: 100 }, (_, i) => `applet.${i}.${'x'.repeat(160)}`);
  assert.throws(
    () =>
      parseSettings({
        ...createDefaultSettings(),
        keybindings: Array.from({ length: 100 }, (_, i) =>
          row(`r.${i}`, 'test.command', 'applets', appletIds),
        ),
      }),
    /1MB/,
  );
});
test('legacy settings remain readable; new bindings are authoritative and allow shared keys', () => {
  const legacy = createDefaultSettings();
  assert.equal(
    getKeybindings(legacy).find((r) => r.command === 'at365.watch.toggle').when.scope,
    'global',
  );
  const rows = [
    row('one', 'test.one', 'applets', ['gmail', 'web.1']),
    row('two', 'test.two', 'global'),
  ];
  const settings = parseSettings({ ...legacy, keybindings: rows });
  assert.deepEqual(settings.keybindings, rows);
  assert.deepEqual(settings.shortcuts, { 'test.one': ['Ctrl+F12'], 'test.two': ['Ctrl+F12'] });
  assert.deepEqual(parseSettings(settings), settings);
  assert.deepEqual(parseSettings({ ...settings, keybindings: [] }).shortcuts, {});
  assert.deepEqual(parseSettings(withKeybindings(legacy, rows)).keybindings, rows);
});
test('invalid and unknown conditions fail closed; unknown applet and command IDs are retained', () => {
  for (const when of [
    { scope: 'unknown', appletIds: [] },
    { scope: 'applets', appletIds: [] },
    { scope: 'app', appletIds: ['test'] },
    { scope: 'global', appletIds: [], extra: true },
  ])
    assert.throws(() => parseKeybindings([{ ...row('x', 'test.one'), when }]));
  assert.throws(() => parseKeybindings([row('x', 'test.one'), row('x', 'test.two')]));
  assert.equal(
    parseKeybindings([row('x', 'missing.command', 'applets', ['missing.applet'])]).length,
    1,
  );
});
test('scopes, multi-applet OR, ordering, disabled/unavailable commands and deduplication', () => {
  const rows = [
    row('a', 'test.a', 'global'),
    row('b', 'test.b'),
    row('c', 'test.c', 'pages'),
    row('d', 'test.d', 'applets', ['gmail', 'web.1']),
    row('e', 'test.b'),
    { ...row('f', 'test.f'), enabled: false },
    row('g', 'missing.command'),
  ];
  const available = ['test.a', 'test.b', 'test.c', 'test.d', 'test.f'].map((id) => ({ id }));
  const resolve = (context, global = false) =>
    resolveKeybindings(rows, 'Ctrl+F12', context, available, global);
  assert.deepEqual(resolve({ appFocused: false }, true), ['test.a']);
  assert.deepEqual(resolve({ appFocused: true }), ['test.b']);
  assert.deepEqual(resolve({ appFocused: true, appletId: 'gmail' }), [
    'test.b',
    'test.c',
    'test.d',
  ]);
  assert.deepEqual(resolve({ appFocused: true, appletId: 'web.1' }, true), [
    'test.a',
    'test.b',
    'test.c',
    'test.d',
  ]);
  assert.deepEqual(resolve({ appFocused: true, appletId: 'other' }), ['test.b', 'test.c']);
  assert.deepEqual(resolve({ appFocused: false, appletId: 'gmail' }), []);
});
test('owner scope uses registered ownership, follows current catalog and fails closed without an owner', () => {
  const rows = [row('a', 'unrelated.command', 'owner'), row('b', 'appdock.test', 'owner')];
  assert.deepEqual(parseKeybindings(rows), rows);
  const resolve = (context, owner = 'gmail', global = false) =>
    resolveKeybindings(
      rows,
      'Ctrl+F12',
      context,
      [
        { id: 'unrelated.command', extensionId: owner },
        { id: 'appdock.test', extensionId: null },
      ],
      global,
    );
  assert.deepEqual(resolve({ appFocused: true, appletId: 'gmail' }), ['unrelated.command']);
  assert.deepEqual(resolve({ appFocused: true, appletId: 'web.1' }), []);
  assert.deepEqual(resolve({ appFocused: false, appletId: 'gmail' }), []);
  assert.deepEqual(resolve({ appFocused: true }), []);
  assert.deepEqual(resolve({ appFocused: true, appletId: 'gmail' }, undefined, true), [
    'unrelated.command',
  ]);
  assert.deepEqual(resolve({ appFocused: true, appletId: 'gmail' }, null), []);
  assert.deepEqual(resolve({ appFocused: true, appletId: 'web.1' }, 'web.1'), [
    'unrelated.command',
  ]);
  assert.deepEqual(
    resolveKeybindings(rows, 'Ctrl+F12', { appFocused: true, appletId: 'gmail' }, []),
    [],
  );
  assert.throws(() => parseKeybindings([row('a', 'unrelated.command', 'owner', ['gmail'])]));
});
test('batch captures commands, reserves against re-entry, continues after failure and stops at shutdown', async () => {
  const calls = [],
    errors = [];
  let finish,
    stopped = false;
  const dispatcher = new ShortcutDispatcher(
    async (id) => {
      calls.push(id);
      if (id === 'a') await new Promise((r) => (finish = r));
      if (id === 'b') throw Error('test');
      if (id === 'quit') stopped = true;
    },
    (e) => errors.push(e),
    () => stopped,
  );
  const first = dispatcher.dispatch('F1', ['a', 'b', 'c', 'b']);
  await dispatcher.dispatch('F1', ['a', 'b']);
  await dispatcher.dispatch('F2', ['b']);
  assert.deepEqual(calls, ['a']);
  finish();
  await first;
  assert.deepEqual(calls, ['a', 'b', 'c']);
  assert.equal(errors.length, 1);
  await dispatcher.dispatch('F1', ['quit', 'c']);
  assert.equal(calls.at(-1), 'quit');
});
test('one OS registration per key; common dispatch receives each press only once', async () => {
  const keys = [],
    presses = [];
  const manager = new GlobalHotKeyManager(
    {
      sync: async (list) => {
        keys.push(list);
        return list.map((shortcut) => ({ shortcut, registered: true }));
      },
      close: async () => {},
    },
    assert.fail,
    () => {},
    assert.fail,
    async (key) => presses.push(key),
  );
  await manager.sync(
    {
      ...createDefaultSettings(),
      keybindings: [row('a', 'test.a', 'global'), row('b', 'test.b', 'global')],
    },
    ['test.a', 'test.b'],
  );
  assert.deepEqual(keys, [['Ctrl+F12']]);
  assert.equal(manager.statuses.length, 2);
  await manager.pressed('Ctrl+F12');
  assert.deepEqual(presses, ['Ctrl+F12']);
  await manager.sync({ ...createDefaultSettings(), keybindings: [] }, []);
  await manager.pressed('Ctrl+F12');
  assert.equal(presses.length, 1);
  await manager.close();
});
test('page typing policy preserves ordinary text, navigation and IME keys', () => {
  for (const key of ['a', 'Tab', 'Enter', 'Backspace', 'Process'])
    assert.equal(safePageShortcut({ key, control: false, alt: false }), false);
  for (const key of ['F1', 'F24', 'Pause'])
    assert.equal(safePageShortcut({ key, control: false, alt: false }), true);
  assert.equal(safePageShortcut({ key: 'r', control: true, alt: false }), true);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ExtensionManager } = require('../out/main/main/core/extensions.js');
const { createDefaultSettings } = require('../out/main/shared/settings-schema.js');
const { trayCommandGroups } = require('../out/main/main/core/tray-commands.js');

function fixture(t, displayNames) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'appdock-display-name-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [index, displayName] of displayNames.entries()) {
    const folder = path.join(root, String(index));
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, 'index.js'), 'exports.activate = async () => {};');
    fs.writeFileSync(
      path.join(folder, 'extension.json'),
      JSON.stringify({
        apiVersion: 1,
        id: `test.name-${index}`,
        name: 'Applet.Watch.at365',
        displayName,
        version: '1.0.0',
        runtime: 'node',
        entry: 'index.js',
        commands: [{ id: `test.name-${index}.run`, title: 'Run' }],
      }),
    );
  }
  const errors = [];
  const manager = new ExtensionManager({
    roots: [root],
    settings: { value: createDefaultSettings() },
    log: (level, source, message) => errors.push({ level, source, message }),
  });
  manager.discover();
  return { manager, errors };
}

test('discovery resolves display names without changing identity or command IDs; tray uses the same names', (t) => {
  const { manager, errors } = fixture(t, [undefined, '  デスクトップ時計  ', 'Applet.Explicit']);
  const snapshots = manager.snapshot();
  assert.deepEqual(errors, []);
  assert.deepEqual(
    snapshots.map((e) => e.displayName),
    ['Watch.at365', 'デスクトップ時計', 'Applet.Explicit'],
  );
  assert(snapshots.every((e) => e.name === 'Applet.Watch.at365'));
  const settings = createDefaultSettings();
  settings.trayCommands = snapshots.map((e) => e.commands[0].id);
  assert.deepEqual(settings.trayCommands, [
    'test.name-0.run',
    'test.name-1.run',
    'test.name-2.run',
  ]);
  assert.deepEqual(
    trayCommandGroups(settings, snapshots).map((g) => g.title),
    snapshots.map((e) => e.displayName),
  );
  assert.equal(manager.items.get('test.name-0').manifest.displayName, undefined);
});

test('invalid explicit display names are rejected during discovery, while 100 characters are accepted', (t) => {
  const { manager, errors } = fixture(t, [
    '',
    '  ',
    null,
    123,
    {},
    [],
    'x'.repeat(101),
    'x'.repeat(100),
  ]);
  assert.equal(manager.snapshot().length, 1);
  assert.equal(manager.snapshot()[0].id, 'test.name-7');
  assert.equal(errors.length, 7);
  assert(errors.every((e) => e.level === 'error' && e.message.includes('displayName')));
});

test('legacy names only lose a leading Applet. prefix and remain nonempty', (t) => {
  const { manager } = fixture(t, [undefined]);
  const manifest = manager.items.get('test.name-0').manifest;
  for (const [name, expected] of [
    ['Other.Applet.Watch', 'Other.Applet.Watch'],
    ['Watch.at365', 'Watch.at365'],
    ['Applet.', 'Applet.'],
    ['Applet.Applet.Watch', 'Applet.Watch'],
  ]) {
    manifest.name = name;
    assert.equal(manager.snapshot()[0].displayName, expected);
  }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path');
const { SettingsStore } = require('../out/main/main/core/settings');
const { AutomationApi } = require('../out/main/main/core/automation-api');
const { defaultRibbon } = require('../out/main/shared/applet-pages');
const id = 'appdock.ribbon.update';
function fixture(t) {
  const root = path.resolve('.artifacts/ribbon-command-unit');
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, 'case-'));
  const settings = new SettingsStore(path.join(dir, 'settings.json'), path.join(dir, 'backups'));
  settings.load();
  t.after(() => settings.close());
  const permissions = { write: true, execute: true, ribbon: true };
  const applets = [
    {
      id: 'sample',
      name: 'Sample',
      enabled: false,
      pages: [
        {
          id: 'main',
          title: 'Sample page',
          kind: 'local',
          path: 'PRIVATE_PATH',
          openCommand: 'PRIVATE_COMMAND',
        },
      ],
    },
  ];
  const options = {
    settings,
    save: (v, r) => settings.save(v, r),
    writable: () => permissions.write,
    executable: () => permissions.execute,
    ribbonEditable: () => permissions.ribbon,
    ribbonApplets: () => applets,
    ready: () => true,
    version: 'test',
    instanceId: 'test',
    applets: () => [],
    commands: () => [],
    execute: async () => {
      throw Error('Ribbon edits must not execute commands');
    },
  };
  const api = new AutomationApi(options);
  const get = () => api.call('ribbon.get');
  const edit = (operations, extras = {}) =>
    api.call('commands.execute', {
      id,
      args: { expectedRevision: get().revision, operations, ...extras },
    });
  return { settings, options, permissions, applets, api, get, edit };
}
const update = (id, changes) => ({ kind: 'update', id, changes });
test('ribbon read exposes scoped metadata and retains disabled and missing pages', (t) => {
  const f = fixture(t),
    s = structuredClone(f.settings.value);
  s.ribbon.order = ['page:missing:main'];
  s.ribbon.custom = 'PRIVATE_EXTRA';
  f.settings.save(s, f.settings.revision);
  const v = f.get(),
    page = v.items.find((i) => i.id === 'page:sample:main');
  assert.equal(page.enabled, false);
  assert.equal(page.visible, true);
  assert.equal(page.displayed, false);
  assert.deepEqual(v.retainedIds, ['page:missing:main']);
  assert.equal(JSON.stringify(v).includes('PRIVATE_'), false);
  assert.throws(() => f.api.call('ribbon.get', { extra: true }), { code: 'INVALID_ARGUMENT' });
});
test('ribbon atomic edit, dry run, disabled page visibility, placement and unrelated settings', async (t) => {
  const f = fixture(t),
    before = structuredClone(f.settings.value),
    bytes = fs.readFileSync(f.settings.file, 'utf8');
  const ops = [
    { kind: 'addSeparator', id: 'separator:test', placement: 'bottom' },
    update('home', { visible: false }),
    update('page:sample:main', { placement: 'bottom' }),
  ];
  const dry = await f.edit(ops, { dryRun: true });
  assert.equal(dry.completion, 'validated');
  assert.equal(dry.changed, true);
  assert.equal(fs.readFileSync(f.settings.file, 'utf8'), bytes);
  const saved = await f.edit(ops);
  assert.equal(saved.completion, 'settingsSaved');
  assert.equal(saved.effectVerified, false);
  assert.ok(saved.layout.hidden.includes('home'));
  assert.ok(saved.layout.bottom.includes('page:sample:main'));
  assert.equal(saved.items.find((i) => i.id === 'page:sample:main').displayed, false);
  for (const key of ['host', 'extensions', 'keybindings', 'gestures', 'appletOrder'])
    assert.deepEqual(f.settings.value[key], before[key]);
  await f.edit([{ kind: 'removeSeparator', id: 'separator:test' }]);
  for (const values of Object.values(f.get().layout)) assert.ok(!values.includes('separator:test'));
});
test('reorder includes hidden and disabled items and preserves other group and retained ids', async (t) => {
  const f = fixture(t),
    s = structuredClone(f.settings.value);
  s.ribbon.order = ['page:missing:main', 'logs'];
  s.ribbon.bottom.push('page:missing:main');
  s.ribbon.hidden = ['home', 'page:missing:main'];
  s.ribbon.custom = { secret: 'PRIVATE_EXTRA' };
  f.settings.save(s, f.settings.revision);
  const before = f.get(),
    top = before.items
      .filter((i) => i.placement === 'top')
      .map((i) => i.id)
      .reverse();
  await f.edit([{ kind: 'reorder', placement: 'top', ids: top }]);
  const after = f.get();
  assert.deepEqual(
    after.items.filter((i) => i.placement === 'top').map((i) => i.id),
    top,
  );
  assert.deepEqual(
    after.items.filter((i) => i.placement === 'bottom'),
    before.items.filter((i) => i.placement === 'bottom'),
  );
  assert.deepEqual(after.retainedIds, ['page:missing:main']);
  assert.ok(after.layout.hidden.includes('page:missing:main'));
  assert.equal(f.settings.value.ribbon.custom.secret, 'PRIVATE_EXTRA');
  await f.edit([{ kind: 'reset' }]);
  assert.deepEqual(f.get().layout, defaultRibbon());
  assert.equal(f.settings.value.ribbon.custom.secret, 'PRIVATE_EXTRA');
});
test('no-op visibility, placement and order do not save', async (t) => {
  const f = fixture(t);
  await f.edit([update('home', { visible: false }), update('logs', { visible: false })]);
  const rev = f.get().revision,
    bytes = fs.readFileSync(f.settings.file, 'utf8');
  const result = await f.edit([
    update('home', { visible: false, placement: 'top' }),
    {
      kind: 'reorder',
      placement: 'top',
      ids: f
        .get()
        .items.filter((i) => i.placement === 'top')
        .map((i) => i.id),
    },
  ]);
  assert.equal(result.changed, false);
  assert.equal(f.get().revision, rev);
  assert.equal(fs.readFileSync(f.settings.file, 'utf8'), bytes);
});
test('invalid operations and late errors reject all changes', async (t) => {
  const f = fixture(t),
    bytes = fs.readFileSync(f.settings.file, 'utf8');
  for (const op of [
    update('home', {}),
    update('home', { visible: 'yes' }),
    update('home', { placement: 'left' }),
    update('home', { extra: true }),
    { kind: 'reset', extra: 1 },
    { kind: 'removeSeparator', id: 'home' },
    { kind: 'addSeparator', id: 'bad', placement: 'top' },
    { kind: 'addSeparator', id: 'separator:test', placement: 'wrong' },
    { kind: 'reorder', placement: 'top', ids: ['home'] },
    { kind: 'reorder', placement: 'top', ids: ['home', 'home'] },
    { kind: 'unknown' },
  ]) {
    await assert.rejects(f.edit([update('logs', { visible: false }), op]), {
      code: 'INVALID_ARGUMENT',
    });
    assert.equal(fs.readFileSync(f.settings.file, 'utf8'), bytes);
  }
  await assert.rejects(f.edit([update('page:missing:main', { visible: true })]), {
    code: 'NOT_FOUND',
  });
  await assert.rejects(f.edit([{ kind: 'removeSeparator', id: 'separator:missing' }]), {
    code: 'NOT_FOUND',
  });
  await assert.rejects(f.edit([]), { code: 'INVALID_ARGUMENT' });
  await assert.rejects(f.edit([{ kind: 'reset' }], { dryRun: 'yes' }), {
    code: 'INVALID_ARGUMENT',
  });
  await assert.rejects(f.edit([{ kind: 'reset' }], { extra: true }), { code: 'INVALID_ARGUMENT' });
});
test('catalog changes invalidate incomplete reorder; separator count and duplicates are bounded', async (t) => {
  const f = fixture(t),
    top = f
      .get()
      .items.filter((i) => i.placement === 'top')
      .map((i) => i.id);
  f.applets.push({
    id: 'second',
    enabled: true,
    pages: [{ id: 'main', title: 'Second', kind: 'local', path: 'index.html' }],
  });
  await assert.rejects(f.edit([{ kind: 'reorder', placement: 'top', ids: top }]), {
    code: 'INVALID_ARGUMENT',
  });
  await assert.rejects(
    f.edit(
      Array.from({ length: 51 }, (_, i) => ({
        kind: 'addSeparator',
        id: `separator:s${i}`,
        placement: 'top',
      })),
    ),
    { code: 'INVALID_ARGUMENT' },
  );
  assert.deepEqual(f.get().layout, defaultRibbon());
  await assert.rejects(
    f.edit([
      { kind: 'addSeparator', id: 'separator:dup', placement: 'top' },
      { kind: 'addSeparator', id: 'separator:dup', placement: 'top' },
    ]),
    { code: 'INVALID_ARGUMENT' },
  );
});
test('all three write permissions independently gate edits and leave reads available', async (t) => {
  const f = fixture(t);
  for (const [permission, code] of [
    ['execute', 'EXECUTION_DISABLED'],
    ['write', 'WRITE_DISABLED'],
    ['ribbon', 'RIBBON_EDITING_DISABLED'],
  ]) {
    f.permissions[permission] = false;
    await assert.rejects(f.edit([update('home', { visible: false })]), { code });
    assert.ok(f.get().items.length);
    f.permissions[permission] = true;
  }
  const api = new AutomationApi({ ...f.options, ribbonEditable: undefined });
  await assert.rejects(
    api.call('commands.execute', {
      id,
      args: { expectedRevision: f.get().revision, operations: [{ kind: 'reset' }] },
    }),
    { code: 'RIBBON_EDITING_DISABLED' },
  );
});
test('shared revision rejects stale edits, restarted API tokens, and disk conflict', async (t) => {
  const f = fixture(t),
    old = f.get().revision;
  await f.api.call('commands.execute', {
    id: 'appdock.settings.update',
    args: { expectedRevision: old, changes: { theme: 'light' } },
  });
  await assert.rejects(f.edit([update('home', { visible: false })], { expectedRevision: old }), {
    code: 'REVISION_CONFLICT',
  });
  const restarted = new AutomationApi(f.options);
  await assert.rejects(
    restarted.call('commands.execute', {
      id,
      args: { expectedRevision: f.get().revision, operations: [{ kind: 'reset' }] },
    }),
    { code: 'REVISION_CONFLICT' },
  );
  const disk = JSON.parse(fs.readFileSync(f.settings.file, 'utf8'));
  disk.host.theme = 'dark';
  fs.writeFileSync(f.settings.file, JSON.stringify(disk));
  await assert.rejects(f.edit([update('home', { visible: false })]));
  assert.equal(JSON.parse(fs.readFileSync(f.settings.file, 'utf8')).host.theme, 'dark');
});
test('save failure is sanitized and leaves settings intact', async (t) => {
  const f = fixture(t),
    api = new AutomationApi({
      ...f.options,
      save: () => {
        throw Error('PRIVATE_PATH');
      },
    });
  await assert.rejects(
    api.call('commands.execute', {
      id,
      args: {
        expectedRevision: api.call('ribbon.get').revision,
        operations: [update('home', { visible: false })],
      },
    }),
    (e) => e.code === 'SAVE_FAILED' && !e.message.includes('PRIVATE'),
  );
  assert.deepEqual(f.get().layout, defaultRibbon());
});

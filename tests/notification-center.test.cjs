const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { NotificationHistoryStore } = require('../out/main/main/core/notification-history');
const { NotificationService } = require('../out/main/main/core/notification-service');
const { NotificationCenterController } = require('../out/main/main/core/notification-center');
const { publishUpdateResult } = require('../out/main/main/core/update-result-notification');
const p = require('../out/main/shared/notification-types');
const { createDefaultSettings } = require('../out/main/shared/settings-schema');
function setup(t, { unknown = false, confirm = async () => true } = {}) {
  const dir = fs.mkdtempSync(path.resolve('.artifacts/notification-center-unit-')),
    file = path.join(dir, 'history.json');
  if (unknown) fs.writeFileSync(file, JSON.stringify({ schemaVersion: 99, entries: [] }));
  const history = new NotificationHistoryStore(file, () => {}),
    service = new NotificationService(history);
  const controller = new NotificationCenterController(
    { id: 'center', route: 'notifications', kind: 'notifications' },
    {
      service,
      applets: () => [],
      dark: () => true,
      changed: () => {},
      confirmDeletion: confirm,
    },
  );
  t.after(() => {
    controller.dispose();
    service.dispose();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const input = (extra) => ({
    title: 'private live',
    body: 'live details',
    level: 'info',
    targets: [],
    lifetime: { type: 'manual' },
    dismissible: true,
    history: 'persistent',
    historyText: { title: 'Safe history', body: 'Safe summary' },
    ...extra,
  });
  const publish = (extra) => service.upsert('host.fixture', input(extra));
  const act = (action) => controller.act({ id: 'center', type: 'notifications', action });
  const model = () => controller.snapshot().content;
  const historyTab = () =>
    act({ type: 'filters', filters: { ...model().filters, tab: 'history' } });
  return { dir, file, history, service, controller, input, publish, act, model, historyTab };
}
test('center-only policy is accepted; obsolete unsaved warning is absent', () => {
  const s = createDefaultSettings(),
    kind = {
      ...p.notificationCatalog([])[0],
      ownerKind: 'applet',
      ownerId: 'fixture',
      canDisable: true,
      requiredTargets: [],
    };
  s.notificationPreferences = {
    overrides: [{ ownerKind: 'applet', ownerId: 'fixture', typeId: kind.typeId, targets: [] }],
  };
  assert.equal(p.resolveNotificationPolicy(kind, s).enabled, true);
  assert.deepEqual(p.resolveNotificationPolicy(kind, s).targets, []);
  assert.equal(
    p.notificationCatalog([]).some((t) => t.typeId === 'unsaved-changes'),
    false,
  );
});
test('active/history ID union uses live content and safe ended summaries; none is never retained', async (t) => {
  const f = setup(t);
  const a = f.publish(),
    b = f.publish({ history: 'session' }),
    c = f.publish({ history: 'none' });
  assert.equal(f.model().items.length, 3);
  assert.equal(f.service.targetItems('banner').length, 0);
  f.service.end('host.fixture', a);
  f.service.end('host.fixture', b);
  f.service.end('host.fixture', c);
  await f.historyTab();
  assert.equal(f.model().total, 2);
  assert.equal(f.model().items.find((i) => i.id === a).body, 'Safe summary');
  assert.ok(f.model().items.every((i) => !i.actions.length && !i.dismissible));
});
test('read persists without resolving notifications or changing deadlines; restart loads safe interrupted history', async (t) => {
  const f = setup(t);
  const id = f.publish({ lifetime: { type: 'timed', milliseconds: 60000 } });
  const before = f.model().items[0];
  await f.act({ type: 'read', ids: [id], token: f.model().token });
  const item = f.model().items[0];
  assert.equal(item.read, true);
  assert.equal(item.status, 'active');
  assert.equal(item.expiresAt, before.expiresAt);
  const reloaded = new NotificationHistoryStore(f.file, () => {});
  assert.equal(reloaded.list()[0].read, true);
  assert.equal(reloaded.list()[0].status, 'interrupted');
  reloaded.flush();
});
test('single ended deletion removes both memory and persistent entry; deleted notification never returns or executes', async (t) => {
  const f = setup(t),
    id = f.publish();
  f.service.end('host.fixture', id);
  await f.historyTab();
  await f.act({ type: 'delete', ids: [id], token: f.model().token });
  assert.equal(f.model().total, 0);
  assert.equal(
    f.service.list().some((i) => i.id === id),
    false,
  );
  assert.equal(new NotificationHistoryStore(f.file, () => {}).list().length, 0);
  await assert.rejects(
    f.service.invoke({ notificationId: id, revision: 1, requestId: 'gone', type: 'dismiss' }),
  );
});
test('bulk confirmation captures IDs and preserves arrivals; cancel does not delete', async (t) => {
  let f,
    cancel = false;
  f = setup(t, {
    confirm: async () => {
      const next = f.publish();
      f.service.end('host.fixture', next);
      return !cancel;
    },
  });
  for (let n = 0; n < 3; n++) {
    const id = f.publish();
    f.service.end('host.fixture', id);
  }
  await f.historyTab();
  await f.act({ type: 'delete', scope: 'all', token: f.model().token });
  assert.equal(f.model().total, 1);
  cancel = true;
  await f.act({ type: 'delete', scope: 'filtered', token: f.model().token });
  assert.equal(f.model().total, 2);
});
test('history pages are bounded and stale cursors/read scope cannot act on a changed query', async (t) => {
  const f = setup(t);
  for (let n = 0; n < 65; n++) {
    const id = f.publish({ level: n % 2 ? 'warning' : 'info' });
    f.service.end('host.fixture', id);
  }
  await f.historyTab();
  assert.equal(f.model().items.length, 50);
  const cursor = f.model().nextCursor;
  await f.act({ type: 'page', cursor });
  assert.equal(f.model().items.length, 15);
  const token = f.model().token,
    id = f.publish();
  f.service.end('host.fixture', id);
  await assert.rejects(f.act({ type: 'page', cursor }), /一覧/);
  await assert.rejects(f.act({ type: 'read', scope: 'filtered', token }), /一覧/);
  await f.act({
    type: 'filters',
    filters: { ...f.model().filters, level: 'warning', text: 'Safe', unread: true },
  });
  assert.equal(f.model().total, 32);
  assert.equal(f.model().items.length, 32);
});
test('unknown schema blocks persistent read/delete but session operations stay usable', async (t) => {
  const f = setup(t, { unknown: true }),
    id = f.publish();
  f.service.end('host.fixture', id);
  await f.historyTab();
  await assert.rejects(f.act({ type: 'delete', ids: [id], token: f.model().token }), /未対応/);
  assert.equal(f.model().total, 1);
  assert.equal(JSON.parse(fs.readFileSync(f.file)).schemaVersion, 99);
  const s = f.publish({ history: 'session' });
  f.service.end('host.fixture', s);
  await f.act({ type: 'delete', ids: [s], token: f.model().token });
  assert.equal(f.model().total, 1);
});
test('failed persistent write rolls back read and deletion in memory as well as disk', async (t) => {
  const f = setup(t),
    id = f.publish();
  f.service.end('host.fixture', id);
  f.history.flush();
  await f.historyTab();
  const prior = fs.readFileSync(f.file, 'utf8'),
    rename = fs.renameSync;
  fs.renameSync = (a, b) => {
    if (b === f.file) throw Error('locked fixture');
    return rename(a, b);
  };
  try {
    await assert.rejects(f.act({ type: 'read', ids: [id], token: f.model().token }), /保存/);
    assert.equal(f.model().items[0].read, false);
    await assert.rejects(f.act({ type: 'delete', ids: [id], token: f.model().token }), /保存/);
    assert.equal(f.model().total, 1);
    assert.equal(fs.readFileSync(f.file, 'utf8'), prior);
  } finally {
    fs.renameSync = rename;
  }
});
test('center and banner share one action lock; history has no callbacks', async (t) => {
  const f = setup(t);
  let release,
    ran = 0;
  const id = f.publish({
    targets: ['banner'],
    actions: [
      {
        key: 'act',
        label: 'Act',
        run: () => {
          ran++;
          return new Promise((r) => (release = r));
        },
      },
    ],
  });
  const item = f.model().items[0],
    request = {
      notificationId: id,
      revision: item.revision,
      requestId: 'center',
      type: 'invoke',
      actionId: item.actions[0].id,
    };
  const pending = f.act({ type: 'act', request });
  await assert.rejects(f.service.invoke({ ...request, requestId: 'banner' }));
  assert.equal(ran, 1);
  release();
  await pending;
  f.service.end('host.fixture', id);
  await f.historyTab();
  await assert.rejects(f.act({ type: 'act', request: { ...request, requestId: 'ended' } }));
});
test('update result produces a configurable banner once; receipt survives history deletion and suppressed result does not replay', (t) => {
  const f = setup(t);
  const receiptFile = path.join(f.dir, 'receipt.json');
  let calls = 0;
  const bytes = JSON.stringify({ ok: true, time: 'event1' }),
    opts = {
      typed: {
        publish: (owner, type, input) => {
          calls++;
          assert.equal(type, 'applied');
          assert.equal(input.level, 'info');
          assert.ok(input.actions[0].run);
          return { status: 'suppressed', reason: 'type-disabled' };
        },
      },
      receiptFile,
      openDetails: async () => {},
      warn: () => {},
    };
  assert.equal(publishUpdateResult(bytes, opts), true);
  assert.equal(calls, 1);
  assert.equal(publishUpdateResult(bytes, opts), true);
  assert.equal(calls, 1);
  publishUpdateResult(JSON.stringify({ ok: true, time: 'event2' }), opts);
  assert.equal(calls, 2);
  assert.equal(publishUpdateResult(JSON.stringify({ ok: false }), opts), false);
  assert.equal(calls, 2);
  fs.writeFileSync(receiptFile, JSON.stringify({ schemaVersion: 9 }));
  publishUpdateResult(bytes, opts);
  assert.equal(JSON.parse(fs.readFileSync(receiptFile)).schemaVersion, 9);
});

test('explicit ID read tolerates unrelated content revisions while filtered bulk still requires its snapshot', async (t) => {
  const f = setup(t),
    a = f.publish(),
    b = f.publish(),
    token = f.model().token;
  f.service.upsert('host.fixture', f.input({ body: 'changed' }), b);
  await f.act({ type: 'read', ids: [a], token });
  assert.equal(f.model().items.find((i) => i.id === a).read, true);
  await assert.rejects(f.act({ type: 'read', scope: 'filtered', token }), /一覧/);
});

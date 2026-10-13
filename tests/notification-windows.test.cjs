const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { NotificationService } = require('../out/main/main/core/notification-service');
const { NotificationHistoryStore } = require('../out/main/main/core/notification-history');
const {
  NotificationWindowsAdapter,
} = require('../out/main/main/core/notification-windows-adapter');
function fixture(t) {
  const dir = fs.mkdtempSync(path.resolve('.artifacts/windows-unit-'));
  let clock = 100000,
    ready = true,
    opened = 0,
    failures = 0;
  const h = new NotificationHistoryStore(
      path.join(dir, 'history.json'),
      () => {},
      () => clock,
    ),
    s = new NotificationService(h, () => clock),
    sent = [];
  const a = new NotificationWindowsAdapter(s, {
    ready: () => ready,
    openCenter: async () => {
      opened++;
    },
    failed: () => failures++,
    deliver: (input) => {
      const slot = { input, closed: 0, released: 0 };
      sent.push(slot);
      return { close: () => slot.closed++, release: () => slot.released++ };
    },
  });
  t.after(() => {
    a.dispose();
    s.dispose();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const input = (extra) => ({
    title: 'Title',
    body: 'Detail',
    level: 'info',
    targets: ['windows', 'banner'],
    lifetime: { type: 'manual' },
    dismissible: true,
    history: 'persistent',
    historyText: { title: 'Safe', body: 'Summary' },
    ...extra,
  });
  return {
    s,
    a,
    sent,
    input,
    ready: (v) => (ready = v),
    open: () => opened,
    failures: () => failures,
    tick: (ms) => {
      clock += ms;
      s.expire();
      a.refresh();
    },
  };
}
test('Windows per-ID delivery and OS close do not resolve, read or repost the active business notification', async (t) => {
  const f = fixture(t),
    id = f.s.upsert('host.test', f.input());
  const b = f.s.upsert('host.other', f.input());
  f.a.refresh();
  assert.equal(f.sent.length, 2);
  assert.equal(f.s.list()[0].delivery.windows, 'accepted');
  f.sent[0].input.closed();
  assert.equal(f.s.list()[0].delivery.windows, 'hidden');
  assert.equal(f.s.list()[1].delivery.windows, 'accepted');
  assert.equal(f.s.list()[0].status, 'active');
  assert.equal(f.s.list()[0].read, false);
  f.a.refresh();
  assert.equal(f.sent.length, 2);
  await f.sent[1].input.clicked();
  await new Promise((r) => setImmediate(r));
  assert.equal(f.open(), 1);
  f.sent[1].input.clicked();
  await new Promise((r) => setImmediate(r));
  assert.equal(f.open(), 1);
  f.s.end('host.other', b);
  f.a.refresh();
  assert.equal(f.sent[1].closed, 1);
});
test('only content changes replace; stale callbacks are ignored, failures stay failed and routes retract independently', (t) => {
  const f = fixture(t),
    id = f.s.upsert('host.test', f.input({ dedupeKey: 'same' }));
  f.a.refresh();
  f.s.upsert('host.test', f.input({ dedupeKey: 'same', body: 'Updated' }));
  f.a.refresh();
  assert.equal(f.sent[0].closed, 1);
  assert.equal(f.sent.length, 2);
  f.sent[0].input.failed();
  assert.equal(f.s.list()[0].delivery.windows, 'accepted');
  f.sent[1].input.failed();
  assert.equal(f.s.list()[0].delivery.windows, 'failed');
  f.a.refresh();
  assert.equal(f.sent.length, 2);
  f.s.upsert('host.test', f.input({ dedupeKey: 'same', body: 'Updated', targets: ['banner'] }));
  f.a.refresh();
  assert.equal(f.sent[1].closed, 1);
  assert.equal(f.s.list()[0].id, id);
  assert.equal(f.s.list()[0].status, 'active');
});
test('startup gate, hidden timed expiry, safe direct action once, and shutdown callback invalidation', async (t) => {
  const f = fixture(t);
  f.ready(false);
  f.s.upsert('host.timer', f.input({ lifetime: { type: 'timed', milliseconds: 100 } }));
  f.a.refresh();
  assert.equal(f.sent.length, 0);
  f.tick(200);
  f.ready(true);
  f.a.refresh();
  assert.equal(f.sent.length, 0);
  let actions = 0;
  f.s.upsert(
    'host.legacy',
    f.input({
      windowsSilent: true,
      windowsClickAction: 'go',
      actions: [
        {
          key: 'go',
          label: 'Open',
          run: async () => {
            actions++;
          },
        },
      ],
    }),
  );
  f.a.refresh();
  assert.equal(f.sent[0].input.silent, true);
  assert.equal(f.sent[0].input.title, 'Title');
  f.sent[0].input.clicked();
  f.sent[0].input.clicked();
  await new Promise((r) => setImmediate(r));
  assert.equal(actions, 1);
  assert.equal(f.open(), 0);
  f.a.dispose();
  assert.equal(f.sent[0].released, 1);
  assert.equal(f.sent[0].closed, 0);
  f.sent[0].input.clicked();
  await new Promise((r) => setImmediate(r));
  assert.equal(actions, 1);
});

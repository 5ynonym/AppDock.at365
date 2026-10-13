const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path');
const { NotificationService } = require('../out/main/main/core/notification-service');
const { NotificationHistoryStore } = require('../out/main/main/core/notification-history');
const {
  SettingsNotificationSource,
} = require('../out/main/main/core/settings-notification-source');
function fixture(t) {
  const base = path.resolve(__dirname, '../.artifacts');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'notification-unit-'));
  let clock = 1000000;
  const problems = [];
  const store = new NotificationHistoryStore(
    path.join(dir, 'history.json'),
    (m) => problems.push(m),
    () => clock,
  );
  const service = new NotificationService(store, () => clock);
  t.after(() => {
    service.dispose();
    assert.ok(dir.startsWith(base + path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return {
    service,
    store,
    dir,
    problems,
    tick: (ms) => {
      clock += ms;
      service.expire();
    },
  };
}
const input = (extra) => ({
  level: 'info',
  title: 'Example',
  body: 'Message',
  lifetime: { type: 'manual' },
  targets: ['banner'],
  dismissible: true,
  history: 'persistent',
  historyText: { title: 'Safe summary', body: 'Safe body' },
  ...extra,
});
const request = (s, id, extra = {}) => {
  const i = s.list().find((i) => i.id === id);
  return {
    notificationId: id,
    revision: i.revision,
    requestId: crypto.randomUUID(),
    type: 'invoke',
    actionId: i.actions[0]?.id,
    ...extra,
  };
};
test('levels, lifecycle, source identity and independent banner visibility', (t) => {
  const { service: s } = fixture(t);
  const a = s.upsert(
    'host.alpha',
    input({ level: 'warning', dedupeKey: 'same', bannerVisible: false }),
  );
  const b = s.upsert('host.beta', input({ level: 'error', dedupeKey: 'same' }));
  assert.equal(s.targetItems('banner').length, 1);
  assert.equal(s.list().length, 2);
  assert.notEqual(a, b);
  assert.equal(s.upsert('host.alpha', input({ dedupeKey: 'same', bannerVisible: true })), a);
  assert.deepEqual(
    s.targetItems('banner').map((i) => i.id),
    [a, b],
  );
  assert.throws(() => s.end('host.beta', a), /owner/);
  s.end('host.alpha', a);
  assert.notEqual(s.upsert('host.alpha', input({ dedupeKey: 'same' })), a);
  assert.equal(s.historyEntries().length, 3);
});
test('timed deadline survives updates and sleep-like jumps; condition cannot be dismissed', async (t) => {
  const { service: s, tick } = fixture(t);
  const id = s.upsert(
    'host.alpha',
    input({ dedupeKey: 'timed', lifetime: { type: 'timed', milliseconds: 100 } }),
  );
  tick(60);
  s.upsert(
    'host.alpha',
    input({ dedupeKey: 'timed', lifetime: { type: 'timed', milliseconds: 100 } }),
  );
  tick(1000);
  assert.equal(s.list().find((i) => i.id === id).status, 'expired');
  const condition = s.upsert(
    'host.alpha',
    input({ lifetime: { type: 'condition' }, dismissible: false }),
  );
  await assert.rejects(s.invoke(request(s, condition, { type: 'dismiss' })), /閉じられません/);
  s.end('host.alpha', condition);
  await assert.rejects(
    s.invoke({ notificationId: condition, revision: 1, requestId: 'stale', type: 'dismiss' }),
    /更新/,
  );
});
test('operation idempotency across interfaces, busy exclusion and rejection of reused IDs', async (t) => {
  const { service: s } = fixture(t);
  let finish,
    count = 0;
  const id = s.upsert(
    'host.alpha',
    input({
      actions: [
        {
          key: 'run',
          label: 'Run',
          run: () => {
            count++;
            return new Promise((r) => (finish = r));
          },
        },
      ],
    }),
  );
  const r = request(s, id);
  const first = s.invoke(r);
  assert.equal(first, s.invoke(r));
  await assert.rejects(s.invoke(request(s, id)), /処理中/);
  await assert.rejects(s.invoke({ ...r, actionId: 'other' }), /reused/);
  finish();
  await first;
  assert.equal(count, 1);
  assert.equal(s.list()[0].busy, false);
  await assert.rejects(s.invoke({ ...r, requestId: 'old-revision' }), /更新/);
});
test('expiry and withdrawal during an action never resurrect a notification', async (t) => {
  const { service: s, tick } = fixture(t);
  let finish;
  const id = s.upsert(
    'host.alpha',
    input({
      lifetime: { type: 'timed', milliseconds: 50 },
      actions: [{ key: 'run', label: 'Run', run: () => new Promise((r) => (finish = r)) }],
    }),
  );
  const work = s.invoke(request(s, id));
  tick(1000);
  finish();
  await work;
  assert.equal(s.list()[0].status, 'expired');
  assert.deepEqual(s.list()[0].actions, []);
  const next = s.upsert('applet:alpha:generation1', input());
  s.withdrawSource('applet:alpha:generation1');
  assert.equal(s.list().find((i) => i.id === next).status, 'withdrawn');
});
test('failure unlocks an action and permits an explicit retry', async (t) => {
  const { service: s } = fixture(t);
  let count = 0;
  const id = s.upsert(
    'host.alpha',
    input({
      actions: [
        {
          key: 'retry',
          label: 'Retry',
          run: async () => {
            if (++count === 1) throw Error('failure');
          },
        },
      ],
    }),
  );
  await assert.rejects(s.invoke(request(s, id)), /failure/);
  assert.equal(s.list()[0].busy, false);
  await s.invoke(request(s, id));
  assert.equal(count, 2);
  assert.equal(s.list()[0].status, 'active');
});
test('persistent history has safe text and no operations, restart interrupts active records', (t) => {
  const { service: s, store, dir } = fixture(t);
  s.upsert(
    'host.alpha',
    input({
      title: 'secret value',
      body: 'credential material',
      actions: [{ key: 'unsafe', label: 'Run', run: async () => {} }],
    }),
  );
  store.flush();
  const bytes = fs.readFileSync(store.file, 'utf8');
  assert.ok(!bytes.includes('secret value') && !bytes.includes('credential material'));
  assert.ok(!bytes.includes('actions') && !bytes.includes('unsafe'));
  const restored = new NotificationHistoryStore(path.join(dir, 'history.json'), () => {});
  assert.equal(restored.list()[0].status, 'interrupted');
  assert.equal(restored.list()[0].actions, undefined);
  restored.flush();
});
test('session/none policies, unsupported interfaces and history omission are explicit', (t) => {
  const { service: s, store } = fixture(t);
  s.upsert('host.alpha', input({ targets: [], history: 'session' }));
  const id = s.upsert('host.alpha', input({ history: 'none' }));
  assert.equal(s.targetItems('banner').length, 1);
  s.end('host.alpha', id);
  assert.equal(s.list().length, 1);
  assert.equal(store.list().length, 0);
  assert.equal(s.historyEntries().length, 1);
  assert.throws(() => s.upsert('host.alpha', input({ targets: ['unknown'] })), /Invalid/);
  assert.throws(() => s.upsert('host.alpha', input({ historyText: undefined })), /Invalid/);
});
test('history handles malformed, newer schemas and write errors without losing runtime notifications', (t) => {
  const { service: s, dir } = fixture(t);
  const newer = path.join(dir, 'newer.json');
  fs.writeFileSync(newer, '{"schemaVersion":99}');
  const messages = [];
  const store = new NotificationHistoryStore(newer, (m) => messages.push(m));
  store.flush();
  assert.equal(fs.readFileSync(newer, 'utf8'), '{"schemaVersion":99}');
  const bad = path.join(dir, 'broken.json');
  fs.writeFileSync(bad, '{broken');
  const broken = new NotificationHistoryStore(bad, (m) => messages.push(m));
  assert.ok(fs.readdirSync(dir).some((n) => n.startsWith('broken.json.corrupt-')));
  broken.flush();
  const parent = path.join(dir, 'file-parent');
  fs.writeFileSync(parent, 'not a folder');
  const unavailable = new NotificationHistoryStore(path.join(parent, 'history.json'), (m) =>
    messages.push(m),
  );
  const runtime = new NotificationService(unavailable);
  runtime.upsert('host.alpha', input());
  unavailable.flush();
  assert.equal(runtime.targetItems('banner').length, 1);
  runtime.dispose();
  assert.ok(messages.length >= 3);
  s.upsert('host.alpha', input());
  assert.equal(s.targetItems('banner').length, 1);
});
test('history retains active records while pruning old and excessive terminal records', (t) => {
  const { store } = fixture(t);
  const base = {
    revision: 1,
    source: 'host.alpha',
    level: 'info',
    title: 'summary',
    body: 'body',
    createdAt: 999999,
    updatedAt: 999999,
    read: false,
    targets: ['banner'],
    delivery: { banner: 'ended' },
  };
  store.put({ ...base, id: 'active', status: 'active' });
  for (let i = 0; i < 1100; i++)
    store.put({ ...base, id: 'ended-' + i, status: 'resolved', endedAt: 999999 });
  assert.equal(store.list().length, 1001);
  assert.ok(store.list().some((i) => i.id === 'active'));
  store.put({ ...base, id: 'too-old', status: 'resolved', endedAt: -30 * 86400000 });
  assert.ok(!store.list().some((i) => i.id === 'too-old'));
});
test('capacity reserves host slots and permits updates at the owner limit', (t) => {
  const { service: s } = fixture(t);
  for (let i = 0; i < 50; i++)
    s.upsert('applet.alpha', input({ dedupeKey: String(i), history: 'none' }));
  assert.throws(() => s.upsert('applet.alpha', input({ history: 'none' })), /capacity/);
  s.upsert('applet.alpha', input({ dedupeKey: '0', body: 'updated', history: 'none' }));
  assert.equal(s.list().length, 50);
  assert.ok(
    s.upsert('host.settings', input({ lifetime: { type: 'condition' }, dismissible: false })),
  );
});
test('settings adapter has one episode, shared actions and is removable without affecting other sources', async (t) => {
  const { service: s } = fixture(t);
  const state = {
    sessionId: 'edit',
    editRevision: 0,
    dirty: true,
    parseError: '',
    saveError: '',
    pending: false,
    avatarLoading: false,
  };
  let route = 'home',
    flushes = 0,
    operations = 0,
    fail = true;
  const source = new SettingsNotificationSource(s, {
    editor: {
      snapshot: () => ({ ...state }),
      act: async (r) => {
        operations++;
        assert.equal(r.editRevision, state.editRevision);
        if (fail) {
          state.saveError = 'sensitive path';
          throw Error('failure');
        }
        state.dirty = false;
      },
    },
    route: () => route,
    busy: () => false,
    flush: async () => {
      flushes++;
      state.editRevision++;
    },
    edit: async () => {
      route = 'settings';
    },
  });
  source.refresh();
  const id = s.list()[0].id;
  source.refresh();
  assert.equal(s.list().length, 1);
  await s.invoke(
    request(s, id, { actionId: s.list()[0].actions.find((a) => a.label === 'すべて保存').id }),
  );
  assert.equal(s.list()[0].level, 'error');
  assert.equal(s.list()[0].id, id);
  assert.equal(s.historyEntries()[0].body.includes('sensitive'), false);
  fail = false;
  await s.invoke(
    request(s, id, { actionId: s.list()[0].actions.find((a) => a.label === 'すべて保存').id }),
  );
  assert.equal(s.list()[0].status, 'resolved');
  assert.equal(flushes, 2);
  assert.equal(operations, 2);
  s.upsert('host.other', input());
  s.withdrawSource('host.settings');
  assert.equal(s.targetItems('banner').length, 1);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path');
const p = require('../out/main/shared/notification-types');
const { createDefaultSettings, parseSettings } = require('../out/main/shared/settings-schema');
const { TypedNotifications } = require('../out/main/main/core/typed-notifications');
const { NotificationService } = require('../out/main/main/core/notification-service');
const { NotificationHistoryStore } = require('../out/main/main/core/notification-history');
const definition = (extra) => ({
  typeId: 'message',
  title: 'Message',
  description: 'A test notification',
  levels: ['info', 'warning'],
  defaultLevel: 'info',
  defaultEnabled: true,
  canDisable: true,
  disabledControlReason: '',
  allowedTargets: ['banner', 'desktop', 'windows'],
  defaultTargets: ['banner'],
  requiredTargets: [],
  lifetimePolicy: 'userDuration',
  defaultDurationSeconds: 5,
  history: 'persistent',
  ...extra,
});
const owner = { ownerKind: 'applet', ownerId: 'fixture.notify' };
const row = (extra) => ({ ...owner, typeId: 'message', ...extra });
function setup(t, definitions = [definition()]) {
  const dir = fs.mkdtempSync(path.resolve('.artifacts/notification-policy-unit-'));
  let clock = 100000,
    generation = 'run1';
  let settings = createDefaultSettings();
  const changes = [];
  const applet = {
    id: owner.ownerId,
    displayName: 'Fixture',
    state: 'running',
    notificationTypes: definitions,
  };
  const history = new NotificationHistoryStore(
    path.join(dir, 'history.json'),
    () => {},
    () => clock,
  );
  const service = new NotificationService(history, () => clock);
  const typed = new TypedNotifications(service, {
    settings: () => settings,
    applets: () => [applet],
    generation: () => generation,
    changed: () => {},
    policyChanged: (id) => changes.push(id),
    now: () => clock,
  });
  t.after(() => {
    typed.dispose();
    service.dispose();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return {
    typed,
    service,
    history,
    changes,
    applet,
    dir,
    settings: () => settings,
    prefs: (r) => {
      settings = { ...settings, notificationPreferences: { overrides: r } };
      typed.reconcile();
    },
    global: (v) => {
      settings.host.notifications = v;
      typed.reconcile();
    },
    stop: () => {
      generation = undefined;
      applet.state = 'stopped';
      typed.reconcile();
    },
    restart: () => {
      generation = 'run2';
      applet.state = 'running';
      typed.reconcile();
    },
    tick: (ms) => {
      clock += ms;
      service.expire();
    },
    advanceWithoutTimer: (ms) => {
      clock += ms;
    },
  };
}
const content = (extra) => ({
  title: 'Message',
  body: 'private detail',
  level: 'info',
  historyText: { title: 'Safe summary', body: 'Safe' },
  dedupeKey: 'episode',
  ...extra,
});
test('declarations reject identity duplication, Applet mandatory claims, invalid defaults and fields', () => {
  assert.equal(p.parseNotificationTypes([definition()]).length, 1);
  for (const value of [
    [definition(), definition()],
    [
      definition({
        canDisable: false,
        requiredTargets: ['banner'],
        disabledControlReason: 'Mandatory',
      }),
    ],
    [definition({ defaultTargets: ['desktop'], allowedTargets: ['banner'] })],
    [definition({ levels: ['info', 'info'] })],
    [definition({ defaultDurationSeconds: 0 })],
    [definition({ lifetimePolicy: 'condition', defaultDurationSeconds: 5 })],
    [definition({ script: 'untrusted' })],
  ])
    assert.throws(() => p.parseNotificationTypes(value));
  assert.equal(
    p.parseNotificationTypes(
      [
        p.settingsNotificationType && {
          ...definition(),
          canDisable: false,
          requiredTargets: ['banner'],
          disabledControlReason: 'Required',
        },
      ],
      true,
    ).length,
    1,
  );
});
test('preferences distinguish inheritance and explicit null; reject invalid and duplicate values', () => {
  const settings = createDefaultSettings(),
    type = p
      .notificationCatalog([
        {
          id: owner.ownerId,
          displayName: 'Fixture',
          state: 'stopped',
          notificationTypes: [definition()],
        },
      ])
      .find((t) => t.ownerKind === 'applet' && t.ownerId === owner.ownerId);
  assert.equal(p.resolveNotificationPolicy(type, settings).lifetime.milliseconds, 5000);
  settings.notificationPreferences = p.parseNotificationPreferences({
    overrides: [row({ durationSeconds: null })],
  });
  assert.deepEqual(p.resolveNotificationPolicy(type, settings).lifetime, { type: 'manual' });
  for (const durationSeconds of [0, -1, 1.5, 86401, '5', NaN])
    assert.throws(() => p.parseNotificationPreferences({ overrides: [row({ durationSeconds })] }));
  assert.throws(() => p.parseNotificationPreferences({ overrides: [row({}), row({})] }));
  assert.throws(() => p.parseNotificationPreferences({ overrides: [row({ targets: ['other'] })] }));
  assert.throws(() => p.parseNotificationPreferences({ overrides: [row({ callback: 'no' })] }));
  assert.deepEqual(
    parseSettings({
      ...createDefaultSettings(),
      notificationPreferences: { overrides: [{ ...row({}), ownerId: 'absent.applet' }] },
    }).notificationPreferences.overrides[0].ownerId,
    'absent.applet',
  );
});
test('mandatory condition is enforced for UI saves and externally received overrides', () => {
  const settings = createDefaultSettings(),
    next = structuredClone(settings),
    type = p.settingsNotificationType;
  next.notificationPreferences = {
    overrides: [
      {
        ownerKind: 'host',
        ownerId: 'settings',
        typeId: type.typeId,
        enabled: false,
        targets: [],
        durationSeconds: 1,
      },
    ],
  };
  assert.throws(() => p.validateNotificationPreferenceChanges(next, settings, [type]));
  const resolved = p.resolveNotificationPolicy(type, next);
  assert.equal(resolved.enabled, true);
  assert.deepEqual(resolved.targets, ['banner']);
  assert.deepEqual(resolved.lifetime, { type: 'condition' });
  assert.equal(resolved.dismissible, false);
});
test('valid future targets are retained but never silently routed to banner', () => {
  const settings = createDefaultSettings(),
    type = { ...definition(), ...owner, ownerTitle: 'Fixture', ownerState: 'running' };
  settings.notificationPreferences = { overrides: [row({ targets: ['desktop', 'windows'] })] };
  assert.deepEqual(p.resolveNotificationPolicy(type, settings).selectedTargets, [
    'desktop',
    'windows',
  ]);
  assert.equal(p.resolveNotificationPolicy(type, settings).reason, 'no-available-targets');
});
test('typed dedupe isolates kinds but shares the owner quota', (t) => {
  const f = setup(t, [definition(), definition({ typeId: 'other' })]);
  const a = f.typed.publish(owner, 'message', content(), 'run1');
  const b = f.typed.publish(owner, 'other', content(), 'run1');
  assert.notEqual(a.notificationId, b.notificationId);
  for (let i = 0; i < 48; i++) {
    f.tick(100);
    f.typed.publish(owner, i % 2 ? 'message' : 'other', content({ dedupeKey: 'key' + i }), 'run1');
  }
  f.tick(100);
  assert.throws(
    () => f.typed.publish(owner, 'other', content({ dedupeKey: 'overflow' }), 'run1'),
    /capacity/,
  );
  assert.equal(
    f.typed.publish(owner, 'message', content({ body: 'updated' }), 'run1').notificationId,
    a.notificationId,
  );
});
test('turning off withdraws active and suppresses new events without content history; on does not replay', (t) => {
  const f = setup(t);
  const a = f.typed.publish(owner, 'message', content(), 'run1');
  f.prefs([row({ enabled: false })]);
  assert.equal(f.service.list()[0].status, 'withdrawn');
  assert.equal(f.service.list()[0].endReason, 'type-disabled');
  const count = f.history.list().length;
  assert.equal(
    f.typed.publish(owner, 'message', content({ title: 'Suppressed private' }), 'run1').status,
    'suppressed',
  );
  assert.equal(f.history.list().length, count);
  f.prefs([]);
  assert.equal(f.service.list().filter((i) => i.status === 'active').length, 0);
  assert.notEqual(
    f.typed.publish(owner, 'message', content(), 'run1').notificationId,
    a.notificationId,
  );
});
test('duration change affects new episodes, ordinary updates preserve deadline, explicit restart uses new policy', (t) => {
  const f = setup(t);
  const a = f.typed.publish(owner, 'message', content(), 'run1');
  const due = f.service.list()[0].expiresAt;
  f.prefs([row({ durationSeconds: null })]);
  f.tick(500);
  f.typed.publish(owner, 'message', content({ body: 'ordinary update' }), 'run1');
  assert.equal(f.service.list()[0].expiresAt, due);
  f.typed.publish(owner, 'message', content({ restartTimer: true }), 'run1');
  assert.equal(f.service.list()[0].expiresAt, undefined);
  f.typed.end(owner, a.notificationId, 'run1');
  const b = f.typed.publish(owner, 'message', content(), 'run1');
  assert.equal(f.service.list().find((i) => i.id === b.notificationId).dismissible, true);
});
test('delayed expiry cannot reuse an ended episode duration or fail route reconciliation', (t) => {
  const f = setup(t);
  const a = f.typed.publish(owner, 'message', content(), 'run1');
  f.advanceWithoutTimer(6000);
  f.prefs([row({ durationSeconds: null, targets: ['banner', 'desktop'] })]);
  const b = f.typed.publish(owner, 'message', content(), 'run1');
  assert.notEqual(b.notificationId, a.notificationId);
  assert.equal(f.service.list().find((i) => i.id === a.notificationId).status, 'expired');
  assert.equal(f.service.list().find((i) => i.id === b.notificationId).expiresAt, undefined);
});

test('route changes preserve active ID and deadline; losing all available targets withdraws', (t) => {
  const f = setup(t);
  const a = f.typed.publish(owner, 'message', content(), 'run1');
  const due = f.service.list()[0].expiresAt;
  f.prefs([row({ targets: ['banner', 'desktop'] })]);
  assert.equal(f.service.list()[0].expiresAt, due);
  assert.equal(f.service.list()[0].id, a.notificationId);
  f.prefs([row({ targets: ['desktop'] })]);
  assert.equal(f.service.list()[0].status, 'withdrawn');
});
test('Applet global gate does not disable host warning, stopped generation cannot resolve or replay actions', async (t) => {
  const f = setup(t);
  let sideEffects = 0;
  f.prefs([row({ durationSeconds: null })]);
  const a = f.typed.publish(
    owner,
    'message',
    content({
      actions: [
        {
          key: 'act',
          label: 'Act',
          run: async () => {
            sideEffects++;
          },
        },
      ],
    }),
    'run1',
  );
  const item = f.service.list().find((i) => i.id === a.notificationId);
  f.global(false);
  assert.equal(f.service.list().find((i) => i.id === item.id).status, 'withdrawn');
  assert.equal(
    f.typed.policy({ ownerKind: 'host', ownerId: 'settings' }, 'unsaved-changes').enabled,
    true,
  );
  await assert.rejects(
    f.service.invoke({
      notificationId: item.id,
      revision: item.revision,
      type: 'invoke',
      actionId: item.actions[0].id,
      requestId: 'old',
    }),
  );
  assert.equal(sideEffects, 0);
  f.global(true);
  const b = f.typed.publish(owner, 'message', content(), 'run1');
  f.stop();
  f.restart();
  assert.throws(() => f.typed.end(owner, b.notificationId, 'run1'));
  assert.throws(() => f.typed.publish(owner, 'message', content(), 'run1'));
  assert.notEqual(
    f.typed.publish(owner, 'message', content(), 'run2').notificationId,
    b.notificationId,
  );
});
test('rate limit is separate from suppression and does not prevent withdrawal', (t) => {
  const f = setup(t);
  f.prefs([row({ durationSeconds: null })]);
  let a;
  for (let i = 0; i < 20; i++) a = f.typed.publish(owner, 'message', content(), 'run1');
  assert.throws(() => f.typed.publish(owner, 'message', content(), 'run1'), /頻度/);
  f.typed.end(owner, a.notificationId, 'run1');
});
test('safe persisted kind identity survives restart without callbacks or private body', (t) => {
  const f = setup(t);
  f.typed.publish(owner, 'message', content(), 'run1');
  f.history.flush();
  const bytes = fs.readFileSync(path.join(f.dir, 'history.json'), 'utf8');
  assert.equal(bytes.includes('private detail'), false);
  const read = new NotificationHistoryStore(path.join(f.dir, 'history.json'), () => {});
  assert.equal(read.list()[0].typeId, 'message');
  assert.equal(read.list()[0].ownerId, owner.ownerId);
  assert.equal(read.list()[0].status, 'interrupted');
  read.flush();
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NotificationSession } = require('../out/main/main/core/notification-session');
const { NotificationSounds } = require('../out/main/main/core/notification-sounds');
const turn = () => new Promise((r) => setImmediate(r));

test('ARSO startup snapshot pauses before first notification; unlock, lock and resume follow session', () => {
  const events = new Map(),
    states = [];
  let state = 'locked';
  const session = new NotificationSession({
    state: () => state,
    on: (event, callback) => {
      events.set(event, callback);
      return () => events.delete(event);
    },
    changed: (paused) => states.push(paused),
  });
  assert.deepEqual(states, [true]);
  events.get('unlock-screen')();
  events.get('lock-screen')();
  events.get('suspend')();
  state = 'idle';
  events.get('resume')();
  assert.deepEqual(states, [true, false, true, true, false]);
  session.dispose();
  assert.equal(events.size, 0);
});

test('unknown or failed initial snapshot fails closed', () => {
  for (const state of [
    () => 'unknown',
    () => {
      throw Error('unavailable');
    },
  ]) {
    const states = [];
    const session = new NotificationSession({
      state,
      on: () => () => {},
      changed: (p) => states.push(p),
    });
    assert.deepEqual(states, [true]);
    session.dispose();
  }
});

test('notification sounds wait without reading files; unlock plays in order and drops stopped owners', async () => {
  const events = [];
  let alive = true;
  const sounds = new NotificationSounds({
    read: async (file) => {
      events.push('read:' + file);
      return Buffer.from(file);
    },
    play: async (bytes, signal, before) => {
      before();
      if (!signal.aborted) events.push('play:' + bytes);
    },
  });
  sounds.setPaused(true);
  sounds.enqueue(
    'a',
    () => true,
    () => assert.fail('sound failed'),
  );
  sounds.enqueue(
    'stopped',
    () => alive,
    () => assert.fail('sound failed'),
  );
  sounds.enqueue(
    'b',
    () => true,
    () => assert.fail('sound failed'),
  );
  await turn();
  assert.deepEqual(events, []);
  alive = false;
  sounds.setPaused(false);
  await turn();
  assert.deepEqual(events, ['read:a', 'play:a', 'read:b', 'play:b']);
  sounds.dispose();
});

test('lock during file read retains an unstarted sound and resumes it once', async () => {
  const plays = [];
  let release;
  const sounds = new NotificationSounds({
    read: () =>
      new Promise((r) => {
        release = () => r(Buffer.from('a'));
      }),
    play: async (bytes, signal, before) => {
      before();
      if (!signal.aborted) plays.push(bytes.toString());
    },
  });
  sounds.enqueue(
    'a',
    () => true,
    () => assert.fail('sound failed'),
  );
  sounds.setPaused(true);
  release();
  await turn();
  assert.deepEqual(plays, []);
  sounds.setPaused(false);
  release();
  await turn();
  assert.deepEqual(plays, ['a']);
  sounds.dispose();
});

test('deferred sounds remain bounded and dispose drops pending work', async () => {
  let plays = 0;
  const sounds = new NotificationSounds({
    read: async () => Buffer.alloc(0),
    play: async () => {
      plays++;
    },
  });
  sounds.setPaused(true);
  for (let i = 0; i < 32; i++)
    sounds.enqueue(
      'a',
      () => true,
      () => {},
    );
  assert.throws(
    () =>
      sounds.enqueue(
        'a',
        () => true,
        () => {},
      ),
    /多すぎ/,
  );
  sounds.dispose();
  sounds.setPaused(false);
  await turn();
  assert.equal(plays, 0);
});

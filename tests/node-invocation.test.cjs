const { test } = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path'),
  { spawn } = require('node:child_process');
const { JsonLinePeer } = require('../out/main/main/core/rpc');
test('Node worker preserves concurrent command identity and only cancels the requested gesture', async (t) => {
  const dir = fs.mkdtempSync(path.resolve('.artifacts/node-invocation-'));
  const file = path.join(dir, 'index.cjs');
  fs.writeFileSync(
    file,
    `exports.activate=async c=>{c.commands.register('test.send','Send',async invocation=>{await new Promise(r=>setTimeout(r,100));if(invocation.signal.aborted)return 'cancelled';return c.appdock.call('input.sendKeys',{keys:invocation.window});});};`,
  );
  const child = spawn(process.execPath, [path.resolve('out/main/main/node-worker.js'), file], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stderr.resume();
  const calls = [];
  const peer = new JsonLinePeer(child.stdout, child.stdin, async (method, params) => {
    calls.push({ method, params });
    return { ok: true, value: { ok: true } };
  });
  t.after(() => {
    peer.close();
    child.kill();
  });
  await peer.request('activate', { settings: {} });
  const one = peer.request('command.execute', {
    id: 'test.send',
    executionId: 'one',
    invocation: { session: 's1', window: 'A', source: 'gesture' },
  });
  const two = peer.request('command.execute', {
    id: 'test.send',
    executionId: 'two',
    invocation: { session: 's2', window: 'B', source: 'gesture' },
  });
  await peer.request('command.cancel', { session: 's1' });
  assert.equal(await one, 'cancelled');
  assert.deepEqual(await two, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.executionId, 'two');
  assert.equal(calls[0].params.params.keys, 'B');
  await peer.request('command.cancel', { session: 'early' });
  assert.equal(
    await peer.request('command.execute', {
      id: 'test.send',
      executionId: 'three',
      invocation: { session: 'early', window: 'C', source: 'gesture' },
    }),
    'cancelled',
  );
  assert.equal(calls.length, 1);
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ ok: true }));
});

const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { spawnSync } = require('node:child_process'),
  { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..'),
  base = path.join(root, '.artifacts');
const helper = path.join(base, 'updater/AppDock.Updater.exe');
const run = (...args) => {
  const result = spawnSync(helper, ['--pack', ...args], { windowsHide: true });
  return { ...result, stderr: new TextDecoder('shift_jis').decode(result.stderr) };
};
test(
  'pack works below the existing mounted development root; linked payloads and ordinary junction ancestors remain rejected',
  { skip: process.platform !== 'win32' },
  (t) => {
    fs.mkdirSync(base, { recursive: true });
    const dir = fs.mkdtempSync(path.join(base, 'pack-mounted-'));
    t.after(() => {
      assert.equal(path.dirname(dir), base);
      fs.rmSync(dir, { recursive: true, force: true });
    });
    const host = path.join(dir, 'AppDock.at365.exe');
    fs.writeFileSync(host, 'MZ-host-fixture');
    const out = path.join(dir, 'host-feed');
    const result = run('host', host, '1.0.0', out);
    assert.equal(result.status, 0, result.stderr);
    const feed = JSON.parse(fs.readFileSync(path.join(out, 'update.json')));
    assert.equal(
      feed.payload.sha256,
      createHash('sha256').update(fs.readFileSync(host)).digest('hex'),
    );
    const source = path.join(dir, 'payload');
    fs.mkdirSync(source);
    fs.writeFileSync(
      path.join(source, 'extension.json'),
      JSON.stringify({ apiVersion: 1, id: 'fixture', version: '1.0.0', entry: 'index.js' }),
    );
    fs.writeFileSync(path.join(source, 'index.js'), 'module.exports={}');
    assert.equal(run('applet', source, 'unused', path.join(dir, 'applet-feed')).status, 0);
    const alias = path.join(dir, 'alias');
    fs.symlinkSync(source, alias, 'junction');
    assert.notEqual(run('applet', alias, 'unused', path.join(dir, 'bad-feed')).status, 0);
    // A file below a junction is also rejected, not only a linked leaf.
    assert.notEqual(
      run('host', path.join(alias, 'index.js'), '1.0.0', path.join(dir, 'bad-host')).status,
      0,
    );
    const nested = path.join(source, 'linked');
    fs.symlinkSync(out, nested, 'junction');
    const blocked = run('applet', source, 'unused', path.join(dir, 'bad-applet'));
    assert.notEqual(blocked.status, 0);
    assert.match(blocked.stderr, /リンク/);
    fs.unlinkSync(nested);
    const outputAlias = path.join(dir, 'output-alias');
    fs.symlinkSync(out, outputAlias, 'junction');
    assert.notEqual(run('host', host, '1.0.0', outputAlias).status, 0);
  },
);

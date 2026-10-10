const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path');
const { atomicWrite } = require('../out/main/main/core/settings');

function fixture(t, behavior) {
  const root = path.resolve('.artifacts/atomic-write-unit');
  fs.mkdirSync(root, { recursive: true });
  const dir = fs.mkdtempSync(path.join(root, 'case-')),
    file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, 'original');
  const rename = fs.renameSync;
  let calls = 0;
  fs.renameSync = (source, target) => {
    if (target === file) {
      calls++;
      behavior(calls, file);
    }
    return rename(source, target);
  };
  t.after(() => {
    fs.renameSync = rename;
  });
  return {
    file,
    calls: () => calls,
    temporaries: () => fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')),
  };
}
const busy = () => Object.assign(Error('simulated Windows reader'), { code: 'EPERM' });
test(
  'Windows atomic replacement retries transient reader denial without repeating the operation',
  { skip: process.platform !== 'win32' },
  (t) => {
    const f = fixture(t, (count) => {
      if (count === 1) throw busy();
    });
    atomicWrite(f.file, 'next');
    assert.equal(f.calls(), 2);
    assert.equal(fs.readFileSync(f.file, 'utf8'), 'next');
    assert.deepEqual(f.temporaries(), []);
  },
);
test(
  'Windows retry preserves an intervening edit and removes the temporary file',
  { skip: process.platform !== 'win32' },
  (t) => {
    const f = fixture(t, (_, file) => {
      fs.writeFileSync(file, 'external edit');
      throw busy();
    });
    assert.throws(() => atomicWrite(f.file, 'next'), /別の場所/);
    assert.equal(f.calls(), 1);
    assert.equal(fs.readFileSync(f.file, 'utf8'), 'external edit');
    assert.deepEqual(f.temporaries(), []);
  },
);
test(
  'Windows reader denial remains bounded and leaves the original untouched',
  { skip: process.platform !== 'win32' },
  (t) => {
    const f = fixture(t, () => {
      throw busy();
    });
    assert.throws(() => atomicWrite(f.file, 'next'), { code: 'EPERM' });
    assert.equal(f.calls(), 4);
    assert.equal(fs.readFileSync(f.file, 'utf8'), 'original');
    assert.deepEqual(f.temporaries(), []);
  },
);

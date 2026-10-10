const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('local launcher preserves success, policy failure and native crash status without retrying', () => {
  const root = path.resolve(__dirname, '..');
  const folder = fs.mkdtempSync(path.join(root, '.artifacts/dev-launcher-'));
  fs.mkdirSync(path.join(folder, '.tools'));
  fs.copyFileSync(path.join(root, 'dev.bat'), path.join(folder, 'dev.bat'));
  fs.writeFileSync(
    path.join(folder, '.tools/environment.bat'),
    '@echo off\r\nset "APPDOCK_NODE_DIR=%~dp0"\r\nset "APPDOCK_PNPM_DIR=%~dp0"\r\n',
  );
  fs.writeFileSync(path.join(folder, '.tools/node.exe'), 'existence-check-only');
  const checks = [];
  for (const code of [0, 1, -1073741571]) {
    fs.writeFileSync(
      path.join(folder, '.tools/pnpm.cmd'),
      `@echo off\r\necho called\r\nexit /b ${code}\r\n`,
    );
    const result = spawnSync('cmd.exe', ['/d', '/c', 'dev.bat install --frozen-lockfile'], {
      cwd: folder,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.error) throw result.error;
    assert.equal(result.status >>> 0, code >>> 0);
    assert.equal(result.stdout.match(/called/g)?.length, 1);
    assert.equal(result.stderr.includes('execution approval'), code === -1073741571);
    checks.push({ code, status: result.status });
  }
  fs.writeFileSync(path.join(folder, 'result.json'), JSON.stringify({ ok: true, checks }));
});

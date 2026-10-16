const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { getPublishDirectory } = require('./publish-paths.cjs');
const root = path.resolve(__dirname, '..');
const output = getPublishDirectory(root);
const result = spawnSync(process.execPath, [
  path.join(__dirname, 'pack-update.cjs'), 'host',
  path.join(output, 'AppDock.at365.exe'), output,
], { cwd: root, stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const deployment = spawnSync('powershell.exe', [
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
  path.join(__dirname, 'publish-deployment.ps1'),
], { cwd: root, stdio: 'inherit', windowsHide: true });
if (deployment.error) throw deployment.error;
if (deployment.status !== 0) process.exit(deployment.status || 1);

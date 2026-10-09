const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const [kind, source, output] = process.argv.slice(2);
if (!['host', 'applet'].includes(kind) || !source || !output)
  throw Error('Usage: pack-update.cjs host|applet source output');
const result = spawnSync(
  path.join(root, '.artifacts/updater/AppDock.Updater.exe'),
  ['--pack', kind, path.resolve(source), require('../package.json').version, path.resolve(output)],
  { cwd: root, stdio: 'inherit', windowsHide: true },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

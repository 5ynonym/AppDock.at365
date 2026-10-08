const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const result = spawnSync(
  'dotnet',
  [
    'publish',
    'dotnet/AppDock.Updater/AppDock.Updater.csproj',
    '-c',
    'Release',
    '-o',
    'artifacts/updater',
  ],
  { cwd: root, stdio: 'inherit', windowsHide: true },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);

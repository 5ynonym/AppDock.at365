const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function run(args) {
  const result = spawnSync('dotnet', args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run([
  'publish',
  'dotnet/AppDock.ExtensionHost/AppDock.ExtensionHost.csproj',
  '-c',
  'Release',
  '-r',
  'win-x64',
  '--self-contained',
  'true',
  '-o',
  'artifacts/dotnet-host',
]);

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
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
run(['build', 'dotnet/AppDock.Extensions.Demo/AppDock.Extensions.Demo.csproj', '-c', 'Release']);
fs.copyFileSync(
  path.join(root, 'dotnet/AppDock.Extensions.Demo/bin/Release/net10.0/AppDock.Extensions.Demo.dll'),
  path.join(root, 'extensions/dotnet-demo/AppDock.Extensions.Demo.dll'),
);

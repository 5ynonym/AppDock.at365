// Real single-EXE / Windows Shell activation, using synthetic notifications only.
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { notificationProtocol } = require('../out/main/main/core/notification-routing');
const root = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || path.join(root, 'publish/AppDock.at365.exe'));
const profile = path.join(root, '.artifacts', `notification-portable-${Date.now()}`);
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const powershell = (code) => {
  try {
    return execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-EncodedCommand',
        Buffer.from("$ProgressPreference='SilentlyContinue';" + code, 'utf16le').toString('base64'),
      ],
      { windowsHide: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ).trim();
  } catch (error) {
    const detail = String(error.stderr || error.message).replaceAll(
      '#< CLIXML',
      'PowerShell diagnostic',
    );
    fs.writeFileSync(path.join(profile, 'powershell-error.txt'), code + '\n' + detail);
    throw Error(detail);
  }
};
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const copies = ['installed', 'test'].map((name) => {
  const folder = path.join(profile, name),
    exe = path.join(folder, 'AppDock.at365.exe');
  fs.mkdirSync(path.join(folder, 'extensions/notification'), { recursive: true });
  fs.copyFileSync(source, exe);
  const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
  settings.host.hardwareAcceleration = false;
  settings.globalShortcutCommands = [];
  settings.extensions['test.notification'] = { enabled: true, settings: {} };
  fs.writeFileSync(path.join(folder, 'settings.json'), JSON.stringify(settings));
  fs.writeFileSync(
    path.join(folder, 'extensions/notification/extension.json'),
    JSON.stringify({
      id: 'test.notification',
      name: 'Synthetic notification',
      version: '1.0.0',
      apiVersion: 1,
      runtime: 'node',
      entry: 'index.js',
      capabilities: ['notifications', 'storage'],
      commands: [
        { id: 'test.notification.send', title: 'Send' },
        { id: 'test.notification.open', title: 'Open' },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(folder, 'extensions/notification/index.js'),
    `
exports.activate = async context => {
  context.commands.register('test.notification.open', 'Open', async () => {
    const count = (await context.storage.get('clicks')) || 0;
    await context.storage.set('clicks', count + 1);
  });
  context.commands.register('test.notification.send', 'Send', () => context.notifications.show(
    'AppDock synthetic ${name}', 'Gmail-style command notification <&>',
    { silent: true, command: 'test.notification.open' }));
};`,
  );
  return { folder, exe, protocol: notificationProtocol(exe, folder, true) };
});
const hash = sha256(source);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {}
    await wait(100);
  }
  throw Error(label);
}
async function start(copy) {
  const server = net.createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  copy.child = spawn(
    copy.exe,
    [`--test-profile=${copy.folder}`, `--remote-debugging-port=${port}`],
    { cwd: copy.folder, env, windowsHide: true, stdio: 'ignore' },
  );
  copy.browser = await until(
    () => chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 }),
    'portable CDP',
  );
  copy.dock = await until(
    () =>
      copy.browser
        .contexts()
        .flatMap((c) => c.pages())
        .find((p) => p.url().startsWith('appdock://host/')),
    'host renderer',
  );
  await until(
    async () => (await copy.dock.evaluate(() => window.dock.snapshot())).startupReady,
    'startup ready',
  );
  const snapshot = await copy.dock.evaluate(() => window.dock.snapshot());
  assert.equal(snapshot.extensions.find((e) => e.id === 'test.notification')?.state, 'running');
}
async function stop(copy) {
  if (copy.dock && !copy.dock.isClosed())
    await copy.dock.evaluate(() => {
      void window.dock.executeCommand('appdock.quit');
    });
  if (copy.child) await until(() => copy.child.exitCode !== null, 'portable exit');
  await copy.browser?.close();
  copy.browser = undefined;
}
const count = (copy) => {
  const file = path.join(copy.folder, '.appdock/storage/test.notification/clicks.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : 0;
};
function historyUri(copy) {
  return powershell(`$ErrorActionPreference='Stop';
    [Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null;
    foreach($toast in [Windows.UI.Notifications.ToastNotificationManager]::History.GetHistory('at365.appdock')) {
      if(!$toast.Content -or !$toast.Content.DocumentElement) { continue }
      $uri=[string]$toast.Content.DocumentElement.GetAttribute('launch');
      if($uri.StartsWith('${copy.protocol}://notification/')) { $uri; break }
    }`);
}
function activate(copy, uri) {
  assert.ok(uri.startsWith(`${copy.protocol}://notification/`));
  assert.match(uri, /^appdock-notify-[a-f0-9]{32}:\/\/notification\/[a-f0-9-]{36}$/);
  powershell(`Start-Process -FilePath '${uri}' -WindowStyle Hidden`);
}
const programs = powershell('[Environment]::GetFolderPath("Programs")');
const shortcuts = ['AppDock.at365.lnk', 'Electron.lnk'].map((name) => {
  const file = path.join(programs, name);
  return { file, bytes: fs.existsSync(file) ? fs.readFileSync(file) : undefined };
});
const registrySnapshot =
  powershell(`$root=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\\Classes\\CLSID');
  $items=@(); foreach($id in $root.GetSubKeyNames()) { $k=$root.OpenSubKey($id);
    if($k.GetValue('') -eq 'Electron Notification Activator') {
      $s=$k.OpenSubKey('LocalServer32'); if($s){$items+=@{id=$id;target=$s.GetValue('')};$s.Close()}
    }; $k.Close()
  };$root.Close(); ConvertTo-Json -Compress -InputObject $items`);
fs.writeFileSync(path.join(profile, 'registry-before.json'), registrySnapshot);
const checks = [];
(async () => {
  for (const copy of copies) {
    assert.equal(sha256(copy.exe), hash);
    await start(copy);
  }
  for (const copy of copies) {
    await copy.dock.evaluate(() => window.dock.executeCommand('test.notification.send'));
    copy.uri = await until(() => historyUri(copy), 'native toast in Action Center');
    const command = powershell(
      `$k=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\\Classes\\${copy.protocol}\\shell\\open\\command'); $k.GetValue(''); $k.Close()`,
    );
    assert.ok(command.includes(copy.exe));
    assert.ok(command.includes(`--test-profile=${copy.folder}`));
  }
  assert.notEqual(copies[0].protocol, copies[1].protocol);
  checks.push(
    'native synthetic toast XML and protocol registrations target each original single EXE/profile',
  );
  activate(copies[0], copies[0].uri);
  await until(() => count(copies[0]) === 1, 'installed callback');
  assert.equal(count(copies[1]), 0);
  activate(copies[1], copies[1].uri);
  await until(() => count(copies[1]) === 1, 'test callback');
  assert.equal(count(copies[0]), 1);
  activate(copies[0], copies[0].uri);
  await wait(1500);
  assert.equal(count(copies[0]), 1);
  checks.push(
    'Windows Shell activation returns to the matching running copy; command runs once and never in the other copy',
  );
  await copies[0].dock.evaluate(() => window.dock.executeCommand('test.notification.send'));
  const stale = await until(() => {
    const uri = historyUri(copies[0]);
    return uri && uri !== copies[0].uri && uri;
  }, 'fresh native toast');
  await copies[0].dock.evaluate(() => window.dock.toggleExtension('test.notification', false));
  activate(copies[0], stale);
  await wait(1500);
  assert.equal(count(copies[0]), 1);
  checks.push('notification from a stopped Applet cannot execute its old callback');
  for (const copy of copies) await stop(copy);
  // An old notification after shutdown launches the correct portable host. No
  // previous-process callback is replayed. CDP is deliberately not persisted.
  activate(copies[0], copies[0].uri);
  await until(
    () =>
      fs.existsSync(path.join(copies[0].folder, '.appdock/chromium/SingletonLock')) ||
      powershell(
        `@(Get-CimInstance Win32_Process | Where-Object {$_.CommandLine -like '*--test-profile=${copies[0].folder}*' -and $_.Name -eq 'AppDock.at365.exe'}).Count`,
      ) !== '0',
    'cold portable activation',
  );
  checks.push(
    'cold Windows Shell activation starts the original portable launcher with the original profile',
  );
  powershell(
    `Get-CimInstance Win32_Process | Where-Object {$_.Name -eq 'AppDock.at365.exe' -and $_.CommandLine -like '*--test-profile=${copies[0].folder}*'} | ForEach-Object {Stop-Process -Id $_.ProcessId -Force}`,
  );
  for (const copy of copies) assert.equal(sha256(copy.exe), hash);
  const result = {
    ok: true,
    profile,
    sha256: hash,
    checks,
    limitation:
      'Native toast submission/history and Windows Shell URI dispatch verified. Physical toast click and real Gmail receipt not automated.',
  };
  fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const copy of copies) {
      if (copy.browser) await stop(copy).catch(() => {});
      if (copy.child?.exitCode === null) copy.child.kill();
      powershell(`[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null;
      foreach($toast in [Windows.UI.Notifications.ToastNotificationManager]::History.GetHistory('at365.appdock')) {
        if(!$toast.Content -or !$toast.Content.DocumentElement) { continue }
        $uri=[string]$toast.Content.DocumentElement.GetAttribute('launch');
        if($uri.StartsWith('${copy.protocol}://notification/')) {
          [Windows.UI.Notifications.ToastNotificationManager]::History.Remove($toast.Tag,$toast.Group,'at365.appdock')
        }
      }`);
      // Remove only this test's URI key, and only if it still points at this copy.
      powershell(`$root=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\\Classes',$true);
      $key=$root.OpenSubKey('${copy.protocol}\\shell\\open\\command');
      if($key){$target=$key.GetValue('');$key.Close();if($target.Contains('${copy.exe}')){$root.DeleteSubKeyTree('${copy.protocol}')}};$root.Close()`);
    }
    // Electron itself rewrites its shared automatic shortcut/COM registration.
    // Restore the pre-test state after all test processes have exited.
    const before = JSON.parse(registrySnapshot);
    for (const item of before) {
      powershell(`$k=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Software\\Classes\\CLSID\\${item.id}\\LocalServer32',$true);
      if($k){$current=$k.GetValue('');if($current -like '*AppDock.at365*' -and $current -ne '${item.target.replace(/'/g, "''")}'){$k.SetValue('','${item.target.replace(/'/g, "''")}')};$k.Close()}`);
    }
    for (const shortcut of shortcuts) {
      if (shortcut.bytes) fs.writeFileSync(shortcut.file, shortcut.bytes);
    }
  });

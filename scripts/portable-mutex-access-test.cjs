const { getPublishDirectory } = require('./publish-paths.cjs');
// Restrict only this fixture's kernel objects to the rights available across elevation.
// No UAC, production process, or persistent security setting is changed.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { freePort, inspect, electronExpression } = require('./electron-main-helper.cjs');
const root = path.resolve(__dirname, '..');
const profile = path.join(root, '.artifacts', `portable-mutex-${Date.now()}`, '日本語 profile');
fs.mkdirSync(profile, { recursive: true });
const exe = path.join(profile, 'AppDock.at365.exe');
fs.copyFileSync(path.join(getPublishDirectory(root), 'AppDock.at365.exe'), exe);
const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
settings.host.hardwareAcceleration = false;
settings.host.startMinimized = true;
settings.globalShortcutCommands = [];
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const ps = (code) =>
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-EncodedCommand',
      Buffer.from(
        "$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';" + code,
        'utf16le',
      ).toString('base64'),
    ],
    { encoding: 'utf8', windowsHide: true },
  ).trim();
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if (await fn()) return;
    } catch {}
    await delay(100);
  }
  throw Error(label);
}
let primary, secondary, port, runtime;
const checkpoints = [];
const expectDenied = process.argv.includes('--expect-denied');
(async () => {
  try {
    port = await freePort();
    primary = spawn(exe, [`--test-profile=${profile}`, `--inspect=${port}`], {
      env,
      windowsHide: true,
      stdio: 'ignore',
    });
    await until(
      async () =>
        (runtime = await inspect(
          port,
          `(()=>{const e=${electronExpression};const w=e.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('appdock://host')); if(!w||w.webContents.isLoading())return null;globalThis.activationCount=0;e.app.on('second-instance',()=>globalThis.activationCount++);return {pid:process.pid,exe:process.execPath};})()`,
        )),
      'primary host ready',
    );
    const identity = path.basename(path.dirname(runtime.exe)).replace('AppDock.at365-', '');
    assert.match(identity, /^[A-F0-9]{64}$/i);
    for (const kind of ['Gate', 'Runtime']) {
      const name = `Global\\AppDock.${kind}.${identity}`;
      const sddl = ps(
        `$m=[Threading.Mutex]::OpenExisting(${quote(name)},[Security.AccessControl.MutexRights]::ReadPermissions -bor [Security.AccessControl.MutexRights]::ChangePermissions); try { $old=$m.GetAccessControl().GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access); $s=New-Object Security.AccessControl.MutexSecurity; $s.SetAccessRuleProtection($true,$false); $rights=[Security.AccessControl.MutexRights]::Synchronize${kind === 'Gate' ? ' -bor [Security.AccessControl.MutexRights]::Modify' : ''}; $s.AddAccessRule((New-Object Security.AccessControl.MutexAccessRule([Security.Principal.WindowsIdentity]::GetCurrent().User,$rights,[Security.AccessControl.AccessControlType]::Allow))); $m.SetAccessControl($s); $old } finally {$m.Dispose()}`,
      );
      try {
        const denied = ps(
          `try { $m=[Threading.Mutex]::OpenExisting(${quote(name)},[Security.AccessControl.MutexRights]::FullControl); $m.Dispose(); 'unexpected-full-control' } catch [UnauthorizedAccessException] { 'denied' }`,
        );
        assert.equal(denied, 'denied');
        const before = await inspect(port, 'globalThis.activationCount');
        secondary = spawn(exe, [`--test-profile=${profile}`], {
          env,
          windowsHide: true,
          stdio: 'ignore',
        });
        if (expectDenied) {
          await until(
            () =>
              ps(
                `$p=Get-Process -Id ${secondary.pid} -ErrorAction SilentlyContinue; if($p){$p.MainWindowTitle}`,
              ).includes('Setup'),
            'original launcher error dialog',
          );
          checkpoints.push({ kind, originalFullAccessDenied: true, errorDialog: true });
          secondary.kill();
          await until(
            () => secondary.signalCode !== null || secondary.exitCode !== null,
            'failed launcher closed',
          );
        } else {
          await until(() => secondary.exitCode !== null, 'secondary launcher exits');
          assert.equal(secondary.exitCode, 0);
          await until(
            async () => (await inspect(port, 'globalThis.activationCount')) === before + 1,
            'activation forwarded once',
          );
          assert.equal(await inspect(port, 'process.pid'), runtime.pid);
          assert.ok(fs.existsSync(runtime.exe));
          checkpoints.push({
            kind,
            originalFullAccessDenied: true,
            secondaryExit: 0,
            activationForwarded: true,
            runtimePreserved: true,
          });
        }
        secondary = undefined;
      } finally {
        ps(
          `$m=[Threading.Mutex]::OpenExisting(${quote(name)},[Security.AccessControl.MutexRights]::ReadPermissions -bor [Security.AccessControl.MutexRights]::ChangePermissions); try {$s=New-Object Security.AccessControl.MutexSecurity; $s.SetSecurityDescriptorSddlForm(${quote(sddl)},[Security.AccessControl.AccessControlSections]::Access);$m.SetAccessControl($s)} finally {$m.Dispose()}`,
        );
      }
    }
    await inspect(port, `setTimeout(()=>${electronExpression}.app.quit(),50);true`);
    await until(() => primary.exitCode !== null, 'primary launcher exits');
    assert.equal(primary.exitCode, 0);
    await until(() => !fs.existsSync(path.dirname(runtime.exe)), 'last runtime cleanup');
    const result = {
      ok: true,
      profile,
      expectDenied,
      sha256: createHash('sha256').update(fs.readFileSync(exe)).digest('hex'),
      checkpoints,
    };
    fs.writeFileSync(path.join(profile, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(profile, 'error.txt'), String(error.stack || error));
    throw error;
  } finally {
    if (secondary && secondary.exitCode === null) secondary.kill();
    if (primary && primary.exitCode === null) {
      await inspect(port, `setTimeout(()=>${electronExpression}.app.quit(),50);true`).catch(
        () => {},
      );
      await until(() => primary.exitCode !== null, 'cleanup').catch(() => primary.kill());
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

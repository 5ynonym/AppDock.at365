import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { HostSettings, LaunchState } from '../../shared/contracts';

const execute = promisify(execFile);
export const psString = (value: string) => `'${value.replace(/'/g, "''")}'`;
export const encodedScript = (value: string) => Buffer.from(value, 'utf16le').toString('base64');
export const powershell = () =>
  path.win32.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe',
  );
export async function runPowerShell(script: string, encode = true): Promise<string> {
  try {
    const result = await execute(
      powershell(),
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        encode ? '-EncodedCommand' : '-Command',
        (encode ? encodedScript : (value: string) => value)(
          `$ProgressPreference='SilentlyContinue'\n[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)\ntry { ${script}\n} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }`,
        ),
      ],
      {
        windowsHide: true,
        timeout: 180000,
        maxBuffer: 1024 * 1024,
      },
    );
    return result.stdout.trim();
  } catch (error) {
    const failure = error as { code?: string | number; stderr?: string };
    throw Error(
      `Windowsの操作に失敗しました (${failure.code ?? 'timeout'})。${failure.stderr?.includes('CLIXML') ? '' : (failure.stderr?.trim().slice(0, 500) ?? '')}`,
    );
  }
}

export interface LaunchTask {
  administratorAccount: boolean;
  elevated: boolean;
  sid: string;
  xml: string | null;
  registered: boolean;
  taskElevated: boolean;
}
export class WindowsLaunch {
  state: LaunchState;
  private busy = false;
  private readonly prefix: string;
  constructor(
    readonly executable: string,
    readonly directory: string,
    readonly args: string[] = [],
    supported = process.platform === 'win32' && !!executable,
    private readonly run = runPowerShell,
  ) {
    const id = createHash('sha256')
      .update(`${executable.toLowerCase()}\n${directory.toLowerCase()}`)
      .digest('hex')
      .slice(0, 20);
    this.prefix = `AppDock.at365-${id}-`;
    this.state = {
      supported,
      elevated: false,
      registered: false,
      taskElevated: false,
      taskName: '',
    };
  }
  private context() {
    return `$ErrorActionPreference='Stop'
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
$sid=$identity.User.Value
$admin=([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$name=${psString(this.prefix)}+$sid
$service=New-Object -ComObject 'Schedule.Service'
$service.Connect()
$folder=$service.GetFolder('\\')
$task=$null
try { $task=$folder.GetTask($name) } catch { if ($_.Exception.HResult -ne -2147024894) { throw } }
if ($task) {
  $definition=$task.Definition
  $taskUser=$definition.Principal.UserId
  if ($taskUser -notmatch '^S-1-') { $taskUser=([Security.Principal.NTAccount]$taskUser).Translate([Security.Principal.SecurityIdentifier]).Value }
  if ($definition.Actions.Count -ne 1 -or $definition.Actions.Item(1).Path -ine ${psString(this.executable)} -or [string]$definition.Actions.Item(1).Arguments -cne ${psString(this.argumentLine())} -or $taskUser -ine $sid -or $definition.Principal.LogonType -ne 3) { throw 'AppDock task ownership mismatch' }
}`;
  }
  private argumentLine() {
    // Windows CommandLineToArgvW quoting, including trailing backslashes.
    return this.args
      .map((arg) => `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`)
      .join(' ');
  }
  async read(): Promise<LaunchTask> {
    const data = JSON.parse(
      await this.run(`${this.context()}
@{ administratorAccount=($identity.Groups.Value -contains 'S-1-5-32-544'); elevated=$admin; sid=$sid; xml=$(if ($task) { $task.Xml } else { $null }); registered=($null -ne $task -and $task.Enabled); taskElevated=($null -ne $task -and $task.Definition.Principal.RunLevel -eq 1) } | ConvertTo-Json -Compress`),
    ) as LaunchTask;
    this.state = {
      supported: this.state.supported,
      elevated: data.elevated,
      registered: data.registered,
      taskElevated: data.taskElevated,
      taskName: `${this.prefix}${data.sid}`,
    };
    return data;
  }
  async refresh(): Promise<LaunchState> {
    if (!this.state.supported) return this.state;
    try {
      await this.read();
    } catch (error) {
      this.state = { ...this.state, error: `起動設定を確認できません: ${String(error)}` };
    }
    return this.state;
  }
  private async mutate(script: string, elevated: boolean) {
    const body = `try { ${script}\nexit 0 } catch { exit 1 }`;
    if (elevated) {
      // UAC is requested only for this explicit change. Never auto-confirm it.
      // Keep the outer wrapper raw: encoding its already-encoded child again can
      // exceed Windows' command-line limit when restoring an existing task XML.
      await this.run(
        `$ErrorActionPreference='Stop'
$child=Start-Process -FilePath ${psString(powershell())} -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encodedScript(body)}' -Wait -PassThru
if ($child.ExitCode -ne 0) { throw 'Windows could not update the startup task' }`,
        false,
      );
    } else await this.run(body);
  }
  async save<T>(
    next: HostSettings,
    previous: HostSettings,
    preflight: () => void,
    commit: () => T,
  ): Promise<T> {
    if (this.busy) throw Error('起動設定を変更中です。完了後に保存してください。');
    this.busy = true;
    try {
      preflight();
      let checked: LaunchTask | undefined;
      if (this.state.supported && next.runAsAdministrator && !previous.runAsAdministrator) {
        checked = await this.read();
        if (!checked.administratorAccount && !checked.elevated)
          throw Error(
            'このWindowsユーザーは管理者ではありません。管理者ユーザーでAppDockを使用してください。',
          );
      }
      const changed =
        next.startAtLogon !== previous.startAtLogon ||
        (next.startAtLogon && next.runAsAdministrator !== previous.runAsAdministrator) ||
        (this.state.supported &&
          !this.state.error &&
          (this.state.registered !== next.startAtLogon ||
            (next.startAtLogon && this.state.taskElevated !== next.runAsAdministrator)));
      if (!changed) return commit();
      if (!this.state.supported)
        throw Error('起動設定はWindowsの発行版AppDockで変更してください。');
      const before = checked ?? (await this.read());
      const elevate =
        !before.elevated && ((next.startAtLogon && next.runAsAdministrator) || before.taskElevated);
      if (elevate && !before.administratorAccount)
        throw Error(
          'このWindowsユーザーは管理者ではありません。同じユーザーの管理者権限が必要です。',
        );
      const script = next.startAtLogon
        ? `${this.context()}
$definition=$service.NewTask(0)
$definition.RegistrationInfo.Description='AppDock.at365 logon startup'
$definition.Principal.UserId=$sid
$definition.Principal.LogonType=3
$definition.Principal.RunLevel=${next.runAsAdministrator ? 1 : 0}
$definition.Settings.Enabled=$true
$definition.Settings.DisallowStartIfOnBatteries=$false
$definition.Settings.StopIfGoingOnBatteries=$false
$definition.Settings.ExecutionTimeLimit='PT0S'
$definition.Settings.MultipleInstances=2
$trigger=$definition.Triggers.Create(9)
$trigger.UserId=$sid
$trigger.Delay='PT3S'
$action=$definition.Actions.Create(0)
$action.Path=${psString(this.executable)}
$action.Arguments=${psString(this.argumentLine())}
$action.WorkingDirectory=${psString(path.win32.dirname(this.executable))}
$security='D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;'+$sid+')'
$null=$folder.RegisterTaskDefinition($name,$definition,6,$sid,$null,3,$security)`
        : `${this.context()}
if ($task) { $folder.DeleteTask($name,0) }`;
      // If RunAs credentials belong to a different user, refuse that account's task.
      const sameUser = `$expectedSid=${psString(before.sid)}
if ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne $expectedSid) { throw 'Use the same Windows user for this operation' }
`;
      try {
        await this.mutate(sameUser + script, elevate);
      } catch (error) {
        throw Error(
          `スタートアップの変更は完了しませんでした。UACをキャンセルした場合や権限がない場合、設定は保存されません。${String(error)}`,
        );
      }
      try {
        const after = await this.read();
        if (
          after.registered !== next.startAtLogon ||
          (next.startAtLogon && after.taskElevated !== next.runAsAdministrator)
        )
          throw Error('Windowsの登録結果が設定と一致しません。');
        preflight();
        return commit();
      } catch (error) {
        try {
          await this.mutate(
            sameUser +
              this.context() +
              (before.xml
                ? `\n$null=$folder.RegisterTask($name,${psString(before.xml)},6,$sid,$null,3,'D:P(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;'+$sid+')')`
                : '\nif ($task) { $folder.DeleteTask($name,0) }'),
            elevate,
          );
          await this.read();
        } catch (rollback) {
          throw Error(
            `${String(error)} / Windowsの起動設定を元に戻せませんでした: ${String(rollback)}`,
          );
        }
        throw error;
      }
    } finally {
      this.busy = false;
    }
  }
  async restartElevated(args: string[], pid = process.pid) {
    if (!this.state.supported) throw Error('管理者起動はWindowsの発行版AppDockで使用できます。');
    const before = await this.read();
    if (before.elevated) throw Error('AppDockはすでに管理者として起動しています。');
    if (!before.administratorAccount)
      throw Error(
        'このWindowsユーザーは管理者ではありません。同じユーザーの管理者権限が必要です。',
      );
    const pipeName = `appdock-elevation-${randomUUID()}`;
    let accept!: (value: boolean) => void;
    const ready = new Promise<boolean>((resolve) => {
      accept = resolve;
    });
    const server = net.createServer((socket) => {
      socket.setTimeout(1000, () => socket.destroy());
      socket.once('data', (data) => {
        accept(data.length === 1 && data[0] === 1);
        socket.end();
      });
      socket.on('error', () => accept(false));
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(`\\\\.\\pipe\\${pipeName}`, resolve);
    });
    const child = `$ErrorActionPreference='Stop'
$allowed=([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -eq ${psString(before.sid)} -and ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))
$pipe=[IO.Pipes.NamedPipeClientStream]::new('.',${psString(pipeName)},[IO.Pipes.PipeDirection]::Out)
$pipe.Connect(15000)
$pipe.WriteByte([byte]$allowed)
$pipe.Flush()
$pipe.Dispose()
if (-not $allowed) { exit 1 }
$parent=Get-Process -Id ${pid} -ErrorAction SilentlyContinue
if ($parent -and -not $parent.WaitForExit(60000)) { exit 1 }
Start-Process -FilePath ${psString(this.executable)} -WorkingDirectory ${psString(path.win32.dirname(this.executable))} ${args.length ? `-ArgumentList ${psString(args.map((arg) => `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`).join(' '))}` : ''}`;
    // Confirm the elevated helper's identity before quitting the current host.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await this.run(
        `$ErrorActionPreference='Stop'
$null=Start-Process -FilePath ${psString(powershell())} -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encodedScript(child)}' -PassThru`,
        false,
      );
      const acknowledged = await Promise.race([
        ready,
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 15000);
        }),
      ]);
      if (!acknowledged)
        throw Error(
          '管理者起動を確認できませんでした。同じWindowsユーザーでUACを承認してください。',
        );
    } finally {
      clearTimeout(timer);
      server.close();
    }
  }
}

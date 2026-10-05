import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { JsonLinePeer } from './rpc';
import { isObject, type SettingsStore } from './settings';
import type {
  ExtensionManifest,
  ExtensionSnapshot,
  Command,
  TrayItem,
  Panel,
} from '../../shared/contracts';
function contained(root: string, entry: string) {
  const resolved = fs.realpathSync(path.resolve(root, entry));
  const relative = path.relative(fs.realpathSync(root), resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('entry は拡張フォルダ内に置いてください。');
  return resolved;
}
function readManifest(folder: string): LoadedManifest {
  const m: any = JSON.parse(fs.readFileSync(path.join(folder, 'extension.json'), 'utf8'));
  if (
    !isObject(m) ||
    m.apiVersion !== 1 ||
    !/^[a-z0-9][a-z0-9.-]{0,100}$/.test(m.id) ||
    typeof m.name !== 'string' ||
    !m.name ||
    m.name.length > 100 ||
    typeof m.version !== 'string' ||
    !['node', 'dotnet'].includes(m.runtime) ||
    typeof m.entry !== 'string'
  )
    throw new Error('拡張マニフェストの形式が正しくありません。');
  if (m.runtime === 'dotnet' && (typeof m.type !== 'string' || !m.type))
    throw new Error('.NET拡張のtypeが必要です。');
  if (
    m.capabilities !== undefined &&
    (!Array.isArray(m.capabilities) || m.capabilities.some((c: any) => typeof c !== 'string'))
  )
    throw new Error('capabilities の形式が正しくありません。');
  if (
    m.settings !== undefined &&
    (!Array.isArray(m.settings) ||
      m.settings.some(
        (s: any) =>
          !isObject(s) ||
          typeof s.key !== 'string' ||
          !/^[a-zA-Z0-9._-]+$/.test(s.key) ||
          !['boolean', 'number', 'string'].includes(s.type),
      ))
  )
    throw new Error('settings の形式が正しくありません。');
  return { ...m, folder, entryPath: contained(folder, m.entry) } as LoadedManifest;
}
type LoadedManifest = ExtensionManifest & { folder: string; entryPath: string };
export interface ExtensionInstance {
  manifest: LoadedManifest;
  state: ExtensionSnapshot['state'];
  commands: Command[];
  tray: TrayItem[];
  panel: Panel | null;
  error: string | null;
  child?: ChildProcessWithoutNullStreams | null;
  peer?: JsonLinePeer | null;
}
interface ManagerOptions {
  roots: string[];
  settings: SettingsStore;
  nodeExecutable: string;
  nodeWorker: string;
  dotnetHost: string;
  api: (e: ExtensionInstance, method: string, params: any) => Promise<unknown>;
  log: (level: string, source: string, message: string) => void;
}
class ExtensionManager extends EventEmitter {
  roots: string[];
  settings: SettingsStore;
  nodeExecutable: string;
  nodeWorker: string;
  dotnetHost: string;
  api: ManagerOptions['api'];
  log: ManagerOptions['log'];
  items: Map<string, ExtensionInstance>;
  queue: Promise<void>;
  shuttingDown: boolean;
  constructor({
    roots,
    settings,
    nodeExecutable,
    nodeWorker,
    dotnetHost,
    api,
    log,
  }: ManagerOptions) {
    super();
    this.roots = roots;
    this.settings = settings;
    this.nodeExecutable = nodeExecutable;
    this.nodeWorker = nodeWorker;
    this.dotnetHost = dotnetHost;
    this.api = api;
    this.log = log;
    this.items = new Map();
    this.queue = Promise.resolve();
    this.shuttingDown = false;
  }
  discover() {
    for (const root of this.roots) {
      if (!fs.existsSync(root)) continue;
      for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        const folder = path.join(root, dir.name);
        if (!fs.existsSync(path.join(folder, 'extension.json'))) continue;
        try {
          const manifest = readManifest(folder);
          if (this.items.has(manifest.id)) {
            this.log(
              'warn',
              manifest.id,
              '同じIDの拡張が重複しています。先に見つけた拡張を使用します。',
            );
            continue;
          }
          this.items.set(manifest.id, {
            manifest,
            state: 'stopped',
            commands: [],
            tray: [],
            panel: null,
            error: null,
          });
        } catch (e: any) {
          this.log('error', dir.name, e.message);
        }
      }
    }
    this.emit('changed');
  }
  snapshot(): ExtensionSnapshot[] {
    return [...this.items.values()].map((e) => ({
      ...e.manifest,
      state: e.state,
      error: e.error,
      enabled: this.settings.value.extensions[e.manifest.id]?.enabled ?? false,
      commands: e.commands,
      tray: e.tray,
      panel: e.panel,
    }));
  }
  reconcile() {
    this.queue = this.queue
      .catch((e) => this.log('error', 'host', e.message))
      .then(async () => {
        if (this.shuttingDown) return;
        for (const e of this.items.values()) {
          const enabled = this.settings.value.extensions[e.manifest.id]?.enabled ?? false;
          if (enabled && e.state === 'stopped') await this.start(e);
          if (!enabled && ['running', 'error', 'starting'].includes(e.state)) await this.stop(e);
          if (enabled && e.state === 'running') {
            try {
              await e.peer!.request(
                'settings.changed',
                this.settings.value.extensions[e.manifest.id]?.settings ?? {},
              );
            } catch (err: any) {
              this.log('warn', e.manifest.id, err.message);
            }
          }
        }
        this.emit('changed');
      });
    return this.queue;
  }
  async start(e: ExtensionInstance) {
    e.state = 'starting';
    e.error = null;
    this.emit('changed');
    try {
      const m = e.manifest;
      // Revalidate paths on each activation, including after an external extension update.
      m.entryPath = contained(m.folder, m.entry);
      let child: ChildProcessWithoutNullStreams;
      if (m.runtime === 'node')
        child = spawn(this.nodeExecutable, [this.nodeWorker, m.entryPath], {
          cwd: m.folder,
          windowsHide: true,
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      else {
        const exe = path.join(this.dotnetHost, 'AppDock.ExtensionHost.exe');
        if (!fs.existsSync(exe))
          throw new Error('.NETホストがありません。pnpm run build:dotnet を実行してください。');
        child = spawn(exe, [m.entryPath, m.type!], {
          cwd: m.folder,
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      }
      e.child = child;
      e.peer = new JsonLinePeer(child.stdout, child.stdin, (method, p) => this.api(e, method, p));
      e.peer.on('closed', () => {
        if (e.state === 'running') {
          child.kill();
          this.crashed(e, '拡張との接続が終了しました。');
        }
      });
      child.on('error', (err) => this.crashed(e, err.message));
      child.on('exit', (code, signal) => {
        e.peer?.close();
        if (e.state !== 'stopping') this.crashed(e, `拡張プロセス終了 (${code ?? signal})`);
      });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (data) => this.log('warn', m.id, data.slice(0, 4000).trim()));
      e.peer.on('protocolError', (err) => {
        this.log('error', m.id, err.message);
        if (e.peer?.closed) {
          child.kill();
          this.crashed(e, err.message);
        }
      });
      const result = await e.peer.request('activate', {
        id: m.id,
        settings: this.settings.value.extensions[m.id]?.settings ?? {},
      });
      if (e.error) throw new Error(e.error);
      if (
        !isObject(result) ||
        !Array.isArray(result.commands) ||
        result.commands.length > 100 ||
        result.commands.some(
          (c: any) =>
            !isObject(c) ||
            typeof c.id !== 'string' ||
            !c.id.startsWith(m.id + '.') ||
            typeof c.title !== 'string',
        )
      )
        throw new Error('コマンド登録の形式が正しくありません。');
      e.commands = result.commands;
      e.tray = Array.isArray(result.tray)
        ? result.tray.filter(
            (t: any) =>
              isObject(t) &&
              typeof t.title === 'string' &&
              e.commands.some((c) => c.id === t.command),
          )
        : [];
      e.state = 'running';
      this.log('info', m.id, `${m.name} を起動しました。`);
    } catch (err: any) {
      e.child?.kill();
      this.crashed(e, err.message);
    }
    this.emit('changed');
  }
  crashed(e: ExtensionInstance, message: string) {
    if (e.state === 'stopping') return;
    e.state = 'error';
    e.error = message;
    e.commands = [];
    e.tray = [];
    e.panel = null;
    this.log('error', e.manifest.id, message);
    this.emit('changed');
  }
  async stop(e: ExtensionInstance) {
    e.state = 'stopping';
    this.emit('changed');
    const child = e.child;
    try {
      if (e.peer && !e.peer.closed)
        await Promise.race([e.peer.request('deactivate'), new Promise((r) => setTimeout(r, 2000))]);
    } catch (err: any) {
      this.log('warn', e.manifest.id, err.message);
    }
    e.peer?.close();
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await Promise.race([exited, new Promise((r) => setTimeout(r, 2000))]);
    }
    e.child = null;
    e.peer = null;
    e.state = 'stopped';
    e.commands = [];
    e.tray = [];
    e.panel = null;
    e.error = null;
    this.emit('changed');
  }
  execute(id: string) {
    const e = [...this.items.values()].find(
      (x) => x.state === 'running' && x.commands.some((c) => c.id === id),
    );
    if (!e) throw new Error('このコマンドは現在利用できません。');
    if (!e.peer || e.peer.closed) throw new Error('拡張との接続が終了しました。');
    return e.peer.request('command.execute', { id });
  }
  restart(id: string) {
    this.queue = this.queue
      .catch(() => {})
      .then(async () => {
        const e = this.items.get(id);
        if (!e) throw new Error('拡張が見つかりません。');
        await this.stop(e);
        if (this.settings.value.extensions[id]?.enabled) await this.start(e);
      });
    return this.queue;
  }
  async shutdown() {
    this.shuttingDown = true;
    await this.queue.catch(() => {});
    await Promise.all([...this.items.values()].map((e) => this.stop(e)));
  }
}
export { ExtensionManager, readManifest, contained };

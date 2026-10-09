import { getKeybindings } from '../../shared/keybindings';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { GlobalHotKeyStatus, Settings } from '../../shared/contracts';
import { JsonLinePeer } from './rpc';

type NativeStatus = Omit<GlobalHotKeyStatus, 'commandId'>;
export interface HotKeyBackend {
  sync(shortcuts: string[]): Promise<NativeStatus[]>;
  close(): Promise<void>;
}
export class WindowsHotKeyBackend implements HotKeyBackend {
  private child?: ChildProcessWithoutNullStreams;
  private peer?: JsonLinePeer;
  constructor(
    private executable: string,
    private pressed: (shortcut: string) => void,
    private failed: (error: Error) => void,
  ) {}
  async sync(shortcuts: string[]): Promise<NativeStatus[]> {
    if (!this.peer || this.peer.closed) {
      if (!shortcuts.length) return [];
      const child = spawn(this.executable, ['--hotkeys'], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      this.child = child;
      const peer = new JsonLinePeer(child.stdout, child.stdin, async (method, parameters) => {
        if (method === 'hotkeys.pressed' && typeof parameters.shortcut === 'string')
          this.pressed(parameters.shortcut);
      });
      this.peer = peer;
      child.stderr.resume();
      child.on('error', (error) => {
        peer.close();
        this.failed(error);
      });
      peer.on('closed', () => {
        child.kill();
        if (this.peer === peer)
          this.failed(new Error('グローバルホットキーホストとの接続が終了しました。'));
      });
      peer.on('protocolError', (error) => {
        this.failed(error);
        peer.close();
      });
      child.on('exit', () => peer.close());
    }
    return this.peer.request('hotkeys.sync', { shortcuts });
  }
  async close() {
    const child = this.child;
    const peer = this.peer;
    this.child = undefined;
    this.peer = undefined;
    if (!child) return;
    const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
    child.stdin.end(); // EOF releases the thread's Windows registrations.
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      exited,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          child.kill();
          resolve();
        }, 2000);
      }),
    ]);
    clearTimeout(timer);
    peer?.close();
  }
}

export class GlobalHotKeyManager {
  statuses: GlobalHotKeyStatus[] = [];
  private signature = '';
  private queue: Promise<void> = Promise.resolve();
  private stopped = false;
  private executing = new Set<string>();
  constructor(
    private backend: HotKeyBackend,
    private execute: (id: string) => Promise<unknown>,
    private changed: () => void,
    private report: (message: string) => void,
    private dispatch?: (shortcut: string) => Promise<unknown>,
  ) {}
  sync(settings: Settings, available: string[], suspended = false, retry = false): Promise<void> {
    const desired = suspended
      ? []
      : getKeybindings(settings)
          .filter(
            (row) => row.enabled && row.when.scope === 'global' && available.includes(row.command),
          )
          .map((row) => ({ commandId: row.command, shortcut: row.key }));
    this.queue = this.queue.then(async () => {
      if (this.stopped) return;
      const signature = JSON.stringify(desired);
      if (!retry && signature === this.signature) return;
      this.signature = signature;
      // Stop dispatching old registrations immediately, including queued Windows messages.
      this.statuses = [];
      try {
        const result = await this.backend.sync([...new Set(desired.map((item) => item.shortcut))]);
        this.statuses = desired.map((item) => {
          const status = result.find((entry) => entry.shortcut === item.shortcut);
          return {
            ...item,
            registered: status?.registered ?? false,
            ...(status?.error ? { error: status.error } : {}),
          };
        });
        for (const status of this.statuses)
          if (status.error) this.report(`${status.shortcut}: ${status.error}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.statuses = desired.map((item) => ({ ...item, registered: false, error: message }));
        this.report(message);
      }
      this.changed();
    });
    return this.queue;
  }
  failed(error: Error) {
    this.statuses = this.statuses.map((status) => ({
      ...status,
      registered: false,
      error: error.message,
    }));
    this.changed();
  }
  async pressed(shortcut: string) {
    if (this.stopped) return;
    const commands = [
      ...new Set(
        this.statuses
          .filter((status) => status.shortcut === shortcut && status.registered)
          .map((status) => status.commandId),
      ),
    ];
    if (!commands.length) return;
    if (this.dispatch) {
      await this.dispatch(shortcut);
      return;
    }
    for (const commandId of commands) {
      if (this.executing.has(commandId)) continue;
      this.executing.add(commandId);
      try {
        await this.execute(commandId);
      } catch (error) {
        this.report(String(error));
      } finally {
        this.executing.delete(commandId);
      }
    }
  }

  async close() {
    this.stopped = true;
    await this.queue;
    this.statuses = [];
    await this.backend.close();
  }
}

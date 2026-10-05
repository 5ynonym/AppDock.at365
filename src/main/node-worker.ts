import { JsonLinePeer } from './core/rpc';
import type { Command, TrayItem, Panel } from '../shared/contracts';
type Handler = () => unknown | Promise<unknown>;
export interface NodeExtensionContext {
  commands: { register(id: string, title: string, handler: Handler): void };
  tray: { add(title: string, command: string): void };
  settings: {
    get<T>(key: string, fallback: T): T;
    set(key: string, value: unknown): Promise<unknown>;
  };
  notifications: { show(title: string, body: string): Promise<unknown> };
  ui: { showPanel(panel: Panel): Promise<unknown> };
  browser: { open(url: string): Promise<unknown> };
  log: { info(message: string): Promise<unknown>; error(message: string): Promise<unknown> };
  scheduler: { every(milliseconds: number, callback: Handler): () => void };
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<unknown>;
  };
  secrets: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<unknown>;
    delete(key: string): Promise<unknown>;
  };
}
export interface NodeExtension {
  activate(context: NodeExtensionContext): Promise<void>;
  deactivate?(): Promise<void>;
}
const commands: (Command & { handler: Handler })[] = [];
const tray: TrayItem[] = [];
const disposables: (() => void)[] = [];
let configuration: Record<string, unknown> = {};
let extension: NodeExtension;
const peer = new JsonLinePeer(process.stdin, process.stdout, async (method, p) => {
  switch (method) {
    case 'activate': {
      configuration = p.settings;
      extension = require(process.argv[2]) as NodeExtension;
      const context: NodeExtensionContext = {
        commands: {
          register: (id, title, handler) => {
            if (commands.some((c) => c.id === id)) throw new Error('Duplicate command');
            commands.push({ id, title, handler });
          },
        },
        tray: { add: (title, command) => tray.push({ title, command }) },
        settings: {
          get: (key, fallback) => (configuration[key] ?? fallback) as typeof fallback,
          set: (key, value) => peer.request('host.settings.set', { key, value }),
        },
        ui: { showPanel: (panel) => peer.request('host.ui.panel', panel) },
        notifications: {
          show: (title, body) => peer.request('host.notifications.show', { title, body }),
        },
        browser: { open: (url) => peer.request('host.browser.open', { url }) },
        log: {
          info: (message) => peer.request('host.log', { level: 'info', message }),
          error: (message) => peer.request('host.log', { level: 'error', message }),
        },
        storage: {
          get: (key) => peer.request('host.storage.get', { key }),
          set: (key, value) => peer.request('host.storage.set', { key, value }),
        },
        secrets: {
          get: (key) => peer.request('host.secrets.get', { key }),
          set: (key, value) => peer.request('host.secrets.set', { key, value }),
          delete: (key) => peer.request('host.secrets.delete', { key }),
        },
        scheduler: {
          every: (ms, callback) => {
            if (!Number.isFinite(ms) || ms < 1000)
              throw new Error('Scheduler interval must be >= 1000 ms');
            let busy = false;
            const timer = setInterval(async () => {
              if (busy) return;
              busy = true;
              try {
                await callback();
              } catch (e) {
                console.error(e);
              } finally {
                busy = false;
              }
            }, ms);
            const dispose = () => clearInterval(timer);
            disposables.push(dispose);
            return dispose;
          },
        },
      };
      await extension.activate(context);
      return { commands: commands.map(({ id, title }) => ({ id, title })), tray };
    }
    case 'command.execute': {
      const cmd = commands.find((c) => c.id === p.id);
      if (!cmd) throw new Error('Unknown command');
      return await cmd.handler();
    }
    case 'settings.changed':
      configuration = p;
      return null;
    case 'deactivate':
      disposables.forEach((d) => d());
      await extension?.deactivate?.();
      setImmediate(() => process.exit(0));
      return null;
    default:
      throw new Error(`Unknown method: ${method}`);
  }
});
// stdout is reserved for the wire protocol.
console.log = console.error;
peer.on('closed', () => {
  disposables.forEach((d) => d());
  process.exit(0);
});
peer.on('protocolError', (e) => console.error(e));

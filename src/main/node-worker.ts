import { AsyncLocalStorage } from 'node:async_hooks';
import { createAppDockClient, type AppDockClient } from '../shared/appdock-api';
import { JsonLinePeer } from './core/rpc';
import type { Command, TrayItem, Panel, SettingOption } from '../shared/contracts';
export interface NodeCommandInvocation {
  signal: AbortSignal;
  session?: string;
  window?: string;
  source?: string;
}
type Handler = (invocation?: NodeCommandInvocation) => unknown | Promise<unknown>;
const execution = new AsyncLocalStorage<{ id?: string; invocation: NodeCommandInvocation }>();
const activeCommands = new Map<string, { session?: string; controller: AbortController }>();
const cancelledSessions = new Set<string>();
export interface NodeExtensionContext {
  appdock: AppDockClient;
  pages: { open(id: string): Promise<unknown> };
  webAccounts: {
    start(): Promise<unknown>;
    open(): Promise<unknown>;
    cycle(direction: 1 | -1): Promise<unknown>;
    navigate(action: 'back' | 'forward' | 'reload' | 'inbox'): Promise<unknown>;
    read(): Promise<
      import('../shared/web-accounts').WebAccountSnapshot & { acknowledged: string[] }
    >;
    report(id: string, status: string, attention: boolean, data?: unknown): Promise<unknown>;
  };
  commands: { register(id: string, title: string, handler: Handler): void };
  tray: { add(title: string, command: string): void; attention(active: boolean): Promise<unknown> };
  audio: { play(file?: string): Promise<unknown> };
  settings: {
    get<T>(key: string, fallback: T): T;
    set(key: string, value: unknown): Promise<unknown>;
    onChanged(handler: Handler): () => void;
    setOptions(key: string, options: SettingOption[]): Promise<unknown>;
  };
  notifications: {
    show(
      title: string,
      body: string,
      options?: { silent?: boolean; command?: string },
    ): Promise<unknown>;
  };
  ui: {
    showPanel(panel: Panel): Promise<unknown>;
    getImageDirectory(): Promise<string>;
    pickFile(kind: 'json' | 'wav'): Promise<string | null>;
  };
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
  onPanelAction?(actionId: string): Promise<void>;
}
const commands: (Command & { handler: Handler })[] = [];
const tray: TrayItem[] = [];
const disposables: (() => void)[] = [];
let configuration: Record<string, unknown> = {};
let extension: NodeExtension;
const settingsHandlers = new Set<Handler>();
const peer = new JsonLinePeer(process.stdin, process.stdout, async (method, p) => {
  switch (method) {
    case 'activate': {
      configuration = p.settings;
      extension = require(process.argv[2]) as NodeExtension;
      const context: NodeExtensionContext = {
        appdock: createAppDockClient((method, params) =>
          peer.request(method, {
            ...(params as object),
            ...(execution.getStore()?.id ? { executionId: execution.getStore()!.id } : {}),
          }),
        ),
        pages: { open: (id) => peer.request('host.pages.open', { id }) },
        webAccounts: {
          start: () => peer.request('host.webAccounts.start', {}),
          open: () => peer.request('host.webAccounts.open', {}),
          cycle: (direction) => peer.request('host.webAccounts.cycle', { direction }),
          navigate: (action) => peer.request('host.webAccounts.navigate', { action }),
          read: () =>
            peer.request('host.webAccounts.read', {}) as Promise<
              import('../shared/web-accounts').WebAccountSnapshot & { acknowledged: string[] }
            >,
          report: (id, status, attention, data) =>
            peer.request('host.webAccounts.report', { id, status, attention, data }),
        },
        commands: {
          register: (id, title, handler) => {
            if (commands.some((c) => c.id === id)) throw new Error('Duplicate command');
            commands.push({ id, title, handler });
          },
        },
        tray: {
          add: (title, command) => tray.push({ title, command }),
          attention: (active) => peer.request('host.tray.attention', { active }),
        },
        audio: { play: (file = '') => peer.request('host.audio.play', { file }) },
        settings: {
          get: (key, fallback) => (configuration[key] ?? fallback) as typeof fallback,
          set: async (key, value) => {
            await peer.request('host.settings.set', { key, value });
            configuration = { ...configuration, [key]: value };
          },
          onChanged: (handler) => {
            settingsHandlers.add(handler);
            const dispose = () => {
              settingsHandlers.delete(handler);
            };
            disposables.push(dispose);
            return dispose;
          },
          setOptions: (key, options) => peer.request('host.settings.options', { key, options }),
        },
        ui: {
          pickFile: (kind) => peer.request('host.ui.pickFile', { kind }, 300000),
          showPanel: (panel) => peer.request('host.ui.panel', panel),
          getImageDirectory: () => peer.request('host.ui.imageDirectory', {}) as Promise<string>,
        },
        notifications: {
          show: (title, body, options) =>
            peer.request('host.notifications.show', { title, body, ...options }),
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
      const controller = new AbortController();
      const session = p.invocation?.session;
      const key = p.executionId ?? session ?? String(Math.random());
      activeCommands.set(key, { session, controller });
      if (session && cancelledSessions.has(session)) controller.abort();
      const invocation = { ...p.invocation, signal: controller.signal };
      try {
        return await execution.run({ id: p.executionId, invocation }, () =>
          cmd.handler(invocation),
        );
      } finally {
        activeCommands.delete(key);
      }
    }
    case 'command.cancel': {
      cancelledSessions.add(p.session);
      if (cancelledSessions.size > 256)
        cancelledSessions.delete(cancelledSessions.values().next().value!);
      // The host independently cancels pending native input using its trusted context.
      for (const entry of activeCommands.values())
        if (entry.session === p.session) entry.controller.abort();
      return null;
    }
    case 'panel.action':
      if (!extension?.onPanelAction) throw new Error('Panel actions are not supported.');
      await extension.onPanelAction(p.id);
      return null;
    case 'settings.changed': {
      const changed = JSON.stringify(configuration) !== JSON.stringify(p);
      configuration = p;
      if (changed) for (const handler of settingsHandlers) await handler();
      return null;
    }
    case 'deactivate':
      for (const entry of activeCommands.values()) entry.controller.abort();
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

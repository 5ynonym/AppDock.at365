import { WebContentsView, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaultShellId, type ShellStatus } from '../../shared/shell';
import type { ExtensionSnapshot } from '../../shared/contracts';
import type { UiPresentation } from './ui-presentation';

type Binding = {
  id: string;
  session: string;
  view: WebContentsView;
  url: string;
  ready: boolean;
  revision: number;
  timer: ReturnType<typeof setTimeout>;
};
/** Owns surfaces, never imports a Shell renderer. Both providers use this exact path. */
export class ShellHost {
  private active?: Binding;
  private pending?: Binding;
  private failed = new Set<string>();
  private failedVersions: Record<string, string> = {};
  private bounds: Electron.Rectangle | null = null;
  private error: string | null = null;
  private disposed = false;
  constructor(
    private options: {
      window: BrowserWindow;
      preload: string;
      ui: UiPresentation;
      providers(): ExtensionSnapshot[];
      selected(): string;
      safeMode: boolean;
      ready(): boolean;
      failureFile: string;
      changed(): void;
      log(message: string): void;
      failed(message: string, retry: () => void): void;
      shortcut(input: Electron.Input): boolean;
    },
  ) {
    try {
      const saved = JSON.parse(fs.readFileSync(options.failureFile, 'utf8'));
      if (saved && typeof saved === 'object') this.failedVersions = saved;
    } catch {}
    const binding = (event: IpcMainInvokeEvent) => {
      const result = [this.active, this.pending].find((b) => b?.view.webContents === event.sender);
      if (
        !result ||
        event.senderFrame !== event.sender.mainFrame ||
        event.sender.getURL() !== result.url
      )
        throw Error('Shell session is not bound');
      return result;
    };
    ipcMain.handle('shell:connect', (event) => {
      const b = binding(event);
      const snapshot = options.ui.get();
      b.revision = snapshot.revision;
      return {
        providerAppletId: b.id,
        contextId: 'primary',
        sessionId: b.session,
        bindingId: 'primary',
        snapshot,
      };
    });
    ipcMain.handle('shell:focusHost', (event, edge) => {
      const b = binding(event);
      if (b !== this.active || !['before', 'after'].includes(edge))
        throw Error('Invalid focus request');
      options.window.webContents.focus();
      options.window.webContents.send('dock:shellFocusHost', edge);
    });
    ipcMain.handle('shell:get', (event) => {
      binding(event);
      return options.ui.get();
    });
    ipcMain.handle('shell:asset', (event, id) => {
      binding(event);
      return options.ui.getAsset(id);
    });
    ipcMain.handle('shell:invoke', (event, request) => {
      const b = binding(event);
      if (b !== this.active || !b.ready) throw Error('Shell is not active');
      return options.ui.invoke(request, b.session);
    });
    ipcMain.handle('shell:ready', (event, session) => {
      const b = binding(event);
      if (session !== b.session) throw Error('Stale Shell session');
      if (b === this.active) return;
      clearTimeout(b.timer);
      b.ready = true;
      const old = this.active;
      this.active = b;
      this.pending = undefined;
      if (b.id === options.selected() || options.safeMode) this.error = null;
      if (old) this.close(old);
      this.layout();
      options.changed();
    });
    ipcMain.handle('shell:dispose', (event, session) => {
      const b = binding(event);
      if (session === b.session) this.fail(b, 'Shell session disposed');
    });
    options.window.once('closed', () => this.dispose());
  }
  get status(): ShellStatus {
    return {
      selected: this.options.selected(),
      active: this.active?.id ?? null,
      error: this.error,
      safeMode: this.options.safeMode,
    };
  }
  focus(edge: 'first' | 'last') {
    if (!['first', 'last'].includes(edge) || !this.active || !this.bounds) return;
    this.active.view.webContents.focus();
    this.active.view.webContents.send('shell:focus', edge);
  }
  viewport(value: Electron.Rectangle | null) {
    if (
      value !== null &&
      (!value ||
        !['x', 'y', 'width', 'height'].every((k) =>
          Number.isFinite(value[k as keyof Electron.Rectangle]),
        ) ||
        value.width < 1 ||
        value.height < 1)
    )
      throw Error('Invalid Shell bounds');
    const zoom = this.options.window.webContents.getZoomFactor();
    this.bounds = value && {
      x: Math.round(value.x * zoom),
      y: Math.round(value.y * zoom),
      width: Math.round(value.width * zoom),
      height: Math.round(value.height * zoom),
    };
    this.layout();
  }
  private layout() {
    if (!this.active) return;
    this.active.view.setVisible(!!this.bounds);
    if (this.bounds) this.active.view.setBounds(this.bounds);
  }
  refresh() {
    if (this.disposed || !this.options.ready()) return;
    const providers = this.options.providers();
    for (const p of providers) {
      if (this.failedVersions[p.id] === p.version) this.failed.add(p.id);
      else if (this.failedVersions[p.id]) {
        delete this.failedVersions[p.id];
        this.failed.delete(p.id);
      }
    }
    let id = this.options.safeMode ? defaultShellId : this.options.selected();
    const requested = providers.find((p) => p.id === id && p.shell && p.enabled);
    if (id !== defaultShellId && (!requested || this.failed.has(id)))
      this.error ||= `${id}: 使用できないためDefault Shellを表示しています。`;
    if (requested?.state === 'error' && !this.failed.has(id)) {
      this.recordFailure(id, requested.version, 'Shell worker failed');
    }
    if (!requested || requested.state !== 'running' || this.failed.has(id)) id = defaultShellId;
    if (this.pending && this.pending.id !== id) {
      const cancelled = this.pending;
      this.pending = undefined;
      this.close(cancelled);
    }
    for (const b of [this.active, this.pending]) {
      if (b && !providers.some((p) => p.id === b.id && p.enabled && p.state === 'running')) {
        if (providers.find((p) => p.id === b.id)?.state === 'error')
          this.fail(b, 'Shell worker stopped');
        else {
          // An intentional disable/restart is not a provider fault. It may be selected again.
          if (b === this.active) this.active = undefined;
          if (b === this.pending) this.pending = undefined;
          this.close(b);
          this.options.changed();
          this.refresh();
        }
        return;
      }
    }
    if (this.pending?.id !== id && this.active?.id !== id && !this.failed.has(id)) {
      const p = providers.find((p) => p.id === id && p.shell && p.state === 'running');
      if (p) {
        try {
          this.open(p);
        } catch {
          this.recordFailure(p.id, p.version, 'Shell UI is unavailable');
          this.options.changed();
        }
      } else if (id === defaultShellId && !providers.some((p) => p.id === defaultShellId)) {
        this.recordFailure(id, '', 'Default Shell package is missing');
      }
    }
    if (this.active?.id === this.options.selected() && !this.failed.has(this.active.id))
      this.error = null;
    const snapshot = this.options.ui.get();
    for (const b of [this.active, this.pending])
      if (b && b.revision !== snapshot.revision && !b.view.webContents.isDestroyed()) {
        b.revision = snapshot.revision;
        b.view.webContents.send('shell:changed', snapshot);
      }
  }
  retry() {
    this.failed.clear();
    this.failedVersions = {};
    this.saveFailures();
    this.error = null;
    this.refresh();
  }
  private saveFailures() {
    try {
      fs.mkdirSync(path.dirname(this.options.failureFile), { recursive: true });
      fs.writeFileSync(this.options.failureFile, JSON.stringify(this.failedVersions));
    } catch {
      this.error = 'Shellの復旧状態を保存できません。ログと保存先を確認してください。';
    }
  }
  private recordFailure(id: string, version: string, message: string) {
    if (this.failed.has(id)) return;
    this.failed.add(id);
    // Default Shell must be attempted on every new launch, including --safe-shell.
    if (id !== defaultShellId) {
      this.failedVersions[id] = version;
      this.saveFailures();
    }
    this.error = `${id}: ${message}`;
    this.options.log(this.error);
    if (id === defaultShellId) this.options.failed(this.error, () => this.retry());
  }
  private open(provider: ExtensionSnapshot) {
    if (this.pending) this.close(this.pending);
    const file = fs.realpathSync(path.resolve(provider.folder, provider.shell!.ui));
    const relative = path.relative(fs.realpathSync(provider.folder), file);
    if (relative.startsWith('..') || path.isAbsolute(relative))
      throw Error('Shell UI is outside provider');
    const view = new WebContentsView({
      webPreferences: {
        preload: this.options.preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    const b: Binding = {
      id: provider.id,
      session: randomUUID(),
      view,
      url: pathToFileURL(file).href,
      ready: false,
      revision: 0,
      timer: setTimeout(() => this.fail(b, 'Shell ready timeout'), 10000),
    };
    this.pending = b;
    view.setVisible(false);
    this.options.window.contentView.addChildView(view);
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    view.webContents.on('will-navigate', (event) => event.preventDefault());
    view.webContents.on('will-redirect', (event) => event.preventDefault());
    view.webContents.on('render-process-gone', () => this.fail(b, 'Shell renderer exited'));
    view.webContents.on('unresponsive', () => this.fail(b, 'Shell renderer is unresponsive'));
    view.webContents.on('before-input-event', (event, input) => {
      if (this.options.shortcut(input)) event.preventDefault();
    });
    void view.webContents.loadURL(b.url).catch(() => this.fail(b, 'Shell UI load failed'));
  }
  private close(b: Binding) {
    clearTimeout(b.timer);
    this.options.ui.disconnect(b.session);
    if (!this.options.window.isDestroyed()) this.options.window.contentView.removeChildView(b.view);
    if (!b.view.webContents.isDestroyed()) b.view.webContents.close();
  }
  private fail(b: Binding, message: string) {
    if (this.disposed || (b !== this.active && b !== this.pending)) return;
    this.recordFailure(
      b.id,
      this.options.providers().find((p) => p.id === b.id)?.version ?? '',
      message,
    );
    if (b === this.active) this.active = undefined;
    if (b === this.pending) this.pending = undefined;
    this.close(b);
    this.options.changed();
    if (b.id !== defaultShellId) this.refresh();
  }
  dispose() {
    this.disposed = true;
    for (const b of [this.active, this.pending]) if (b) this.close(b);
    this.active = this.pending = undefined;
    for (const method of ['connect', 'get', 'asset', 'invoke', 'ready', 'dispose', 'focusHost'])
      ipcMain.removeHandler(`shell:${method}`);
  }
}

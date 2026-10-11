import {
  ipcMain,
  type BrowserWindow,
  type IpcMainInvokeEvent,
  type WebContentsView,
} from 'electron';
import { randomUUID } from 'node:crypto';
import type { ExtensionSnapshot } from '../../shared/contracts';
import { defaultShellId, shellView } from '../../shared/shell';
import type { ShellPageRequest, ShellPageViewport } from '../../shared/shell-pages';
import type { ShellPageController } from './shell-page-controller';
import { createShellView } from './shell-view';

type Surface = {
  view: WebContentsView;
  url: string;
  session: string;
  provider: string;
  version: string;
  ready: boolean;
  revision: number;
  settingsSignature?: string;
  timer: ReturnType<typeof setTimeout>;
};
/** One nonmodal body slot. Content controllers never own native display or provider recovery. */
export class ShellPageHost {
  private current?: ShellPageController;
  private surface?: Surface;
  private bounds: ShellPageViewport | null = null;
  private failedProviders = new Set<string>();
  private unavailable = false;
  private disposed = false;
  private pendingFocus?: 'first' | 'last';
  constructor(
    private options: {
      window: BrowserWindow;
      preload: string;
      providers(): ExtensionSnapshot[];
      selected(): string;
      route(): string;
      ready(): boolean;
      create(request: ShellPageRequest): ShellPageController;
      execute(provider: string, command: string): Promise<unknown>;
      settings(provider: string): Record<string, unknown>;
      shortcut(key: string): Promise<unknown>;
      layer(): void;
      failed(message: string, unavailable: boolean): void;
    },
  ) {
    const bound = (event: IpcMainInvokeEvent, active = false) => {
      const s = this.surface;
      if (
        !s ||
        !this.current ||
        this.current.route !== options.route() ||
        event.sender !== s.view.webContents ||
        event.senderFrame !== event.sender.mainFrame ||
        event.sender.getURL() !== s.url ||
        (active && !s.ready)
      )
        throw Error('Page session is not bound');
      return s;
    };
    ipcMain.handle('shell-page:connect', (event) => {
      const s = bound(event);
      return {
        sessionId: s.session,
        providerAppletId: s.provider,
        snapshot: this.current!.snapshot(),
      };
    });
    ipcMain.handle('shell-page:ready', (event, session) => {
      const s = bound(event);
      if (s.session !== session) throw Error('Stale page session');
      clearTimeout(s.timer);
      s.ready = true;
      this.refresh();
      if (this.current && this.pendingFocus && options.window.isFocused())
        this.focus(this.current.id, this.pendingFocus);
    });
    ipcMain.handle('shell-page:act', (event, action) => {
      bound(event, true);
      return this.current!.act(action);
    });
    ipcMain.handle('shell-page:executeCommand', (event, command) =>
      options.execute(bound(event, true).provider, command),
    );
    ipcMain.handle('shell-page:getSettings', (event) => options.settings(bound(event).provider));
    ipcMain.handle('shell-page:shortcut', (event, key) => {
      bound(event, true);
      return options.shortcut(key);
    });
    ipcMain.handle('shell-page:focusHost', (event, edge) => {
      bound(event, true);
      if (!['before', 'after'].includes(edge)) throw Error('Invalid focus edge');
      options.window.webContents.focus();
      options.window.webContents.send('dock:shellPageFocusHost', this.current!.id, edge);
    });
    options.window.on('resize', () => this.layout());
    options.window.on('show', () => this.layout());
    options.window.on('hide', () => this.layout());
    options.window.on('minimize', () => this.layout());
    options.window.on('restore', () => this.layout());
    options.window.webContents.on('did-start-loading', () => this.close());
    options.window.webContents.on('render-process-gone', () => this.close());
    options.window.once('closed', () => this.dispose());
  }
  mount(request: ShellPageRequest, bounds: ShellPageViewport | null) {
    if (this.disposed) return;
    this.validateBounds(bounds);
    // The root renderer can still have the previous route during a navigation notification.
    if (request?.route !== this.options.route()) return;
    if (this.current?.id !== request.id) {
      const controller = this.options.create(request);
      this.close();
      this.current = controller;
    }
    this.bounds = bounds;
    this.refresh();
  }
  close(id?: string) {
    if (id !== undefined && id !== this.current?.id) return;
    this.current = undefined;
    this.bounds = null;
    this.unavailable = false;
    this.pendingFocus = undefined;
    this.closeSurface();
  }
  focus(id: string, edge: 'first' | 'last') {
    if (id !== this.current?.id || !this.bounds || !['first', 'last'].includes(edge)) return;
    if (!this.surface?.ready) {
      this.pendingFocus = edge;
      return;
    }
    this.pendingFocus = undefined;
    this.surface.view.webContents.focus();
    this.surface.view.webContents.send('shell-page:focus', edge);
  }
  private validateBounds(area: ShellPageViewport | null) {
    if (
      area !== null &&
      (!area ||
        ['x', 'y', 'width', 'height'].some((k) => {
          const v = area[k as keyof ShellPageViewport];
          return (
            !Number.isFinite(v) ||
            Math.abs(v) > 100000 ||
            ((k === 'width' || k === 'height') && v < 1)
          );
        }))
    )
      throw Error('Invalid page viewport');
  }
  private candidate() {
    const region = `page.${this.current!.kind}` as const;
    const available = (id: string) =>
      this.options
        .providers()
        .find(
          (p) =>
            p.id === id &&
            p.enabled &&
            p.state === 'running' &&
            shellView(p.shell, region) &&
            !this.failedProviders.has(`${region}:${p.id}:${p.version}`),
        );
    return available(this.options.selected()) ?? available(defaultShellId);
  }
  private present() {
    if (!this.current || !this.options.ready()) return;
    const p = this.candidate();
    if (!p) {
      if (!this.unavailable) {
        this.unavailable = true;
        this.options.failed('ページを起動できません。Shellを再試行してください。', true);
      }
      return;
    }
    this.unavailable = false;
    try {
      const { view, url } = createShellView(
        p.folder,
        shellView(p.shell, `page.${this.current.kind}`)!,
        this.options.preload,
      );
      const s: Surface = {
        view,
        url,
        session: randomUUID(),
        provider: p.id,
        version: p.version,
        ready: false,
        revision: 0,
        timer: setTimeout(() => this.fail(s, 'ready timeout'), 10000),
      };
      this.surface = s;
      this.options.window.contentView.addChildView(view);
      view.webContents.on('render-process-gone', () => this.fail(s, 'renderer exited'));
      view.webContents.on('unresponsive', () => this.fail(s, 'renderer unresponsive'));
      void view.webContents.loadURL(url).catch(() => this.fail(s, 'load failed'));
    } catch {
      this.failedProviders.add(`page.${this.current.kind}:${p.id}:${p.version}`);
      this.options.failed(`${p.id}: ページを読み込めません。`, false);
      this.present();
    }
  }
  private fail(s: Surface, reason: string) {
    if (s !== this.surface || !this.current || this.disposed) return;
    this.failedProviders.add(`page.${this.current.kind}:${s.provider}:${s.version}`);
    this.closeSurface();
    this.options.failed(`${s.provider}: ${reason}`, false);
    this.present();
  }
  private closeSurface() {
    const s = this.surface;
    this.surface = undefined;
    if (!s) return;
    if (this.current && !s.view.webContents.isDestroyed() && s.view.webContents.isFocused())
      this.pendingFocus = 'first';
    clearTimeout(s.timer);
    if (!this.options.window.isDestroyed()) this.options.window.contentView.removeChildView(s.view);
    if (!s.view.webContents.isDestroyed()) s.view.webContents.close();
  }
  layout() {
    const s = this.surface,
      w = this.options.window;
    if (!s || w.isDestroyed()) return;
    const visible =
      s.ready &&
      !!this.bounds &&
      w.isVisible() &&
      !w.isMinimized() &&
      this.current?.route === this.options.route();
    s.view.setVisible(visible);
    if (!visible || !this.bounds) return;
    const zoom = w.webContents.getZoomFactor();
    const [width, height] = w.getContentSize();
    const x = Math.max(0, Math.min(width - 1, Math.round(this.bounds.x * zoom)));
    const y = Math.max(0, Math.min(height - 1, Math.round(this.bounds.y * zoom)));
    s.view.setBounds({
      x,
      y,
      width: Math.max(1, Math.min(width - x, Math.round(this.bounds.width * zoom))),
      height: Math.max(1, Math.min(height - y, Math.round(this.bounds.height * zoom))),
    });
    s.view.webContents.setZoomFactor(zoom);
    // Nonmodal pages remain below the settings notice and modal overlay.
    w.contentView.addChildView(s.view);
    this.options.layer();
  }
  refresh() {
    if (!this.current || this.disposed) return;
    if (this.current.route !== this.options.route()) {
      this.close();
      return;
    }
    if (!this.options.ready()) return;
    const provider = this.candidate();
    if (
      this.surface &&
      (provider?.id !== this.surface.provider || provider.version !== this.surface.version)
    )
      this.closeSurface();
    if (!this.surface) this.present();
    const s = this.surface;
    if (!s?.ready) return;
    const model = this.current.snapshot();
    if (model.revision !== s.revision) {
      s.revision = model.revision;
      s.view.webContents.send('shell-page:changed', model);
    }
    const signature = JSON.stringify(this.options.settings(s.provider));
    if (signature !== s.settingsSignature) {
      s.settingsSignature = signature;
      s.view.webContents.send('shell-page:settingsChanged');
    }
    this.layout();
  }
  retry() {
    this.failedProviders.clear();
    this.unavailable = false;
    this.refresh();
  }
  dispose() {
    this.disposed = true;
    this.close();
    for (const name of [
      'connect',
      'ready',
      'act',
      'executeCommand',
      'getSettings',
      'shortcut',
      'focusHost',
    ])
      ipcMain.removeHandler(`shell-page:${name}`);
  }
}

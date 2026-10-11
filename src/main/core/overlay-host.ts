import {
  BrowserWindow,
  ipcMain,
  webContents,
  type WebContents,
  type IpcMainInvokeEvent,
  type WebContentsView,
} from 'electron';
import { randomUUID } from 'node:crypto';
import type { ExtensionSnapshot } from '../../shared/contracts';
import { defaultShellId, shellView } from '../../shared/shell';
import type { OverlayController } from './overlay-controller';
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
/** One modal lane per context. Controllers and providers do not own native layering. */
export class OverlayHost {
  private current?: OverlayController;
  private surface?: Surface;
  private previousFocus?: WebContents;
  private previousRoute = '';
  private failedProviders = new Set<string>();
  private disposed = false;
  constructor(
    private options: {
      window: BrowserWindow;
      preload: string;
      providers(): ExtensionSnapshot[];
      selected(): string;
      route(): string;
      execute(provider: string, command: string): Promise<unknown>;
      settings(provider: string): Record<string, unknown>;
      changed(): void;
      failed(message: string): void;
    },
  ) {
    const bound = (event: IpcMainInvokeEvent) => {
      const s = this.surface;
      if (
        !s ||
        !this.current ||
        event.sender !== s.view.webContents ||
        event.senderFrame !== event.sender.mainFrame ||
        event.sender.getURL() !== s.url
      )
        throw Error('Overlay session is not bound');
      return s;
    };
    ipcMain.handle('overlay:connect', (event) => {
      const s = bound(event);
      return {
        sessionId: s.session,
        providerAppletId: s.provider,
        snapshot: this.current!.snapshot(),
      };
    });
    ipcMain.handle('overlay:ready', (event, session) => {
      const s = bound(event);
      if (session !== s.session) throw Error('Stale overlay session');
      clearTimeout(s.timer);
      if (s.ready) return;
      s.ready = true;
      this.layout();
      if (options.window.isFocused()) s.view.webContents.focus();
      this.refresh();
    });
    ipcMain.handle('overlay:act', (event, action) => {
      const s = bound(event);
      if (!s.ready) throw Error('Overlay is not ready');
      return this.current!.act(action);
    });
    ipcMain.handle('overlay:executeCommand', (event, command) => {
      const s = bound(event);
      if (!s.ready) throw Error('Overlay is not ready');
      return options.execute(s.provider, command);
    });
    ipcMain.handle('overlay:getSettings', (event) => options.settings(bound(event).provider));
    options.window.on('resize', () => this.layout());
    options.window.on('hide', () => this.cancel('window-hidden'));
    options.window.on('minimize', () => this.cancel('window-minimized'));
    options.window.webContents.on('did-start-loading', () => this.cancel('owner-reloaded'));
    options.window.webContents.on('render-process-gone', () => this.cancel('owner-exited'));
    options.window.once('closed', () => this.dispose());
  }
  get active() {
    return !!this.current;
  }
  get kind() {
    return this.current?.kind ?? null;
  }
  open(controller: OverlayController) {
    if (this.disposed) {
      controller.cancel('shutdown');
      return;
    }
    this.cancel('replaced');
    this.previousFocus = this.options.window.isFocused()
      ? (webContents.getFocusedWebContents() ?? this.options.window.webContents)
      : undefined;
    this.previousRoute = this.options.route();
    this.current = controller;
    controller.onClosed(() => {
      if (this.current !== controller) return;
      this.current = undefined;
      const restore =
        !this.options.window.isDestroyed() &&
        this.options.window.isFocused() &&
        this.previousRoute === this.options.route();
      this.closeSurface();
      if (restore && this.previousFocus && !this.previousFocus.isDestroyed())
        this.previousFocus.focus();
      this.previousFocus = undefined;
      this.options.changed();
    });
    this.options.changed();
    this.present();
  }
  cancel(reason = 'dismissed') {
    this.current?.cancel(reason);
  }
  retry() {
    this.failedProviders.clear();
  }
  private present() {
    const controller = this.current;
    if (!controller) return;
    const providers = this.options.providers();
    const candidate = (id: string) =>
      providers.find(
        (p) =>
          p.id === id &&
          p.enabled &&
          p.state === 'running' &&
          shellView(p.shell, `overlay.${controller.kind}`) &&
          !this.failedProviders.has(`${p.id}:${p.version}`),
      );
    const provider = candidate(this.options.selected()) ?? candidate(defaultShellId);
    if (!provider) {
      this.cancel('unavailable');
      this.options.failed('オーバーレイを起動できません。Shellを再試行してください。');
      return;
    }
    try {
      const { view, url } = createShellView(
        provider.folder,
        shellView(provider.shell, `overlay.${controller.kind}`)!,
        this.options.preload,
      );
      view.setBackgroundColor('#00000000');
      const s: Surface = {
        view,
        url,
        session: randomUUID(),
        provider: provider.id,
        version: provider.version,
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
      this.failedProviders.add(`${provider.id}:${provider.version}`);
      this.options.failed(`${provider.id}: オーバーレイを読み込めません。`);
      this.present();
    }
  }
  private fail(s: Surface, reason: string) {
    if (s !== this.surface || !this.current) return;
    this.failedProviders.add(`${s.provider}:${s.version}`);
    this.closeSurface();
    this.options.failed(`${s.provider}: ${reason}`);
    this.present();
  }
  private closeSurface() {
    const s = this.surface;
    this.surface = undefined;
    if (!s) return;
    clearTimeout(s.timer);
    if (!this.options.window.isDestroyed()) this.options.window.contentView.removeChildView(s.view);
    if (!s.view.webContents.isDestroyed()) s.view.webContents.close();
  }
  layout() {
    const s = this.surface;
    if (!s?.ready || this.options.window.isDestroyed()) return;
    const [width, height] = this.options.window.getContentSize();
    s.view.setBounds({ x: 0, y: 0, width: Math.max(1, width), height: Math.max(1, height) });
    s.view.webContents.setZoomFactor(this.options.window.webContents.getZoomFactor());
    s.view.setVisible(true);
    this.options.window.contentView.addChildView(s.view);
  }
  refresh() {
    const s = this.surface;
    if (!this.current || !s) return;
    if (this.previousRoute !== this.options.route()) {
      this.cancel('owner-navigation');
      return;
    }
    if (
      !this.options
        .providers()
        .some(
          (p) =>
            p.id === s.provider && p.version === s.version && p.enabled && p.state === 'running',
        )
    ) {
      // Intentional disable/restart must not blacklist a healthy provider.
      this.closeSurface();
      this.present();
      return;
    }
    const model = this.current.snapshot();
    const signature = JSON.stringify(this.options.settings(s.provider));
    if (s.ready && s.settingsSignature !== signature) {
      s.settingsSignature = signature;
      s.view.webContents.send('overlay:settingsChanged');
    }
    if (s.ready && s.revision !== model.revision) {
      s.revision = model.revision;
      s.view.webContents.send('overlay:changed', model);
    }
    this.layout();
  }
  dispose() {
    this.disposed = true;
    this.cancel('shutdown');
    this.closeSurface();
    for (const name of ['connect', 'ready', 'act', 'executeCommand', 'getSettings'])
      ipcMain.removeHandler(`overlay:${name}`);
  }
}

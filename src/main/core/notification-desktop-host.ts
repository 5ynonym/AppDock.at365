import { BrowserWindow, screen, powerMonitor, type Rectangle, type Tray } from 'electron';
import type { ExtensionSnapshot } from '../../shared/contracts';
import { NotificationSurfaceHost } from './notification-surface-host';
import { NotificationSurfaceController } from './notification-surface-controller';
import { NotificationService } from './notification-service';
import { NativeNotificationState } from './native-notification-state';
import { desktopNotificationBounds } from './notification-desktop-layout';
/** One lazy independent presentation window; all content and deadlines remain in the service. */
export class NotificationDesktopHost {
  private window?: BrowserWindow;
  private host?: NotificationSurfaceHost;
  private state: NativeNotificationState;
  private stop: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private querying = false;
  private accepts = false;
  private locked = false;
  private disposed = false;
  private warned = false;
  private queued = false;
  private failures = new Set<string>();
  private refreshDisplay = () => this.refresh();
  private lock = () => {
    this.locked = true;
    this.refresh();
  };
  private unlock = () => {
    this.locked = false;
    void this.query();
  };
  constructor(
    private options: {
      service: NotificationService;
      parent: BrowserWindow;
      nativeExecutable: string;
      preload: string;
      dark(): boolean;
      tray(): Tray | undefined;
      providers(): ExtensionSnapshot[];
      selected(): string;
      ready(): boolean;
      settings(provider: string): Record<string, unknown>;
      execute(provider: string, command: string): Promise<unknown>;
      openCenter(): Promise<void>;
      failed(message: string): void;
    },
  ) {
    this.state = new NativeNotificationState(options.nativeExecutable);
    this.stop = options.service.subscribe(() => {
      if (!this.queued) {
        this.queued = true;
        queueMicrotask(() => {
          this.queued = false;
          this.refresh();
        });
      }
    });
    screen.on('display-added', this.refreshDisplay);
    screen.on('display-removed', this.refreshDisplay);
    screen.on('display-metrics-changed', this.refreshDisplay);
    powerMonitor.on('lock-screen', this.lock);
    powerMonitor.on('unlock-screen', this.unlock);
    powerMonitor.on('suspend', this.lock);
    powerMonitor.on('resume', this.unlock);
    options.parent.on('enter-full-screen', this.refreshDisplay);
    options.parent.on('leave-full-screen', this.refreshDisplay);
  }
  private display() {
    let tray: Rectangle | undefined;
    try {
      tray = this.options.tray()?.getBounds();
    } catch {}
    const display =
      tray && tray.width > 0 && tray.height > 0
        ? screen.getDisplayMatching(tray)
        : screen.getDisplayMatching(this.options.parent.getBounds());
    return { work: display.workArea, tray };
  }
  private viewport() {
    const { work, tray } = this.display();
    const bounds = desktopNotificationBounds(work, tray, 600);
    return { width: bounds.width, maxHeight: bounds.height };
  }
  private async query() {
    if (
      this.disposed ||
      this.querying ||
      this.warned ||
      !this.options.service.targetItems('desktop').length
    )
      return;
    this.querying = true;
    try {
      this.accepts = await this.state.accepts();
    } catch {
      this.accepts = false;
      if (!this.warned) {
        this.warned = true;
        this.options.failed(
          'デスクトップ通知の表示可否を確認できません。通知センターから確認できます。',
        );
      }
    } finally {
      this.querying = false;
      this.refresh();
    }
  }
  refresh() {
    if (this.disposed) return;
    if (!this.options.ready() || !this.options.service.targetItems('desktop').length) {
      clearInterval(this.timer);
      this.timer = undefined;
      this.host?.dispose();
      this.host = undefined;
      this.window?.destroy();
      this.window = undefined;
      this.state.close();
      this.accepts = false;
      return;
    }
    if (!this.timer) {
      this.timer = setInterval(() => void this.query(), 1000);
      this.timer.unref();
      void this.query();
    }
    if (!this.window) {
      const window = new BrowserWindow({
        title: 'AppDock デスクトップ通知',
        width: 440,
        height: 114,
        show: false,
        frame: false,
        transparent: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      this.window = window;
      window.setMenu(null);
      this.host = new NotificationSurfaceHost({
        window,
        preload: this.options.preload,
        controller: new NotificationSurfaceController(
          this.options.service,
          this.options.dark,
          'desktop',
        ),
        failures: this.failures,
        providers: this.options.providers,
        selected: this.options.selected,
        ready: this.options.ready,
        settings: this.options.settings,
        execute: this.options.execute,
        layer: () => {},
        failed: (message) => this.options.failed(message),
        openCenter: this.options.openCenter,
        focusHost: () => window.blur(),
        visible: () => !this.locked && this.accepts && !this.options.parent.isFullScreen(),
        viewport: () => this.viewport(),
        arrange: (view, height, visible) => {
          if (!visible) {
            window.hide();
            return;
          }
          const { work, tray } = this.display();
          const bounds = desktopNotificationBounds(work, tray, height);
          if (JSON.stringify(window.getBounds()) !== JSON.stringify(bounds))
            window.setBounds(bounds, false);
          view?.webContents.setZoomFactor(1);
          view?.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
          if (!window.isVisible()) window.showInactive();
        },
      });
    }
    this.host?.refresh();
  }
  retry() {
    this.failures.clear();
    this.warned = false;
    this.host?.retry();
    void this.query();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    clearInterval(this.timer);
    this.host?.dispose();
    this.window?.destroy();
    this.state.close();
    screen.removeListener('display-added', this.refreshDisplay);
    screen.removeListener('display-removed', this.refreshDisplay);
    screen.removeListener('display-metrics-changed', this.refreshDisplay);
    powerMonitor.removeListener('lock-screen', this.lock);
    powerMonitor.removeListener('unlock-screen', this.unlock);
    powerMonitor.removeListener('suspend', this.lock);
    powerMonitor.removeListener('resume', this.unlock);
    this.options.parent.removeListener('enter-full-screen', this.refreshDisplay);
    this.options.parent.removeListener('leave-full-screen', this.refreshDisplay);
  }
}

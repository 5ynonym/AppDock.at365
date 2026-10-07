import { BrowserWindow, screen, ipcMain, powerMonitor } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { JsonLinePeer } from './rpc';
import type { SettingsStore } from './settings';
import {
  selectWidgetDisplay,
  widgetBounds,
  type WidgetDisplay,
  type WidgetSnapshot,
} from '../../shared/widgets';

type Plane = { window: BrowserWindow; signature: string; attached: boolean };
export function widgetDisplays(): WidgetDisplay[] {
  const primary = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d) => ({
    id: String(d.id),
    label: `${d.label || '画面 ' + d.id} · ${d.bounds.width}×${d.bounds.height}${d.id === primary ? '（メイン）' : ''}`,
    primary: d.id === primary,
    bounds: d.bounds,
  }));
}
export class DesktopWidgets {
  private planes = new Map<string, Plane>();
  private editor?: {
    window: BrowserWindow;
    widget: WidgetSnapshot;
    revision: number;
    timer: ReturnType<typeof setTimeout>;
  };
  private queue = Promise.resolve();
  private child?: ChildProcessWithoutNullStreams;
  private peer?: JsonLinePeer;
  private closed = false;
  private refreshTimer?: ReturnType<typeof setInterval>;
  errors: string[] = [];
  constructor(
    private settings: SettingsStore,
    private catalog: () => WidgetSnapshot[],
    private nativeHost: string,
    private changed: () => void,
  ) {
    const refresh = () => this.sync();
    screen.on('display-added', refresh);
    screen.on('display-removed', refresh);
    screen.on('display-metrics-changed', refresh);
    powerMonitor.on('resume', refresh);
    ipcMain.handle('widget:finishMove', (event, save) => {
      if (!this.editor || !this.authorized(event, this.editor.window) || typeof save !== 'boolean')
        throw new Error('移動中のウィジェットではありません。');
      return this.finishMove(save);
    });
    this.cleanup = () => {
      screen.removeListener('display-added', refresh);
      screen.removeListener('display-removed', refresh);
      screen.removeListener('display-metrics-changed', refresh);
      powerMonitor.removeListener('resume', refresh);
      ipcMain.removeHandler('widget:finishMove');
      ipcMain.removeHandler('widget:snapshot');
    };
    ipcMain.handle('widget:snapshot', (event) => {
      const plane = [...this.planes.values()].find((p) => this.authorized(event, p.window));
      if (!plane && !(this.editor && this.authorized(event, this.editor.window)))
        throw new Error('許可されていないウィジェット画面です。');
      const win = plane?.window ?? this.editor!.window;
      const bounds = win.getBounds();
      const widgets = plane ? this.planeWidgets(win) : [this.editor!.widget];
      return { widgets, displays: widgetDisplays(), bounds, editing: !plane };
    });
  }
  private cleanup: () => void;
  private authorized(event: IpcMainInvokeEvent, win: BrowserWindow) {
    return (
      !win.isDestroyed() &&
      event.sender === win.webContents &&
      event.senderFrame === win.webContents.mainFrame &&
      event.senderFrame?.url === 'appdock://host/index.html?surface=widget'
    );
  }
  private planeWidgets(win: BrowserWindow) {
    const key = [...this.planes].find(([, p]) => p.window === win)?.[0];
    return this.catalog().filter((w) => {
      const d = selectWidgetDisplay(widgetDisplays(), w.placement.monitor);
      return (
        w.available &&
        w.placement.desktop &&
        w.id !== this.editor?.widget.id &&
        key === `${d.id}:${w.placement.layer}`
      );
    });
  }
  private createWindow(bounds: Electron.Rectangle, editing = false) {
    const win = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      show: false,
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      focusable: editing,
      title: editing ? 'AppDock — ウィジェットを移動' : 'AppDock — ウィジェット',
      webPreferences: {
        preload: path.join(__dirname, '../widget-preload.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false,
      },
    });
    win.setMenu(null);
    win.setIgnoreMouseEvents(!editing);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.webContents.on('render-process-gone', () => {
      win.destroy();
      this.sync();
    });
    return win;
  }
  sync() {
    this.queue = this.queue.catch(() => {}).then(() => this.reconcile());
    return this.queue;
  }
  private async reconcile() {
    if (this.closed) return;
    const displays = widgetDisplays();
    const groups = new Map<string, { display: WidgetDisplay; widgets: WidgetSnapshot[] }>();
    for (const w of this.catalog().filter((w) => w.available && w.placement.desktop)) {
      const d = selectWidgetDisplay(displays, w.placement.monitor);
      const key = `${d.id}:${w.placement.layer}`;
      const group = groups.get(key) ?? { display: d, widgets: [] };
      group.widgets.push(w);
      groups.set(key, group);
    }
    if (
      this.editor &&
      !this.catalog().some(
        (w) => w.id === this.editor?.widget.id && w.available && w.placement.desktop,
      )
    )
      await this.finishMove(false);
    for (const [key, plane] of this.planes)
      if (!groups.has(key) || plane.window.isDestroyed()) {
        if (!plane.window.isDestroyed()) plane.window.destroy();
        this.planes.delete(key);
      }
    const errors: string[] = [];
    for (const [key, group] of groups) {
      try {
        let plane = this.planes.get(key);
        if (!plane) {
          plane = {
            window: this.createWindow(group.display.bounds),
            signature: '',
            attached: false,
          };
          this.planes.set(key, plane);
          plane.window.on('closed', () => {
            if (!this.closed) this.sync();
          });
          await plane.window.loadURL('appdock://host/index.html?surface=widget');
        }
        if (this.closed || plane.window.isDestroyed()) continue;
        const desktop = key.endsWith(':desktop');
        const signature = JSON.stringify([group, this.editor?.widget.id]);
        if (!desktop && signature !== plane.signature) plane.window.setBounds(group.display.bounds);
        plane.window.setAlwaysOnTop(!desktop, 'screen-saver');
        if (desktop) {
          // Revalidate the shell parent after Explorer restart, resume and DPI changes.
          await this.attach(plane.window, group.display.bounds);
          if (!plane.attached || !plane.window.isVisible()) {
            // SWP_SHOWWINDOW alone does not start Chromium's compositor for a hidden window.
            plane.window.showInactive();
            await this.attach(plane.window, group.display.bounds);
          }
          plane.attached = true;
        }
        if (signature !== plane.signature) {
          plane.signature = signature;
          plane.window.webContents.send('widget:changed');
        }
        if (!desktop) plane.window.showInactive();
      } catch (e) {
        errors.push(`${group.display.label}: ${e instanceof Error ? e.message : String(e)}`);
        const plane = this.planes.get(key);
        if (plane && !plane.window.isDestroyed()) plane.window.hide();
      }
    }
    const needsShell = [...groups.keys()].some((k) => k.endsWith(':desktop'));
    if (needsShell && !this.refreshTimer) this.refreshTimer = setInterval(() => this.sync(), 5000);
    if (!needsShell) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
      this.stopBridge();
    }
    if (JSON.stringify(errors) !== JSON.stringify(this.errors)) {
      this.errors = errors;
      this.changed();
    }
  }
  private async attach(win: BrowserWindow, bounds: Electron.Rectangle) {
    if (process.platform !== 'win32')
      throw new Error('デスクトップへの固定はWindowsで利用できます。');
    if (!this.peer || this.peer.closed) {
      const child = spawn(this.nativeHost, ['--widget-shell', String(process.pid)], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const peer = new JsonLinePeer(
        child.stdout,
        child.stdin,
        async () => {
          throw new Error('Unsupported shell callback');
        },
        3000,
      );
      this.child = child;
      this.peer = peer;
      child.stderr.resume();
      child.on('error', () => peer.close());
      child.on('exit', () => peer.close());
      peer.on('protocolError', () => peer.close());
      peer.on('closed', () => child.kill());
    }
    const handle = win.getNativeWindowHandle();
    const physical = screen.dipToScreenRect(null, bounds);
    const result = await this.peer.request('widgets.attach', {
      handle: handle.readBigUInt64LE().toString(),
      ...physical,
    });
    if (!result?.attached) throw new Error('デスクトップへの固定を確認できませんでした。');
  }
  async move(id: string) {
    if (this.closed) throw new Error('AppDockは終了中です。');
    const widget = this.catalog().find((w) => w.id === id && w.available && w.placement.desktop);
    if (!widget) throw new Error('デスクトップ表示中のウィジェットを選んでください。');
    await this.finishMove(false);
    const display = selectWidgetDisplay(widgetDisplays(), widget.placement.monitor);
    const bounds = widgetBounds(widget.placement, display.bounds);
    const win = this.createWindow(bounds, true);
    win.setAlwaysOnTop(true, 'screen-saver');
    this.editor = {
      window: win,
      widget,
      revision: this.settings.revision,
      timer: setTimeout(() => void this.finishMove(false), 120000),
    };
    win.on('closed', () => {
      if (this.editor?.window === win) {
        clearTimeout(this.editor.timer);
        this.editor = undefined;
        this.sync();
      }
    });
    await this.sync();
    try {
      await win.loadURL('appdock://host/index.html?surface=widget');
      win.show();
    } catch (e) {
      await this.finishMove(false);
      throw e;
    }
  }
  async finishMove(save: boolean) {
    const editor = this.editor;
    if (!editor) return;
    if (save) {
      const bounds = editor.window.getBounds();
      const display = screen.getDisplayMatching(bounds);
      // A stale settings revision preserves independent user edits instead of replacing them.
      this.settings.save(
        {
          ...this.settings.value,
          widgets: {
            ...this.settings.value.widgets,
            [editor.widget.id]: {
              ...editor.widget.placement,
              position: 'free',
              monitor: String(display.id),
              x: bounds.x - display.bounds.x,
              y: bounds.y - display.bounds.y,
            },
          },
        },
        editor.revision,
      );
    }
    clearTimeout(editor.timer);
    this.editor = undefined;
    if (!editor.window.isDestroyed()) editor.window.destroy();
    this.sync();
  }
  private stopBridge() {
    const child = this.child;
    this.child = undefined;
    const peer = this.peer;
    this.peer = undefined;
    child?.kill();
    peer?.close();
  }
  async close() {
    this.closed = true;
    this.cleanup();
    clearInterval(this.refreshTimer);
    await this.finishMove(false);
    for (const p of this.planes.values()) if (!p.window.isDestroyed()) p.window.destroy();
    this.planes.clear();
    this.stopBridge();
    await this.queue;
  }
}

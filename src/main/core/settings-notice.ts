import { BrowserWindow, WebContentsView, ipcMain } from 'electron';
import type { SettingsNoticeState } from '../../shared/contracts';

/** Small native overlay: also sits above Applet/Gmail child WebContentsViews. */
export class SettingsNotice {
  private view?: WebContentsView;
  private state: SettingsNoticeState = { visible: false, busy: false, dark: true, message: '' };
  private height = 114;
  private ready = false;
  constructor(
    private window: BrowserWindow,
    private url: string,
    private preload: string,
    private failed: (message: string) => void,
  ) {
    for (const [channel, callback] of [
      ['state', () => this.state],
      [
        'resize',
        (height: unknown) => {
          if (!Number.isSafeInteger(height) || (height as number) < 40 || (height as number) > 240)
            throw Error('通知の高さが不正です。');
          this.height = height as number;
          this.layout();
        },
      ],
      [
        'act',
        (action: unknown) => {
          if (!['save', 'discard', 'edit'].includes(String(action)))
            throw Error('通知の操作が不正です。');
          if (this.state.visible && !this.state.busy)
            this.window.webContents.send('dock:settingsNoticeAction', action);
        },
      ],
    ] as const) {
      ipcMain.handle(`settings-notice:${channel}`, (event, ...args) => {
        if (
          !this.view ||
          event.sender !== this.view.webContents ||
          event.senderFrame !== this.view.webContents.mainFrame ||
          event.senderFrame.url !== this.url
        )
          throw Error('許可されていない画面からの要求です。');
        return (callback as (...args: unknown[]) => unknown)(...args);
      });
    }
    window.on('resize', () => this.layout());
    window.webContents.on('did-start-loading', () =>
      this.update({ ...this.state, visible: false }),
    );
    window.webContents.on('render-process-gone', () =>
      this.update({ ...this.state, visible: false }),
    );
    window.once('closed', () => {
      this.view?.webContents.close();
      for (const channel of ['state', 'resize', 'act'])
        ipcMain.removeHandler(`settings-notice:${channel}`);
    });
  }
  update(state: SettingsNoticeState) {
    if (
      !state ||
      typeof state.visible !== 'boolean' ||
      typeof state.busy !== 'boolean' ||
      typeof state.dark !== 'boolean' ||
      typeof state.message !== 'string' ||
      state.message.length > 2000
    )
      throw Error('通知の状態が不正です。');
    this.state = state;
    if (!this.view && state.visible) {
      this.view = new WebContentsView({
        webPreferences: {
          preload: this.preload,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          spellcheck: false,
        },
      });
      this.view.setBackgroundColor('#00000000');
      this.view.setVisible(false);
      this.view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      this.view.webContents.on('will-navigate', (event) => event.preventDefault());
      this.view.webContents.on('did-finish-load', () => {
        this.ready = true;
        this.view?.webContents.send('settings-notice:changed', this.state);
        this.layout();
      });
      void this.view.webContents.loadURL(this.url).catch((error) => this.failed(String(error)));
    }
    if (this.ready) this.view?.webContents.send('settings-notice:changed', this.state);
    this.layout();
  }
  layout() {
    if (!this.view || this.window.isDestroyed()) return;
    const visible = this.state.visible && this.ready;
    this.view.setVisible(visible);
    if (!visible) return;
    const [width, height] = this.window.getContentSize();
    const cardWidth = Math.min(680, Math.max(1, width - 32));
    this.view.setBounds({
      x: Math.round((width - cardWidth) / 2),
      y: 48,
      width: cardWidth,
      height: Math.min(this.height, Math.max(1, height - 80)),
    });
    // Re-adding an existing child moves it above any newly attached Applet surface.
    this.window.contentView.addChildView(this.view);
  }
}

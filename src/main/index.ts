import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  dialog,
  nativeTheme,
  session,
  shell,
  protocol,
  net,
  screen,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SettingsStore } from './core/settings';
import { WindowStateStore, windowMinimum, restoreWindowBounds } from './core/window-state';
import { ExtensionManager } from './core/extensions';
import { checkUpdate, releasesUrl } from './core/updates';
import { HostLog } from './core/log';
import { createHostApi } from './core/host-api';
import { saveUserSettings } from './core/profile';
import { validateAppletSettings } from '../shared/setting-definitions';
import { parseSettings } from '../shared/settings-schema';
import { hostCommands, shortcutFromEvent } from '../shared/commands';
import { GlobalHotKeyManager, WindowsHotKeyBackend } from './core/global-hotkeys';
import { trayCommandGroups, withoutMissingSamples } from './core/tray-commands';
import { TrayClickDispatcher, readDoubleClickTime } from './core/tray-clicks';
import type { HostSnapshot, Settings } from '../shared/contracts';

protocol.registerSchemesAsPrivileged([
  { scheme: 'appdock', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
const smoke = process.argv.includes('--smoke-test');
const smokeDirectory = process.argv
  .find((a) => a.startsWith('--smoke-dir='))
  ?.slice('--smoke-dir='.length);
const testDirectory = process.argv
  .find((a) => a.startsWith('--test-profile='))
  ?.slice('--test-profile='.length);
const baseDirectory = testDirectory
  ? path.resolve(testDirectory)
  : smoke && smokeDirectory
    ? path.resolve(smokeDirectory)
    : app.isPackaged
      ? process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'))
      : app.getAppPath();
const dataDirectory = path.join(baseDirectory, '.appdock');
fs.mkdirSync(dataDirectory, { recursive: true });
app.setPath('userData', path.join(dataDirectory, 'chromium'));
app.setAppUserModelId('at365.appdock');
const locked = app.requestSingleInstanceLock({ baseDirectory });
const settings = new SettingsStore(path.join(baseDirectory, 'settings.json'));
let settingsLoadError: Error | undefined;
if (locked) {
  try {
    settings.load();
    // Electron requires this before app.ready and before the renderer/GPU starts.
    if (!settings.value.host.hardwareAcceleration) app.disableHardwareAcceleration();
  } catch (error) {
    settingsLoadError = error instanceof Error ? error : new Error(String(error));
  }
}
let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayClicks: TrayClickDispatcher | undefined;
let manager: ExtensionManager;
let log: HostLog;
let hotKeys: GlobalHotKeyManager | undefined;
let shortcutRecording = false;
let windowState: WindowStateStore | undefined;
let restoreMaximized = false;
let quitting = false;
let shutdownFinished = false;
let shutdownStarted = false;
let notifyTimer: ReturnType<typeof setTimeout> | undefined;
const changed = () => {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = undefined;
    if (window && !window.isDestroyed()) window.webContents.send('dock:changed');
  }, 60);
};
function showWindow() {
  if (window) {
    if (restoreMaximized) {
      restoreMaximized = false;
      window.maximize();
    }
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }
}
function trayMenu() {
  if (!tray || !manager) return;
  const groups = trayCommandGroups(settings.value, manager.snapshot());
  const appletGroups = groups.filter((group) => group.extensionId !== null);
  const builtins = groups.find((group) => group.extensionId === null)?.commands ?? [];
  const menu = Menu.buildFromTemplate([
    ...appletGroups.map((group) => ({
      label: group.title,
      submenu: group.commands.map((command) => ({
        label: command.title,
        enabled: command.enabled,
        click: () => runTrayCommand(command.id),
      })),
    })),
    ...(appletGroups.length ? [{ type: 'separator' as const }] : []),
    ...builtins.map((command) => ({
      label: command.title,
      enabled: command.enabled,
      click: () => runTrayCommand(command.id),
    })),
    ...(builtins.length ? [{ type: 'separator' as const }] : []),
    { label: '設定…', click: () => runTrayCommand('appdock.settings.open') },
    { label: '終了', click: () => runTrayCommand('appdock.quit') },
  ]);
  menu.on('menu-will-show', () => trayClicks?.cancel());
  tray.setContextMenu(menu);
}
function quitHost(restart = false) {
  if (quitting) return;
  if (restart) {
    const portableExecutable = app.isPackaged && process.env.PORTABLE_EXECUTABLE_FILE;
    if (portableExecutable) {
      // The portable launcher removes the extracted app directory on exit.
      process.chdir(path.dirname(portableExecutable));
      app.relaunch({ execPath: portableExecutable, args: process.argv.slice(1) });
    } else {
      app.relaunch();
    }
  }
  quitting = true;
  app.quit();
}
async function executeCommand(id: string) {
  if (quitting) return;
  if (id === 'appdock.restart' || id === 'appdock.quit') {
    quitHost(id === 'appdock.restart');
    return;
  }
  if (hostCommands.some((command) => command.id === id)) {
    showWindow();
    if (id !== 'appdock.open') window?.webContents.send('dock:hostCommand', id);
    return;
  }
  return manager.execute(id);
}
function runTrayCommand(id: string) {
  void executeCommand(id).catch((error) => {
    log.write('error', 'tray', `${id}: ${String(error)}`);
    // Keep settings reachable when the selected Applet is no longer available.
    showWindow();
  });
}
function snapshot(): HostSnapshot {
  return {
    globalHotKeys: hotKeys?.statuses ?? [],
    settings: settings.snapshot(),
    extensions: manager.snapshot(),
    logs: log.entries,
    version: app.getVersion(),
    dataDirectory,
    dark: nativeTheme.shouldUseDarkColors,
    avatarUrl:
      settings.value.profile.avatar && fs.existsSync(path.join(baseDirectory, 'avatar.png'))
        ? `appdock://host/avatar.png?v=${fs.statSync(path.join(baseDirectory, 'avatar.png')).mtimeMs}`
        : null,
  };
}
function applySettings() {
  trayClicks?.cancel();
  nativeTheme.themeSource = settings.value.host.theme;
  trayMenu();
  changed();
}
function syncHotKeys(retry = false) {
  if (quitting || !hotKeys) return Promise.resolve();
  const available = [
    ...hostCommands.map((command) => command.id),
    ...manager
      .snapshot()
      .flatMap((extension) =>
        extension.commands.filter((command) => command.available).map((command) => command.id),
      ),
  ];
  return hotKeys.sync(settings.value, available, shortcutRecording, retry);
}
function registerIpc() {
  const updateTarget = (id?: string) => {
    if (id === undefined) return { version: app.getVersion(), repository: '5ynonym/AppDock.at365' };
    if (typeof id !== 'string' || !manager.items.has(id))
      throw new Error('Appletが見つかりません。');
    const manifest = manager.items.get(id)!.manifest;
    return { version: manifest.version, repository: manifest.updateRepository };
  };
  const handle = (channel: string, callback: (...args: any[]) => unknown) =>
    ipcMain.handle(channel, (event, ...args) => {
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame?.url !== 'appdock://host/index.html'
      )
        throw new Error('許可されていない画面からの要求です。');
      return callback(...args);
    });
  handle('dock:snapshot', snapshot);
  handle('dock:chooseDirectory', async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: '画像ソースフォルダーを選ぶ',
      properties: ['openDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  handle('dock:checkUpdates', (id?: string) => {
    const target = updateTarget(id);
    return checkUpdate(target.version, target.repository, net.fetch);
  });
  handle('dock:openReleases', (id?: string) => {
    const target = updateTarget(id);
    if (!target.repository) throw new Error('更新確認先が設定されていません。');
    return shell.openExternal(releasesUrl(target.repository));
  });
  handle('dock:startExtensionNow', (id: string) => {
    if (manager.items.get(id)?.state !== 'waiting')
      throw new Error('開始待ちのAppletが見つかりません。');
    return manager.restart(id, true);
  });
  handle('dock:retryGlobalHotKeys', () => syncHotKeys(true));
  handle('dock:setShortcutRecording', async (recording: boolean) => {
    if (typeof recording !== 'boolean') throw new Error('キー入力状態が正しくありません。');
    shortcutRecording = recording && !!window?.isFocused();
    await syncHotKeys();
  });
  handle('dock:saveSettings', (value: Settings, revision: number, avatar?: Uint8Array | null) => {
    const next = parseSettings(value);
    validateAppletSettings(next, manager.snapshot());
    return saveUserSettings(settings, baseDirectory, next, revision, avatar);
  });
  handle('dock:setPinnedCommands', (ids: string[]) =>
    settings.save({ ...settings.value, pinnedCommands: ids }, settings.revision),
  );
  handle('dock:toggleExtension', async (id: string, enabled: boolean) => {
    if (!manager.items.has(id) || typeof enabled !== 'boolean')
      throw new Error('拡張が見つかりません。');
    settings.updateExtension(id, { enabled });
    await manager.reconcile();
  });
  handle('dock:restartExtension', (id: string) => manager.restart(id));
  handle('dock:executeCommand', (id: string) => executeCommand(id));
  handle('dock:executePanelAction', (id: string, actionId: string) =>
    manager.executePanelAction(id, actionId),
  );
  handle('dock:openPath', async (kind: string) => {
    const target = (
      {
        settings: settings.file,
        extensions: path.join(baseDirectory, 'extensions'),
        logs: log.directory,
      } as Record<string, string>
    )[kind];
    if (!target) throw new Error('保存先が見つかりません。');
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
  });
  handle('dock:windowAction', (action: string) => {
    switch (action) {
      case 'minimize':
        window?.minimize();
        break;
      case 'maximize':
        window?.isMaximized() ? window.unmaximize() : window?.maximize();
        break;
      case 'close':
        window?.close();
        break;
      case 'quit':
        quitHost();
        break;
      default:
        throw new Error('未対応のウィンドウ操作です。');
    }
  });
}
async function initialize() {
  if (settingsLoadError) {
    dialog.showErrorBox(
      'AppDock — 設定を読み込めません',
      `${settingsLoadError.message}\n\n${settings.file}\n元のファイルは保持しています。JSONを修正して起動し直してください。`,
    );
    app.quit();
    return;
  }
  log = new HostLog(path.join(dataDirectory, 'logs'), changed);
  const external = path.join(baseDirectory, 'extensions');
  fs.mkdirSync(external, { recursive: true });
  manager = new ExtensionManager({
    hostVersion: app.getVersion(),
    roots: [external],
    settings,
    nodeExecutable: process.execPath,
    nodeWorker: path.join(__dirname, 'node-worker.js'),
    dotnetHost: app.isPackaged
      ? path.join(process.resourcesPath, 'dotnet-host')
      : path.join(app.getAppPath(), 'artifacts', 'dotnet-host'),
    api: createHostApi(settings, dataDirectory, log.write, changed, () => manager.emit('changed')),
    log: log.write,
  });
  const hotKeyHost = app.isPackaged
    ? path.join(process.resourcesPath, 'dotnet-host', 'AppDock.ExtensionHost.exe')
    : path.join(app.getAppPath(), 'artifacts', 'dotnet-host', 'AppDock.ExtensionHost.exe');
  hotKeys = new GlobalHotKeyManager(
    new WindowsHotKeyBackend(
      hotKeyHost,
      (shortcut) => {
        void hotKeys?.pressed(shortcut);
      },
      (error) => hotKeys?.failed(error),
    ),
    async (id) => {
      if (shortcutRecording || quitting) return;
      await executeCommand(id);
    },
    changed,
    (message) => log.write('error', 'hotkeys', message),
  );
  manager.on('changed', () => {
    trayMenu();
    void syncHotKeys();
    changed();
  });
  settings.on('changed', () => {
    applySettings();
    void syncHotKeys(true);
    void manager.reconcile();
  });
  settings.watch((e) =>
    log.write(
      'error',
      'settings',
      `設定ファイルを読み込めません。最後の有効な設定を継続します。${e.message}`,
    ),
  );
  applySettings();
  nativeTheme.on('updated', changed);
  const renderer = path.resolve(__dirname, '../../renderer');
  protocol.handle('appdock', (request) => {
    const url = new URL(request.url);
    if (url.host === 'host' && url.pathname.startsWith('/panel-images/')) {
      const image = [...manager.items.values()]
        .flatMap((extension) => extension.panel?.images ?? [])
        .find((item) => item.image === url.href);
      if (!image?.imageFile || !fs.existsSync(image.imageFile))
        return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(image.imageFile).href).then(
        (response) =>
          new Response(response.body, {
            headers: {
              'Content-Type': /\.png$/i.test(image.imageFile!)
                ? 'image/png'
                : /\.webp$/i.test(image.imageFile!)
                  ? 'image/webp'
                  : 'image/jpeg',
              'Cache-Control': 'no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          }),
      );
    }
    if (url.host === 'host' && url.pathname === '/avatar.png') {
      const file = path.join(baseDirectory, 'avatar.png');
      if (!settings.value.profile.avatar || !fs.existsSync(file))
        return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(file).href);
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(renderer, relative || 'index.html');
    if (
      url.host !== 'host' ||
      path.relative(renderer, file).startsWith('..') ||
      !fs.existsSync(file)
    )
      return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  Menu.setApplicationMenu(null);
  windowState = new WindowStateStore(path.join(dataDirectory, 'window-state.json'), (error) =>
    log.write('error', 'window', `ウィンドウ状態の読み込み・保存に失敗しました: ${String(error)}`),
  );
  const primary = screen.getPrimaryDisplay();
  const displays = [
    primary,
    ...screen.getAllDisplays().filter((display) => display.id !== primary.id),
  ];
  const savedWindow = windowState.load(displays.map((display) => display.workArea));
  restoreMaximized = savedWindow?.maximized ?? false;
  const windowIcon = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(app.getAppPath(), 'assets', 'icon.ico');
  window = new BrowserWindow({
    width: 1280,
    height: 840,
    ...savedWindow?.bounds,
    minWidth: Math.min(windowMinimum.width, savedWindow?.bounds.width ?? windowMinimum.width),
    minHeight: Math.min(windowMinimum.height, savedWindow?.bounds.height ?? windowMinimum.height),
    title: 'AppDock.at365',
    backgroundColor: '#101116',
    show: false,
    frame: false,
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false,
    },
  });
  if (process.platform === 'win32') {
    // Windows Shell needs a real file path, outside app.asar, for the taskbar icon.
    const executable = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe');
    window.setAppDetails({
      appId: 'at365.appdock',
      // A portable app extracts resources temporarily; pinned icons must use its stable EXE.
      appIconPath: process.env.PORTABLE_EXECUTABLE_FILE || windowIcon,
      appIconIndex: 0,
      relaunchCommand: app.isPackaged ? `"${executable}"` : `"${executable}" "${app.getAppPath()}"`,
      relaunchDisplayName: 'AppDock.at365',
    });
  }
  windowState.track(window);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.on('close', (event) => {
    if (!quitting && settings.value.host.closeToTray && tray) {
      event.preventDefault();
      window?.hide();
    } else {
      quitting = true;
      app.quit();
    }
  });
  window.webContents.on('render-process-gone', (_, details) =>
    log.write('error', 'renderer', details.reason),
  );
  const resumeHotKeys = () => {
    shortcutRecording = false;
    void syncHotKeys();
  };
  window.on('blur', resumeHotKeys);
  window.webContents.on('render-process-gone', resumeHotKeys);
  window.webContents.on('did-start-loading', resumeHotKeys);
  window.webContents.on('before-input-event', (event, input) => {
    if (shortcutRecording) return;
    const shortcut = shortcutFromEvent({
      key: input.key,
      code: input.code,
      ctrlKey: input.control,
      altKey: input.alt,
      shiftKey: input.shift,
      metaKey: input.meta,
      isComposing: input.isComposing,
    });
    if (hotKeys?.statuses.some((status) => status.registered && status.shortcut === shortcut))
      event.preventDefault();
  });
  registerIpc();
  const icon = nativeImage.createFromPath(path.join(app.getAppPath(), 'assets', 'icon.png'));
  tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.setToolTip('AppDock.at365');
  trayClicks = new TrayClickDispatcher(
    () => settings.value.host,
    runTrayCommand,
    () =>
      readDoubleClickTime(hotKeyHost).catch((error) => {
        log.write('warn', 'tray', `${String(error)} 最大判定時間の5秒で待機します。`);
        return 5000;
      }),
  );
  tray.on('click', () => trayClicks?.click());
  tray.on('double-click', () => trayClicks?.doubleClick());
  trayMenu();
  await window.loadURL('appdock://host/index.html');
  // Reapply after native initialization, which can adjust frameless bounds for DPI.
  if (savedWindow) restoreWindowBounds(window, savedWindow.bounds);
  manager.discover();
  const migrated = withoutMissingSamples(settings.value, manager.items.keys());
  if (JSON.stringify(migrated) !== JSON.stringify(settings.value))
    settings.save(migrated, settings.revision);
  await manager.reconcile();
  await syncHotKeys();
  log.write('info', 'host', 'AppDockを起動しました。');
  if (smoke) await runSmoke();
  else if (!settings.value.host.startMinimized) showWindow();
}
async function runSmoke() {
  try {
    const title = await window!.webContents.executeJavaScript('document.title');
    if (title !== 'AppDock.at365') throw new Error('Renderer did not load');
    const expectedApplets = process.argv.includes('--smoke-clock') ? ['at365.watch'] : [];
    if (manager.snapshot().some((e) => !expectedApplets.includes(e.id)))
      throw new Error('Unexpected applet in a clean smoke profile');
    let nativeClock:
      { state: string; commands: number; trayItems: number; visibleSaved: boolean } | undefined;
    if (process.argv.includes('--smoke-clock')) {
      const clock = manager.snapshot().find((e) => e.id === 'at365.watch');
      if (clock?.state !== 'running' || clock.commands.length !== 3 || clock.tray.length)
        throw new Error(clock?.error || 'Native clock did not activate');
      await manager.execute('at365.watch.show');
      await manager.execute('at365.watch.hide');
      await manager.reconcile();
      if (settings.value.extensions['at365.watch']?.settings.visible !== false)
        throw new Error('Native clock visibility was not persisted');
      nativeClock = {
        state: clock.state,
        commands: clock.commands.length,
        trayItems: clock.tray.length,
        visibleSaved: true,
      };
    }
    await new Promise((r) => setTimeout(r, 400));
    tray!.emit('click');
    if (!window!.isVisible()) throw new Error('Default tray click did not open AppDock');
    settings.save(
      {
        ...settings.value,
        host: { ...settings.value.host, trayClickCommand: 'appdock.settings.open' },
      },
      settings.revision,
    );
    tray!.emit('click');
    await new Promise((r) => setTimeout(r, 250));
    if (
      !(await window!.webContents.executeJavaScript(
        `Array.from(document.querySelectorAll('h1,h2')).some(element => element.textContent === '設定')`,
      ))
    )
      throw new Error('Selected tray click did not open settings');
    settings.save(
      {
        ...settings.value,
        host: { ...settings.value.host, trayClickCommand: 'appdock.commands.search' },
      },
      settings.revision,
    );
    tray!.emit('click');
    await new Promise((r) => setTimeout(r, 150));
    if (
      !(await window!.webContents.executeJavaScript(`!!document.querySelector('.command-palette')`))
    )
      throw new Error('Selected tray click did not open command palette');
    window!.hide();
    settings.save(
      { ...settings.value, host: { ...settings.value.host, trayClickCommand: 'missing.command' } },
      settings.revision,
    );
    tray!.emit('click');
    await new Promise((r) => setTimeout(r, 150));
    if (
      !window!.isVisible() ||
      !log.entries.some(
        (entry) => entry.source === 'tray' && entry.message.includes('missing.command'),
      )
    )
      throw new Error('Unavailable tray command did not report error and restore settings access');
    settings.save(
      { ...settings.value, host: { ...settings.value.host, trayClickCommand: 'appdock.open' } },
      settings.revision,
    );
    const avatarBytes = nativeImage
      .createFromPath(path.join(app.getAppPath(), 'assets', 'icon.png'))
      .resize({ width: 64, height: 64 })
      .toPNG();
    const result = await window!.webContents.executeJavaScript(`(async () => {
      const s = await window.dock.snapshot();
      await window.dock.saveSettings({...s.settings.value, host: {...s.settings.value.host, theme: 'light'}}, s.settings.revision);
      const avatar = new Uint8Array(${JSON.stringify([...avatarBytes])});
      const current = await window.dock.snapshot();
      await window.dock.saveSettings({...current.settings.value, profile: {name: 'Portable test', avatar: 'avatar.png'}}, current.settings.revision, avatar);
      await window.dock.setPinnedCommands(['appdock.commands.search', 'appdock.settings.open']);
      const saved = await window.dock.snapshot();
      const image = new Image();
      const avatarLoaded = await new Promise(resolve => {
        image.onload = () => resolve(image.naturalWidth > 0);
        image.onerror = () => resolve(false);
        image.src = saved.avatarUrl;
      });
      return {bridge: !!window.dock, nodeExposed: typeof window.require !== 'undefined', rows: document.querySelectorAll('button').length,
        profile: saved.settings.value.profile, pins: saved.settings.value.pinnedCommands,
        paletteKeys: saved.settings.value.shortcuts['appdock.commands.search'], avatarLoaded};
    })()`);
    if (result.nodeExposed || !result.bridge || result.rows < 5)
      throw new Error('Preload / React check failed');
    if (
      !result.avatarLoaded ||
      result.profile.avatar !== 'avatar.png' ||
      result.paletteKeys[0] !== 'Ctrl+P' ||
      result.pins.length !== 2
    )
      throw new Error('Portable preferences / avatar check failed');
    await new Promise((r) => setTimeout(r, 250));
    fs.mkdirSync(path.join(baseDirectory, 'screenshots'), { recursive: true });
    fs.writeFileSync(
      path.join(baseDirectory, 'screenshots', 'light.png'),
      (await window!.webContents.capturePage()).toPNG(),
    );
    settings.save(
      { ...settings.value, host: { ...settings.value.host, theme: 'dark' } },
      settings.revision,
    );
    await new Promise((r) => setTimeout(r, 250));
    fs.writeFileSync(
      path.join(baseDirectory, 'screenshots', 'dark.png'),
      (await window!.webContents.capturePage()).toPNG(),
    );
    fs.writeFileSync(
      path.join(baseDirectory, 'smoke-result.json'),
      JSON.stringify(
        {
          ok: true,
          result,
          extensions: manager
            .snapshot()
            .map((e) => ({ id: e.id, state: e.state, panel: !!e.panel })),
          settingsPath: settings.file,
          avatarPath: path.join(baseDirectory, 'avatar.png'),
          nativeClock,
          trayCommands: {
            defaultOpen: true,
            selectedHostCommands: true,
            unavailableFallback: true,
          },
        },
        null,
        2,
      ),
    );
  } catch (e) {
    fs.writeFileSync(
      path.join(baseDirectory, 'smoke-result.json'),
      JSON.stringify({ ok: false, error: e instanceof Error ? e.stack : String(e) }),
    );
    process.exitCode = 1;
  }
  quitting = true;
  app.quit();
}
app.on('second-instance', () => showWindow());
app.on('before-quit', (event) => {
  quitting = true;
  trayClicks?.close();
  windowState?.flush();
  if (shutdownFinished || !manager) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;
  void (async () => {
    await hotKeys?.close();
    await manager.shutdown();
  })().finally(() => {
    settings.close();
    tray?.destroy();
    shutdownFinished = true;
    app.quit();
  });
});
app.on('window-all-closed', () => {
  if (!tray || quitting) app.quit();
});
if (!locked) app.quit();
else
  void app
    .whenReady()
    .then(initialize)
    .catch((e) => {
      dialog.showErrorBox('AppDock', String(e));
      quitting = true;
      app.quit();
    });

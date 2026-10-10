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
  safeStorage,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { SettingsStore } from './core/settings';
import { dataPaths } from './core/data-paths';
import { WindowsLaunch } from './core/windows-launch';
import { WindowStateStore, windowMinimum, restoreWindowBounds } from './core/window-state';
import { ExtensionManager } from './core/extensions';
import { PortableUpdates, type UpdateTarget } from './core/portable-updates';
import { execFileSync } from 'node:child_process';
import { HostLog } from './core/log';
import { createHostApi } from './core/host-api';
import { saveUserSettings } from './core/profile';
import { validateAppletSettings } from '../shared/setting-definitions';
import { parseSettings } from '../shared/settings-schema';
import {
  getKeybindings,
  initializeExtensionDefaults,
  initializeWebAppletDefaults,
  resolveKeybindings,
} from '../shared/keybindings';
import { ShortcutDispatcher } from './core/shortcut-dispatcher';
import { GestureManager, type GestureInvocation } from './core/gestures';
import { initializeGestureDefaults } from '../shared/gestures';
import { normalizeShortcut } from '../shared/commands';
import { hostCommands, shortcutFromEvent } from '../shared/commands';
import { GlobalHotKeyManager, WindowsHotKeyBackend } from './core/global-hotkeys';
import { trayCommandGroups, withoutMissingSamples } from './core/tray-commands';
import {
  getTrayMenu,
  resolveTrayMenu,
  trayCommandCatalog,
  gesturePauseCommand,
  type ResolvedTrayItem,
} from '../shared/tray-menu';
import {
  DEFAULT_DOUBLE_CLICK_TIME_MS,
  TrayClickDispatcher,
  readDoubleClickTime,
} from './core/tray-clicks';
import type { HostSnapshot, Settings } from '../shared/contracts';
import { configureWindowRendering } from './core/window-rendering';
import { trayIdentity } from './core/tray-identity';
import {
  configureNotifications,
  showNotification,
  activateNotification,
} from './core/notifications';
import {
  activeShortcutApplet,
  configurePageHost,
  updatePageViewport,
  refreshPageDisplays,
  localPageSource,
} from './core/applet-pages';
import { pageDisplay, pageKey } from '../shared/applet-pages';
import { WebAppletManager, discoverWebDefaults } from './core/web-applets';
import { SettingsNotice } from './core/settings-notice';
import { webId } from '../shared/web-applets';
import { AutomationService } from './core/automation';
import { AutomationApi } from './core/automation-api';
import { automationApplets, automationCommands } from './core/automation-commands';
import type { AutomationAction } from '../shared/automation';

configureWindowRendering(app);

protocol.registerSchemesAsPrivileged([
  { scheme: 'appdock', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
const restoreView = process.argv.includes('--restore-view');
const hostDocumentUrl = `appdock://host/index.html${restoreView ? '?restoreView=1' : ''}`;
let startupReady = false;
let pendingNotificationArgs: string[] | undefined;
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
const isolatedLocal = process.argv
  .find((a) => a.startsWith('--test-local-state='))
  ?.slice('--test-local-state='.length);
const paths = dataPaths(
  baseDirectory,
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  testDirectory || smoke ? isolatedLocal || path.join(baseDirectory, 'data') : undefined,
);
const dataDirectory = paths.local;
const sharedDirectory = paths.shared;
fs.mkdirSync(dataDirectory, { recursive: true });
app.setPath('userData', path.join(dataDirectory, 'chromium'));
app.setAppUserModelId('at365.appdock');
const locked = app.requestSingleInstanceLock({ baseDirectory });
if (locked)
  configureNotifications(
    app.isPackaged
      ? process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')
      : app.getPath('exe'),
    baseDirectory,
    [
      ...(app.isPackaged ? [] : [app.getAppPath()]),
      ...(testDirectory ? [`--test-profile=${baseDirectory}`] : []),
      ...(smoke && smokeDirectory ? ['--smoke-test', `--smoke-dir=${baseDirectory}`] : []),
    ],
  );
const settings = new SettingsStore(
  path.join(baseDirectory, 'settings.json'),
  path.join(dataDirectory, 'settings-backups'),
);
const launch = new WindowsLaunch(
  app.isPackaged ? process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe') : '',
  baseDirectory,
  testDirectory ? [`--test-profile=${baseDirectory}`] : [],
);
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
let settingsNotice: SettingsNotice | undefined;
let tray: Tray | null = null;
let trayClicks: TrayClickDispatcher | undefined;
let manager: ExtensionManager;
let webApplets: WebAppletManager;
const allApplets = () => [...manager.snapshot(), ...(webApplets?.snapshot() ?? [])];
let log: HostLog;
let hotKeys: GlobalHotKeyManager | undefined;
let gestures: GestureManager | undefined;
let shortcutRecording = false;
let windowState: WindowStateStore | undefined;
let restoreMaximized = false;
let quitting = false;
let shutdownFinished = false;
let shutdownStarted = false;
let notifyTimer: ReturnType<typeof setTimeout> | undefined;
let avatarPoll: ReturnType<typeof setInterval> | undefined;
let updater: PortableUpdates;
let startupUpdateTimer: ReturnType<typeof setTimeout> | undefined;
let automation: AutomationService | undefined;
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
  const attention = [...manager.items.values()].some((e) => e.state === 'running' && e.attention);
  const icon = nativeImage
    .createFromPath(path.join(app.getAppPath(), 'assets', 'icon.png'))
    .resize({ width: 20, height: 20 });
  if (attention) {
    const pixels = icon.toBitmap();
    for (let y = 0; y < 8; y++)
      for (let x = 12; x < 20; x++) {
        const offset = (y * 20 + x) * 4;
        pixels[offset] = 70;
        pixels[offset + 1] = 170;
        pixels[offset + 2] = 255;
        pixels[offset + 3] = 255;
      }
    tray.setImage(nativeImage.createFromBitmap(pixels, { width: 20, height: 20 }));
  } else tray.setImage(icon);
  tray.setToolTip(attention ? 'AppDock.at365 — 新しい通知があります' : 'AppDock.at365');
  const applets = allApplets();
  const entries = resolveTrayMenu(
    getTrayMenu(settings.value, applets),
    trayCommandCatalog(applets),
  );
  const template = (items: ResolvedTrayItem[]): Electron.MenuItemConstructorOptions[] =>
    items.map((item) =>
      item.type === 'separator'
        ? { type: 'separator' }
        : item.type === 'group'
          ? { label: item.title!.replace(/&/g, '&&'), submenu: template(item.children!) }
          : {
              label: item.title!.replace(/&/g, '&&'),
              enabled: item.enabled,
              ...(item.command === gesturePauseCommand
                ? { type: 'checkbox' as const, checked: gestures?.paused ?? false }
                : {}),
              click: () => runTrayCommand(item.command!),
            },
    );
  const menu = Menu.buildFromTemplate([
    ...template(entries),
    ...(entries.length ? [{ type: 'separator' as const }] : []),
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
      // Relaunch the original EXE; its gate protects extraction and final cleanup.
      process.chdir(path.dirname(portableExecutable));
      app.relaunch({
        execPath: portableExecutable,
        args: [
          ...process.argv.slice(1).filter((arg) => arg !== '--restore-view'),
          '--restore-view',
        ],
      });
    } else {
      app.relaunch({
        args: [
          ...process.argv.slice(1).filter((arg) => arg !== '--restore-view'),
          '--restore-view',
        ],
      });
    }
  }
  quitting = true;
  app.quit();
}
async function executeCommand(id: string, invocation?: GestureInvocation) {
  if (quitting) return;
  if (id === gesturePauseCommand) {
    gestures?.togglePause();
    trayMenu();
    changed();
    return;
  }
  if (id === 'appdock.restart' || id === 'appdock.quit') {
    quitHost(id === 'appdock.restart');
    return;
  }
  if (hostCommands.some((command) => command.id === id)) {
    showWindow();
    if (id !== 'appdock.open') window?.webContents.send('dock:hostCommand', id);
    return;
  }
  const split = id.lastIndexOf('.');
  const web = id.slice(0, split);
  if (webId(web))
    return id.endsWith('.open')
      ? webApplets.open(web)
      : webApplets.navigate(web, id.slice(split + 1));
  return manager.execute(id, invocation);
}
const shortcutDispatcher = new ShortcutDispatcher(
  executeCommand,
  (message) => log.write('error', 'shortcuts', message),
  () => quitting || shortcutRecording,
);
function shortcutContext() {
  const appletId = activeShortcutApplet();
  return { appFocused: !!appletId || !!window?.isFocused(), appletId };
}
function availableShortcutCommands() {
  return [
    ...hostCommands.map((c) => ({ id: c.id, title: c.title, extensionId: null })),
    ...allApplets().flatMap((e) =>
      e.commands
        .filter((c) => c.available)
        .map((c) => ({ id: c.id, title: c.title, extensionId: e.id })),
    ),
  ];
}
function dispatchShortcut(key: string, globalEvent = false) {
  if (shortcutRecording || quitting) return Promise.resolve();
  const commands = resolveKeybindings(
    getKeybindings(settings.value),
    key,
    shortcutContext(),
    availableShortcutCommands(),
    globalEvent,
  );
  return shortcutDispatcher.dispatch(key, commands);
}
function runTrayCommand(id: string) {
  void executeCommand(id).catch((error) => {
    log.write('error', 'tray', `${id}: ${String(error)}`);
    // Keep settings reachable when the selected Applet is no longer available.
    showWindow();
  });
}
function avatarFile(): string | undefined {
  const relative = settings.value.profile.avatar;
  if (!relative) return;
  const file = path.resolve(baseDirectory, relative);
  try {
    if (
      fs.lstatSync(file).isSymbolicLink() ||
      fs.realpathSync(file).toLowerCase() !== file.toLowerCase()
    )
      return;
    return file;
  } catch {
    return;
  }
}
function avatarSignature() {
  const file = avatarFile();
  return file ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : '';
}
function snapshot(): HostSnapshot {
  return {
    launch: launch.state,
    startupReady,
    windowVisible: !!window && !window.isDestroyed() && window.isVisible() && !window.isMinimized(),
    updates: updater?.state ?? { busy: false, phase: '', results: [] },
    globalHotKeys: hotKeys?.statuses ?? [],
    settings: settings.snapshot(),
    extensions: allApplets(),
    webPages: webApplets.states(),
    webAccounts: webApplets.accounts(),
    logs: log.entries,
    version: app.getVersion(),
    runtime: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
    },
    dataDirectory,
    sharedDirectory,
    legacyLocalData:
      dataDirectory !== sharedDirectory &&
      [sharedDirectory, path.join(baseDirectory, '.appdock')].some((directory) =>
        ['chromium', 'web-accounts', 'storage', 'secrets', 'web-applets/sessions'].some((p) =>
          fs.existsSync(path.join(directory, p)),
        ),
      ),
    dark: nativeTheme.shouldUseDarkColors,
    avatarUrl: avatarFile() ? `appdock://host/avatar.png?v=${avatarSignature()}` : null,
  };
}
function applySettings() {
  webApplets?.reconcile();
  trayClicks?.cancel();
  nativeTheme.themeSource = settings.value.host.theme;
  refreshPageDisplays();
  trayMenu();
  changed();
}
function syncHotKeys(retry = false) {
  if (quitting || !hotKeys) return Promise.resolve();
  const available = [
    ...hostCommands.map((command) => command.id),
    ...allApplets().flatMap((extension) =>
      extension.commands.filter((command) => command.available).map((command) => command.id),
    ),
  ];
  return hotKeys.sync(settings.value, available, shortcutRecording, retry);
}
function prepareSettings(value: Settings) {
  let next = parseSettings(value);
  webApplets.validateAccounts(next.webApplets.items);
  validateAppletSettings(next, manager.snapshot());
  return initializeWebAppletDefaults(next, settings.value);
}
function commitSettings(
  value: Settings,
  revision: number,
  avatar?: Uint8Array | null,
  avatarName?: string,
) {
  return saveUserSettings(settings, baseDirectory, value, revision, avatar, avatarName);
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
    ipcMain.handle(channel, async (event, ...args) => {
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        event.senderFrame?.url !== hostDocumentUrl
      )
        throw new Error('許可されていない画面からの要求です。');
      try {
        return await callback(...args);
      } catch (error) {
        // Record the operation and error, never its settings/authentication arguments.
        log.write(
          'error',
          'host',
          `${channel}: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    });
  handle('dock:snapshot', snapshot);
  handle('dock:automation', (action: AutomationAction) => {
    if (!automation || quitting) throw Error('連携機能の準備中です。');
    return automation.action(action);
  });
  handle('dock:settingsNotice', (state) => settingsNotice?.update(state));
  handle('dock:confirmDiscardSettings', async () => {
    const answer = await dialog.showMessageBox(window!, {
      type: 'warning',
      message: '未保存の変更をすべて破棄しますか？',
      detail:
        '設定・ショートカット・Appletの並び順など、すべての未保存変更を破棄して保存済みの状態へ戻します。Webアカウントの即時反映操作は対象外です。',
      buttons: ['キャンセル', 'すべて破棄'],
      defaultId: 0,
      cancelId: 0,
    });
    return answer.response === 1;
  });
  handle('dock:openAppletPage', async (extensionId: string, pageId: string) => {
    if (webId(extensionId) && pageId === 'main') return webApplets.open(extensionId);
    const extension = manager.items.get(extensionId);
    const page = extension?.manifest.pages?.find((page) => page.id === pageId);
    if (!page) throw Error('Appletページがありません。');
    await executeCommand(page.openCommand);
  });
  handle('dock:pageViewport', updatePageViewport);
  handle('dock:webDefaults', discoverWebDefaults);
  handle('dock:webNavigate', (id: string, action: string) => webApplets.navigate(id, action));
  handle('dock:clearWebAccount', (id: string) => webApplets.clearAccount(id));
  handle('dock:createWebAccount', (name: unknown) => webApplets.addAccount(name));
  handle('dock:renameWebAccount', (id: string, name: unknown) =>
    webApplets.renameAccount(id, name),
  );
  handle('dock:deleteWebAccount', (id: string) => webApplets.deleteAccount(id));
  ipcMain.handle('applet-page:snapshot', (event) => localPageSource(event).snapshot());
  ipcMain.handle('applet-page:execute', (event, id: unknown) => localPageSource(event).execute(id));
  handle('dock:chooseDirectory', async () => {
    const result = await dialog.showOpenDialog(window!, {
      title: '画像ソースフォルダーを選ぶ',
      properties: ['openDirectory'],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
  handle('dock:checkUpdates', async (id?: string) => {
    updateTarget(id);
    await updater.check([id ?? 'host']);
    return updater.state.results.find((result) => result.id === (id ?? 'host'))!;
  });
  handle('dock:cancelUpdates', () => updater.cancel());
  handle('dock:checkAllUpdates', () => updater.check());
  handle('dock:installUpdates', (target: string) => {
    if (
      typeof target !== 'string' ||
      (target !== 'all' && target !== 'host' && target !== 'applets' && !manager.items.has(target))
    )
      throw Error('更新対象が正しくありません。');
    return updater.install(target);
  });
  handle('dock:openReleases', (id?: string) => {
    updateTarget(id);
    const result = updater.state.results.find((result) => result.id === (id ?? 'host'));
    if (
      !result?.releaseUrl ||
      !/^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+\/releases$/.test(result.releaseUrl)
    )
      throw new Error('GitHubの更新元を確認してから開いてください。');
    return shell.openExternal(result.releaseUrl);
  });
  handle('dock:startExtensionNow', (id: string) => {
    if (manager.items.get(id)?.state !== 'waiting')
      throw new Error('開始待ちのAppletが見つかりません。');
    return manager.restart(id, true);
  });
  handle('dock:dispatchShortcut', (key: unknown) => {
    if (!window?.isFocused()) return;
    const normalized = normalizeShortcut(key);
    if (hotKeys?.statuses.some((s) => s.registered && s.shortcut === normalized)) return;
    return dispatchShortcut(normalized);
  });
  handle('dock:retryGlobalHotKeys', () => syncHotKeys(true));
  handle('dock:setShortcutRecording', async (recording: boolean) => {
    if (typeof recording !== 'boolean') throw new Error('キー入力状態が正しくありません。');
    shortcutRecording = recording && !!window?.isFocused();
    await syncHotKeys();
  });
  handle('dock:refreshLaunchState', async () => {
    const state = await launch.refresh();
    changed();
    return state;
  });
  handle('dock:restartAsAdministrator', async () => {
    await launch.restartElevated([...launch.args, '--restore-view', '--appdock-elevation-attempt']);
    quitHost();
  });
  handle('dock:restoreSettingsBackup', async (revision: number) => {
    const answer = await dialog.showMessageBox(window!, {
      type: 'warning',
      message: 'このPCの正常な設定で共有ファイルを復元しますか？',
      detail:
        '復元したsettings.jsonは同期先のPCにも届きます。現在の破損ファイルはそのままでは使えません。',
      buttons: ['キャンセル', 'バックアップで復元'],
      defaultId: 0,
      cancelId: 0,
    });
    return answer.response === 1 ? settings.restoreBackup(revision) : null;
  });
  handle(
    'dock:saveSettings',
    async (value: Settings, revision: number, avatar?: Uint8Array | null, avatarName?: string) => {
      const next = prepareSettings(value);
      return launch.save(
        next.host,
        settings.value.host,
        () => settings.assertRevision(revision),
        () => commitSettings(next, revision, avatar, avatarName),
      );
    },
  );
  handle('dock:setPinnedCommands', (ids: string[]) =>
    settings.save({ ...settings.value, pinnedCommands: ids }, settings.revision),
  );
  handle('dock:toggleExtension', async (id: string, enabled: boolean) => {
    if (webId(id) && typeof enabled === 'boolean') {
      const next = structuredClone(settings.value);
      const item = next.webApplets.items.find((item) => item.id === id);
      if (!item) throw Error('WebAppletがありません。');
      item.enabled = enabled;
      settings.save(next, settings.revision);
      return;
    }
    if (!manager.items.has(id) || typeof enabled !== 'boolean')
      throw new Error('拡張が見つかりません。');
    settings.updateExtension(id, { enabled });
    await manager.reconcile();
  });
  handle('dock:restartExtension', (id: string) =>
    webId(id) ? webApplets.restart(id) : manager.restart(id),
  );
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
  const helperPath = app.isPackaged
    ? path.join(process.resourcesPath, 'updater', 'AppDock.Updater.exe')
    : path.join(app.getAppPath(), '.artifacts', 'updater', 'AppDock.Updater.exe');
  if (fs.existsSync(path.join(dataDirectory, 'update-transaction.json'))) {
    try {
      execFileSync(helperPath, ['--recover', baseDirectory, dataDirectory], { windowsHide: true });
    } catch (error) {
      dialog.showErrorBox(
        'AppDock — 更新の復元が必要です',
        `中断された更新を復元できませんでした。\n${String(error)}\n${dataDirectory} の更新記録と一時フォルダーを保持しています。`,
      );
      app.quit();
      return;
    }
  }
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
      : path.join(app.getAppPath(), '.artifacts', 'dotnet-host'),
    api: createHostApi(
      settings,
      dataDirectory,
      log.write,
      changed,
      () => manager.emit('changed'),
      executeCommand,
      path.join(paths.assets, 'applets'),
    ),
    log: log.write,
  });
  updater = new PortableUpdates({
    targets: (): UpdateTarget[] => [
      {
        id: 'host',
        name: 'AppDock',
        kind: 'host',
        version: app.getVersion(),
        source: settings.value.updates.hostSource,
        destination: process.env.PORTABLE_EXECUTABLE_FILE || '',
      },
      ...manager.snapshot().map((extension) => ({
        id: extension.id,
        name: extension.displayName,
        kind: 'applet' as const,
        version: extension.version,
        destination: extension.folder,
        source:
          settings.value.extensions[extension.id]?.updateSource ??
          (extension.updateRepository ? `github:${extension.updateRepository}` : ''),
      })),
    ],
    settings: () => settings.value.updates,
    hostVersion: app.getVersion(),
    helper: helperPath,
    executable: app.isPackaged ? process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe') : '',
    restartArgs: [
      '--restore-view',
      ...(testDirectory
        ? process.argv
            .slice(1)
            .filter(
              (argument) =>
                argument.startsWith('--test-profile=') ||
                argument.startsWith('--test-local-state=') ||
                argument.startsWith('--remote-debugging-port=') ||
                argument.startsWith('--inspect='),
            )
        : []),
    ],
    baseDirectory,
    stateDirectory: dataDirectory,
    fetcher: net.fetch,
    changed,
    confirm: async (names) => {
      const response = await dialog.showMessageBox(window!, {
        type: 'question',
        title: '更新して再起動',
        message: 'AppDockとすべてのAppletを終了し、更新して再起動します。',
        detail: names.join('\n'),
        buttons: ['更新して再起動', 'キャンセル'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      return response.response === 0;
    },
    processIds: () => [
      process.pid,
      ...(process.env.PORTABLE_EXECUTABLE_FILE ? [process.ppid] : []),
      ...[...manager.items.values()].flatMap((item) => (item.child?.pid ? [item.child.pid] : [])),
    ],
    shutdown: () => quitHost(),
    log: (message) => log.write('warn', 'updates', message),
  });
  const hotKeyHost = app.isPackaged
    ? path.join(process.resourcesPath, 'dotnet-host', 'AppDock.ExtensionHost.exe')
    : path.join(app.getAppPath(), '.artifacts', 'dotnet-host', 'AppDock.ExtensionHost.exe');
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
    (key) => dispatchShortcut(key, true),
  );
  webApplets = new WebAppletManager(
    settings,
    dataDirectory,
    changed,
    executeCommand,
    sharedDirectory,
    (error) => log.write('error', 'web-accounts', error.message),
  );
  gestures = new GestureManager(
    path.join(path.dirname(hotKeyHost), 'input', 'AppDock.InputHost.exe'),
    () => {
      const focused = BrowserWindow.getFocusedWindow();
      return {
        settings: settings.value,
        context: {
          ...shortcutContext(),
          window: focused?.getNativeWindowHandle().readBigUInt64LE().toString() ?? '',
        },
        commands: availableShortcutCommands(),
        recording: shortcutRecording || quitting,
      };
    },
    shortcutDispatcher,
    executeCommand,
    (session) => {
      for (const item of manager.items.values())
        if (item.peer && !item.peer.closed)
          item.peer.send({ jsonrpc: '2.0', method: 'command.cancel', params: { session } });
    },
    (message) => log.write('error', 'gestures', message),
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
  settings.on('statusChanged', changed);
  settings.watch((e) =>
    log.write(
      'error',
      'settings',
      `設定ファイルを読み込めません。最後の有効な設定を継続します。${e.message}`,
    ),
  );
  applySettings();
  let lastAvatar = avatarSignature();
  avatarPoll = setInterval(() => {
    try {
      const next = avatarSignature();
      if (next !== lastAvatar) {
        lastAvatar = next;
        changed();
      }
    } catch {
      /* A sync write can temporarily lock an image. Retry on the next poll. */
    }
  }, 2000);
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
      const file = avatarFile();
      if (!file) return new Response('Not found', { status: 404 });
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
  session.defaultSession.setSpellCheckerEnabled(false);
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
      spellcheck: false,
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
  settingsNotice = new SettingsNotice(
    window,
    'appdock://host/index.html?settingsNotice=1',
    path.join(__dirname, 'settings-notice-preload.js'),
    (message) => log.write('error', 'settings', message),
  );
  configurePageHost({
    overlay: () => settingsNotice?.layout(),
    window: () => window,
    display: (key, fallback) => {
      const web = settings.value.webApplets.items.find((item) => pageKey(item.id, 'main') === key);
      if (web) return web.display;
      for (const extension of manager.items.values()) {
        const page = extension.manifest.pages?.find(
          (page) => pageKey(extension.manifest.id, page.id) === key,
        );
        if (page) return pageDisplay(settings.value, extension.manifest.id, page);
      }
      return fallback;
    },
    selected: (key) => {
      // Closing Applet surfaces during shutdown must not overwrite the restart destination.
      if (!quitting) window?.webContents.send('dock:appletPage', key);
    },
    failed: (message) => log.write('error', 'pages', message),
    shortcut: (input, appletId) => {
      if (
        input.type !== 'keyDown' ||
        input.isAutoRepeat ||
        input.isComposing ||
        shortcutRecording ||
        quitting
      )
        return false;
      const context = shortcutContext();
      if (!context.appFocused || (appletId && context.appletId !== appletId)) return false;
      const key = shortcutFromEvent({
        key: input.key,
        code: input.code,
        ctrlKey: input.control,
        altKey: input.alt,
        shiftKey: input.shift,
        metaKey: input.meta,
        isComposing: input.isComposing,
      });
      if (!key) return false;
      if (hotKeys?.statuses.some((s) => s.registered && s.shortcut === key)) return true;
      const commands = resolveKeybindings(
        getKeybindings(settings.value),
        key,
        context,
        availableShortcutCommands(),
      );
      if (!commands.length) return false;
      void shortcutDispatcher.dispatch(key, commands);
      return true;
    },
  });
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
  window.on('show', changed);
  window.on('hide', changed);
  window.on('minimize', changed);
  window.on('restore', changed);
  window.webContents.on('render-process-gone', resumeHotKeys);
  window.webContents.on('did-start-loading', resumeHotKeys);
  window.webContents.on('did-start-loading', () => updatePageViewport(null, null));
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
  tray = new Tray(
    icon.resize({ width: 20, height: 20 }),
    process.platform === 'win32' ? trayIdentity(app.getPath('exe'), baseDirectory) : undefined,
  );
  tray.setToolTip('AppDock.at365');
  trayClicks = new TrayClickDispatcher(
    () => settings.value.host,
    runTrayCommand,
    () =>
      readDoubleClickTime(hotKeyHost).catch((error) => {
        log.write(
          'warn',
          'tray',
          `${String(error)} 既定のダブルクリック判定時間${DEFAULT_DOUBLE_CLICK_TIME_MS}msで待機します。`,
        );
        return DEFAULT_DOUBLE_CLICK_TIME_MS;
      }),
  );
  tray.on('click', () => trayClicks?.click());
  tray.on('double-click', () => trayClicks?.doubleClick());
  trayMenu();
  await window.loadURL(hostDocumentUrl);
  // Reapply after native initialization, which can adjust frameless bounds for DPI.
  if (savedWindow) restoreWindowBounds(window, savedWindow.bounds);
  manager.discover();
  const migrated = initializeGestureDefaults(
    initializeExtensionDefaults(
      withoutMissingSamples(settings.value, manager.items.keys()),
      [...manager.items.values()].map((item) => item.manifest),
    ),
    [...manager.items.values()].map((item) => item.manifest),
  );
  migrated.trayMenu = getTrayMenu(migrated, allApplets());
  if (!settings.recovered && JSON.stringify(migrated) !== JSON.stringify(settings.value))
    settings.save(migrated, settings.revision);
  await manager.reconcile();
  await syncHotKeys();
  await gestures.start();
  startupReady = true;
  automation = new AutomationService({
    localDirectory: dataDirectory,
    baseDirectory,
    version: app.getVersion(),
    encrypt: (value) => {
      if (!safeStorage.isEncryptionAvailable())
        throw Error('Windowsの認証情報保護を利用できません。');
      return safeStorage.encryptString(value).toString('base64');
    },
    decrypt: (value) => safeStorage.decryptString(Buffer.from(value, 'base64')),
    changed,
    audit: (level, message) => log.write(level, 'automation', message),
    createApi: (writable, instanceId, executable) =>
      new AutomationApi({
        settings,
        save: (value, revision) => {
          try {
            return commitSettings(prepareSettings(value), revision);
          } catch {
            log.write('error', 'automation', '基本設定を保存できませんでした。');
            throw Error('設定保存失敗');
          }
        },
        applets: () => automationApplets(allApplets()),
        commands: () => automationCommands(allApplets()),
        execute: executeCommand,
        executable,
        version: app.getVersion(),
        instanceId,
        writable,
        ready: () => startupReady && !quitting,
      }),
  });
  await automation.initialize();
  changed();
  log.write('info', 'host', 'AppDockを起動しました。');
  const updateResultFile = path.join(dataDirectory, 'update-result.json');
  if (fs.existsSync(updateResultFile)) {
    try {
      const result = JSON.parse(fs.readFileSync(updateResultFile, 'utf8'));
      updater.state.phase = result.message;
      updater.state.completion = { ok: result.ok === true, message: String(result.message) };
      log.write(result.ok ? 'info' : 'error', 'updates', String(result.message));
      const temporary =
        typeof result.temporaryDirectory === 'string'
          ? path.resolve(result.temporaryDirectory)
          : '';
      if (
        temporary &&
        path.dirname(temporary).toLowerCase() === path.resolve(os.tmpdir()).toLowerCase() &&
        /^AppDock-update-[A-Za-z0-9]{6}$/.test(path.basename(temporary))
      ) {
        setTimeout(() => {
          if (fs.existsSync(path.join(dataDirectory, 'update-transaction.json'))) return;
          if (fs.existsSync(temporary) && !fs.lstatSync(temporary).isSymbolicLink())
            void fs.promises
              .rm(temporary, { recursive: true, force: true })
              .catch((error) =>
                log.write(
                  'warn',
                  'updates',
                  `更新用一時ファイルを削除できませんでした: ${String(error)}`,
                ),
              );
        }, 5000);
      }
    } catch (error) {
      log.write('warn', 'updates', String(error));
    }
  }
  startupUpdateTimer = updater.scheduleStartup(smoke, (results) => {
    if (!results.length || quitting) return;
    log.write('info', 'updates', `${results.length}件の更新があります。`);
    try {
      showNotification(
        'AppDock — 更新があります',
        results.map((result) => `${result.name}: ${result.latestVersion}`).join('\n'),
        true,
        () => {
          showWindow();
          window?.webContents.send('dock:hostCommand', 'appdock.updates.open');
        },
      );
    } catch (error) {
      log.write('error', 'updates', String(error));
    }
  });
  if (smoke) await runSmoke();
  else if (restoreView || !settings.value.host.startMinimized) showWindow();
  activateNotification(process.argv, showWindow);
  if (pendingNotificationArgs) activateNotification(pendingNotificationArgs, showWindow);
  pendingNotificationArgs = undefined;
  // Optional startup command only for an explicit isolated test profile.
  const testCommand =
    testDirectory &&
    process.argv.find((a) => a.startsWith('--test-command='))?.slice('--test-command='.length);
  if (!smoke && testCommand) await manager.execute(testCommand);
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
      result.profile.avatar !== 'data/assets/profile/avatar.png' ||
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
          avatarPath: path.join(baseDirectory, 'data', 'assets', 'profile', 'avatar.png'),
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
app.on('second-instance', (_event, argv) => {
  if (!startupReady) {
    pendingNotificationArgs = argv;
    return;
  }
  if (!activateNotification(argv, showWindow)) showWindow();
});
app.on('before-quit', (event) => {
  clearTimeout(startupUpdateTimer);
  quitting = true;
  trayClicks?.close();
  windowState?.flush();
  if (shutdownFinished || !manager) return;
  event.preventDefault();
  if (shutdownStarted) return;
  shutdownStarted = true;
  void (async () => {
    for (const stop of [
      () => automation?.close(),
      () => gestures?.close(),
      () => hotKeys?.close(),
      () => webApplets.close(),
      () => manager.shutdown(),
    ]) {
      try {
        await stop();
      } catch {
        log.write('error', 'host', '終了処理の一部に失敗しました。');
      }
    }
  })().finally(() => {
    settings.close();
    clearInterval(avatarPoll);
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
    .then(async () => {
      await launch.refresh();
      if (
        !settingsLoadError &&
        launch.state.supported &&
        !launch.state.elevated &&
        settings.value.host.runAsAdministrator &&
        !smoke &&
        !process.argv.includes('--appdock-elevation-attempt')
      ) {
        try {
          await launch.restartElevated([
            ...process.argv.slice(1).filter((arg) => !arg.startsWith('--inspect')),
            '--appdock-elevation-attempt',
          ]);
          quitHost();
          return;
        } catch {
          launch.state = {
            ...launch.state,
            error:
              '管理者起動がキャンセルされたか、許可されませんでした。現在は通常権限で動作しています。',
          };
        }
      }
      await initialize();
    })
    .catch((e) => {
      dialog.showErrorBox('AppDock', String(e));
      quitting = true;
      app.quit();
    });

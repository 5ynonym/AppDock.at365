import { parseKeybindings, withKeybindings } from './keybindings';
import { parseTrayMenu, trayMenuCommandIds, maximumTrayItems } from './tray-menu';
import { parseGestures, migrateGestures, defaultGestures } from './gestures';
import type { Settings } from './contracts';
import { avatarReference } from './asset-names';
import { defaultWebShortcutDefaults, parseWebApplets } from './web-applets';
import { validateUpdateSource } from './update-sources';
import { validPageId, validRibbonId, validSeparatorId, defaultRibbon } from './applet-pages';
import {
  defaultShortcuts,
  defaultGlobalShortcutCommands,
  parseShortcuts,
  validCommandId,
} from './commands';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const createDefaultSettings = (): Settings => ({
  appletOrder: [],
  gestures: defaultGestures(),
  gestureDefaultsInitialized: [],
  webApplets: { items: [], shortcutDefaults: defaultWebShortcutDefaults() },
  schemaVersion: 1,
  host: {
    theme: 'dark',
    closeToTray: true,
    notifications: true,
    startMinimized: false,
    startAtLogon: false,
    runAsAdministrator: false,
    hardwareAcceleration: true,
    trayClickCommand: 'appdock.open',
    trayDoubleClickCommand: null,
  },
  extensions: {},
  updates: {
    hostSource: 'github:5ynonym/AppDock.at365',
    checkHostOnStartup: false,
    checkAppletsOnStartup: false,
    startupDelaySeconds: 10,
    notifyOnStartup: true,
    allowSameVersion: false,
  },
  shortcuts: structuredClone(defaultShortcuts),
  globalShortcutCommands: [...defaultGlobalShortcutCommands],
  trayCommands: [],
  pinnedCommands: [],
  ribbon: defaultRibbon(),
  profile: { name: 'ユキ', avatar: null },
});
export function parseSettings(value: unknown): Settings {
  if (
    !object(value) ||
    value.schemaVersion !== 1 ||
    !object(value.host) ||
    !object(value.extensions)
  )
    throw new Error('schemaVersion: 1、host、extensions が必要です。');
  if (
    typeof value.host.theme !== 'string' ||
    !['dark', 'light', 'system'].includes(value.host.theme)
  )
    throw new Error('theme は dark / light / system です。');
  for (const key of ['closeToTray', 'notifications', 'startMinimized'])
    if (typeof value.host[key] !== 'boolean') throw new Error(`host.${key} は true / false です。`);
  const hardwareAcceleration =
    value.host.hardwareAcceleration === undefined ? true : value.host.hardwareAcceleration;
  if (typeof hardwareAcceleration !== 'boolean')
    throw new Error('host.hardwareAcceleration は true / false です。');
  const startAtLogon = value.host.startAtLogon ?? false;
  const runAsAdministrator = value.host.runAsAdministrator ?? false;
  for (const key of ['startAtLogon', 'runAsAdministrator'])
    if (value.host[key] !== undefined && typeof value.host[key] !== 'boolean')
      throw new Error(`host.${key} は true / false です。`);
  const trayClickCommand =
    value.host.trayClickCommand === undefined ? 'appdock.open' : value.host.trayClickCommand;
  if (!validCommandId(trayClickCommand))
    throw new Error('host.trayClickCommand はコマンドIDです。');
  const trayDoubleClickCommand =
    value.host.trayDoubleClickCommand === undefined ? null : value.host.trayDoubleClickCommand;
  if (trayDoubleClickCommand !== null && !validCommandId(trayDoubleClickCommand))
    throw new Error('host.trayDoubleClickCommand はコマンドIDまたはnullです。');
  const trayMenu = value.trayMenu === undefined ? undefined : parseTrayMenu(value.trayMenu);
  const trayCommands =
    trayMenu !== undefined
      ? trayMenuCommandIds(trayMenu)
      : value.trayCommands === undefined
        ? []
        : value.trayCommands;
  if (
    !Array.isArray(trayCommands) ||
    trayCommands.length > (trayMenu === undefined ? 500 : maximumTrayItems) ||
    trayCommands.some((id) => !validCommandId(id)) ||
    new Set(trayCommands).size !== trayCommands.length
  )
    throw new Error('trayCommands は重複のないコマンドIDの配列です。');
  for (const [id, item] of Object.entries(value.extensions)) {
    if (
      !/^[a-z0-9][a-z0-9.-]{0,100}$/.test(id) ||
      ['constructor', 'prototype', '__proto__'].includes(id) ||
      !object(item) ||
      typeof item.enabled !== 'boolean' ||
      !object(item.settings)
    )
      throw new Error(`拡張設定 ${id} の形式が正しくありません。`);
    if (
      item.startupDelaySeconds !== undefined &&
      (!Number.isInteger(item.startupDelaySeconds) ||
        Number(item.startupDelaySeconds) < 0 ||
        Number(item.startupDelaySeconds) > 86400)
    )
      throw new Error(`拡張設定 ${id} の開始までの秒数は0～86400の整数です。`);
    if (item.updateSource !== undefined) validateUpdateSource(item.updateSource);
    if (
      item.pages !== undefined &&
      (!object(item.pages) ||
        Object.entries(item.pages).some(
          ([pageId, page]) =>
            !validPageId(pageId) ||
            !object(page) ||
            !['page', 'window'].includes(String(page.display)),
        ))
    )
      throw Error(`拡張設定 ${id} のページ表示方法が不正です。`);
  }
  const appletOrder = value.appletOrder === undefined ? [] : value.appletOrder;
  if (
    !Array.isArray(appletOrder) ||
    appletOrder.length > 500 ||
    appletOrder.some(
      (id) =>
        typeof id !== 'string' ||
        !/^[a-z0-9][a-z0-9.-]{0,100}$/.test(id) ||
        ['constructor', 'prototype', '__proto__'].includes(id),
    ) ||
    new Set(appletOrder).size !== appletOrder.length
  )
    throw Error('appletOrder は重複のないApplet IDの配列です。');
  const rawRibbon = value.ribbon === undefined ? defaultRibbon() : value.ribbon;
  const ribbon = object(rawRibbon)
    ? {
        ...rawRibbon,
        bottom: rawRibbon.bottom === undefined ? [] : rawRibbon.bottom,
        separators: rawRibbon.separators === undefined ? [] : rawRibbon.separators,
      }
    : rawRibbon;
  if (
    !object(ribbon) ||
    ['order', 'hidden', 'bottom', 'separators'].some((key) => {
      const ids = ribbon[key];
      return (
        !Array.isArray(ids) ||
        ids.length > (key === 'separators' ? 50 : 500) ||
        ids.some((id) => !validRibbonId(id)) ||
        (key === 'separators' && ids.some((id) => !validSeparatorId(id))) ||
        new Set(ids).size !== ids.length
      );
    })
  )
    throw Error('ribbon.order / hidden / bottom / separators は重複のないリボンIDの配列です。');
  for (const key of ['order', 'hidden', 'bottom'])
    if (
      (ribbon[key] as string[]).some(
        (id) => validSeparatorId(id) && !(ribbon.separators as string[]).includes(id),
      )
    )
      throw Error('セパレーターを使うにはribbon.separatorsへ登録してください。');
  const keybindings =
    value.keybindings === undefined ? undefined : parseKeybindings(value.keybindings);
  const keybindingDefaultsInitialized =
    value.keybindingDefaultsInitialized === undefined ? [] : value.keybindingDefaultsInitialized;
  if (
    !Array.isArray(keybindingDefaultsInitialized) ||
    keybindingDefaultsInitialized.length > 500 ||
    keybindingDefaultsInitialized.some(
      (id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9.-]{0,100}$/.test(id),
    ) ||
    new Set(keybindingDefaultsInitialized).size !== keybindingDefaultsInitialized.length
  )
    throw Error('既定ショートカット適用済みAppletの一覧が不正です。');
  const shortcuts = keybindings
    ? {}
    : parseShortcuts(value.shortcuts === undefined ? {} : value.shortcuts);
  const globalShortcutCommands = keybindings
    ? []
    : value.globalShortcutCommands === undefined
      ? [...defaultGlobalShortcutCommands]
      : value.globalShortcutCommands;
  if (
    !Array.isArray(globalShortcutCommands) ||
    globalShortcutCommands.length > 500 ||
    globalShortcutCommands.some((id) => !validCommandId(id)) ||
    new Set(globalShortcutCommands).size !== globalShortcutCommands.length
  )
    throw new Error('globalShortcutCommands は重複のないコマンドIDの配列です。');
  const pinnedCommands = value.pinnedCommands === undefined ? [] : value.pinnedCommands;
  if (
    !Array.isArray(pinnedCommands) ||
    pinnedCommands.length > 500 ||
    pinnedCommands.some((id) => !validCommandId(id)) ||
    new Set(pinnedCommands).size !== pinnedCommands.length
  )
    throw new Error('pinnedCommands は重複のないコマンドIDの配列です。');
  const profile = value.profile === undefined ? { name: 'ユキ', avatar: null } : value.profile;
  if (
    !object(profile) ||
    typeof profile.name !== 'string' ||
    !profile.name.trim() ||
    profile.name.length > 80 ||
    (profile.avatar !== null && !avatarReference(profile.avatar))
  )
    throw new Error(
      'プロフィールは80文字以内の名前と、登録アバターの相対パス / null を指定してください。',
    );
  const updates = {
    ...createDefaultSettings().updates,
    ...(object(value.updates) ? value.updates : {}),
  };
  if (value.updates !== undefined && !object(value.updates))
    throw Error('updates はオブジェクトです。');
  validateUpdateSource(updates.hostSource);
  for (const key of [
    'checkHostOnStartup',
    'checkAppletsOnStartup',
    'notifyOnStartup',
    'allowSameVersion',
  ] as const)
    if (typeof updates[key] !== 'boolean') throw Error(`updates.${key} は true / false です。`);
  if (
    !Number.isInteger(updates.startupDelaySeconds) ||
    updates.startupDelaySeconds < 0 ||
    updates.startupDelaySeconds > 3600
  )
    throw Error('更新確認の開始までの秒数は0～3600の整数です。');
  const next = {
    gestures:
      value.gestures === undefined
        ? migrateGestures(value as unknown as Settings)
        : parseGestures(value.gestures),
    gestureDefaultsInitialized: parseGestureInitialized(value.gestureDefaultsInitialized),
    ...(keybindings ? { keybindings } : {}),
    ...(value.keybindingDefaultsInitialized === undefined ? {} : { keybindingDefaultsInitialized }),
    webApplets: parseWebApplets(value.webApplets),
    updates,
    schemaVersion: value.schemaVersion,
    extensions: value.extensions,
    host: {
      ...value.host,
      trayClickCommand,
      trayDoubleClickCommand,
      hardwareAcceleration,
      startAtLogon,
      runAsAdministrator,
    },
    trayCommands,
    ...(trayMenu === undefined ? {} : { trayMenu }),
    shortcuts,
    globalShortcutCommands,
    pinnedCommands,
    appletOrder,
    ribbon,
    profile: { ...profile, name: profile.name.trim() },
  };
  const parsed = structuredClone(next) as unknown as Settings;
  const result = keybindings ? withKeybindings(parsed, keybindings) : parsed;
  if (new TextEncoder().encode(JSON.stringify(result)).length > 1024 * 1024)
    throw new Error('設定は1MB以下にしてください。');
  return result;
}
function parseGestureInitialized(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 500 || value.some((v) => !validCommandId(v)))
    throw Error('ジェスチャー初期設定の適用済み一覧が不正です。');
  return [...new Set(value)] as string[];
}

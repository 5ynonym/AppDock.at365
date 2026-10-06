import type { Settings } from './contracts';
import {
  defaultShortcuts,
  defaultGlobalShortcutCommands,
  parseShortcuts,
  validCommandId,
} from './commands';
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const createDefaultSettings = (): Settings => ({
  schemaVersion: 1,
  host: {
    theme: 'dark',
    closeToTray: true,
    notifications: true,
    startMinimized: false,
    hardwareAcceleration: true,
    trayClickCommand: 'appdock.open',
  },
  extensions: {},
  shortcuts: structuredClone(defaultShortcuts),
  globalShortcutCommands: [...defaultGlobalShortcutCommands],
  trayCommands: [],
  pinnedCommands: [],
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
  const trayClickCommand =
    value.host.trayClickCommand === undefined ? 'appdock.open' : value.host.trayClickCommand;
  if (!validCommandId(trayClickCommand))
    throw new Error('host.trayClickCommand はコマンドIDです。');
  const trayCommands = value.trayCommands === undefined ? [] : value.trayCommands;
  if (
    !Array.isArray(trayCommands) ||
    trayCommands.length > 500 ||
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
  }
  const shortcuts = parseShortcuts(value.shortcuts === undefined ? {} : value.shortcuts);
  const globalShortcutCommands =
    value.globalShortcutCommands === undefined
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
    (profile.avatar !== null && profile.avatar !== 'avatar.png')
  )
    throw new Error('プロフィールは80文字以内の名前と avatar.png / null を指定してください。');
  const next = {
    ...value,
    host: { ...value.host, trayClickCommand, hardwareAcceleration },
    trayCommands,
    shortcuts,
    globalShortcutCommands,
    pinnedCommands,
    profile: { ...profile, name: profile.name.trim() },
  };
  if (new TextEncoder().encode(JSON.stringify(next)).length > 1024 * 1024)
    throw new Error('設定は1MB以下にしてください。');
  return structuredClone(next) as unknown as Settings;
}

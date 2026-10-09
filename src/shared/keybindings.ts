import {
  defaultShortcuts,
  defaultGlobalShortcutCommands,
  normalizeShortcut,
  validCommandId,
} from './commands';
import type { Settings } from './contracts';

export const shortcutScopes = [
  { id: 'global', title: 'グローバル' },
  { id: 'app', title: 'AppDock全体' },
  { id: 'pages', title: 'すべてのApplet' },
  { id: 'owner', title: '提供元のApplet' },
  { id: 'applets', title: '指定したApplet' },
] as const;
export type ShortcutScope = (typeof shortcutScopes)[number]['id'];
export interface Keybinding {
  id: string;
  command: string;
  key: string;
  enabled: boolean;
  when: { scope: ShortcutScope; appletIds: string[] };
}
export interface ShortcutContext {
  appFocused: boolean;
  appletId?: string;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export function parseKeybindings(value: unknown): Keybinding[] {
  if (!Array.isArray(value) || value.length > 2000)
    throw Error('キーバインドは2000件以内の配列です。');
  const ids = new Set<string>();
  return value.map((row) => {
    if (
      !object(row) ||
      !validCommandId(row.id) ||
      ids.has(row.id) ||
      !validCommandId(row.command) ||
      typeof row.enabled !== 'boolean' ||
      !object(row.when)
    )
      throw Error('キーバインドのID・コマンド・有効状態・条件を確認してください。');
    ids.add(row.id);
    const when = row.when;
    if (
      !shortcutScopes.some((s) => s.id === when.scope) ||
      !Array.isArray(when.appletIds) ||
      when.appletIds.length > 500 ||
      when.appletIds.some((id) => !validCommandId(id)) ||
      new Set(when.appletIds).size !== when.appletIds.length ||
      (when.scope === 'applets' ? !when.appletIds.length : !!when.appletIds.length) ||
      Object.keys(when).some((k) => !['scope', 'appletIds'].includes(k))
    )
      throw Error(
        '「いつ・どこで」の条件を確認してください。指定したAppletは1件以上選んでください。',
      );
    return {
      id: row.id,
      command: row.command,
      key: normalizeShortcut(row.key),
      enabled: row.enabled,
      when: { scope: when.scope as ShortcutScope, appletIds: [...when.appletIds] as string[] },
    };
  });
}
export function migrateKeybindings(
  shortcuts: Record<string, string[]>,
  globals: string[],
): Keybinding[] {
  return Object.entries(shortcuts).flatMap(([command, keys], i) =>
    keys.map((key, j) => ({
      id: `legacy.${i}.${j}`,
      command,
      key,
      enabled: true,
      when: {
        scope: globals.includes(command) ? ('global' as const) : ('app' as const),
        appletIds: [],
      },
    })),
  );
}
export function getKeybindings(
  settings: Pick<Settings, 'keybindings' | 'shortcuts' | 'globalShortcutCommands'>,
): Keybinding[] {
  return (
    settings.keybindings ?? migrateKeybindings(settings.shortcuts, settings.globalShortcutCommands)
  );
}
export function defaultKeybindings() {
  return migrateKeybindings(defaultShortcuts, defaultGlobalShortcutCommands);
}
/** Legacy fields are derived display/compatibility data once keybindings exists. */
export function withKeybindings(settings: Settings, rows: Keybinding[]): Settings {
  const shortcuts: Record<string, string[]> = {};
  for (const row of rows) {
    shortcuts[row.command] ??= [];
    if (row.enabled && !shortcuts[row.command].includes(row.key))
      shortcuts[row.command].push(row.key);
  }
  return {
    ...settings,
    keybindings: rows,
    shortcuts,
    globalShortcutCommands: [
      ...new Set(rows.filter((r) => r.enabled && r.when.scope === 'global').map((r) => r.command)),
    ],
  };
}
export function matchesWhen(
  when: Keybinding['when'],
  context: ShortcutContext,
  extensionId?: string | null,
): boolean {
  switch (when.scope) {
    case 'global':
      return true;
    case 'app':
      return context.appFocused;
    case 'pages':
      return context.appFocused && !!context.appletId;
    case 'owner':
      return context.appFocused && !!extensionId && context.appletId === extensionId;
    case 'applets':
      return context.appFocused && !!context.appletId && when.appletIds.includes(context.appletId);
    default:
      return false;
  }
}
export function resolveKeybindings(
  rows: Keybinding[],
  key: string,
  context: ShortcutContext,
  available: { id: string; extensionId?: string | null }[],
  globalEvent = false,
): string[] {
  const commands = new Map(available.map((command) => [command.id, command]));
  return [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.enabled &&
            row.key === key &&
            (globalEvent || row.when.scope !== 'global') &&
            commands.has(row.command) &&
            matchesWhen(row.when, context, commands.get(row.command)?.extensionId),
        )
        .map((row) => row.command),
    ),
  ];
}
/** No host IPC or text inspection is injected into remote documents. */
export function safePageShortcut(input: { control: boolean; alt: boolean; key: string }) {
  return (
    input.control ||
    input.alt ||
    /^F([1-9]|1[0-9]|2[0-4])$/i.test(input.key) ||
    input.key === 'Pause'
  );
}

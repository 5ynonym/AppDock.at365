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
export type KeybindingDefault = Omit<Keybinding, 'id'>;
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
/** Manifest defaults may only name commands declared by the same Applet. */
export function parseKeybindingDefaults(
  value: unknown,
  commands: string[],
  limit = 100,
): KeybindingDefault[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit)
    throw Error(`既定のキーバインドは${limit}件以内の配列です。`);
  const allowed = new Set(commands);
  return parseKeybindings(
    value.map((row, index) => {
      if (
        !object(row) ||
        !allowed.has(String(row.command)) ||
        Object.keys(row).some((key) => !['command', 'key', 'enabled', 'when'].includes(key))
      )
        throw Error('既定のキーバインドには自身の登録コマンドだけを指定してください。');
      return { ...row, id: `default.${index}` };
    }),
  ).map(({ id: _id, ...row }) => row);
}

export function addDefaultBindings(
  rows: Keybinding[],
  owner: string,
  defaults: KeybindingDefault[],
): Keybinding[] {
  const assigned = new Set(rows.map((row) => row.command));
  return [
    ...rows,
    ...defaults.flatMap((row, index) =>
      assigned.has(row.command)
        ? []
        : [
            {
              ...row,
              id: `applet-default.${owner}.${index}`,
              when: { ...row.when, appletIds: [...row.when.appletIds] },
            },
          ],
    ),
  ];
}

export function initializeExtensionDefaults(
  settings: Settings,
  applets: { id: string; defaultKeybindings?: KeybindingDefault[] }[],
): Settings {
  const initialized = new Set(settings.keybindingDefaultsInitialized ?? []);
  let rows = getKeybindings(settings);
  for (const applet of applets) {
    if (initialized.has(applet.id)) continue;
    // An Applet already present in older settings has user-owned shortcut state.
    if (!settings.extensions[applet.id])
      rows = addDefaultBindings(rows, applet.id, applet.defaultKeybindings ?? []);
    initialized.add(applet.id);
  }
  return withKeybindings({ ...settings, keybindingDefaultsInitialized: [...initialized] }, rows);
}

export function initializeWebAppletDefaults(settings: Settings, previous: Settings): Settings {
  const existing = new Set(previous.webApplets.items.map((item) => item.id));
  let rows = getKeybindings(settings);
  for (const item of settings.webApplets.items) {
    if (existing.has(item.id)) continue;
    rows = addDefaultBindings(
      rows,
      item.id,
      settings.webApplets.shortcutDefaults.map((binding) => ({
        ...binding,
        command: `${item.id}.${binding.command}`,
      })),
    );
  }
  return withKeybindings(settings, rows);
}

export function resetAppletKeybindings(
  settings: Settings,
  applet: {
    id: string;
    runtime: string;
    commands: { id: string }[];
    defaultKeybindings?: KeybindingDefault[];
  },
): Settings {
  const owned = new Set(applet.commands.map((command) => command.id));
  const remaining = getKeybindings(settings).filter((row) => !owned.has(row.command));
  const defaults =
    applet.runtime === 'web'
      ? settings.webApplets.shortcutDefaults.map((binding) => ({
          ...binding,
          command: `${applet.id}.${binding.command}`,
        }))
      : (applet.defaultKeybindings ?? []);
  return withKeybindings(settings, addDefaultBindings(remaining, applet.id, defaults));
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
/** Reorder the visible provider's slots, preserving other providers' dispatch positions. */
export function moveKeybindingInGroup(
  rows: Keybinding[],
  id: string,
  target: string,
  groupForCommand: (command: string) => string,
) {
  const row = rows.find((row) => row.id === id),
    to = rows.find((row) => row.id === target);
  if (!row || !to || groupForCommand(row.command) !== groupForCommand(to.command)) return rows;
  const group = groupForCommand(row.command);
  const members = rows.filter((item) => groupForCommand(item.command) === group);
  const fromIndex = members.indexOf(row),
    toIndex = members.indexOf(to);
  members.splice(fromIndex, 1);
  members.splice(toIndex, 0, row);
  let index = 0;
  return rows.map((item) => (groupForCommand(item.command) === group ? members[index++] : item));
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

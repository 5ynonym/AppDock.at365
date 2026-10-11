import type { ExtensionSnapshot, Settings, SettingDefinition } from './contracts';
import { createDefaultSettings, parseSettings } from './settings-schema';
import { validateAppletSettings } from './setting-definitions';
import { orderApplets } from './applet-order';
import { getKeybindings } from './keybindings';
import { appletApiPermissionLabels } from './appdock-api';

export const settingsTextLimit = 1024 * 1024;
export type SettingsPath = string[];
export interface SettingsItem {
  id: string;
  pageId: string;
  key: string;
  title: string;
  description: string;
  definition?: SettingDefinition;
  keywords?: string[];
}
export interface SettingsPageDefinition {
  id: string;
  title: string;
  owner?: string;
  kind: 'host' | 'applet' | 'web';
  json: boolean;
  items: SettingsItem[];
}
export const settingsItemId = (pageId: string, key: string) =>
  `${encodeURIComponent(pageId)}/${encodeURIComponent(key)}`;
export const appletSettingsPageId = (id: string) => `applet:${id}`;
export const hostSettingsPages = [
  ['appearance', '表示'],
  ['general', '一般'],
  ['ribbon', 'リボン'],
  ['tray', 'タスクトレイ'],
  ['shortcuts', 'ショートカット'],
  ['gestures', 'マウスジェスチャー'],
  ['web-accounts', 'Webアカウント'],
  ['permissions', '操作の許可'],
  ['codex', 'Codex連携'],
  ['profile', 'プロフィール'],
  ['about', 'バージョン情報・更新'],
] as const;
const hostItems: Record<string, [string, string, string?][]> = {
  appearance: [
    ['shellProvider', 'Shell', 'Shell Appletが担当する領域を選びます。'],
    ['theme', 'テーマ', '配色 Dark Light System'],
  ],
  general: [
    ['permissions', 'Applet・MCPからの操作'],
    ['startAtLogon', 'スタートアップに登録'],
    ['runAsAdministrator', '常に管理者として起動'],
    ['launch', '現在の起動状態'],
    ['closeToTray', '閉じるとトレイに常駐'],
    ['notifications', 'デスクトップ通知'],
    ['hardwareAcceleration', 'ハードウェアアクセラレーション'],
    ['startMinimized', 'トレイから起動'],
  ],
  ribbon: [['ribbon', 'リボンの配置']],
  tray: [
    ['trayMenu', 'タスクトレイの配置'],
    ['trayClickCommand', 'クリック'],
    ['trayDoubleClickCommand', 'ダブルクリック'],
  ],
  shortcuts: [['keybindings', 'ショートカット']],
  gestures: [
    ['gestures', 'マウスジェスチャー', '有効 割り当て 条件 実行順'],
    ['options', '動作設定', 'Webブラウザのexe 除外するexe Chromium'],
  ],
  'web-accounts': [['accounts', 'Webアカウント', 'アカウント名 追加 削除 ログイン情報をクリア']],
  permissions: Object.entries(appletApiPermissionLabels).map(([key, title]) => [
    key,
    title,
    'Applet MCP 操作の許可',
  ]),
  codex: [
    ['automation', 'Codex連携', '連携を有効にする'],
    ['registration', 'Codexへ登録', '設定ファイル 登録 解除'],
    ['connection', '接続の詳細', '登録名 接続ポート'],
  ],
  profile: [
    ['name', 'ユーザー名'],
    ['avatar', 'アバター画像'],
  ],
  about: [
    ['updates', '更新設定'],
    ['versions', 'バージョン情報'],
    ['updateSource', 'Appletの更新元'],
    ['hostSource', 'AppDockの更新元'],
    ['checkHostOnStartup', '起動時にAppDockの更新を確認'],
    ['checkAppletsOnStartup', '起動時にAppletの更新を確認'],
    ['notifyOnStartup', '起動時に更新が見つかったら通知'],
    ['allowSameVersion', '同じバージョンの再適用を許可（開発用）'],
    ['startupDelaySeconds', '起動から確認までの秒数'],
  ],
};
const generalKeys = [
  'startAtLogon',
  'runAsAdministrator',
  'closeToTray',
  'notifications',
  'hardwareAcceleration',
  'startMinimized',
];
const updateKeys = [
  'hostSource',
  'checkHostOnStartup',
  'checkAppletsOnStartup',
  'startupDelaySeconds',
  'notifyOnStartup',
  'allowSameVersion',
];
const webKeys = ['name', 'url', 'icon', 'display', 'navigation', 'allowedOrigins', 'accountId'];
const item = (
  pageId: string,
  key: string,
  title: string,
  description = '',
  definition?: SettingDefinition,
): SettingsItem => ({
  id: settingsItemId(pageId, key),
  pageId,
  key,
  title,
  description,
  definition,
});
export function settingsCatalog(
  applets: ExtensionSnapshot[],
  draft: Settings,
): SettingsPageDefinition[] {
  return [
    ...hostSettingsPages.map(([id, title]) => ({
      id,
      title,
      kind: 'host' as const,
      json: !['web-accounts', 'permissions', 'codex'].includes(id),
      items: hostItems[id].map(([key, title, description]) => item(id, key, title, description)),
    })),
    ...orderApplets(applets, draft.appletOrder).map((a) => {
      const id = appletSettingsPageId(a.id);
      return {
        id,
        title: a.displayName,
        owner: a.id,
        kind: a.runtime === 'web' ? ('web' as const) : ('applet' as const),
        json: true,
        items:
          a.runtime === 'web'
            ? webKeys.map((key, i) =>
                item(
                  id,
                  key,
                  [
                    '名前',
                    'URL',
                    'アイコン',
                    '表示方法',
                    '遷移規則',
                    '許可origin',
                    'Webアカウント',
                  ][i],
                ),
              )
            : [
                ...(a.pages ?? []).map((p) => item(id, `page:${p.id}`, `${p.title}の表示方法`)),
                item(id, 'startupDelaySeconds', '開始までの秒数'),
                ...(a.settingActions ?? []).map((s) =>
                  item(id, `action:${s.command}`, s.title, s.description),
                ),
                ...(a.settings ?? []).map((s) =>
                  item(id, `setting:${s.key}`, s.title, s.description, s),
                ),
              ],
      };
    }),
  ];
}
export function settingsPaths(
  page: SettingsPageDefinition,
  applets: ExtensionSnapshot[],
): SettingsPath[] {
  if (!page.json) return [];
  if (page.kind === 'applet') {
    const a = applets.find((a) => a.id === page.owner);
    if (!a) throw Error('設定対象が見つかりません。');
    return [
      ['extensions', a.id, 'settings'],
      ['extensions', a.id, 'startupDelaySeconds'],
      ...(a.pages ?? []).map((p) => ['extensions', a.id, 'pages', p.id, 'display']),
    ];
  }
  switch (page.id) {
    case 'appearance':
      return ['theme', 'shellProvider'].map((k) => ['host', k]);
    case 'general':
      return generalKeys.map((k) => ['host', k]);
    case 'tray':
      return [['trayMenu'], ['host', 'trayClickCommand'], ['host', 'trayDoubleClickCommand']];
    case 'shortcuts':
      return [['keybindings']];
    case 'gestures':
      return [
        'enabled',
        'browsers',
        'excludedProcesses',
        'requireChromiumWindowClass',
        'distance',
        'wheelDelayMs',
        'indicatorOpacity',
        'indicatorPosition',
        'bindings',
      ].map((key) => ['gestures', key]);
    case 'ribbon':
      return ['order', 'hidden', 'bottom', 'separators'].map((k) => ['ribbon', k]);
    case 'profile':
      return [
        ['profile', 'name'],
        ['profile', 'avatar'],
      ];
    case 'about':
      return [
        ...updateKeys.map((k) => ['updates', k]),
        ...applets
          .filter((a) => a.runtime !== 'web' && a.sourceKind !== 'builtin')
          .map((a) => ['extensions', a.id, 'updateSource']),
      ];
    default:
      return [];
  }
}
export const readSettingsPath = (value: unknown, path: SettingsPath): any =>
  path.reduce((v: any, key) => (v != null && Object.hasOwn(v, key) ? v[key] : undefined), value);
function writePath(value: any, path: SettingsPath, next: unknown) {
  let parent = value;
  for (const key of path.slice(0, -1)) {
    if (!Object.hasOwn(parent, key)) parent[key] = {};
    parent = parent[key];
  }
  const key = path.at(-1)!;
  if (next === undefined) delete parent[key];
  else parent[key] = structuredClone(next);
}
function webItem(value: Settings, page: SettingsPageDefinition) {
  const row = value.webApplets.items.find((a) => a.id === page.owner);
  if (!row) throw Error('設定対象が見つかりません。');
  return row;
}
export function settingsProjection(
  value: Settings,
  page: SettingsPageDefinition,
  applets: ExtensionSnapshot[],
): Record<string, unknown> {
  if (!page.json) throw Error('このページはJSON編集に対応していません。');
  if (page.kind === 'web') {
    const row = webItem(value, page);
    return {
      webApplets: {
        items: [Object.fromEntries(['id', ...webKeys].map((k) => [k, (row as any)[k]]))],
      },
    };
  }
  const result = {};
  if (page.kind === 'applet') writePath(result, ['extensions', page.owner!, 'settings'], {});
  for (const path of settingsPaths(page, applets)) {
    const part = path[0] === 'keybindings' ? getKeybindings(value) : readSettingsPath(value, path);
    if (part !== undefined) writePath(result, path, part);
  }
  return result;
}
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
function assertScope(value: unknown, paths: SettingsPath[], prefix: string[] = []) {
  if (paths.some((p) => p.length === prefix.length)) return;
  if (!object(value)) throw Error('JSONの親キーはオブジェクトで指定してください。');
  for (const [key, child] of Object.entries(value)) {
    const matching = paths.filter((p) => p[prefix.length] === key);
    if (!matching.length || ['__proto__', 'prototype', 'constructor'].includes(key))
      throw Error(`このページでは変更できないキーです: ${key}`);
    assertScope(child, matching, [...prefix, key]);
  }
}
/** Validate an isolated page, then merge only its allowed leaves into the current draft. */
export function applySettingsJson(
  draft: Settings,
  page: SettingsPageDefinition,
  applets: ExtensionSnapshot[],
  text: string,
  validate = true,
): Settings {
  if (new TextEncoder().encode(text).length > settingsTextLimit)
    throw Error('JSONは1MB以下にしてください。');
  const value = JSON.parse(text);
  if (!object(value) || !page.json) throw Error('部分JSONはオブジェクトで指定してください。');
  const next = structuredClone(draft);
  if (page.kind === 'web') {
    assertScope(value, [['webApplets', 'items']]);
    const rows = value.webApplets?.items;
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.id !== page.owner)
      throw Error('対象IDを変更・削除することはできません。');
    assertScope(
      rows[0],
      ['id', ...webKeys].map((k) => [k]),
    );
    const row = webItem(next, page);
    for (const key of webKeys) writePath(row, [key], rows[0][key]);
    if (!validate) return next;
    const check = createDefaultSettings();
    check.webApplets.items = [row];
    const parsed = parseSettings(check).webApplets.items[0];
    for (const key of webKeys) writePath(row, [key], (parsed as any)[key]);
    return next;
  }
  const paths = settingsPaths(page, applets);
  assertScope(value, paths);
  if (!validate) {
    if (page.kind === 'applet') next.extensions[page.owner!] ??= { enabled: false, settings: {} };
    for (const p of paths) writePath(next, p, readSettingsPath(value, p));
    return next;
  }
  const check = createDefaultSettings();
  for (const p of paths)
    if (p[0] === 'extensions') check.extensions[p[1]] ??= { enabled: false, settings: {} };
  for (const p of paths) writePath(check, p, readSettingsPath(value, p));
  // Missing required values fail; optional values use the existing parser's defaults.
  if (page.id === 'shortcuts' && !Array.isArray(value.keybindings))
    throw Error('keybindings は配列で指定してください。');
  if (
    page.kind === 'applet' &&
    !object(readSettingsPath(check, ['extensions', page.owner!, 'settings']))
  )
    throw Error('settings はオブジェクトで指定してください。');
  const normalized = parseSettings(check);
  validateAppletSettings(
    normalized,
    page.kind === 'applet' ? applets.filter((a) => a.id === page.owner) : [],
  );
  for (const p of paths) writePath(next, p, readSettingsPath(normalized, p));
  return next;
}
export function settingsPageChanged(
  draft: Settings,
  saved: Settings,
  page: SettingsPageDefinition,
  applets: ExtensionSnapshot[],
) {
  if (!page.json) return false;
  try {
    return (
      JSON.stringify(settingsProjection(draft, page, applets)) !==
      JSON.stringify(settingsProjection(saved, page, applets))
    );
  } catch {
    return true;
  }
}
const normalize = (text: string) => text.normalize('NFKC').toLowerCase();
export function searchSettings(pages: SettingsPageDefinition[], query: string): SettingsItem[] {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return pages
    .flatMap((page) => page.items.map((field) => ({ field, page })))
    .map(({ field, page }, order) => ({
      field,
      order,
      name: normalize(field.title),
      text: normalize(
        [
          field.title,
          field.description,
          field.key,
          page.title,
          page.owner,
          ...(field.keywords ?? []),
          ...(field.definition?.options?.map((o) => o.label) ?? []),
        ].join(' '),
      ),
    }))
    .filter((row) => words.every((w) => row.text.includes(w)))
    .map((row) => ({
      ...row,
      rank:
        row.name === normalize(query).trim() ? 0 : words.every((w) => row.name.includes(w)) ? 1 : 2,
    }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map((row) => row.field);
}

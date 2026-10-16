import type { ExtensionManifest, ExtensionSnapshot, Settings } from './contracts';
import { ribbonGroupIcons, type RibbonGroup } from './ribbon';

export type PageDisplay = 'page' | 'window';
export interface AppletPageDefinition {
  iconImage?: string;
  id: string;
  title: string;
  icon?: 'mail' | 'clock' | 'image' | 'folder' | 'extensions';
  source: 'local' | 'web-accounts';
  ui?: string;
  openCommand: string;
  defaultDisplay?: PageDisplay;
}
export interface RibbonItem {
  iconImage?: string;
  kind?: 'separator' | 'group';
  group?: RibbonGroup;
  id: string;
  title: string;
  icon: string;
  extensionId?: string;
  pageId?: string;
}
export const builtinRibbon: RibbonItem[] = [
  { id: 'home', title: 'ホーム', icon: 'home' },
  { id: 'extensions', title: 'Applet', icon: 'extensions' },
  { id: 'settings', title: '設定', icon: 'settings' },
  { id: 'logs', title: 'ログ', icon: 'logs' },
  { id: 'notifications', title: '通知センター', icon: 'bell' },
  { id: 'theme', title: 'テーマを切り替え', icon: 'sun' },
  { id: 'profile', title: 'プロフィール設定を開く', icon: 'settings' },
];
export const pageKey = (extensionId: string, pageId: string) => `page:${extensionId}:${pageId}`;
export const validPageId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^[a-z0-9][a-z0-9.-]{0,79}$/.test(id) &&
  !['constructor', 'prototype', '__proto__'].includes(id);
export const validRibbonId = (id: unknown): id is string =>
  typeof id === 'string' &&
  (builtinRibbon.some((item) => item.id === id) ||
    /^page:[a-z0-9][a-z0-9.-]{0,100}:[a-z0-9][a-z0-9.-]{0,79}$/.test(id) ||
    validSeparatorId(id) ||
    validGroupId(id));
export const validGroupId = (id: unknown): id is string =>
  typeof id === 'string' && /^group:[a-z0-9][a-z0-9-]{0,79}$/.test(id);
export const validSeparatorId = (id: unknown): id is string =>
  typeof id === 'string' && /^separator:[a-z0-9][a-z0-9-]{0,79}$/.test(id);
export const defaultRibbon = () => ({
  order: [] as string[],
  hidden: [] as string[],
  bottom: ['theme', 'profile'],
  separators: [] as string[],
  groups: [] as RibbonGroup[],
});

export function parseAppletPages(manifest: ExtensionManifest): AppletPageDefinition[] {
  const pages = manifest.pages;
  if (pages === undefined) return [];
  if (!Array.isArray(pages) || pages.length > 10 || !manifest.capabilities?.includes('pages'))
    throw Error('ページは10件以下の配列とpages capabilityが必要です。');
  const ids = new Set<string>();
  let web = false;
  return pages.map((page) => {
    if (
      !page ||
      !validPageId(page.id) ||
      ids.has(page.id) ||
      typeof page.title !== 'string' ||
      !page.title.trim() ||
      page.title.length > 80 ||
      /[\x00-\x1f\x7f]/.test(page.title) ||
      !['local', 'web-accounts'].includes(page.source) ||
      (page.icon !== undefined &&
        !['mail', 'clock', 'image', 'folder', 'extensions'].includes(page.icon)) ||
      (page.defaultDisplay !== undefined && !['page', 'window'].includes(page.defaultDisplay)) ||
      !manifest.commands?.some(
        (command) => command.id === page.openCommand && command.activateOnExecute,
      )
    )
      throw Error('ページのID・名前・アイコン・表示方法・起動コマンドを確認してください。');
    if (
      page.source === 'local' &&
      (typeof page.ui !== 'string' || !page.ui || !/\.html$/i.test(page.ui))
    )
      throw Error('ローカルページにはApplet内のHTMLファイルが必要です。');
    if (page.source === 'web-accounts') {
      if (
        web ||
        !manifest.webAccounts ||
        !manifest.capabilities?.includes('web-accounts') ||
        page.ui !== undefined
      )
        throw Error('Webアカウントのページは1つだけ宣言できます。');
      web = true;
    }
    ids.add(page.id);
    return { ...page, title: page.title.trim() };
  });
}
export function ribbonItems(
  extensions: ExtensionManifest[],
  separators: string[] = [],
  groups: RibbonGroup[] = [],
): RibbonItem[] {
  const applets = extensions.flatMap((extension) =>
    (extension.pages ?? []).map((page) => ({
      id: pageKey(extension.id, page.id),
      title: page.title,
      icon: page.icon ?? 'extensions',
      iconImage: page.iconImage,
      extensionId: extension.id,
      pageId: page.id,
    })),
  );
  return [
    ...builtinRibbon.slice(0, 4),
    ...applets,
    ...builtinRibbon.slice(4),
    ...separators.map((id, index): RibbonItem => ({
      id,
      title: `セパレーター ${index + 1}`,
      icon: '',
      kind: 'separator',
    })),
    ...groups.map((group): RibbonItem => ({
      id: group.id,
      title: group.title,
      icon: group.icon,
      kind: 'group',
      group,
    })),
  ];
}
export function visibleRibbonItems(
  extensions: ExtensionSnapshot[],
  separators: string[] = [],
  groups: RibbonGroup[] = [],
): RibbonItem[] {
  return ribbonItems(
    extensions.filter((extension) => extension.enabled),
    separators,
    groups,
  );
}
export function orderRibbon(items: RibbonItem[], order: string[]): RibbonItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  return [
    ...order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    ...items.filter((item) => !order.includes(item.id)),
  ];
}
export function pageDisplay(
  settings: Settings,
  extensionId: string,
  page: AppletPageDefinition,
): PageDisplay {
  return (
    settings.extensions[extensionId]?.pages?.[page.id]?.display ?? page.defaultDisplay ?? 'page'
  );
}

/** Shared validation for GUI settings saves and external ribbon edits. */
export function parseRibbon(value: unknown): Settings['ribbon'] {
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const rawRibbon = value === undefined ? defaultRibbon() : value;
  const ribbon = object(rawRibbon)
    ? {
        ...rawRibbon,
        bottom: rawRibbon.bottom === undefined ? [] : rawRibbon.bottom,
        separators: rawRibbon.separators === undefined ? [] : rawRibbon.separators,
        groups: rawRibbon.groups === undefined ? [] : rawRibbon.groups,
      }
    : rawRibbon;
  if (
    !object(ribbon) ||
    ['order', 'hidden', 'bottom', 'separators'].some((key) => {
      const ids = ribbon[key];
      return (
        !Array.isArray(ids) ||
        ids.length > (key === 'separators' ? 50 : 550) ||
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
  if (!Array.isArray(ribbon.groups) || ribbon.groups.length > 50)
    throw Error('リボングループは50件以下で指定してください。');
  const groups = ribbon.groups as RibbonGroup[];
  const groupIds = new Set<string>();
  const children = new Set<string>();
  for (const g of groups) {
    if (
      !object(g) ||
      Object.keys(g).some((k) => !['id', 'title', 'icon', 'expansion', 'children'].includes(k)) ||
      !validGroupId(g.id) ||
      groupIds.has(g.id) ||
      typeof g.title !== 'string' ||
      !g.title.trim() ||
      g.title.trim().length > 80 ||
      /[\x00-\x1f\x7f]/.test(g.title) ||
      !ribbonGroupIcons.includes(g.icon) ||
      !['persistent', 'temporary'].includes(g.expansion) ||
      !Array.isArray(g.children) ||
      g.children.length > 500 ||
      g.children.some(
        (id) =>
          !validRibbonId(id) ||
          validGroupId(id) ||
          children.has(id) ||
          (validSeparatorId(id) && !(ribbon.separators as string[]).includes(id)),
      ) ||
      new Set(g.children).size !== g.children.length
    )
      throw Error('グループのID・名前・アイコン・展開方法・子の所属を確認してください。');
    groupIds.add(g.id);
    for (const id of g.children) children.add(id);
  }
  const order = ribbon.order as string[],
    bottom = ribbon.bottom as string[];
  if (
    order.some((id) => children.has(id)) ||
    bottom.some((id) => children.has(id)) ||
    groups.some((g) => !order.includes(g.id)) ||
    ['order', 'hidden', 'bottom'].some((k) =>
      (ribbon[k] as string[]).some((id) => validGroupId(id) && !groupIds.has(id)),
    ) ||
    order.filter((id) => !validGroupId(id)).length + children.size > 500
  )
    throw Error('グループの子は1つの所属先だけに置き、グループをトップレベルへ配置してください。');
  ribbon.groups = groups.map((g) => ({ ...g, title: g.title.trim(), children: [...g.children] }));
  return ribbon as unknown as Settings['ribbon'];
}

import type { ExtensionManifest, ExtensionSnapshot, Settings } from './contracts';

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
  kind?: 'separator';
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
    validSeparatorId(id));
export const validSeparatorId = (id: unknown): id is string =>
  typeof id === 'string' && /^separator:[a-z0-9][a-z0-9-]{0,79}$/.test(id);
export const defaultRibbon = () => ({
  order: [] as string[],
  hidden: [] as string[],
  bottom: ['theme', 'profile'],
  separators: [] as string[],
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
  ];
}
export function visibleRibbonItems(
  extensions: ExtensionSnapshot[],
  separators: string[] = [],
): RibbonItem[] {
  return ribbonItems(
    extensions.filter((extension) => extension.enabled),
    separators,
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

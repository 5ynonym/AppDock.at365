export type WebNavigation = 'none' | 'same-origin' | 'any';
export interface WebProfile {
  id: string;
  name: string;
}
export interface WebApplet {
  id: string;
  name: string;
  url: string;
  accountId: string;
  enabled: boolean;
  display: 'page' | 'window';
  navigation: WebNavigation;
  allowedOrigins: string[];
  icon: string;
  imported?: Partial<Pick<WebApplet, 'name' | 'url' | 'icon' | 'navigation'>>;
}
export interface WebAppletSettings {
  items: WebApplet[];
}
export interface WebPageState {
  loading: boolean;
  error: string;
  origin: string;
  canGoBack: boolean;
  canGoForward: boolean;
}
export interface WebDefaults {
  name?: string;
  url?: string;
  icon?: string;
  navigation?: 'none' | 'same-origin';
  source?: string;
  message: string;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
export const webId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^web\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
export const profileId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^account\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
export function webUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 4096 || /[\x00-\x20\x7f]/.test(raw))
    throw Error('WebページにはHTTP(S)のURLを指定してください。');
  const u = new URL(raw);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
    throw Error('Webページには資格情報を含まないHTTP(S)のURLを指定してください。');
  return u.href;
}
export function webProfileName(v: unknown): string {
  if (typeof v !== 'string' || !v.trim() || v.length > 80 || /[\x00-\x1f\x7f]/.test(v))
    throw Error('名前は1～80文字で指定してください。');
  return v.trim();
}
export function parseWebProfiles(raw: unknown): WebProfile[] {
  if (!Array.isArray(raw) || raw.length > 32) throw Error('Webアカウントは32枠までです。');
  const ids = new Set<string>();
  return raw.map((a) => {
    if (!object(a) || !profileId(a.id) || ids.has(a.id))
      throw Error('WebアカウントのIDが不正または重複しています。');
    ids.add(a.id);
    return { id: a.id, name: webProfileName(a.name) };
  });
}
export function parseWebApplets(raw: unknown): WebAppletSettings {
  if (raw === undefined) return { items: [] };
  if (!object(raw) || !Array.isArray(raw.items) || raw.items.length > 64)
    throw Error('WebAppletは64件、Webアカウントは32枠までです。');
  // Validate the old roster for migration, but do not retain it in settings.
  const legacy = raw.accounts === undefined ? undefined : parseWebProfiles(raw.accounts);
  const itemIds = new Set<string>();
  const items = raw.items.map((a): WebApplet => {
    if (
      !object(a) ||
      !webId(a.id) ||
      itemIds.has(a.id) ||
      !profileId(a.accountId) ||
      (legacy !== undefined && !legacy.some((p) => p.id === a.accountId)) ||
      typeof a.enabled !== 'boolean' ||
      !['page', 'window'].includes(String(a.display)) ||
      !['none', 'same-origin', 'any'].includes(String(a.navigation)) ||
      !Array.isArray(a.allowedOrigins) ||
      a.allowedOrigins.length > 16
    )
      throw Error('WebAppletのID・アカウント・表示方法・ページ遷移を確認してください。');
    const origins = a.allowedOrigins.map((s) => {
      const u = new URL(webUrl(s));
      if (u.origin !== s) throw Error('追加の許可先はHTTP(S)のoriginを指定してください。');
      return u.origin;
    });
    if (new Set(origins).size !== origins.length) throw Error('追加の許可先が重複しています。');
    if (
      typeof a.icon !== 'string' ||
      a.icon.length > 24576 ||
      (a.icon && !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(a.icon))
    )
      throw Error('WebAppletのアイコンは取り込んだPNGを指定してください。');
    itemIds.add(a.id);
    let imported: WebApplet['imported'];
    if (a.imported !== undefined) {
      if (!object(a.imported)) throw Error('Web側の初期設定の記録が不正です。');
      imported = {};
      if (a.imported.name !== undefined) imported.name = webProfileName(a.imported.name);
      if (a.imported.url !== undefined) imported.url = webUrl(a.imported.url);
      if (a.imported.navigation !== undefined) {
        if (!['none', 'same-origin'].includes(String(a.imported.navigation)))
          throw Error('Web側の遷移設定が不正です。');
        imported.navigation = a.imported.navigation as 'none' | 'same-origin';
      }
      if (a.imported.icon !== undefined) {
        if (
          typeof a.imported.icon !== 'string' ||
          a.imported.icon.length > 24576 ||
          !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(a.imported.icon)
        )
          throw Error('Web側のアイコンが不正です。');
        imported.icon = a.imported.icon;
      }
    }
    return {
      id: a.id,
      name: webProfileName(a.name),
      url: webUrl(a.url),
      accountId: a.accountId,
      enabled: a.enabled,
      display: a.display as WebApplet['display'],
      navigation: a.navigation as WebNavigation,
      allowedOrigins: origins,
      icon: a.icon,
      ...(imported ? { imported } : {}),
    };
  });
  return { items };
}
export function allowedWebAppletNavigation(item: WebApplet, target: string): boolean {
  try {
    const u = new URL(webUrl(target));
    const initial = new URL(item.url);
    const documentUrl = (v: URL) => {
      const copy = new URL(v.href);
      copy.hash = '';
      return copy.href;
    };
    if (item.navigation === 'none')
      return documentUrl(u) === documentUrl(initial) || item.allowedOrigins.includes(u.origin);
    return (
      item.navigation === 'any' ||
      u.origin === initial.origin ||
      item.allowedOrigins.includes(u.origin)
    );
  } catch {
    return false;
  }
}
/** Remote JSON supplies a bounded set of defaults, never host settings or permissions. */
export function manifestDefaults(
  raw: unknown,
  manifestUrl: string,
  pageUrl: string,
): Omit<WebDefaults, 'icon' | 'message'> & { iconUrl?: string } {
  if (!object(raw)) throw Error('Web側の設定JSONがオブジェクトではありません。');
  const origin = new URL(pageUrl).origin;
  if (new URL(webUrl(manifestUrl)).origin !== origin)
    throw Error('設定JSONは同じoriginから取得してください。');
  const sameUrl = (v: unknown) => {
    if (typeof v !== 'string') return undefined;
    const u = new URL(v, manifestUrl);
    return webUrl(u.href) && u.origin === origin ? u.href : undefined;
  };
  const result: Omit<WebDefaults, 'icon' | 'message'> & { iconUrl?: string } = {
    source: manifestUrl,
  };
  if (typeof raw.short_name === 'string' || typeof raw.name === 'string')
    result.name = webProfileName(raw.short_name ?? raw.name);
  result.url = sameUrl(raw.start_url);
  if (Array.isArray(raw.icons))
    for (const i of raw.icons) {
      if (object(i)) {
        const u = sameUrl(i.src);
        if (u) {
          result.iconUrl = u;
          break;
        }
      }
    }
  if (object(raw.appdock)) {
    if (raw.appdock.schemaVersion !== undefined && raw.appdock.schemaVersion !== 1)
      throw Error('Web側の設定JSONの版に対応していません。');
    if (['none', 'same-origin'].includes(String(raw.appdock.navigation)))
      result.navigation = raw.appdock.navigation as 'none' | 'same-origin';
  }
  return result;
}

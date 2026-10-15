export interface WebProfile {
  id: string;
  name: string;
  owner?: string;
}
export interface WebPageState {
  loading: boolean;
  error: string;
  origin: string;
  canGoBack: boolean;
  canGoForward: boolean;
}
export interface RemotePageDefinition {
  id: string;
  name: string;
  url: string;
  accountId: string;
  enabled: boolean;
  display: 'page' | 'window';
  navigation: 'none' | 'same-origin' | 'any';
  allowedOrigins: string[];
  icon: string;
}
export const profileId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^account\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
export function webUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 4096 || /[\x00-\x20\x7f]/.test(raw))
    throw Error('WebページにはHTTP(S)のURLを指定してください。');
  const url = new URL(raw);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw Error('Webページには資格情報を含まないHTTP(S)のURLを指定してください。');
  return url.href;
}
export function webProfileName(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 80 ||
    /[\x00-\x1f\x7f]/.test(value)
  )
    throw Error('名前は1～80文字で指定してください。');
  return value.trim();
}
export function parseWebProfiles(raw: unknown): WebProfile[] {
  if (!Array.isArray(raw) || raw.length > 32) throw Error('Webアカウントは32枠までです。');
  const ids = new Set<string>();
  return raw.map((account) => {
    if (!account || typeof account !== 'object' || !profileId(account.id) || ids.has(account.id))
      throw Error('WebアカウントのIDが不正または重複しています。');
    ids.add(account.id);
    return { id: account.id, name: webProfileName(account.name) };
  });
}
export function allowedWebNavigation(item: RemotePageDefinition, target: string): boolean {
  try {
    const url = new URL(webUrl(target)),
      initial = new URL(item.url);
    const documentUrl = (value: URL) => {
      const copy = new URL(value.href);
      copy.hash = '';
      return copy.href;
    };
    if (item.navigation === 'none')
      return documentUrl(url) === documentUrl(initial) || item.allowedOrigins.includes(url.origin);
    return (
      item.navigation === 'any' ||
      url.origin === initial.origin ||
      item.allowedOrigins.includes(url.origin)
    );
  } catch {
    return false;
  }
}

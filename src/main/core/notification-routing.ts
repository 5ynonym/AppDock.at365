import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

// Use the original portable launcher, never its temporary extracted executable.
export function notificationProtocol(executable: string, profile: string, packaged: boolean) {
  const normalize = (value: string) => path.win32.resolve(value).toLowerCase();
  const identity = createHash('sha256')
    .update(JSON.stringify([normalize(executable), normalize(profile), packaged]))
    .digest('hex')
    .slice(0, 32);
  return `appdock-notify-${identity}`;
}

export function notificationToken(argv: string[], protocol: string): string | undefined {
  for (const argument of argv) {
    if (!argument.startsWith(`${protocol}:`)) continue;
    try {
      const url = new URL(argument);
      if (
        url.protocol === `${protocol}:` &&
        url.hostname === 'notification' &&
        !url.username &&
        !url.password &&
        !url.port &&
        !url.search &&
        !url.hash &&
        /^\/[a-f0-9-]{36}$/.test(url.pathname)
      )
        return url.pathname.slice(1);
    } catch {}
  }
}

const xml = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function notificationXml(title: string, body: string, silent: boolean, url: string) {
  return `<toast activationType="protocol" launch="${xml(url)}"><visual><binding template="ToastGeneric"><text>${xml(title)}</text><text>${xml(body)}</text></binding></visual>${silent ? '<audio silent="true"/>' : ''}</toast>`;
}

export class NotificationRoutes {
  private callbacks = new Map<string, () => void>();
  constructor(readonly protocol: string) {}
  add(callback: () => void) {
    // Notifications may remain in Action Center after a timeout. Keep their
    // callbacks, bounded, until activated; a stale/previous-run token only opens
    // the host and can never execute a command supplied by an external URI.
    if (this.callbacks.size >= 512) this.callbacks.delete(this.callbacks.keys().next().value!);
    const token = randomUUID();
    this.callbacks.set(token, callback);
    return `${this.protocol}://notification/${token}`;
  }
  activate(argv: string[], fallback: () => void) {
    const token = notificationToken(argv, this.protocol);
    if (!token) return false;
    const callback = this.callbacks.get(token);
    this.callbacks.delete(token);
    (callback ?? fallback)();
    return true;
  }
}

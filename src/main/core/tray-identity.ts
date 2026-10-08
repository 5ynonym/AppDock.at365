import { createHash } from 'node:crypto';
import path from 'node:path';

// Windows binds an unsigned tray GUID to the actual executable path. Include
// that path so moving an installation never reuses a GUID bound elsewhere.
export function trayIdentity(executable: string, profile: string): string {
  const normalize = (value: string) => path.win32.resolve(value).toLowerCase();
  const namespace = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const bytes = createHash('sha1')
    .update(namespace)
    .update(JSON.stringify(['at365.appdock.tray', normalize(executable), normalize(profile)]))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { TypedNotifications } from './typed-notifications';
/** A PC-local receipt prevents replaying the same updater result after another ordinary restart. */
export function publishUpdateResult(
  bytes: string,
  options: {
    typed: TypedNotifications;
    receiptFile: string;
    openDetails(): Promise<void>;
    warn(message: string): void;
  },
) {
  const result = JSON.parse(bytes);
  if (result?.ok !== true) return false;
  const hash = createHash('sha256').update(bytes).digest('hex');
  let writable = true;
  if (fs.existsSync(options.receiptFile)) {
    try {
      const previous = JSON.parse(fs.readFileSync(options.receiptFile, 'utf8'));
      if (previous.schemaVersion === 1 && previous.lastHash === hash) return true;
      if (previous.schemaVersion !== 1) {
        writable = false;
        options.warn('更新通知の受付済み記録が未対応の形式です。上書きしません。');
      }
    } catch {
      options.warn('更新通知の受付済み記録を読み込めません。');
    }
  }
  options.typed.publish({ ownerKind: 'host', ownerId: 'updates' }, 'applied', {
    level: 'info',
    title: '更新を適用しました',
    body: 'AppDockと対象Appletの更新が完了しました。',
    dedupeKey: hash,
    historyText: { title: '更新を適用しました', body: '更新処理が完了しました。' },
    actions: [{ key: 'details', label: '更新画面を開く', run: options.openDetails }],
  });
  // Suppressed results are consumed too, so switching preferences back on does not replay old updates.
  if (!writable) return true;
  let temp = '';
  try {
    fs.mkdirSync(path.dirname(options.receiptFile), { recursive: true });
    temp = options.receiptFile + '.tmp-' + randomUUID();
    fs.writeFileSync(temp, JSON.stringify({ schemaVersion: 1, lastHash: hash }), 'utf8');
    fs.renameSync(temp, options.receiptFile);
  } catch {
    options.warn('更新通知の受付済み記録を保存できません。次回起動で再表示する場合があります。');
  } finally {
    if (temp && fs.existsSync(temp))
      try {
        fs.unlinkSync(temp);
      } catch {}
  }
  return true;
}

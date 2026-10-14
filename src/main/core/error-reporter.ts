import { createHash } from 'node:crypto';
import type { TypedNotifications } from './typed-notifications';

/** Only explicitly sanitized, user-facing messages belong in this shared reporting path. */
export interface ReportableError {
  eventId: string;
  source: string;
  title: string;
  code: string;
  message: string;
}

/** One log and one configurable notification per failure; reporting never changes its outcome. */
export class ErrorReporter {
  private seen = new Set<string>();
  constructor(
    private options: {
      notifications(): TypedNotifications | undefined;
      log(source: string, message: string): void;
    },
  ) {}

  report(error: ReportableError): void {
    const key = JSON.stringify([error.source, error.eventId]);
    if (this.seen.has(key)) return;
    this.seen.add(key);
    while (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
    const title = error.title.slice(0, 200),
      body = `${error.message}\nエラーコード: ${error.code}`.slice(0, 2000);
    const write = (message: string) => {
      try {
        this.options.log(error.source, message);
      } catch {
        // Do not recursively report a broken logging sink.
      }
    };
    write(`[ERROR] eventId=${error.eventId} ${title}\n${body}`);
    try {
      this.options
        .notifications()
        ?.publish({ ownerKind: 'host', ownerId: 'errors' }, 'operation-failed', {
          level: 'error',
          title,
          body,
          historyText: { title, body },
          dedupeKey: createHash('sha256').update(key).digest('hex'),
        });
    } catch {
      write('エラー通知を表示できませんでした。失敗の内容は直前のログを確認してください。');
    }
  }
}

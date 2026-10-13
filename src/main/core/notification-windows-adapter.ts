import { randomUUID } from 'node:crypto';
import { legacyNotificationTypeId } from '../../shared/notification-types';
import {
  showNotification,
  type NativeNotificationInput,
  type NativeNotificationHandle,
} from './notifications';
import type { NotificationService } from './notification-service';
type Slot = { signature: string; handle?: NativeNotificationHandle; activated?: boolean };
/** Best-effort OS projection. OS timeout/close never resolves the business notification. */
export class NotificationWindowsAdapter {
  private slots = new Map<string, Slot>();
  private stop: () => void;
  private queued = false;
  private disposed = false;
  constructor(
    private service: NotificationService,
    private options: {
      openCenter(): Promise<void>;
      failed(): void;
      ready?(): boolean;
      deliver?(input: NativeNotificationInput): NativeNotificationHandle;
    },
  ) {
    this.stop = service.subscribe(() => {
      if (!this.queued) {
        this.queued = true;
        queueMicrotask(() => {
          this.queued = false;
          this.refresh();
        });
      }
    });
    this.refresh();
  }
  private async activate(id: string) {
    const item = this.service.targetItems('windows').find((i) => i.id === id);
    if (!item) {
      await this.options.openCenter();
      return;
    }
    const actionId = this.service.windowsOptions(id).actionId;
    if (actionId)
      await this.service.invoke({
        notificationId: id,
        revision: item.revision,
        requestId: randomUUID(),
        type: 'invoke',
        actionId,
      });
    else await this.options.openCenter();
  }
  refresh() {
    if (this.disposed || this.options.ready?.() === false) return;
    const items = this.service.targetItems('windows'),
      ids = new Set(items.map((i) => i.id));
    for (const [id, slot] of this.slots)
      if (!ids.has(id)) {
        this.slots.delete(id);
        try {
          slot.handle?.close();
        } catch {
          this.options.failed();
        }
      }
    for (const item of items) {
      const silent = this.service.windowsOptions(item.id).silent;
      const signature = JSON.stringify([item.title, item.body, item.level, silent]);
      const old = this.slots.get(item.id);
      if (old?.signature === signature) continue;
      // Replace only changed content; reads, delivery reports and busy state never repost a toast.
      this.slots.delete(item.id);
      try {
        old?.handle?.close();
      } catch {
        this.options.failed();
      }
      const slot: Slot = { signature };
      this.slots.set(item.id, slot);
      this.service.setDelivery('windows', [item.id], 'pending');
      const state = (value: 'accepted' | 'hidden' | 'failed') => {
        if (this.disposed || this.slots.get(item.id) !== slot) return;
        this.service.setDelivery('windows', [item.id], value);
      };
      try {
        const legacy =
          item.typeId === legacyNotificationTypeId ||
          this.service.windowsOptions(item.id).actionId !== undefined;
        const labels = { info: 'インフォメーション', warning: '警告', error: 'エラー' };
        slot.handle = (this.options.deliver ?? showNotification)({
          id: item.id,
          title: legacy ? item.title : labels[item.level] + '：' + item.title,
          body: item.body + (item.actions.length && !legacy ? '\n通知を開いて操作できます。' : ''),
          level: item.level,
          silent,
          clicked: () => {
            if (this.disposed || this.slots.get(item.id) !== slot || slot.activated) return;
            slot.activated = true;
            void this.activate(item.id).catch(() => this.options.failed());
          },
          failed: () => {
            state('failed');
            this.options.failed();
          },
          closed: () => state('hidden'),
        });
        // A synchronous transport failure callback must not be overwritten as accepted.
        const current = this.service.list().find((i) => i.id === item.id);
        if (current?.delivery.windows === 'pending') state('accepted');
      } catch {
        state('failed');
        this.options.failed();
      }
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    // Keep Windows history at shutdown; invalidate in-memory callbacks without restoring them next launch.
    for (const slot of this.slots.values()) {
      try {
        slot.handle?.release();
      } catch {
        this.options.failed();
      }
    }
    this.slots.clear();
  }
}

import { createHash } from 'node:crypto';
import type { Settings, ExtensionSnapshot } from '../../shared/contracts';
import {
  notificationCatalog,
  notificationTypeKey,
  resolveNotificationPolicy,
  type NotificationOwner,
  type NotificationPolicy,
  type NotificationPublishResult,
} from '../../shared/notification-types';
import type { NotificationService, NotificationInput } from './notification-service';
type Binding = {
  owner: NotificationOwner;
  typeId: string;
  generation?: string;
  input: NotificationInput;
  lifetime: NotificationInput['lifetime'];
};
export interface NotificationPublication {
  notificationId: string;
  owner: NotificationOwner;
  typeId: string;
  generation?: string;
  title: string;
  body: string;
  createdAt: number;
}
export class TypedNotifications {
  private bindings = new Map<string, Binding>();
  private fingerprint = '';
  private reconciling = false;
  private rates = new Map<string, { tokens: number; at: number }>();
  private unsubscribe: () => void;
  constructor(
    private service: NotificationService,
    private options: {
      settings(): Settings;
      applets(): ExtensionSnapshot[];
      generation(id: string): string | undefined;
      changed(): void;
      policyChanged(id: string): void;
      now?(): number;
      published?(event: NotificationPublication): void;
      publicationFailed?(): void;
    },
  ) {
    this.unsubscribe = service.subscribe(() => {
      const active = new Set(
        service
          .list()
          .filter((i) => i.status === 'active')
          .map((i) => i.id),
      );
      for (const id of this.bindings.keys()) if (!active.has(id)) this.bindings.delete(id);
    });
  }
  private source(owner: NotificationOwner) {
    return owner.ownerKind + '.' + owner.ownerId;
  }
  policy(owner: NotificationOwner, typeId: string): NotificationPolicy {
    const type = notificationCatalog(this.options.applets()).find(
      (t) => notificationTypeKey(t) === notificationTypeKey({ ...owner, typeId }),
    );
    if (!type) throw Error('宣言された通知種類がありません。');
    return resolveNotificationPolicy(type, this.options.settings());
  }
  publish(
    owner: NotificationOwner,
    typeId: string,
    content: Omit<NotificationInput, 'lifetime' | 'targets' | 'dismissible' | 'history'>,
    generation?: string,
  ): NotificationPublishResult {
    this.reconcile();
    const type = notificationCatalog(this.options.applets()).find(
      (t) => notificationTypeKey(t) === notificationTypeKey({ ...owner, typeId }),
    );
    if (!type) throw Error('宣言された通知種類がありません。');
    if (!type.levels.includes(content.level)) throw Error('通知のレベルが種類の定義に合いません。');
    if (
      owner.ownerKind === 'applet' &&
      (!generation || this.options.generation(owner.ownerId) !== generation)
    )
      throw Error('通知の発行元が停止しました。');
    // Validate content even when preferences suppress delivery.
    if (
      typeof content.title !== 'string' ||
      content.title.length > 200 ||
      typeof content.body !== 'string' ||
      content.body.length > 2000 ||
      (content.dedupeKey !== undefined && (!content.dedupeKey || content.dedupeKey.length > 200)) ||
      (type.history === 'persistent' &&
        (!content.historyText ||
          typeof content.historyText.title !== 'string' ||
          content.historyText.title.length > 200 ||
          typeof content.historyText.body !== 'string' ||
          content.historyText.body.length > 2000))
    )
      throw Error('通知の内容が不正です。');
    if (owner.ownerKind === 'applet') {
      const now = (this.options.now ?? Date.now)(),
        key = owner.ownerId;
      const rate = this.rates.get(key) ?? { tokens: 20, at: now };
      rate.tokens = Math.min(20, rate.tokens + Math.max(0, now - rate.at) / 100);
      rate.at = now;
      this.rates.set(key, rate);
      if (rate.tokens < 1) throw Error('通知の発行頻度を超えました。');
      rate.tokens--;
    }
    const policy = resolveNotificationPolicy(type, this.options.settings());
    if (!policy.enabled) return { status: 'suppressed', reason: policy.reason! };
    const key =
      content.dedupeKey === undefined
        ? undefined
        : createHash('sha256')
            .update(JSON.stringify([typeId, content.dedupeKey]))
            .digest('hex');
    const previous =
      key === undefined
        ? undefined
        : [...this.bindings].find(
            ([, b]) =>
              notificationTypeKey({ ...b.owner, typeId: b.typeId }) ===
                notificationTypeKey({ ...owner, typeId }) && b.input.dedupeKey === key,
          );
    const lifetime = previous && !content.restartTimer ? previous[1].lifetime : policy.lifetime;
    const input: NotificationInput = {
      ...content,
      dedupeKey: key,
      lifetime,
      targets: policy.targets,
      dismissible:
        previous && !content.restartTimer ? previous[1].input.dismissible : policy.dismissible,
      history: type.history,
    };
    const notificationId = this.service.upsert(this.source(owner), input);
    this.service.identify(notificationId, owner, typeId);
    this.bindings.set(notificationId, { owner: { ...owner }, typeId, generation, input, lifetime });
    if (!previous) {
      try {
        this.options.published?.({
          notificationId,
          owner: { ...owner },
          typeId,
          generation,
          title: content.title,
          body: content.body,
          createdAt: (this.options.now ?? Date.now)(),
        });
      } catch {
        this.options.publicationFailed?.();
      }
    }
    return { status: 'accepted', notificationId };
  }
  isActive(owner: NotificationOwner, id: string) {
    this.reconcile();
    const binding = this.bindings.get(id);
    return (
      !!binding &&
      binding.owner.ownerKind === owner.ownerKind &&
      binding.owner.ownerId === owner.ownerId
    );
  }
  end(
    owner: NotificationOwner,
    id: string,
    generation?: string,
    status: 'resolved' | 'withdrawn' = 'resolved',
  ) {
    const binding = this.bindings.get(id);
    if (
      !binding ||
      notificationTypeKey({ ...binding.owner, typeId: '' }) !==
        notificationTypeKey({ ...owner, typeId: '' }) ||
      binding.generation !== generation ||
      (owner.ownerKind === 'applet' && this.options.generation(owner.ownerId) !== generation)
    )
      throw Error('通知の所有者または実行世代が一致しません。');
    this.service.end(this.source(owner), id, status);
  }
  reconcile() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      // Reconcile real-time expiry before reading episode bindings, even if the timer was delayed.
      this.service.list();
      const catalog = notificationCatalog(this.options.applets()),
        settings = this.options.settings();
      const fingerprint = JSON.stringify([catalog, settings.notificationPreferences]);
      const changed = fingerprint !== this.fingerprint;
      this.fingerprint = fingerprint;
      for (const [id, binding] of [...this.bindings]) {
        const type = catalog.find(
          (t) =>
            notificationTypeKey(t) ===
            notificationTypeKey({ ...binding.owner, typeId: binding.typeId }),
        );
        const stopped =
          binding.owner.ownerKind === 'applet' &&
          this.options.generation(binding.owner.ownerId) !== binding.generation;
        const policy = type && resolveNotificationPolicy(type, settings);
        if (stopped || !policy?.enabled) {
          this.service.end(
            this.source(binding.owner),
            id,
            'withdrawn',
            stopped ? 'source-stopped' : (policy?.reason ?? 'type-removed'),
          );
        } else if (JSON.stringify(binding.input.targets) !== JSON.stringify(policy.targets)) {
          binding.input = { ...binding.input, targets: policy.targets, restartTimer: false };
          this.service.upsert(
            this.source(binding.owner),
            { ...binding.input, dedupeKey: binding.input.dedupeKey },
            id,
          );
        }
      }
      if (changed) {
        for (const a of this.options.applets())
          if (this.options.generation(a.id)) this.options.policyChanged(a.id);
        this.options.changed();
      }
      const owners = new Set(this.options.applets().map((a) => a.id));
      for (const key of this.rates.keys()) if (!owners.has(key)) this.rates.delete(key);
    } finally {
      this.reconciling = false;
    }
  }
  dispose() {
    this.unsubscribe();
    this.bindings.clear();
    this.rates.clear();
  }
}

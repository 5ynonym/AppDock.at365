import type { ExtensionSnapshot, Settings } from './contracts';
import type { NotificationLevel, NotificationLifetime, NotificationTarget } from './notifications';
export interface NotificationOwner {
  ownerKind: 'host' | 'applet';
  ownerId: string;
}
export interface NotificationTypeDefinition {
  typeId: string;
  title: string;
  description: string;
  levels: NotificationLevel[];
  defaultLevel: NotificationLevel;
  defaultEnabled: boolean;
  canDisable: boolean;
  disabledControlReason: string;
  allowedTargets: NotificationTarget[];
  defaultTargets: NotificationTarget[];
  requiredTargets: NotificationTarget[];
  lifetimePolicy: 'userDuration' | 'fixedManual' | 'condition';
  defaultDurationSeconds?: number | null;
  history: 'persistent' | 'session' | 'none';
}
export interface NotificationTypeEntry extends NotificationTypeDefinition, NotificationOwner {
  ownerTitle: string;
  ownerState: string;
}
export interface NotificationPreference extends NotificationOwner {
  typeId: string;
  enabled?: boolean;
  targets?: NotificationTarget[];
  durationSeconds?: number | null;
}
export interface NotificationPreferences {
  overrides: NotificationPreference[];
}
export interface NotificationPolicy {
  enabled: boolean;
  selectedTargets: NotificationTarget[];
  targets: NotificationTarget[];
  lifetime: NotificationLifetime;
  dismissible: boolean;
  durationSeconds: number | null;
  reason?: string;
}
export interface TypedNotificationInput {
  typeId: string;
  title: string;
  body: string;
  level?: NotificationLevel;
  dedupeKey?: string;
  historyText?: { title: string; body: string };
  actions?: {
    key: string;
    label: string;
    primary?: boolean;
    disabled?: boolean;
    command: string;
  }[];
  restartTimer?: boolean;
}
export type NotificationPublishResult =
  { status: 'accepted'; notificationId: string } | { status: 'suppressed'; reason: string };
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[a-z0-9][a-z0-9._-]{0,100}$/.test(v) &&
  !['constructor', 'prototype', '__proto__'].includes(v);
const targetNames = ['banner', 'desktop', 'windows'];
export const availableNotificationTargets: NotificationTarget[] = ['banner', 'desktop'];
const targets = (v: unknown): v is NotificationTarget[] =>
  Array.isArray(v) &&
  v.length <= 3 &&
  v.every((t) => targetNames.includes(t)) &&
  new Set(v).size === v.length;
const duration = (v: unknown) =>
  v === null || (Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 86400);
export const notificationTypeKey = (v: NotificationOwner & { typeId: string }) =>
  JSON.stringify([v.ownerKind, v.ownerId, v.typeId]);
export const notificationSettingKey = (v: NotificationOwner & { typeId: string }) =>
  encodeURIComponent(notificationTypeKey(v));
export function parseNotificationTypes(value: unknown, host = false): NotificationTypeDefinition[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 64) throw Error('通知種類は64件以下です。');
  const keys = [
    'typeId',
    'title',
    'description',
    'levels',
    'defaultLevel',
    'defaultEnabled',
    'canDisable',
    'disabledControlReason',
    'allowedTargets',
    'defaultTargets',
    'requiredTargets',
    'lifetimePolicy',
    'defaultDurationSeconds',
    'history',
  ];
  const result = value.map((v) => {
    if (
      !object(v) ||
      Object.keys(v).some((k) => !keys.includes(k)) ||
      !id(v.typeId) ||
      typeof v.title !== 'string' ||
      !v.title.trim() ||
      v.title.length > 100 ||
      typeof v.description !== 'string' ||
      v.description.length > 1000 ||
      !Array.isArray(v.levels) ||
      !v.levels.length ||
      v.levels.length > 3 ||
      new Set(v.levels).size !== v.levels.length ||
      v.levels.some((l: unknown) => !['info', 'warning', 'error'].includes(String(l))) ||
      !v.levels.includes(v.defaultLevel) ||
      typeof v.defaultEnabled !== 'boolean' ||
      typeof v.canDisable !== 'boolean' ||
      typeof v.disabledControlReason !== 'string' ||
      v.disabledControlReason.length > 1000 ||
      !targets(v.allowedTargets) ||
      !targets(v.defaultTargets) ||
      !targets(v.requiredTargets) ||
      [...v.defaultTargets, ...v.requiredTargets].some((t) => !v.allowedTargets.includes(t)) ||
      v.requiredTargets.some((t) => !v.defaultTargets.includes(t)) ||
      !['userDuration', 'fixedManual', 'condition'].includes(v.lifetimePolicy) ||
      !['persistent', 'session', 'none'].includes(v.history) ||
      (v.defaultDurationSeconds !== undefined &&
        (v.lifetimePolicy !== 'userDuration' || !duration(v.defaultDurationSeconds))) ||
      (!v.canDisable &&
        (!host ||
          !v.defaultEnabled ||
          !v.requiredTargets.length ||
          !v.disabledControlReason.trim()))
    )
      throw Error('通知種類の定義が不正です。');
    return structuredClone(v) as NotificationTypeDefinition;
  });
  if (new Set(result.map((v) => v.typeId)).size !== result.length)
    throw Error('通知種類IDが重複しています。');
  return result;
}
export function parseNotificationPreferences(value: unknown): NotificationPreferences {
  if (value === undefined) return { overrides: [] };
  if (
    !object(value) ||
    Object.keys(value).some((k) => k !== 'overrides') ||
    !Array.isArray(value.overrides) ||
    value.overrides.length > 1024
  )
    throw Error('通知設定の形式が不正です。');
  const rows = value.overrides.map((v: unknown) => {
    if (
      !object(v) ||
      Object.keys(v).some(
        (k) =>
          !['ownerKind', 'ownerId', 'typeId', 'enabled', 'targets', 'durationSeconds'].includes(k),
      ) ||
      !['host', 'applet'].includes(v.ownerKind) ||
      !id(v.ownerId) ||
      !id(v.typeId) ||
      (v.enabled !== undefined && typeof v.enabled !== 'boolean') ||
      (v.targets !== undefined && !targets(v.targets)) ||
      (v.durationSeconds !== undefined && !duration(v.durationSeconds))
    )
      throw Error('通知設定の値が不正です。');
    return structuredClone(v) as NotificationPreference;
  });
  if (new Set(rows.map(notificationTypeKey)).size !== rows.length)
    throw Error('通知設定が重複しています。');
  return { overrides: rows };
}
export const settingsNotificationType: NotificationTypeEntry = {
  ownerKind: 'host',
  ownerId: 'settings',
  ownerTitle: 'AppDock',
  ownerState: 'running',
  typeId: 'unsaved-changes',
  title: '未保存の変更',
  description: '未保存の変更や保存できない設定を案内します。',
  levels: ['warning', 'error'],
  defaultLevel: 'warning',
  defaultEnabled: true,
  canDisable: false,
  disabledControlReason: '変更を失わないため、設定を保存または破棄するまで表示します。',
  allowedTargets: ['banner'],
  defaultTargets: ['banner'],
  requiredTargets: ['banner'],
  lifetimePolicy: 'condition',
  history: 'persistent',
};
export function notificationCatalog(applets: ExtensionSnapshot[]): NotificationTypeEntry[] {
  return [
    structuredClone(settingsNotificationType),
    {
      ...structuredClone(settingsNotificationType),
      ownerId: 'updates',
      typeId: 'applied',
      title: '更新適用完了',
      description: '更新後の再起動で、更新を適用したことを通知します。',
      levels: ['info'],
      defaultLevel: 'info',
      canDisable: true,
      disabledControlReason: '',
      allowedTargets: ['banner', 'desktop', 'windows'],
      requiredTargets: [],
      lifetimePolicy: 'userDuration',
      defaultDurationSeconds: 6,
    },
    ...applets.flatMap((a) =>
      (a.notificationTypes ?? []).map((t) => ({
        ...t,
        ownerKind: 'applet' as const,
        ownerId: a.id,
        ownerTitle: a.displayName,
        ownerState: a.state,
      })),
    ),
  ];
}
export function resolveNotificationPolicy(
  type: NotificationTypeEntry,
  settings: Settings,
): NotificationPolicy {
  const row = settings.notificationPreferences?.overrides.find(
    (r) => notificationTypeKey(r) === notificationTypeKey(type),
  );
  const invalidTargets = row?.targets?.some((t) => !type.allowedTargets.includes(t));
  const selectedTargets = [
    ...new Set([
      ...(row?.targets ?? type.defaultTargets).filter((t) => type.allowedTargets.includes(t)),
      ...type.requiredTargets,
    ]),
  ];
  const seconds =
    type.lifetimePolicy === 'userDuration'
      ? row?.durationSeconds !== undefined
        ? row.durationSeconds
        : (type.defaultDurationSeconds ?? null)
      : null;
  const enabled = !type.canDisable || (row?.enabled ?? type.defaultEnabled);
  const available = selectedTargets.filter((t) => availableNotificationTargets.includes(t));
  const reason = !enabled
    ? 'type-disabled'
    : type.ownerKind === 'applet' && !settings.host.notifications
      ? 'applet-disabled'
      : invalidTargets && type.canDisable
        ? 'type-definition-changed'
        : selectedTargets.length > 0 && !available.length
          ? 'no-available-targets'
          : undefined;
  return {
    enabled: !reason,
    selectedTargets,
    targets: available,
    durationSeconds: seconds,
    lifetime:
      type.lifetimePolicy === 'condition'
        ? { type: 'condition' }
        : seconds === null
          ? { type: 'manual' }
          : { type: 'timed', milliseconds: seconds * 1000 },
    dismissible: type.lifetimePolicy !== 'condition',
    reason,
  };
}
export function validateNotificationPreferenceChanges(
  next: Settings,
  previous: Settings,
  catalog: NotificationTypeEntry[],
) {
  for (const row of next.notificationPreferences?.overrides ?? []) {
    const prior = previous.notificationPreferences?.overrides.find(
      (r) => notificationTypeKey(r) === notificationTypeKey(row),
    );
    if (JSON.stringify(prior) === JSON.stringify(row)) continue;
    const type = catalog.find((t) => notificationTypeKey(t) === notificationTypeKey(row));
    if (!type) continue;
    if (
      (!type.canDisable && row.enabled === false) ||
      (row.durationSeconds !== undefined && type.lifetimePolicy !== 'userDuration') ||
      row.targets?.some((t) => !type.allowedTargets.includes(t)) ||
      type.requiredTargets.some((t) => row.targets !== undefined && !row.targets.includes(t))
    )
      throw Error(type.title + ': 通知種類の制約に合わない設定です。');
  }
}

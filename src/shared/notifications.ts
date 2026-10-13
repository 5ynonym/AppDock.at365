import type { ShellAppletApi } from './shell';
export type NotificationLevel = 'info' | 'warning' | 'error';
export type NotificationStatus =
  'active' | 'resolved' | 'dismissed' | 'expired' | 'withdrawn' | 'interrupted';
export type NotificationTarget = 'banner' | 'desktop' | 'windows';
export type NotificationLifetime =
  { type: 'timed'; milliseconds: number } | { type: 'manual' | 'condition' };
export interface NotificationItem {
  id: string;
  revision: number;
  source: string;
  level: NotificationLevel;
  title: string;
  body: string;
  actions: { id: string; label: string; primary: boolean; disabled: boolean }[];
  dismissible: boolean;
  busy: boolean;
  status: NotificationStatus;
  createdAt: number;
  updatedAt: number;
  endedAt?: number;
  expiresAt?: number;
  read: boolean;
  targets: NotificationTarget[];
  delivery: Partial<
    Record<NotificationTarget, 'pending' | 'showing' | 'hidden' | 'failed' | 'ended'>
  >;
}
export interface NotificationHistoryEntry extends Omit<
  NotificationItem,
  'actions' | 'busy' | 'dismissible'
> {}
export interface NotificationActionRequest {
  notificationId: string;
  revision: number;
  requestId: string;
  actionId?: string;
  type: 'invoke' | 'dismiss';
}
export interface NotificationBannerModel {
  schemaVersion: 1;
  contextId: 'primary';
  sessionId: string;
  revision: number;
  dark: boolean;
  items: NotificationItem[];
  viewport: { width: number; maxHeight: number };
}
export interface NotificationBannerApi extends ShellAppletApi {
  connect(): Promise<{
    sessionId: string;
    providerAppletId: string;
    snapshot: NotificationBannerModel;
  }>;
  ready(sessionId: string): Promise<void>;
  act(request: NotificationActionRequest): Promise<void>;
  resize(height: number): Promise<void>;
  focusHost(): Promise<void>;
  onFocus(callback: () => void): () => void;
  onChanged(callback: (model: NotificationBannerModel) => void): () => void;
}

import type { Settings } from './contracts';

/** Private host adapter state. This is never a Shell presentation model. */
export interface SettingsEditingState {
  sessionId: string;
  editRevision: number;
  revision: number;
  draft: Settings;
  text: string;
  mode: 'form' | 'json';
  dirty: boolean;
  parseError: string;
  saveError: string;
  pending: boolean;
  avatarLoading: boolean;
  avatarChanged: boolean;
  avatarPreview?: string | null;
  pageId: string;
  buffers: Record<string, string>;
}
export type SettingsEdit =
  | { type: 'select-page'; pageId: string }
  | { type: 'page-values'; pageId: string; value: Record<string, unknown> }
  | { type: 'partial-text'; pageId: string; value: string }
  | { type: 'draft'; value: Settings }
  | { type: 'mode'; value: 'form' | 'json' }
  | { type: 'avatar'; bytes: Uint8Array | null; name?: string }
  | { type: 'avatar-loading'; value: boolean }
  | { type: 'save' | 'discard' | 'reload' };
export interface SettingsEditRequest {
  sessionId: string;
  operationId: string;
  editRevision: number;
  action: SettingsEdit;
}

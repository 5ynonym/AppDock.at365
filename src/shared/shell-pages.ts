import type { LogEntry } from './contracts';
import type { ShellAppletApi } from './shell';

export type LogScope = { type: 'all' } | { type: 'applet'; id: string } | { type: 'web' };
export interface LogFilters {
  source: string;
  level: 'all' | 'info' | 'warn' | 'error';
  text: string;
}
/** Requests belong to a mounted host slot, not to the presentation provider. */
export interface ShellPageRequest {
  id: string;
  route: string;
  kind: 'logs';
  scope: LogScope;
  source: string;
}
export interface ShellPageViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ShellPageModel {
  schemaVersion: 1;
  id: string;
  contextId: 'primary';
  kind: 'logs';
  revision: number;
  dark: boolean;
  content: {
    scope: LogScope;
    filters: LogFilters;
    sources: { id: string; title: string }[];
    entries: LogEntry[];
    limit: number;
  };
}
export type ShellPageAction =
  { id: string; type: 'filters'; filters: LogFilters } | { id: string; type: 'open-directory' };
export interface ShellPageApi extends ShellAppletApi {
  connect(): Promise<{ sessionId: string; providerAppletId: string; snapshot: ShellPageModel }>;
  ready(sessionId: string): Promise<void>;
  act(action: ShellPageAction): Promise<void>;
  onChanged(callback: (model: ShellPageModel) => void): () => void;
  focusHost(edge: 'before' | 'after'): Promise<void>;
  onFocus(callback: (edge: 'first' | 'last') => void): () => void;
  /** Keyboard shortcuts retain host routing while text input stays local. */
  shortcut(key: string): Promise<unknown>;
}

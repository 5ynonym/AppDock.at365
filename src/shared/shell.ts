/** Public presentation contract. No renderer implementation or host internals. */
export const defaultShellId = 'appdock.default-shell';
export interface RibbonView {
  schemaVersion: 1;
  epoch: string;
  revision: number;
  contextId: 'primary';
  dark: boolean;
  route: string;
  contextActionId: string;
  items: {
    id: string;
    kind: 'button' | 'separator';
    title: string;
    tooltip: string;
    placement: 'top' | 'bottom';
    selected: boolean;
    enabled: boolean;
    disabledReason?: string;
    actionId?: string;
    icon: { name?: string; assetId?: string; text?: string };
  }[];
}
export interface UiActionRequest {
  contextId?: 'primary';
  epoch: string;
  requestId: string;
  actionId: string;
}
export interface ShellConnection {
  providerAppletId: string;
  contextId: 'primary';
  sessionId: string;
  bindingId: 'primary';
  snapshot: RibbonView;
}
export interface ShellApi {
  focusHost(edge: 'before' | 'after'): Promise<void>;
  onFocus(callback: (edge: 'first' | 'last') => void): () => void;
  connect(): Promise<ShellConnection>;
  ready(sessionId: string): Promise<void>;
  dispose(sessionId: string): Promise<void>;
  get(): Promise<RibbonView>;
  asset(id: string): Promise<{ dataUrl: string }>;
  invoke(request: UiActionRequest): Promise<unknown>;
  onChanged(callback: (snapshot: RibbonView) => void): () => void;
}
export interface ShellStatus {
  selected: string;
  active: string | null;
  error: string | null;
  safeMode: boolean;
}
export type NavigationState = { route: string; request: number; section?: 'profile' | 'ribbon' };

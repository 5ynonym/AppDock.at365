/** Public presentation contract. No renderer implementation or host internals. */
export const defaultShellId = 'appdock.default-shell';
/** Only these regions are mounted today. Additional page regions need their own public contract. */
export type ShellRegion =
  | 'ribbon'
  | 'overlay.command-palette'
  | 'page.logs'
  | 'page.home'
  | 'page.notifications'
  | 'page.settings'
  | 'notification.banner'
  | 'notification.desktop';
export function shellView(
  shell: { ui?: string; views?: Record<string, string> } | undefined,
  region: ShellRegion,
) {
  return shell?.views?.[region] ?? (region === 'ribbon' ? shell?.ui : undefined);
}
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
export interface ShellAppletApi {
  /** Execute a command registered by this provider Applet, through the normal dispatcher. */
  executeCommand(id: string): Promise<unknown>;
  getSettings(): Promise<Record<string, unknown>>;
  onSettingsChanged(callback: () => void): () => void;
}
export interface ShellApi extends ShellAppletApi {
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
export type NavigationState = {
  route: string;
  request: number;
  section?: 'profile' | 'ribbon';
  appletId?: string;
};

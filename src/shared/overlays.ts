import type { UiCommand } from './commands';
import type { ShellAppletApi } from './shell';

/** Host-owned content; presentation providers may implement each kind independently. */
export interface CommandPaletteRequest {
  requestId: string;
  mode: 'execute' | 'select';
  commandIds?: string[];
  pins?: string[];
  shortcuts?: Record<string, string[]>;
}
export type CommandPaletteResult =
  { status: 'selected' | 'executed'; commandId: string } | { status: 'cancelled'; reason: string };
export interface OverlayModel {
  schemaVersion: 1;
  id: string;
  contextId: 'primary';
  kind: 'command-palette';
  revision: number;
  dark: boolean;
  modal: true;
  content: {
    mode: 'execute' | 'select';
    commands: UiCommand[];
    pins: string[];
    shortcuts: Record<string, string[]>;
    busy: boolean;
    error: string;
  };
}
export type OverlayAction =
  | { id: string; type: 'dismiss' }
  | { id: string; type: 'choose'; commandId: string }
  | { id: string; type: 'togglePin'; commandId: string }
  | { id: string; type: 'movePin'; commandId: string; direction: -1 | 1; visibleIds: string[] };
export interface ShellOverlayApi extends ShellAppletApi {
  connect(): Promise<{ sessionId: string; providerAppletId: string; snapshot: OverlayModel }>;
  ready(sessionId: string): Promise<void>;
  act(action: OverlayAction): Promise<void>;
  onChanged(callback: (model: OverlayModel) => void): () => void;
}

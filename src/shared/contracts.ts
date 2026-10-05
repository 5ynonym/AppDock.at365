export interface HostSettings {
  theme: 'dark' | 'light' | 'system';
  closeToTray: boolean;
  notifications: boolean;
  startMinimized: boolean;
}
export interface ExtensionSettings {
  enabled: boolean;
  settings: Record<string, unknown>;
}
export interface Settings {
  schemaVersion: 1;
  host: HostSettings;
  extensions: Record<string, ExtensionSettings>;
  shortcuts: Record<string, string[]>;
  pinnedCommands: string[];
  profile: { name: string; avatar: 'avatar.png' | null };
}
export interface SettingsSnapshot {
  value: Settings;
  revision: number;
  path: string;
}
export interface Command {
  id: string;
  title: string;
}
export interface TrayItem {
  title: string;
  command: string;
}
export interface SettingDefinition {
  key: string;
  title: string;
  type: 'boolean' | 'number' | 'string';
  default?: unknown;
  minimum?: number;
  maximum?: number;
}
export interface Panel {
  title: string;
  description?: string;
  facts?: { label: string; value: string }[];
  actions?: { title: string; command: string }[];
}
export interface ExtensionManifest {
  apiVersion: 1;
  id: string;
  name: string;
  version: string;
  description?: string;
  runtime: 'node' | 'dotnet';
  entry: string;
  type?: string;
  capabilities?: string[];
  settings?: SettingDefinition[];
}
export interface ExtensionSnapshot extends ExtensionManifest {
  folder: string;
  state: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  error: string | null;
  enabled: boolean;
  commands: Command[];
  tray: TrayItem[];
  panel: Panel | null;
}
export interface LogEntry {
  time: string;
  level: string;
  source: string;
  message: string;
}
export interface HostSnapshot {
  settings: SettingsSnapshot;
  extensions: ExtensionSnapshot[];
  logs: LogEntry[];
  version: string;
  dataDirectory: string;
  dark: boolean;
  avatarUrl: string | null;
}
export interface DockApi {
  snapshot(): Promise<HostSnapshot>;
  saveSettings(
    value: Settings,
    revision: number,
    avatar?: Uint8Array | null,
  ): Promise<SettingsSnapshot>;
  setPinnedCommands(ids: string[]): Promise<SettingsSnapshot>;
  toggleExtension(id: string, enabled: boolean): Promise<void>;
  restartExtension(id: string): Promise<void>;
  executeCommand(id: string): Promise<unknown>;
  openPath(kind: 'settings' | 'extensions' | 'logs'): Promise<void>;
  windowAction(action: 'minimize' | 'maximize' | 'close' | 'quit'): Promise<void>;
  onChanged(callback: () => void): () => void;
}

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
  globalShortcutCommands: string[];
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
  type: 'boolean' | 'number' | 'string' | 'select';
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  step?: number;
  options?: SettingOption[];
  dynamic?: boolean;
}
export interface SettingOption {
  label: string;
  value: string;
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
  runtime: 'node' | 'dotnet' | 'native';
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
  settingOptions: Record<string, SettingOption[]>;
}
export interface LogEntry {
  time: string;
  level: string;
  source: string;
  message: string;
}
export interface HostSnapshot {
  globalHotKeys: GlobalHotKeyStatus[];
  settings: SettingsSnapshot;
  extensions: ExtensionSnapshot[];
  logs: LogEntry[];
  version: string;
  dataDirectory: string;
  dark: boolean;
  avatarUrl: string | null;
}
export interface GlobalHotKeyStatus {
  commandId: string;
  shortcut: string;
  registered: boolean;
  error?: string;
}
export interface DockApi {
  retryGlobalHotKeys(): Promise<void>;
  setShortcutRecording(recording: boolean): Promise<void>;
  onHostCommand(callback: (id: string) => void): () => void;
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

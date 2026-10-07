import type { WidgetDefinition, WidgetDisplay, WidgetPlacement, WidgetSnapshot } from './widgets';
export interface HostSettings {
  theme: 'dark' | 'light' | 'system';
  closeToTray: boolean;
  notifications: boolean;
  startMinimized: boolean;
  hardwareAcceleration: boolean;
  trayClickCommand: string;
  trayDoubleClickCommand: string | null;
}
export interface ExtensionSettings {
  enabled: boolean;
  startupDelaySeconds?: number;
  settings: Record<string, unknown>;
}
export interface Settings {
  schemaVersion: 1;
  host: HostSettings;
  extensions: Record<string, ExtensionSettings>;
  shortcuts: Record<string, string[]>;
  globalShortcutCommands: string[];
  trayCommands: string[];
  pinnedCommands: string[];
  widgets: Record<string, WidgetPlacement>;
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
export interface DeclaredCommand extends Command {
  activateOnExecute?: boolean;
  aliases?: string[];
}
export interface AppletCommand extends DeclaredCommand {
  available: boolean;
  hidden?: boolean;
}
export interface TrayItem {
  title: string;
  command: string;
}
export interface SettingDefinition {
  key: string;
  title: string;
  type:
    | 'boolean'
    | 'number'
    | 'string'
    | 'json'
    | 'select'
    | 'shortcut-list'
    | 'string-list'
    | 'object-list';
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  step?: number;
  options?: SettingOption[];
  dynamic?: boolean;
  fields?: SettingDefinition[];
  itemTitle?: string;
  aliases?: string[];
  format?: 'directory';
  numericOptions?: boolean;
}
export interface SettingOption {
  label: string;
  value: string;
}
export interface Panel {
  title: string;
  description?: string;
  facts?: { label: string; value: string }[];
  actions?: PanelAction[];
  tabs?: PanelAction[];
  images?: {
    title: string;
    tooltip?: string;
    imageFile?: string;
    description?: string;
    image?: string;
    actions?: PanelAction[];
  }[];
}
export interface PanelAction {
  title: string;
  command: string;
  actionId?: string;
  selected?: boolean;
}
export interface ExtensionManifest {
  apiVersion: 1;
  id: string;
  name: string;
  displayName?: string;
  version: string;
  minimumHostVersion?: string;
  updateRepository?: string;
  startupDelaySeconds?: number;
  description?: string;
  runtime: 'node' | 'dotnet' | 'native';
  entry: string;
  type?: string;
  capabilities?: string[];
  settings?: SettingDefinition[];
  commands?: DeclaredCommand[];
  widgets?: WidgetDefinition[];
  webAccounts?: import('./web-accounts').WebAccountDefinition;
}
export interface ExtensionSnapshot extends ExtensionManifest {
  displayName: string;
  folder: string;
  state: 'stopped' | 'waiting' | 'starting' | 'running' | 'stopping' | 'error';
  scheduledStartAt?: number;
  error: string | null;
  enabled: boolean;
  commands: AppletCommand[];
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
  widgets: WidgetSnapshot[];
  widgetDisplays: WidgetDisplay[];
  widgetErrors: string[];
  globalHotKeys: GlobalHotKeyStatus[];
  settings: SettingsSnapshot;
  extensions: ExtensionSnapshot[];
  logs: LogEntry[];
  version: string;
  dataDirectory: string;
  runtime: { electron: string; chrome: string; node: string; platform: string; arch: string };
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
  setWidgetPlacement(
    id: string,
    placement: WidgetPlacement,
    revision: number,
  ): Promise<SettingsSnapshot>;
  moveWidget(id: string): Promise<void>;
  finishWidgetMove(save: boolean): Promise<void>;
  chooseDirectory(): Promise<string | null>;
  checkUpdates(id?: string): Promise<UpdateResult>;
  openReleases(id?: string): Promise<void>;
  startExtensionNow(id: string): Promise<void>;
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
  executePanelAction(id: string, actionId: string): Promise<unknown>;
  openPath(kind: 'settings' | 'extensions' | 'logs'): Promise<void>;
  windowAction(action: 'minimize' | 'maximize' | 'close' | 'quit'): Promise<void>;
  onChanged(callback: () => void): () => void;
}
export interface UpdateResult {
  status: 'current' | 'available' | 'unpublished' | 'unsupported';
  currentVersion: string;
  latestVersion?: string;
  checkedAt: string;
}

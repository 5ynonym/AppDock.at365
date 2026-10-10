export interface HostSettings {
  theme: 'dark' | 'light' | 'system';
  closeToTray: boolean;
  notifications: boolean;
  startMinimized: boolean;
  startAtLogon: boolean;
  runAsAdministrator: boolean;
  hardwareAcceleration: boolean;
  trayClickCommand: string;
  trayDoubleClickCommand: string | null;
}
export interface ExtensionSettings {
  enabled: boolean;
  updateSource?: string;
  startupDelaySeconds?: number;
  pages?: Record<string, { display: import('./applet-pages').PageDisplay }>;
  settings: Record<string, unknown>;
}
export interface Settings {
  appletOrder: string[];
  gestures?: import('./gestures').GestureSettings;
  gestureDefaultsInitialized?: string[];
  keybindings?: import('./keybindings').Keybinding[];
  keybindingDefaultsInitialized?: string[];
  webApplets: import('./web-applets').WebAppletSettings;
  schemaVersion: 1;
  host: HostSettings;
  updates: UpdateSettings;
  extensions: Record<string, ExtensionSettings>;
  shortcuts: Record<string, string[]>;
  globalShortcutCommands: string[];
  trayCommands: string[];
  trayMenu?: import('./tray-menu').TrayMenuItem[];
  pinnedCommands: string[];
  ribbon: { order: string[]; hidden: string[]; bottom: string[]; separators: string[] };
  profile: { name: string; avatar: string | null };
}
export interface SettingsSnapshot {
  value: Settings;
  revision: number;
  path: string;
  syncError?: string;
  recovered?: boolean;
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
export interface SettingAction {
  title: string;
  command: string;
  description?: string;
  successMessage?: string;
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
  defaultGestureBindings?: import('./gestures').GestureBinding[];
  apiVersion: 1;
  id: string;
  name: string;
  displayName?: string;
  version: string;
  minimumHostVersion?: string;
  updateRepository?: string;
  startupDelaySeconds?: number;
  description?: string;
  runtime: 'node' | 'dotnet' | 'native' | 'web';
  entry: string;
  type?: string;
  capabilities?: string[];
  settings?: SettingDefinition[];
  settingActions?: SettingAction[];
  commands?: DeclaredCommand[];
  defaultKeybindings?: import('./keybindings').KeybindingDefault[];
  webAccounts?: import('./web-accounts').WebAccountDefinition;
  pages?: import('./applet-pages').AppletPageDefinition[];
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
  launch: LaunchState;
  webAccounts: import('./web-applets').WebProfile[];
  webPages: Record<string, import('./web-applets').WebPageState>;
  startupReady: boolean;
  windowVisible: boolean;
  updates: UpdateState;
  globalHotKeys: GlobalHotKeyStatus[];
  settings: SettingsSnapshot;
  extensions: ExtensionSnapshot[];
  logs: LogEntry[];
  version: string;
  dataDirectory: string;
  sharedDirectory: string;
  legacyLocalData: boolean;
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
  restoreSettingsBackup(revision: number): Promise<SettingsSnapshot | null>;
  refreshLaunchState(): Promise<LaunchState>;
  restartAsAdministrator(): Promise<void>;
  settingsNotice(state: SettingsNoticeState): Promise<void>;
  confirmDiscardSettings(): Promise<boolean>;
  onSettingsNoticeAction(callback: (action: 'save' | 'discard' | 'edit') => void): () => void;
  dispatchShortcut(key: string): Promise<{ executed: number; failed: number } | undefined>;
  webDefaults(url: string): Promise<import('./web-applets').WebDefaults>;
  webNavigate(id: string, action: 'back' | 'forward' | 'reload' | 'home'): Promise<void>;
  clearWebAccount(id: string): Promise<boolean>;
  createWebAccount(name: string): Promise<import('./web-applets').WebProfile>;
  renameWebAccount(id: string, name: string): Promise<void>;
  deleteWebAccount(id: string): Promise<false | 'deleted' | 'deferred'>;
  cancelUpdates(): Promise<boolean>;
  checkAllUpdates(): Promise<UpdateState>;
  installUpdates(target: 'all' | 'host' | 'applets' | string): Promise<UpdateState>;
  onAppletPage(callback: (key: string | null) => void): () => void;
  openAppletPage(extensionId: string, pageId: string): Promise<void>;
  pageViewport(
    key: string | null,
    bounds: { x: number; y: number; width: number; height: number } | null,
  ): Promise<void>;
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
    avatarName?: string,
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
export interface LaunchState {
  supported: boolean;
  elevated: boolean;
  registered: boolean;
  taskElevated: boolean;
  taskName: string;
  error?: string;
}
export interface SettingsNoticeState {
  visible: boolean;
  busy: boolean;
  dark: boolean;
  message: string;
}
export interface SettingsNoticeApi {
  state(): Promise<SettingsNoticeState>;
  onChanged(callback: (state: SettingsNoticeState) => void): () => void;
  act(action: 'save' | 'discard' | 'edit'): Promise<void>;
  resize(height: number): Promise<void>;
}
export interface UpdateResult {
  status: 'current' | 'available' | 'unpublished' | 'unsupported' | 'incompatible' | 'error';
  currentVersion: string;
  latestVersion?: string;
  checkedAt: string;
  id?: string;
  name?: string;
  message?: string;
  installable?: boolean;
  releaseUrl?: string;
}
export interface UpdateSettings {
  hostSource: string;
  checkHostOnStartup: boolean;
  checkAppletsOnStartup: boolean;
  startupDelaySeconds: number;
  notifyOnStartup: boolean;
  allowSameVersion: boolean;
}
export interface UpdateState {
  completion?: { ok: boolean; message: string };
  cancellable?: boolean;
  progress?: {
    id: string;
    name: string;
    index: number;
    count: number;
    receivedBytes: number;
    totalBytes?: number;
  };
  busy: boolean;
  phase: string;
  results: UpdateResult[];
}

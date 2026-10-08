export interface WebAccountDefinition {
  url: string;
  origins: string[];
  observeOrigin: string;
  ui: string;
  observer: string;
  itemOpener?: string;
  keepActive?: boolean;
  avatarOrigins?: string[];
  externalLinkSetting?: string;
}
export interface WebAccount {
  id: string;
  name: string;
  monitoring: boolean;
  avatar: string;
  url: string;
  loading: boolean;
  error: string;
  canGoBack: boolean;
  canGoForward: boolean;
  observation: unknown;
  status: string;
  attention: boolean;
  data: unknown;
  sound: WebAccountSound;
  soundError?: string;
}
export interface WebAccountSound {
  enabled: boolean;
  file: string;
  name?: string;
}
export interface WebAccountSnapshot {
  navigationRevision?: number;
  dark: boolean;
  settings?: Record<string, boolean | string>;
  selected: string;
  accounts: WebAccount[];
}
export interface WebAccountUi {
  snapshot(): Promise<WebAccountSnapshot>;
  setSetting(key: string, value: boolean | string): Promise<void>;
  add(): Promise<void>;
  select(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  move(id: string, direction: 1 | -1): Promise<void>;
  setMonitoring(id: string, enabled: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  navigate(action: 'back' | 'forward' | 'reload' | 'inbox'): Promise<void>;
  openItem(id: string, key: string): Promise<boolean>;
  cycle(direction: 1 | -1): Promise<void>;
  setSound(id: string, sound: WebAccountSound): Promise<void>;
  pickSound(id: string): Promise<void>;
  testSound(id: string): Promise<void>;
  acknowledge(id: string): Promise<void>;
  viewport(bounds: { x: number; y: number; width: number; height: number } | null): Promise<void>;
  onChanged(callback: () => void): () => void;
}

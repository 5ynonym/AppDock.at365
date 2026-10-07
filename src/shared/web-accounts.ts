export interface WebAccountDefinition {
  url: string;
  origins: string[];
  observeOrigin: string;
  ui: string;
  observer: string;
}
export interface WebAccount {
  id: string;
  name: string;
  url: string;
  loading: boolean;
  error: string;
  canGoBack: boolean;
  canGoForward: boolean;
  observation: unknown;
  status: string;
  attention: boolean;
}
export interface WebAccountSnapshot {
  selected: string;
  accounts: WebAccount[];
}
export interface WebAccountUi {
  snapshot(): Promise<WebAccountSnapshot>;
  add(): Promise<void>;
  select(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  remove(id: string): Promise<void>;
  navigate(action: 'back' | 'forward' | 'reload' | 'inbox'): Promise<void>;
  acknowledge(id: string): Promise<void>;
  onChanged(callback: () => void): () => void;
}

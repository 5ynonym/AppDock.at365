import type { DockApi, Settings, UpdateState } from '../contracts';
/** Public, injectable control dependencies. No transport or host implementation is imported. */
export type SettingsControlsApi = Pick<
  DockApi,
  | 'onChanged'
  | 'checkUpdates'
  | 'checkAllUpdates'
  | 'installUpdates'
  | 'cancelUpdates'
  | 'openReleases'
  | 'setShortcutRecording'
  | 'retryGlobalHotKeys'
  | 'openCommandPalette'
  | 'cancelCommandPalette'
  | 'createWebAccount'
  | 'renameWebAccount'
  | 'deleteWebAccount'
  | 'clearWebAccount'
  | 'webDefaults'
  | 'chooseDirectory'
  | 'setAppletApiPermissions'
  | 'automation'
  | 'executeCommand'
> & { snapshot(): Promise<{ updates: UpdateState }> };
export let settingsControls: SettingsControlsApi;
export function configureSettingsControls(api: SettingsControlsApi) {
  settingsControls = api;
}
export interface SettingsControlEditor {
  value: Settings;
  edit(value: Settings): void;
}

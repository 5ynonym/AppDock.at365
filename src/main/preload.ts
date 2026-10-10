import { contextBridge, ipcRenderer } from 'electron';
import type { DockApi } from '../shared/contracts';
const api: DockApi = {
  automation: (action) => ipcRenderer.invoke('dock:automation', action),
  refreshLaunchState: () => ipcRenderer.invoke('dock:refreshLaunchState'),
  restartAsAdministrator: () => ipcRenderer.invoke('dock:restartAsAdministrator'),
  settingsNotice: (state) => ipcRenderer.invoke('dock:settingsNotice', state),
  confirmDiscardSettings: () => ipcRenderer.invoke('dock:confirmDiscardSettings'),
  onSettingsNoticeAction: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, action: 'save' | 'discard' | 'edit') =>
      callback(action);
    ipcRenderer.on('dock:settingsNoticeAction', handler);
    return () => ipcRenderer.removeListener('dock:settingsNoticeAction', handler);
  },
  webDefaults: (url) => ipcRenderer.invoke('dock:webDefaults', url),
  webNavigate: (id, action) => ipcRenderer.invoke('dock:webNavigate', id, action),
  clearWebAccount: (id) => ipcRenderer.invoke('dock:clearWebAccount', id),
  createWebAccount: (name) => ipcRenderer.invoke('dock:createWebAccount', name),
  renameWebAccount: (id, name) => ipcRenderer.invoke('dock:renameWebAccount', id, name),
  deleteWebAccount: (id) => ipcRenderer.invoke('dock:deleteWebAccount', id),
  cancelUpdates: () => ipcRenderer.invoke('dock:cancelUpdates'),
  onAppletPage: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, key: string | null) => callback(key);
    ipcRenderer.on('dock:appletPage', handler);
    return () => ipcRenderer.removeListener('dock:appletPage', handler);
  },
  openAppletPage: (extensionId, pageId) =>
    ipcRenderer.invoke('dock:openAppletPage', extensionId, pageId),
  pageViewport: (key, bounds) => ipcRenderer.invoke('dock:pageViewport', key, bounds),
  chooseDirectory: () => ipcRenderer.invoke('dock:chooseDirectory'),
  checkUpdates: (id) => ipcRenderer.invoke('dock:checkUpdates', id),
  checkAllUpdates: () => ipcRenderer.invoke('dock:checkAllUpdates'),
  installUpdates: (target) => ipcRenderer.invoke('dock:installUpdates', target),
  openReleases: (id) => ipcRenderer.invoke('dock:openReleases', id),
  startExtensionNow: (id) => ipcRenderer.invoke('dock:startExtensionNow', id),
  dispatchShortcut: (key) => ipcRenderer.invoke('dock:dispatchShortcut', key),
  retryGlobalHotKeys: () => ipcRenderer.invoke('dock:retryGlobalHotKeys'),
  setShortcutRecording: (recording) => ipcRenderer.invoke('dock:setShortcutRecording', recording),
  onHostCommand: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on('dock:hostCommand', handler);
    return () => ipcRenderer.removeListener('dock:hostCommand', handler);
  },
  snapshot: () => ipcRenderer.invoke('dock:snapshot'),
  saveSettings: (value, revision, avatar, avatarName) =>
    ipcRenderer.invoke('dock:saveSettings', value, revision, avatar, avatarName),
  restoreSettingsBackup: (revision) => ipcRenderer.invoke('dock:restoreSettingsBackup', revision),
  setPinnedCommands: (ids) => ipcRenderer.invoke('dock:setPinnedCommands', ids),
  toggleExtension: (id, enabled) => ipcRenderer.invoke('dock:toggleExtension', id, enabled),
  restartExtension: (id) => ipcRenderer.invoke('dock:restartExtension', id),
  executeCommand: (id) => ipcRenderer.invoke('dock:executeCommand', id),
  executePanelAction: (id, actionId) => ipcRenderer.invoke('dock:executePanelAction', id, actionId),
  openPath: (kind) => ipcRenderer.invoke('dock:openPath', kind),
  windowAction: (action) => ipcRenderer.invoke('dock:windowAction', action),
  onChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('dock:changed', handler);
    return () => ipcRenderer.removeListener('dock:changed', handler);
  },
};
contextBridge.exposeInMainWorld('dock', api);

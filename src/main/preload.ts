import { contextBridge, ipcRenderer } from 'electron';
import type { DockApi } from '../shared/contracts';
const api: DockApi = {
  webDefaults: (url) => ipcRenderer.invoke('dock:webDefaults', url),
  webNavigate: (id, action) => ipcRenderer.invoke('dock:webNavigate', id, action),
  clearWebAccount: (id) => ipcRenderer.invoke('dock:clearWebAccount', id),
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
  retryGlobalHotKeys: () => ipcRenderer.invoke('dock:retryGlobalHotKeys'),
  setShortcutRecording: (recording) => ipcRenderer.invoke('dock:setShortcutRecording', recording),
  onHostCommand: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on('dock:hostCommand', handler);
    return () => ipcRenderer.removeListener('dock:hostCommand', handler);
  },
  snapshot: () => ipcRenderer.invoke('dock:snapshot'),
  saveSettings: (value, revision, avatar) =>
    ipcRenderer.invoke('dock:saveSettings', value, revision, avatar),
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

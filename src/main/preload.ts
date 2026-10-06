import { contextBridge, ipcRenderer } from 'electron';
import type { DockApi } from '../shared/contracts';
const api: DockApi = {
  checkUpdates: (id) => ipcRenderer.invoke('dock:checkUpdates', id),
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
  openPath: (kind) => ipcRenderer.invoke('dock:openPath', kind),
  windowAction: (action) => ipcRenderer.invoke('dock:windowAction', action),
  onChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('dock:changed', handler);
    return () => ipcRenderer.removeListener('dock:changed', handler);
  },
};
contextBridge.exposeInMainWorld('dock', api);

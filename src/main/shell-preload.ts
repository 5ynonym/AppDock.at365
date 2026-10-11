import { contextBridge, ipcRenderer } from 'electron';
import type { ShellApi, RibbonView } from '../shared/shell';
const api: ShellApi = {
  getSettings: () => ipcRenderer.invoke('shell:getSettings'),
  onSettingsChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('shell:settingsChanged', handler);
    return () => ipcRenderer.removeListener('shell:settingsChanged', handler);
  },
  executeCommand: (id) => ipcRenderer.invoke('shell:executeCommand', id),
  focusHost: (edge) => ipcRenderer.invoke('shell:focusHost', edge),
  onFocus: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, edge: 'first' | 'last') => callback(edge);
    ipcRenderer.on('shell:focus', handler);
    return () => ipcRenderer.removeListener('shell:focus', handler);
  },
  connect: () => ipcRenderer.invoke('shell:connect'),
  ready: (session) => ipcRenderer.invoke('shell:ready', session),
  dispose: (session) => ipcRenderer.invoke('shell:dispose', session),
  get: () => ipcRenderer.invoke('shell:get'),
  asset: (id) => ipcRenderer.invoke('shell:asset', id),
  invoke: (request) => ipcRenderer.invoke('shell:invoke', request),
  onChanged: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, snapshot: RibbonView) => callback(snapshot);
    ipcRenderer.on('shell:changed', handler);
    return () => ipcRenderer.removeListener('shell:changed', handler);
  },
};
contextBridge.exposeInMainWorld('appdockShell', api);

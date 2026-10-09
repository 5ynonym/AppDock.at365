import { contextBridge, ipcRenderer } from 'electron';
import type { SettingsNoticeApi, SettingsNoticeState } from '../shared/contracts';

const api: SettingsNoticeApi = {
  state: () => ipcRenderer.invoke('settings-notice:state'),
  onChanged: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, state: SettingsNoticeState) => callback(state);
    ipcRenderer.on('settings-notice:changed', listener);
    return () => ipcRenderer.removeListener('settings-notice:changed', listener);
  },
  act: (action) => ipcRenderer.invoke('settings-notice:act', action),
  resize: (height) => ipcRenderer.invoke('settings-notice:resize', height),
};
contextBridge.exposeInMainWorld('settingsNotice', api);

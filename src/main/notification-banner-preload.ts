import { contextBridge, ipcRenderer } from 'electron';
import type { NotificationBannerApi, NotificationBannerModel } from '../shared/notifications';
const api: NotificationBannerApi = {
  getSettings: () => ipcRenderer.invoke('notification-banner:getSettings'),
  onSettingsChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('notification-banner:settingsChanged', listener);
    return () => ipcRenderer.removeListener('notification-banner:settingsChanged', listener);
  },
  executeCommand: (id) => ipcRenderer.invoke('notification-banner:executeCommand', id),
  connect: () => ipcRenderer.invoke('notification-banner:connect'),
  ready: (id) => ipcRenderer.invoke('notification-banner:ready', id),
  act: (request) => ipcRenderer.invoke('notification-banner:act', request),
  resize: (height) => ipcRenderer.invoke('notification-banner:resize', height),
  focusHost: () => ipcRenderer.invoke('notification-banner:focusHost'),
  onFocus: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('notification-banner:focus', listener);
    return () => ipcRenderer.removeListener('notification-banner:focus', listener);
  },
  onChanged: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, model: NotificationBannerModel) =>
      callback(model);
    ipcRenderer.on('notification-banner:changed', listener);
    return () => ipcRenderer.removeListener('notification-banner:changed', listener);
  },
};
contextBridge.exposeInMainWorld('appdockNotifications', api);

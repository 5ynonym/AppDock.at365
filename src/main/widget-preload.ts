import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('widgetSurface', {
  snapshot: () => ipcRenderer.invoke('widget:snapshot'),
  finishMove: (save: boolean) => ipcRenderer.invoke('widget:finishMove', save),
  onChanged: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('widget:changed', listener);
    return () => ipcRenderer.removeListener('widget:changed', listener);
  },
});

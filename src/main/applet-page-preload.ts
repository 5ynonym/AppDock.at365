import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('appletPage', {
  snapshot: () => ipcRenderer.invoke('applet-page:snapshot'),
  executeCommand: (id: string) => ipcRenderer.invoke('applet-page:execute', id),
  onChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('applet-page:changed', handler);
    return () => ipcRenderer.removeListener('applet-page:changed', handler);
  },
});

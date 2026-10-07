import { contextBridge, ipcRenderer } from 'electron';
// One fixed channel; the host maps the sender to its own Applet. No arbitrary RPC.
contextBridge.exposeInMainWorld('webAccounts', {
  snapshot: () => ipcRenderer.invoke('web-account:invoke', 'snapshot'),
  add: () => ipcRenderer.invoke('web-account:invoke', 'add'),
  select: (id: string) => ipcRenderer.invoke('web-account:invoke', 'select', id),
  rename: (id: string, name: string) =>
    ipcRenderer.invoke('web-account:invoke', 'rename', id, name),
  remove: (id: string) => ipcRenderer.invoke('web-account:invoke', 'remove', id),
  navigate: (action: string) => ipcRenderer.invoke('web-account:invoke', 'navigate', action),
  acknowledge: (id: string) => ipcRenderer.invoke('web-account:invoke', 'acknowledge', id),
  onChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('web-account:changed', handler);
    return () => ipcRenderer.removeListener('web-account:changed', handler);
  },
});

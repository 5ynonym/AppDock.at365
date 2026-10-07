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
  openItem: (id: string, key: string) =>
    ipcRenderer.invoke('web-account:invoke', 'openItem', id, key),
  cycle: (direction: number) => ipcRenderer.invoke('web-account:invoke', 'cycle', direction),
  setSound: (id: string, sound: unknown) =>
    ipcRenderer.invoke('web-account:invoke', 'setSound', id, sound),
  pickSound: (id: string) => ipcRenderer.invoke('web-account:invoke', 'pickSound', id),
  testSound: (id: string) => ipcRenderer.invoke('web-account:invoke', 'testSound', id),
  acknowledge: (id: string) => ipcRenderer.invoke('web-account:invoke', 'acknowledge', id),
  viewport: (bounds: unknown) => ipcRenderer.invoke('web-account:invoke', 'viewport', bounds),
  onChanged: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('web-account:changed', handler);
    return () => ipcRenderer.removeListener('web-account:changed', handler);
  },
});

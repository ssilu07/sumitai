import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  toggleClickThrough: () => Promise<boolean>;
  setContentProtection: (enable: boolean) => Promise<boolean>;
  minimizeWindow: () => void;
  minimizeToBackground: () => void;
  restoreWindow: () => void;
  toggleStealthMode: () => Promise<boolean>;
  closeWindow: () => void;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  getDesktopSources: () => Promise<Array<{ id: string; name: string; display_id?: string }>>;
  captureScreen: () => Promise<string | null>;
  onClickThroughChanged: (callback: (enabled: boolean) => void) => () => void;
  onStealthStateChanged: (callback: (hidden: boolean) => void) => () => void;
  platform: string;
}

const api: ElectronAPI = {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },
  toggleClickThrough: () => ipcRenderer.invoke('toggle-click-through'),
  setContentProtection: (enable: boolean) => ipcRenderer.invoke('set-content-protection', enable),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  minimizeToBackground: () => ipcRenderer.send('minimize-to-background'),
  restoreWindow: () => ipcRenderer.send('restore-window'),
  toggleStealthMode: () => ipcRenderer.invoke('toggle-stealth-mode'),
  closeWindow: () => ipcRenderer.send('window-close'),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('set-always-on-top', flag),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  onClickThroughChanged: (callback: (enabled: boolean) => void) => {
    const handler = (_event: any, enabled: boolean) => callback(enabled);
    ipcRenderer.on('click-through-changed', handler);
    return () => {
      ipcRenderer.removeListener('click-through-changed', handler);
    };
  },
  onStealthStateChanged: (callback: (hidden: boolean) => void) => {
    const handler = (_event: any, hidden: boolean) => callback(hidden);
    ipcRenderer.on('stealth-state-changed', handler);
    return () => {
      ipcRenderer.removeListener('stealth-state-changed', handler);
    };
  },
  platform: process.platform,
};

contextBridge.exposeInMainWorld('electronAPI', api);

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

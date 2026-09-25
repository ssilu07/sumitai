import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  toggleClickThrough: () => Promise<boolean>;
  setContentProtection: (enable: boolean) => Promise<boolean>;
  setSkipTaskbar: (skip: boolean) => Promise<boolean>;
  setTrayVisible: (visible: boolean) => Promise<boolean>;
  minimizeWindow: () => void;
  minimizeToBackground: () => void;
  restoreWindow: () => void;
  toggleStealthMode: () => Promise<boolean>;
  setMiniMode: (mini: boolean) => Promise<boolean>;
  toggleMiniMode: () => Promise<boolean>;
  exitMiniMode: () => void;
  onMiniModeChanged: (callback: (mini: boolean) => void) => () => void;
  closeWindow: () => void;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  getDesktopSources: () => Promise<Array<{ id: string; name: string; display_id?: string }>>;
  captureScreen: () => Promise<string | null>;
  onTriggerScreenCapture?: (callback: () => void) => () => void;
  onClickThroughChanged: (callback: (enabled: boolean) => void) => () => void;
  onStealthStateChanged: (callback: (hidden: boolean) => void) => () => void;
  setWindowPosition: (x: number, y: number) => void;
  setWindowHeight?: (height: number) => Promise<boolean>;
  setWindowSize?: (width: number, height: number) => Promise<boolean>;
  getWindowBounds?: () => Promise<{ x: number; y: number; width: number; height: number }>;
  logQAEvent?: (data: any) => Promise<boolean>;
  logTranscriptEvent?: (data: any) => Promise<boolean>;
  openLogFile?: () => Promise<boolean>;
  getLogFilePath?: () => Promise<string>;
  onMobileQuery?: (callback: (data: { query: string; role?: string }) => void) => () => void;
  onMobileAction?: (callback: (data: { action: string; payload?: any }) => void) => () => void;
  broadcastMobileSuggestion?: (data: any) => void;
  broadcastMobileToken?: (data: any) => void;
  broadcastMobileClear?: () => void;
  getMobileServerInfo?: () => Promise<{ ip: string; port: number; url: string; activeClients: number } | null>;
  platform: string;
}

const api: ElectronAPI = {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },
  toggleClickThrough: () => ipcRenderer.invoke('toggle-click-through'),
  setContentProtection: (enable: boolean) => ipcRenderer.invoke('set-content-protection', enable),
  setSkipTaskbar: (skip: boolean) => ipcRenderer.invoke('set-skip-taskbar', skip),
  setTrayVisible: (visible: boolean) => ipcRenderer.invoke('set-tray-visible', visible),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  minimizeToBackground: () => ipcRenderer.send('minimize-to-background'),
  restoreWindow: () => ipcRenderer.send('restore-window'),
  toggleStealthMode: () => ipcRenderer.invoke('toggle-stealth-mode'),
  setMiniMode: (mini: boolean) => ipcRenderer.invoke('set-mini-mode', mini),
  toggleMiniMode: () => ipcRenderer.invoke('toggle-mini-mode'),
  exitMiniMode: () => ipcRenderer.send('exit-mini-mode'),
  onMiniModeChanged: (callback: (mini: boolean) => void) => {
    const handler = (_event: any, mini: boolean) => callback(mini);
    ipcRenderer.on('mini-mode-changed', handler);
    return () => {
      ipcRenderer.removeListener('mini-mode-changed', handler);
    };
  },
  closeWindow: () => ipcRenderer.send('window-close'),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('set-always-on-top', flag),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  onTriggerScreenCapture: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-screen-capture', handler);
    return () => {
      ipcRenderer.removeListener('trigger-screen-capture', handler);
    };
  },
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
  setWindowPosition: (x: number, y: number) => ipcRenderer.send('set-window-position', x, y),
  setWindowHeight: (height: number) => ipcRenderer.invoke('set-window-height', height),
  setWindowSize: (width: number, height: number) => ipcRenderer.invoke('set-window-size', width, height),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  logQAEvent: (data: any) => ipcRenderer.invoke('log-qa-event', data),
  logTranscriptEvent: (data: any) => ipcRenderer.invoke('log-transcript-event', data),
  openLogFile: () => ipcRenderer.invoke('open-log-file'),
  getLogFilePath: () => ipcRenderer.invoke('get-log-file-path'),
  onMobileQuery: (callback: (data: { query: string; role?: string }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('mobile-remote-query', handler);
    return () => {
      ipcRenderer.removeListener('mobile-remote-query', handler);
    };
  },
  onMobileAction: (callback: (data: { action: string; payload?: any }) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('mobile-remote-action', handler);
    return () => {
      ipcRenderer.removeListener('mobile-remote-action', handler);
    };
  },
  broadcastMobileSuggestion: (data: any) => ipcRenderer.send('broadcast-mobile-suggestion', data),
  broadcastMobileToken: (data: any) => ipcRenderer.send('broadcast-mobile-token', data),
  broadcastMobileClear: () => ipcRenderer.send('broadcast-mobile-clear'),
  getMobileServerInfo: () => ipcRenderer.invoke('get-mobile-server-info'),
  platform: process.platform,
};


contextBridge.exposeInMainWorld('electronAPI', api);

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

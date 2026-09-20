/// <reference types="vite/client" />

export interface DesktopSource {
  id: string;
  name: string;
  display_id?: string;
}

export interface ElectronAPI {
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
  toggleClickThrough: () => Promise<boolean>;
  setContentProtection: (enable: boolean) => Promise<boolean>;
  minimizeWindow: () => void;
  minimizeToBackground?: () => void;
  restoreWindow?: () => void;
  toggleStealthMode?: () => Promise<boolean>;
  closeWindow: () => void;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  getDesktopSources: () => Promise<DesktopSource[]>;
  captureScreen: () => Promise<string | null>;
  onClickThroughChanged: (callback: (enabled: boolean) => void) => () => void;
  onStealthStateChanged?: (callback: (hidden: boolean) => void) => () => void;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

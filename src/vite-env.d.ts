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
  setSkipTaskbar?: (skip: boolean) => Promise<boolean>;
  setTrayVisible?: (visible: boolean) => Promise<boolean>;
  minimizeWindow: () => void;
  minimizeToBackground?: () => void;
  restoreWindow?: () => void;
  toggleStealthMode?: () => Promise<boolean>;
  setMiniMode?: (mini: boolean) => Promise<boolean>;
  toggleMiniMode?: () => Promise<boolean>;
  exitMiniMode?: () => void;
  onMiniModeChanged?: (callback: (mini: boolean) => void) => () => void;
  closeWindow: () => void;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  getDesktopSources: () => Promise<DesktopSource[]>;
  captureScreen: () => Promise<string | null>;
  onTriggerScreenCapture?: (callback: () => void) => () => void;
  onClickThroughChanged: (callback: (enabled: boolean) => void) => () => void;
  onStealthStateChanged?: (callback: (hidden: boolean) => void) => () => void;
  setWindowPosition?: (x: number, y: number) => void;
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

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

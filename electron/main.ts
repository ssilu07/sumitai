import { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, screen, Tray, Menu, nativeImage, session, shell } from 'electron';
import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startMobileServer, stopMobileServer, broadcastToMobile, getMobileServerInfo } from './mobileServer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure single instance lock so multiple stealth overlays don't clash
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let miniWindow: BrowserWindow | null = null;  // Dedicated tiny window for mini mode
let resolvedPreload = '';                      // Resolved at createWindow() time, reused for miniWindow
let tray: Tray | null = null;
let isClickThroughEnabled = false;
let isStealthHidden = false;
let isSkipTaskbarEnabled = true;
let watchdogInterval: NodeJS.Timeout | null = null;
const MINI_WIDTH = 68;
const MINI_HEIGHT = 68;
let isMiniMode = false;
let preMiniBounds = { x: 0, y: 0, width: 880, height: 580 };

/**
 * Creates a dedicated 68×68 BrowserWindow for the mini-mode widget.
 * Using a separate OS window means the background is NEVER blocked —
 * the ghost main window is transparent + click-through and the tiny
 * mini window truly occupies only 68×68 px on screen.
 */
function createMiniWindow(x: number, y: number): BrowserWindow {
  const win = new BrowserWindow({
    x: Math.round(x),
    y: Math.round(y),
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    roundedCorners: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: resolvedPreload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  try {
    win.setContentProtection(true);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, 'screen-saver', 1);
    win.setSkipTaskbar(true);
  } catch (e) {
    console.error('[MiniWindow] Protection setup failed:', e);
  }
  // Load the same app with ?mode=mini so React renders only the MiniWidget
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}?mode=mini`);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { query: { mode: 'mini' } });
  }
  win.show();
  return win;
}

function enterMiniMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (isMiniMode) return;
  preMiniBounds = mainWindow.getBounds();

  const newX = Math.round(preMiniBounds.x + preMiniBounds.width - MINI_WIDTH);
  const newY = Math.round(preMiniBounds.y);

  isMiniMode = true;

  // ── Ghost the main window completely ──────────────────────────────────────
  // setOpacity(0)  → window is invisible (no visual flash)
  // setIgnoreMouseEvents(true, forward:true) → mouse clicks pass through to OS
  // blur()         → keyboard focus released to previously-active background app
  // Together these guarantee the full background (mouse + keyboard) works 100%.
  mainWindow.setOpacity(0);
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.blur();

  // ── Launch the dedicated mini window ─────────────────────────────────────
  // This is a FRESH 68×68 BrowserWindow — only this tiny area is "owned" by us.
  // Everything else on screen is completely free for the user.
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.destroy();
    miniWindow = null;
  }
  miniWindow = createMiniWindow(newX, newY);

  mainWindow.webContents.send('mini-mode-changed', true);
  updateTrayMenu();
}

function exitMiniMode() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!isMiniMode) return;

  isMiniMode = false;

  // Destroy the mini window first
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.destroy();
    miniWindow = null;
  }

  // Notify React (while window is still invisible) so HUDOverlay renders
  // before the window becomes visible — avoids a MiniWidget flash
  mainWindow.webContents.send('mini-mode-changed', false);

  // Restore the main window after a tick so React has rendered HUDOverlay
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setOpacity(1.0);
    mainWindow.setIgnoreMouseEvents(isClickThroughEnabled, { forward: true });

    // Clamp preMiniBounds so the restored HUD is always fully visible on screen
    const display = screen.getDisplayMatching(preMiniBounds);
    const { x: wx, y: wy, width: ww, height: wh } = display.workArea;
    const targetW = preMiniBounds.width || 880;
    const targetH = preMiniBounds.height || 520;
    const clampedX = Math.round(Math.max(wx, Math.min(preMiniBounds.x, wx + ww - targetW)));
    const clampedY = Math.round(Math.max(wy, Math.min(preMiniBounds.y, wy + wh - targetH)));
    preMiniBounds = { x: clampedX, y: clampedY, width: targetW, height: targetH };

    mainWindow.setBounds(preMiniBounds);
    mainWindow.show();
    mainWindow.focus();
  }, 80);

  updateTrayMenu();
}



function toggleMiniMode() {
  if (isMiniMode) {
    exitMiniMode();
  } else {
    enterMiniMode();
  }
}

function quitApplication() {
  console.log('[Electron] Exiting application cleanly via quitApplication...');
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }
  try {
    globalShortcut.unregisterAll();
  } catch (e) {
    console.error('Error unregistering shortcuts:', e);
  }
  try {
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
      tray = null;
    }
  } catch (e) {
    console.error('Error destroying tray:', e);
  }
  try {
    if (miniWindow && !miniWindow.isDestroyed()) {
      miniWindow.destroy();
      miniWindow = null;
    }
  } catch (e) {
    console.error('Error destroying miniWindow:', e);
  }
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();

      mainWindow = null;
    }
  } catch (e) {
    console.error('Error destroying mainWindow:', e);
  }
  app.quit();
  setTimeout(() => {
    app.exit(0);
  }, 300);
}

function createWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Initial HUD dimensions positioned discreetly in the upper-right or centered
  const windowWidth = 880;
  const windowHeight = 520;
  const initialX = Math.max(20, Math.round(width - windowWidth - 30));
  const initialY = 30;
  preMiniBounds = { x: initialX, y: initialY, width: windowWidth, height: windowHeight };

    const preloadCjs = path.join(__dirname, 'preload.cjs');
    const preloadJs = path.join(__dirname, 'preload.js');
    const preloadMjs = path.join(__dirname, 'preload.mjs');
    resolvedPreload = fs.existsSync(preloadCjs)
      ? preloadCjs
      : fs.existsSync(preloadJs)
      ? preloadJs
      : preloadMjs;
    console.log('[Electron] Resolved Preload Script Path:', resolvedPreload);

    mainWindow = new BrowserWindow({
      x: initialX,
      y: initialY,
      width: windowWidth,
      height: windowHeight,
      minWidth: 68,
      minHeight: 68,
      transparent: true,
      frame: false,
      hasShadow: false,
      resizable: true,
      skipTaskbar: true, // Total stealth from the OS taskbar/dock
      alwaysOnTop: true,
      roundedCorners: false, // Prevents Windows 11 DWM rounded border clipping artifacts
      backgroundColor: '#00000000',
      webPreferences: {
        preload: resolvedPreload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // Allows desktopCapturer IPC communication
        backgroundThrottling: false, // Keep audio and STT processing at full speed when window is inactive
      },
    });

  /**
   * ========================================================================
   * CORE REQUIREMENT: SCREEN PROTECTION & UNDETECTABILITY
   * ========================================================================
   * win.setContentProtection(true) instructs the OS compositing window manager:
   *
   * 1. Windows:
   *    Calls Win32 API `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)` (0x00000011).
   *    Supported on Windows 10 Version 2004 (Build 19041) and Windows 11+.
   *    Result: The window completely disappears from all capture APIs:
   *    - Zoom Screen Share
   *    - Google Meet & Microsoft Teams tab/desktop sharing
   *    - OBS Studio & Discord screen streams
   *    - Snipping Tool, PrintScreen, Lightshot, CleanShot X
   *
   * 2. macOS:
   *    Sets `[NSWindow setSharingType:NSWindowSharingNone]`.
   *    The window is omitted from CGDisplayStream, ScreenCaptureKit, and QuickTime recordings.
   * ========================================================================
   */
  /**
   * ========================================================================
   * CORE REQUIREMENT: SCREEN PROTECTION & UNDETECTABILITY
   * ========================================================================
   */
  const enforceProtection = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        mainWindow.setContentProtection(true);
        if (isSkipTaskbarEnabled) {
          mainWindow.setSkipTaskbar(true);
        }
        if (!isStealthHidden) {
          mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        }
      } catch (err) {
        console.error('[Protection] Failed to enforce content protection:', err);
      }
    }
  };

  // Initial enforcement
  enforceProtection();
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // CRITICAL FIX: Windows DWM resets display affinity back to WDA_NONE (0x0)
  // whenever a window transitions between hide/show, minimize/restore, or monitor changes.
  // We re-apply setContentProtection(true) on ALL lifecycle events!
  mainWindow.on('show', enforceProtection);
  mainWindow.on('restore', enforceProtection);
  mainWindow.on('focus', enforceProtection);
  mainWindow.on('moved', enforceProtection);
  mainWindow.on('resized', enforceProtection);

  // Background watchdog: re-arm protection every 3 seconds to defend against
  // Zoom / Teams / OS display manager resetting window flags when screen share starts
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
  }
  watchdogInterval = setInterval(enforceProtection, 3000);
  mainWindow.on('closed', () => {
    if (watchdogInterval) {
      clearInterval(watchdogInterval);
      watchdogInterval = null;
    }
  });

  // Load the Vite dev server or production index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Electron] HUD window loaded successfully.');
    enforceProtection();
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer] [L${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`);
  });

  mainWindow.show();
  mainWindow.focus();
  enforceProtection();

  return mainWindow;
}

const TRAY_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAO0lEQVR4nGNgoAWw2PvjPzZMkWaiDCGkGa8hxGrGagipmjEMGTWACgZQHI1USUjEGoJXMyFDiNJMKgAAUOPH4OYQoB8AAAAASUVORK5CYII=';

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    let icon: Electron.NativeImage;
    if (fs.existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
    } else {
      icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
    }

    tray = new Tray(icon);
    tray.setToolTip('Prateek AI Copilot (Ctrl+Shift+H to toggle)');
    updateTrayMenu();

    tray.on('click', () => {
      toggleVisibility();
    });
    tray.on('double-click', () => {
      toggleVisibility();
    });
  } catch (err) {
    console.error('[Tray] Failed to create system tray:', err);
  }
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  try {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: isStealthHidden ? 'Show Copilot HUD (Ctrl+Shift+H)' : 'Minimize to Background (Ctrl+Shift+H)',
        click: () => toggleVisibility(),
      },
      {
        label: isMiniMode ? 'Expand to Full HUD (Ctrl+Shift+M)' : 'Collapse to Mini Floating Icon (Ctrl+Shift+M)',
        click: () => toggleMiniMode(),
      },
      {
        label: isClickThroughEnabled ? 'Disable Click-Through (Ctrl+Shift+X)' : 'Enable Click-Through (Ctrl+Shift+X)',
        click: () => {
          if (!mainWindow || mainWindow.isDestroyed()) return;
          isClickThroughEnabled = !isClickThroughEnabled;
          mainWindow.setIgnoreMouseEvents(isClickThroughEnabled, { forward: true });
          mainWindow.webContents.send('click-through-changed', isClickThroughEnabled);
          updateTrayMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Prateek Copilot',
        click: () => {
          quitApplication();
        },
      },
    ]);
    tray.setContextMenu(contextMenu);
  } catch (err) {
    console.error('[Tray] Failed to update tray context menu:', err);
  }
}

function hideToBackground() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // STEALTH HIDE:
  // Using opacity 0 + ignore mouse events ensures Windows DWM preserves
  // WDA_EXCLUDEFROMCAPTURE without destroying the compositing pipeline!
  mainWindow.setOpacity(0);
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  isStealthHidden = true;
  updateTrayMenu();
  mainWindow.webContents.send('stealth-state-changed', true);
}

function restoreFromBackground() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  // STEALTH RESTORE:
  // Restore opacity and immediately re-arm content protection!
  mainWindow.setOpacity(1.0);
  mainWindow.setIgnoreMouseEvents(isClickThroughEnabled, { forward: true });
  mainWindow.setContentProtection(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  if (isSkipTaskbarEnabled) {
    mainWindow.setSkipTaskbar(true);
  }
  mainWindow.show();
  mainWindow.focus();
  if (isSkipTaskbarEnabled) {
    mainWindow.setSkipTaskbar(true);
  }
  isStealthHidden = false;
  updateTrayMenu();
  mainWindow.webContents.send('stealth-state-changed', false);
}

function toggleVisibility() {
  if (isStealthHidden) {
    restoreFromBackground();
  } else {
    hideToBackground();
  }
}

/**
 * Register Global Hotkeys
 * - Ctrl+Shift+H / Cmd+Shift+H: Instant Panic/Toggle Hide
 * - Ctrl+Shift+X / Cmd+Shift+X: Toggle Click-Through Mode
 */
function registerHotkeys() {
  // Register both Ctrl+Shift+H and Alt+Shift+H
  const primaryToggle = process.platform === 'darwin' ? 'Command+Shift+H' : 'Ctrl+Shift+H';
  globalShortcut.register(primaryToggle, toggleVisibility);
  globalShortcut.register('Alt+Shift+H', toggleVisibility);

  // Click-Through Toggle Hotkey (Ctrl+Shift+X)
  const clickThroughKey = process.platform === 'darwin' ? 'Command+Shift+X' : 'Ctrl+Shift+X';
  const registeredClickThrough = globalShortcut.register(clickThroughKey, () => {
    if (!mainWindow) return;
    isClickThroughEnabled = !isClickThroughEnabled;
    mainWindow.setIgnoreMouseEvents(isClickThroughEnabled, { forward: true });
    mainWindow.webContents.send('click-through-changed', isClickThroughEnabled);
    updateTrayMenu();
  });

  if (!registeredClickThrough) {
    console.warn(`[Hotkeys] Failed to register click-through hotkey: ${clickThroughKey}`);
  }

  // Toggle DevTools (Ctrl+Shift+I, F12)
  const devToolsKey = process.platform === 'darwin' ? 'Command+Alt+I' : 'Ctrl+Shift+I';
  globalShortcut.register(devToolsKey, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });
  globalShortcut.register('F12', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Emergency Quit Hotkey (Ctrl+Shift+Q / Alt+Shift+Q)
  const quitKey = process.platform === 'darwin' ? 'Command+Shift+Q' : 'Ctrl+Shift+Q';
  globalShortcut.register(quitKey, () => {
    quitApplication();
  });
  globalShortcut.register('Alt+Shift+Q', () => {
    quitApplication();
  });

  // Mini Mode Hotkey (Ctrl+Shift+M / Alt+Shift+M)
  const miniKey = process.platform === 'darwin' ? 'Command+Shift+M' : 'Ctrl+Shift+M';
  globalShortcut.register(miniKey, () => {
    toggleMiniMode();
  });
  // Screen Scan Hotkey (Alt+S / Alt+Shift+S)
  globalShortcut.register('Alt+S', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('trigger-screen-capture');
    }
  });
  globalShortcut.register('Alt+Shift+S', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('trigger-screen-capture');
    }
  });
}

// ── Persistent Logs Configuration ──────────────────────────────────────────
const projectLogsDir = path.join(process.cwd(), 'logs');
const userLogsDir = path.join(app.getPath('userData'), 'logs');

function ensureDir(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (e) {
    // Ignore directory creation error
  }
}

ensureDir(projectLogsDir);
ensureDir(userLogsDir);

const mainQaLogFile = path.join(projectLogsDir, 'interview_qa.log');
const mainJsonLogFile = path.join(projectLogsDir, 'interview_qa.json');
const mainTranscriptLogFile = path.join(projectLogsDir, 'transcripts.log');

const userQaLogFile = path.join(userLogsDir, 'interview_qa.log');
const userTranscriptLogFile = path.join(userLogsDir, 'transcripts.log');

/**
 * IPC Event Handlers
 */
function registerIpcHandlers() {
  // ── Logging IPC Handlers (Transcripts & Answer Generation) ─────────────────
  ipcMain.handle('log-qa-event', (_event, entry: any) => {
    try {
      const now = new Date(entry.timestamp || Date.now());
      const dateStr = now.toLocaleDateString();
      const timeStr = entry.timeString || now.toLocaleTimeString();
      const speaker = (entry.speaker || 'INTERVIEWER').toUpperCase();
      const provider = entry.provider || 'AI';
      const model = entry.model ? ` (${entry.model})` : '';
      const latency = entry.latencyMs ? ` | Latency: ${(entry.latencyMs / 1000).toFixed(2)}s` : '';
      const source = entry.source ? ` | Source: ${entry.source}` : '';

      const divider = '================================================================================';
      const subDivider = '--------------------------------------------------------------------------------';

      const terminalOutput = [
        `\n\x1b[36m${divider}\x1b[0m`,
        `\x1b[1m\x1b[33m[Q&A LOG ENTRY]\x1b[0m \x1b[90m${dateStr} ${timeStr}\x1b[0m`,
        `\x1b[32mSpeaker:\x1b[0m \x1b[1m${speaker}\x1b[0m | \x1b[35mProvider:\x1b[0m ${provider}${model}${latency}${source}`,
        `\x1b[90m${subDivider}\x1b[0m`,
        `\x1b[1m\x1b[33m❓ QUESTION:\x1b[0m`,
        `\x1b[1m${entry.question}\x1b[0m`,
        `\x1b[90m${subDivider}\x1b[0m`,
        `\x1b[1m\x1b[32m🤖 ANSWER GENERATED:\x1b[0m`,
        `${entry.answer}`,
        `\x1b[36m${divider}\x1b[0m\n`,
      ].join('\n');

      // 1. Output clearly to Node terminal console
      process.stdout.write(terminalOutput);

      // 2. Format plain text for disk log file
      const fileText = [
        `\n${divider}`,
        `[Q&A LOG ENTRY] ${dateStr} ${timeStr}`,
        `Speaker: ${speaker} | Provider: ${provider}${model}${latency}${source}`,
        `${subDivider}`,
        `QUESTION:`,
        `${entry.question}`,
        `${subDivider}`,
        `ANSWER:`,
        `${entry.answer}`,
        `${divider}\n`,
      ].join('\n');

      // Append to project log file
      try {
        fs.appendFileSync(mainQaLogFile, fileText, 'utf-8');
      } catch {}

      // Append to appData user log file
      try {
        fs.appendFileSync(userQaLogFile, fileText, 'utf-8');
      } catch {}

      // Append to JSON log file
      try {
        let jsonList: any[] = [];
        if (fs.existsSync(mainJsonLogFile)) {
          try {
            const raw = fs.readFileSync(mainJsonLogFile, 'utf-8');
            jsonList = JSON.parse(raw);
          } catch {
            jsonList = [];
          }
        }
        jsonList.push(entry);
        fs.writeFileSync(mainJsonLogFile, JSON.stringify(jsonList, null, 2), 'utf-8');
      } catch {}

      return true;
    } catch (err) {
      console.error('[MainLogger] Failed to write QA log:', err);
      return false;
    }
  });

  ipcMain.handle('log-transcript-event', (_event, entry: any) => {
    try {
      const timeStr = entry.timeString || new Date(entry.timestamp || Date.now()).toLocaleTimeString();
      const speaker = (entry.speaker || 'SPEAKER').toUpperCase();
      const line = `[TRANSCRIPT] [${timeStr}] [${speaker}]: ${entry.text}\n`;

      // Print to terminal console
      process.stdout.write(`\x1b[90m[TRANSCRIPT]\x1b[0m \x1b[34m[${speaker}]\x1b[0m \x1b[90m${timeStr}:\x1b[0m ${entry.text}\n`);

      try {
        fs.appendFileSync(mainTranscriptLogFile, line, 'utf-8');
      } catch {}
      try {
        fs.appendFileSync(userTranscriptLogFile, line, 'utf-8');
      } catch {}
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('open-log-file', async () => {
    try {
      let targetFile = mainQaLogFile;
      if (!fs.existsSync(targetFile)) {
        if (fs.existsSync(userQaLogFile)) {
          targetFile = userQaLogFile;
        } else {
          fs.writeFileSync(targetFile, '# Interview Q&A Session Logs\n\nNo questions recorded yet.\n', 'utf-8');
        }
      }
      await shell.openPath(targetFile);
      return true;
    } catch (e) {
      console.error('[MainLogger] Failed to open log file:', e);
      return false;
    }
  });

  ipcMain.handle('get-log-file-path', () => {
    return fs.existsSync(mainQaLogFile) ? mainQaLogFile : userQaLogFile;
  });

  // ── Mobile Remote Bridge Handlers ─────────────────────────────────────────
  ipcMain.on('broadcast-mobile-suggestion', (_event, data) => {
    broadcastToMobile('suggestion', data);
  });

  ipcMain.on('broadcast-mobile-token', (_event, data) => {
    broadcastToMobile('token', data);
  });

  ipcMain.on('broadcast-mobile-clear', () => {
    broadcastToMobile('clear', {});
  });

  ipcMain.handle('get-mobile-server-info', () => {
    return getMobileServerInfo();
  });

  // Dynamic mouse events: renderer can ask to ignore mouse when hovering transparent zones,
  // but re-capture mouse when hovering over buttons/inputs.
  ipcMain.on('set-ignore-mouse-events', (_event, ignore: boolean, options?: { forward: boolean }) => {
    if (!mainWindow) return;
    // Don't override if stealth hidden or global click-through is locked
    if (isStealthHidden) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      return;
    }
    if (isClickThroughEnabled) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      return;
    }
    mainWindow.setIgnoreMouseEvents(ignore, { forward: options?.forward ?? true });
  });

  // Mini Mode Handlers
  ipcMain.handle('toggle-mini-mode', () => {
    toggleMiniMode();
    return isMiniMode;
  });
  ipcMain.handle('set-mini-mode', (_event, mini: boolean) => {
    if (mini) {
      enterMiniMode();
    } else {
      exitMiniMode();
    }
    return isMiniMode;
  });
  ipcMain.handle('is-mini-mode', () => isMiniMode);

  // Explicit click-through toggle from HUD button
  ipcMain.handle('toggle-click-through', () => {
    if (!mainWindow) return false;
    isClickThroughEnabled = !isClickThroughEnabled;
    mainWindow.setIgnoreMouseEvents(isClickThroughEnabled, { forward: true });
    mainWindow.webContents.send('click-through-changed', isClickThroughEnabled);
    updateTrayMenu();
    return isClickThroughEnabled;
  });

  // Toggle Content Protection (for testing or debugging capture behavior)
  ipcMain.handle('set-content-protection', (_event, enable: boolean) => {
    if (!mainWindow) return false;
    mainWindow.setContentProtection(enable);
    return mainWindow.isDestroyed() ? false : true;
  });

  // Window Controls & Background Minimization
  ipcMain.on('window-minimize', () => toggleMiniMode());
  ipcMain.on('exit-mini-mode', () => exitMiniMode()); // Called by the mini window's expand button
  ipcMain.on('set-window-position', (event, x: number, y: number) => {
    // Move whichever window sent this IPC (works for both main & mini window)
    const senderWin = BrowserWindow.fromWebContents(event.sender);
    if (!senderWin || senderWin.isDestroyed()) return;
    const display = screen.getDisplayMatching(senderWin.getBounds());
    const { x: wx, y: wy, width: ww, height: wh } = display.workArea;
    const [sw, sh] = senderWin.getSize();
    const clampedX = Math.round(Math.max(wx, Math.min(x, wx + ww - sw)));
    const clampedY = Math.round(Math.max(wy, Math.min(y, wy + wh - sh)));
    senderWin.setPosition(clampedX, clampedY);
    // Keep track of mini window position so expand restores nearby
    if (senderWin === miniWindow) {
      preMiniBounds = { ...preMiniBounds, x: clampedX, y: clampedY };
    }
  });

  // Dynamic window height expansion (expands downwards while keeping top-left anchor)
  ipcMain.handle('set-window-height', (_event, targetHeight: number) => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (isMiniMode) return false;

    const currentBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(currentBounds);
    const { y: wy, height: wh } = display.workArea;

    const minH = 460;
    const maxH = Math.min(880, Math.max(minH, wh - 40));
    const clampedHeight = Math.round(Math.max(minH, Math.min(targetHeight, maxH)));

    let newY = currentBounds.y;
    // If expanding downwards would push below screen taskbar/work area, shift Y upward smoothly
    if (newY + clampedHeight > wy + wh - 15) {
      newY = Math.max(wy + 10, wy + wh - clampedHeight - 15);
    }

    console.log(`[Electron] set-window-height: requested=${targetHeight}, clamped=${clampedHeight}, current=${currentBounds.height}, newY=${newY}`);

    if (Math.abs(currentBounds.height - clampedHeight) >= 6 || newY !== currentBounds.y) {
      mainWindow.setSize(currentBounds.width, clampedHeight);
      mainWindow.setBounds({
        x: currentBounds.x,
        y: newY,
        width: currentBounds.width,
        height: clampedHeight,
      });
      preMiniBounds = { ...preMiniBounds, height: clampedHeight, y: newY };
    }
    return true;
  });

  ipcMain.handle('set-window-size', (_event, width: number, height: number) => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    if (isMiniMode) return false;

    const currentBounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(currentBounds);
    const { x: wx, y: wy, width: ww, height: wh } = display.workArea;

    const clampedW = Math.round(Math.max(400, Math.min(width, ww - 20)));
    const clampedH = Math.round(Math.max(460, Math.min(height, wy + wh - currentBounds.y - 20)));

    mainWindow.setBounds({
      x: currentBounds.x,
      y: currentBounds.y,
      width: clampedW,
      height: clampedH,
    });
    preMiniBounds = { ...preMiniBounds, width: clampedW, height: clampedH };
    return true;
  });

  ipcMain.handle('get-window-bounds', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return preMiniBounds;
    return mainWindow.getBounds();
  });
  ipcMain.on('minimize-to-background', () => hideToBackground());
  ipcMain.on('restore-window', () => restoreFromBackground());
  ipcMain.handle('toggle-stealth-mode', () => {
    toggleVisibility();
    return isStealthHidden;
  });
  ipcMain.handle('is-stealth-hidden', () => isStealthHidden);
  ipcMain.on('window-close', () => quitApplication());
  ipcMain.handle('window-close', () => {
    quitApplication();
    return true;
  });
  ipcMain.on('close-app', () => quitApplication());
  ipcMain.handle('close-app', () => {
    quitApplication();
    return true;
  });
  ipcMain.handle('get-always-on-top', () => mainWindow?.isAlwaysOnTop() ?? false);
  ipcMain.handle('set-always-on-top', (_event, flag: boolean) => {
    if (!mainWindow) return false;
    mainWindow.setAlwaysOnTop(flag, 'screen-saver', 1);
    return flag;
  });

  // Taskbar & Tray Visibility Handlers
  ipcMain.handle('set-skip-taskbar', (_event, skip: boolean) => {
    isSkipTaskbarEnabled = skip;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setSkipTaskbar(skip);
    }
    return isSkipTaskbarEnabled;
  });

  ipcMain.handle('set-tray-visible', (_event, visible: boolean) => {
    if (visible) {
      if (!tray || tray.isDestroyed()) {
        createTray();
      }
    } else {
      if (tray && !tray.isDestroyed()) {
        tray.destroy();
        tray = null;
      }
    }
    return visible;
  });

  /**
   * Audio Capture IPC:
   * Retrieve available desktop audio/screen sources so Chromium can attach
   * loopback audio stream from the system speaker (what the interviewer says).
   */
  ipcMain.handle('get-desktop-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      fetchWindowIcons: false,
      thumbnailSize: { width: 0, height: 0 },
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      display_id: s.display_id,
    }));
  });

  /**
   * Screen Vision IPC:
   * Captures the full primary screen (Google Meet chat, coding question, CoderPad)
   * and returns base64 PNG data URL so Gemini Vision can extract and answer the question.
   */
  ipcMain.handle('capture-screen', async () => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const scaleFactor = primaryDisplay.scaleFactor || 1;
      const width = Math.round((primaryDisplay.bounds?.width || primaryDisplay.size.width) * scaleFactor);
      const height = Math.round((primaryDisplay.bounds?.height || primaryDisplay.size.height) * scaleFactor);

      // Strategy 1: DesktopCapturer getSources with full resolution
      try {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width, height },
        });

        // Try primary screen source first
        const primarySource = sources.find((s) => s.id.startsWith('screen')) || sources[0];
        if (primarySource && !primarySource.thumbnail.isEmpty()) {
          const dataUrl = primarySource.thumbnail.toDataURL();
          if (dataUrl && dataUrl.length > 100) {
            console.log('[CaptureScreen] Captured via desktopCapturer primary source');
            return dataUrl;
          }
        }

        // Try any non-empty source
        for (const s of sources) {
          if (!s.thumbnail.isEmpty()) {
            const dataUrl = s.thumbnail.toDataURL();
            if (dataUrl && dataUrl.length > 100) {
              console.log('[CaptureScreen] Captured via desktopCapturer source:', s.name);
              return dataUrl;
            }
          }
        }
      } catch (dcErr) {
        console.warn('[CaptureScreen] desktopCapturer thumbnail error:', dcErr);
      }

      // Strategy 2: Native Windows PowerShell GDI capture (Windows only)
      if (process.platform === 'win32') {
        try {
          const psCode = `Add-Type -AssemblyName System.Windows.Forms, System.Drawing; $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $b = New-Object System.Drawing.Bitmap($s.Width, $s.Height); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen($s.Location, [System.Drawing.Point]::Empty, $s.Size); $ms = New-Object System.IO.MemoryStream; $b.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $b64 = [Convert]::ToBase64String($ms.ToArray()); $g.Dispose(); $b.Dispose(); $ms.Dispose(); [Console]::Out.Write($b64);`;
          const base64 = await new Promise<string | null>((resolve) => {
            execFile(
              'powershell',
              ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psCode],
              { maxBuffer: 30 * 1024 * 1024, windowsHide: true },
              (err, stdout) => {
                if (err || !stdout || stdout.trim().length < 50) {
                  resolve(null);
                } else {
                  resolve(stdout.trim());
                }
              }
            );
          });
          if (base64) {
            console.log('[CaptureScreen] Captured via Windows PowerShell GDI fallback');
            return `data:image/png;base64,${base64}`;
          }
        } catch (psErr) {
          console.warn('[CaptureScreen] Windows PowerShell capture error:', psErr);
        }
      }

      return null;
    } catch (err) {
      console.error('[CaptureScreen] Error grabbing screen snapshot:', err);
      return null;
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Configure system audio loopback capture handler for getDisplayMedia on Windows
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen'] })
      .then((sources) => {
        const primarySource = sources.find((s) => s.id.startsWith('screen')) || sources[0];
        if (primarySource) {
          console.log('[Electron] Granted display media with loopback audio for:', primarySource.name);
          callback({
            video: primarySource,
            audio: 'loopback',
          });
        } else {
          console.warn('[Electron] No screen source available for loopback');
          callback({});
        }
      })
      .catch((err) => {
        console.error('[Electron] Error grabbing screen sources for loopback:', err);
        callback({});
      });
  });

  // Automatically grant media/display-capture permissions so loopback audio & mic are never blocked
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  createWindow();
  createTray();
  registerHotkeys();
  registerIpcHandlers();

  // Start Mobile Remote Controller Server
  startMobileServer({
    onQuery: (query, role) => {
      console.log(`[Main] 📱 Mobile Query Dispatched: "${query}" (role: ${role})`);
      // If user had collapsed to mini mode, expand to full HUD so answer is visible on PC
      if (isMiniMode) {
        exitMiniMode();
      }
      // If user had hidden HUD in stealth mode, restore it
      if (isStealthHidden) {
        restoreFromBackground();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('mobile-remote-query', { query, role: role || 'interviewer' });
      }
    },
    onAction: (action) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (action === 'toggle-stealth') {
        toggleVisibility();
      } else if (action === 'toggle-mini') {
        toggleMiniMode();
      } else if (action === 'clear') {
        mainWindow.webContents.send('mobile-remote-action', { action: 'clear' });
        broadcastToMobile('clear', {});
      } else if (action === 'stop') {
        mainWindow.webContents.send('mobile-remote-action', { action: 'stop' });
      } else if (action === 'generate' || action === 'enter') {
        if (isMiniMode) exitMiniMode();
        if (isStealthHidden) restoreFromBackground();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('mobile-remote-action', { action: 'generate' });
      } else if (action === 'scan-screen' || action === 'scan' || action === 'screenshot') {
        if (isMiniMode) exitMiniMode();
        if (isStealthHidden) restoreFromBackground();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('trigger-screen-capture');
      }
    },
  }).catch((err) => {
    console.error('[Main] Failed to start mobile server:', err);
  });

  // If user launches second instance while app is running/hidden, restore it
  app.on('second-instance', () => {
    restoreFromBackground();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      restoreFromBackground();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopMobileServer();
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

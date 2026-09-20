import { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, screen, Tray, Menu, nativeImage, session } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ensure single instance lock so multiple stealth overlays don't clash
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isClickThroughEnabled = false;
let isStealthHidden = false;

function createWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // Initial HUD dimensions positioned discreetly in the upper-right or centered
  const windowWidth = 620;
  const windowHeight = 520;
  const initialX = Math.round(width - windowWidth - 30);
  const initialY = 40;

    const preloadMjs = path.join(__dirname, 'preload.mjs');
    const preloadJs = path.join(__dirname, 'preload.js');
    const resolvedPreload = fs.existsSync(preloadMjs) ? preloadMjs : preloadJs;

    mainWindow = new BrowserWindow({
      x: initialX,
      y: initialY,
      width: windowWidth,
      height: windowHeight,
      minWidth: 420,
      minHeight: 350,
      transparent: true,
      frame: false,
      hasShadow: false,
      resizable: true,
      skipTaskbar: false, // Set to true if you want total stealth from the OS taskbar/dock
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
  const watchdogInterval = setInterval(enforceProtection, 3000);
  mainWindow.on('closed', () => clearInterval(watchdogInterval));

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
          app.quit();
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
  mainWindow.setOpacity(0.92);
  mainWindow.setIgnoreMouseEvents(isClickThroughEnabled, { forward: true });
  mainWindow.setContentProtection(true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.show();
  mainWindow.focus();
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
}

/**
 * IPC Event Handlers
 */
function registerIpcHandlers() {
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
  ipcMain.on('window-minimize', () => hideToBackground());
  ipcMain.on('minimize-to-background', () => hideToBackground());
  ipcMain.on('restore-window', () => restoreFromBackground());
  ipcMain.handle('toggle-stealth-mode', () => {
    toggleVisibility();
    return isStealthHidden;
  });
  ipcMain.handle('is-stealth-hidden', () => isStealthHidden);
  ipcMain.on('window-close', () => mainWindow?.close());
  ipcMain.handle('get-always-on-top', () => mainWindow?.isAlwaysOnTop() ?? false);
  ipcMain.handle('set-always-on-top', (_event, flag: boolean) => {
    if (!mainWindow) return false;
    mainWindow.setAlwaysOnTop(flag, 'screen-saver', 1);
    return flag;
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
      const { width, height } = primaryDisplay.size;
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height },
      });
      const primarySource = sources.find((s) => s.id.startsWith('screen')) || sources[0];
      if (!primarySource) return null;
      return primarySource.thumbnail.toDataURL();
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
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

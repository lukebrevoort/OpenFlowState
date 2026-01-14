/**
 * FlowState Desktop App - Electron Main Process
 * 
 * This is the entry point for the Electron main process.
 * It manages the application lifecycle, creates windows, and handles IPC.
 */

import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

// Determine if we're in development mode
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'FlowState',
    titleBarStyle: 'hiddenInset', // macOS native look
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#F6EEE3', // FlowState background color
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Show window when ready to prevent flashing
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Cleanup on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when app is ready
app.whenReady().then(() => {
  createWindow();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================================
// IPC Handlers - Communication between main and renderer processes
// ============================================================================

/**
 * Get app information
 */
ipcMain.handle('app:getInfo', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    isDev,
  };
});

/**
 * Get system theme preference
 */
ipcMain.handle('app:getTheme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

/**
 * Open external URL in default browser
 */
ipcMain.handle('app:openExternal', async (_event, url: string) => {
  await shell.openExternal(url);
});

/**
 * Minimize window
 */
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

/**
 * Maximize/restore window
 */
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

/**
 * Close window
 */
ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// ============================================================================
// Future IPC Handlers (to be implemented)
// ============================================================================

// Config store operations
ipcMain.handle('config:get', async () => {
  // TODO: Implement config store
  return {};
});

ipcMain.handle('config:set', async (_event, config: unknown) => {
  // TODO: Implement config store
  console.log('Config set:', config);
});

// Auth operations
ipcMain.handle('auth:getToken', async (_event, service: string) => {
  // TODO: Implement auth manager
  console.log('Get token for:', service);
  return null;
});

ipcMain.handle('auth:setToken', async (_event, service: string, token: unknown) => {
  // TODO: Implement auth manager
  console.log('Set token for:', service, token);
});

// OAuth server operations
ipcMain.handle('oauth:start', async (_event, service: string) => {
  // TODO: Implement OAuth server
  console.log('Start OAuth for:', service);
});

// OpenCode operations
ipcMain.handle('opencode:send', async (_event, message: string) => {
  // TODO: Implement OpenCode integration
  console.log('Send to OpenCode:', message);
  return { response: 'OpenCode integration not yet implemented' };
});

console.log('FlowState Desktop App starting...');

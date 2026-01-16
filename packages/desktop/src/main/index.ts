/**
 * FlowState Desktop App - Electron Main Process
 *
 * This is the entry point for the Electron main process.
 * It manages the application lifecycle, creates windows, and handles IPC.
 */

import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { configStore } from './config-store.js';
import { processManager } from './process-manager.js';
import { authManager, ClientCredentials } from './auth-manager.js';
import { oauthServer } from './oauth-server.js';

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

/**
 * Initialize the application
 */
async function initialize(): Promise<void> {
  console.log('FlowState Desktop App starting...');

  // Load configuration
  await configStore.load();
  console.log('Configuration loaded');

  // Initialize auth manager
  try {
    await authManager.initialize();
    console.log('Auth manager initialized');
  } catch (error) {
    console.error('Failed to initialize auth manager:', error);
  }

  // Set main window reference for OAuth server
  if (mainWindow) {
    oauthServer.setMainWindow(mainWindow);
  }

  // Start OpenCode server
  try {
    await processManager.start();
    console.log('OpenCode server initialized');

    // Start event stream if we have a window
    if (mainWindow?.webContents) {
      await processManager.startEventStream(mainWindow.webContents);
    }
  } catch (error) {
    console.error('Failed to start OpenCode:', error);
    // Continue anyway - the app can still function, just without AI
  }
}

// Create window when app is ready
app.whenReady().then(async () => {
  createWindow();

  // Initialize after window is created
  await initialize();

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

ipcMain.handle('app:openTerminal', async (_event, command: string) => {
  try {
    await shell.openExternal(`terminal://${encodeURIComponent(command)}`);
  } catch (error) {
    console.error('Failed to open terminal via URL scheme:', error);
  }

  try {
    const { exec } = await import('node:child_process');
    const escapedCommand = command.replace(/"/g, '\\"');
    exec(`osascript -e 'tell application "Terminal" to do script "${escapedCommand}"'`);
  } catch (error) {
    console.error('Failed to open terminal via exec:', error);
    throw error;
  }
});

// ============================================================================
// Window Controls
// ============================================================================

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

// ============================================================================
// Configuration
// ============================================================================

ipcMain.handle('config:get', async () => {
  try {
    return configStore.get();
  } catch {
    // Config not loaded yet, load it
    return await configStore.load();
  }
});

ipcMain.handle('config:set', async (_event, config: Parameters<typeof configStore.update>[0]) => {
  await configStore.update(config);
  return configStore.get();
});

// ============================================================================
// Authentication
// ============================================================================

/**
 * Get stored token for a service
 */
ipcMain.handle('auth:getToken', async (_event, service: string) => {
  try {
    return await authManager.getToken(service);
  } catch (error) {
    console.error(`[Auth] Error getting token for ${service}:`, error);
    return null;
  }
});

/**
 * Get auth status for a service
 */
ipcMain.handle('auth:getStatus', async (_event, service: string) => {
  try {
    return await authManager.getStatus(service);
  } catch (error) {
    console.error(`[Auth] Error getting status for ${service}:`, error);
    return {
      service,
      connected: false,
      configured: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

/**
 * Get auth status for all services
 */
ipcMain.handle('auth:getAllStatuses', async () => {
  try {
    return await authManager.getAllStatuses();
  } catch (error) {
    console.error('[Auth] Error getting all statuses:', error);
    return [];
  }
});

/**
 * Remove token for a service
 */
ipcMain.handle('auth:removeToken', async (_event, service: string) => {
  try {
    await authManager.removeToken(service);
  } catch (error) {
    console.error(`[Auth] Error removing token for ${service}:`, error);
    throw error;
  }
});

/**
 * Store client credentials for a service
 */
ipcMain.handle(
  'auth:setCredentials',
  async (_event, service: string, credentials: ClientCredentials) => {
    try {
      await authManager.storeClientCredentials(service, credentials);
    } catch (error) {
      console.error(`[Auth] Error storing credentials for ${service}:`, error);
      throw error;
    }
  }
);

/**
 * Get client credentials for a service
 */
ipcMain.handle('auth:getCredentials', async (_event, service: string) => {
  try {
    return await authManager.getClientCredentials(service);
  } catch (error) {
    console.error(`[Auth] Error getting credentials for ${service}:`, error);
    return null;
  }
});

/**
 * Remove client credentials for a service
 */
ipcMain.handle('auth:removeCredentials', async (_event, service: string) => {
  try {
    await authManager.removeClientCredentials(service);
  } catch (error) {
    console.error(`[Auth] Error removing credentials for ${service}:`, error);
    throw error;
  }
});

/**
 * Store an API token directly (for Notion Internal Integration, etc.)
 */
ipcMain.handle('auth:storeApiToken', async (_event, service: string, apiToken: string) => {
  try {
    await authManager.storeApiToken(service, apiToken);

    // Reload MCP config to include the new service
    await processManager.reloadMcpConfig();
    
    // Notify renderer of success
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('auth:apiTokenSuccess', { service });
    }
    
    return { success: true };
  } catch (error) {
    console.error(`[Auth] Error storing API token for ${service}:`, error);
    throw error;
  }
});

// ============================================================================
// OAuth
// ============================================================================

/**
 * Start OAuth flow for a service
 */
ipcMain.handle(
  'oauth:start',
  async (_event, service: string, clientId: string, clientSecret: string) => {
    try {
      console.log(`[OAuth] Starting OAuth flow for ${service}`);

      // Store credentials for future token refresh
      await authManager.storeClientCredentials(service, {
        clientId,
        clientSecret,
      });

      // Start OAuth flow
      const token = await oauthServer.startOAuth(service, clientId, clientSecret);

      // Reload MCP config to include the new service
      await processManager.reloadMcpConfig();

      return token;
    } catch (error) {
      console.error(`[OAuth] Error starting OAuth for ${service}:`, error);

      // Send error event to renderer
      if (mainWindow?.webContents) {
        mainWindow.webContents.send('oauth:error', {
          service,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }
);

/**
 * Refresh token for a service
 */
ipcMain.handle('oauth:refresh', async (_event, service: string) => {
  try {
    return await oauthServer.refreshToken(service);
  } catch (error) {
    console.error(`[OAuth] Error refreshing token for ${service}:`, error);
    return null;
  }
});

/**
 * Disconnect a service (remove token)
 */
ipcMain.handle('oauth:disconnect', async (_event, service: string) => {
  try {
    await oauthServer.disconnect(service);

    // Reload MCP config to remove the disconnected service
    await processManager.reloadMcpConfig();

    // Notify renderer
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('oauth:disconnected', { service });
    }
  } catch (error) {
    console.error(`[OAuth] Error disconnecting ${service}:`, error);
    throw error;
  }
});

/**
 * Reload MCP configuration (call after connecting new integrations)
 */
ipcMain.handle('mcp:reload', async () => {
  try {
    await processManager.reloadMcpConfig();
    return { success: true };
  } catch (error) {
    console.error('[MCP] Error reloading config:', error);
    throw error;
  }
});

/**
 * Get MCP server status
 */
ipcMain.handle('mcp:status', async () => {
  try {
    return await processManager.getMcpStatus();
  } catch (error) {
    console.error('[MCP] Error getting status:', error);
    return null;
  }
});

// ============================================================================
// OpenCode Integration
// ============================================================================

/**
 * Send a message to OpenCode and get a response
 */
ipcMain.handle('opencode:send', async (event, message: string) => {
  if (!processManager.running) {
    return {
      error: 'OpenCode not running',
      content: 'The AI assistant is not available. Please restart the application.',
    };
  }

  try {
    // Get the webContents from the event
    const webContents = event.sender;

    // Stream the message (sends events back via IPC)
    await processManager.streamMessage(message, webContents);

    return { success: true };
  } catch (error) {
    console.error('Error in opencode:send:', error);
    return {
      error: error instanceof Error ? error.message : String(error),
      content: 'An error occurred while processing your request.',
    };
  }
});

/**
 * Get OpenCode status
 */
ipcMain.handle('opencode:status', async () => {
  try {
    return { success: true, status: processManager.running };
  } catch (error) {
    console.error('Failed to get OpenCode status:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('opencode:restart', async () => {
  try {
    await processManager.stop();
    await processManager.start();
    return { success: true };
  } catch (error) {
    console.error('Failed to restart OpenCode:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});


/**
 * Create a new session
 */
ipcMain.handle('opencode:newSession', async (_event, title?: string) => {
  if (!processManager.running) {
    throw new Error('OpenCode not running');
  }

  const sessionId = await processManager.createSession(title);
  return { sessionId };
});

/**
 * List all sessions
 */
ipcMain.handle('opencode:listSessions', async () => {
  return await processManager.listSessions();
});

/**
 * Switch to a different session
 */
ipcMain.handle('opencode:switchSession', async (_event, sessionId: string) => {
  await processManager.switchSession(sessionId);
  return { sessionId };
});

/**
  * Get messages from current session
  */
 ipcMain.handle('opencode:getMessages', async () => {
   return await processManager.getSessionMessages();
 });

 /**
  * List timeline events for a session
  */
 ipcMain.handle('timeline:list', async (_event, sessionId: string, limit?: number, offset?: number) => {
   return await processManager.getTimelineEventsForSession(sessionId, limit ?? 100, offset ?? 0);
 });

 /**
  * Resolve a timeline payload from blob storage
  */
 ipcMain.handle('timeline:payload', async (_event, payloadRef: string) => {
   return await processManager.getTimelinePayload(payloadRef);
 });
 
 console.log('IPC handlers registered');


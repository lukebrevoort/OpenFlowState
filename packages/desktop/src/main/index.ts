/**
 * FlowState Desktop App - Electron Main Process
 *
 * This is the entry point for the Electron main process.
 * It manages the application lifecycle, creates windows, and handles IPC.
 */

import { app, BrowserWindow, ipcMain, shell, nativeTheme, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { runCanvasBrowserLogin } from './canvas-browser-login.js';
import {
  readOutlookInboxWithBrowserSession,
  runOutlookBrowserLogin,
} from './outlook-browser-session.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { configStore } from './config-store.js';
import { processManager } from './process-manager.js';
import { timelineStore } from './timeline-store.js';
import { taskStore } from './task-store.js';
import { authManager, ClientCredentials } from './auth-manager.js';
import { oauthServer } from './oauth-server.js';
import { listGoogleCalendars } from './google-calendar.js';
import { approvalPolicyStore, type ApprovalReply } from './approval-policy-store.js';
import { approvalsAuditStore } from './approvals-audit-store.js';
import { startPendingAuthWatcher, stopPendingAuthWatcher } from './pending-auth-watcher.js';
import type {
  IpcError,
  IpcResult,
  StudyMaterialArtifact,
  StudyMaterialArtifactCreateInput,
  StudyMaterialRun,
  StudyMaterialRunCreateInput,
  TaskRun,
  WorkflowArtifact,
  WorkflowDefinition,
  WorkflowRun,
} from '../renderer/types/electron';
import { workflowsRunner } from './workflows-runner.js';
import { workflowsGenerator } from './workflows-generator.js';
import { toRendererTaskRun } from './task-types.js';
import { workflowRunStore } from './workflow-run-store.js';
import { studyMaterialStore } from './study-material-store.js';
import { PinnedWorkflowsLimitError, workflowsPinsStore } from './workflows-pins-store.js';
import { userProfile } from '@flowstate/core';
import { runIntegrationHealthCheck, runOAuthBatchHealthCheck } from './integrations-health.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execFileAsync = promisify(execFile);
const SAFE_PROVIDER_PATTERN = /^[A-Za-z0-9_-]+$/;
const TERMINAL_COMMAND_PREFIX = 'opencode auth login';
const UNSAFE_SHELL_CHARS_PATTERN = /[;&|`$<>\\"'(){}\[\]!]/;
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

const approvedEnsureFilePaths = new Set<string>();
const approvedEnsureFileDirectories = new Set<string>();

const normalizeAbsolutePath = (value: string, fieldName: string): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error(`${fieldName} must be an absolute path.`);
  }
  return path.normalize(path.resolve(trimmed));
};

const isPathWithin = (candidatePath: string, rootPath: string): boolean => {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const getAppOwnedRoots = (): string[] => {
  return Array.from(new Set([app.getPath('userData'), configStore.getDataDir()].map((p) => path.normalize(path.resolve(p)))));
};

const markEnsureFilePathApproved = (filePath: string): void => {
  approvedEnsureFilePaths.add(filePath);
  approvedEnsureFileDirectories.add(path.dirname(filePath));
};

const markEnsureFileDirectoryApproved = (dirPath: string): void => {
  approvedEnsureFileDirectories.add(dirPath);
};

const isEnsureFilePathAllowed = (filePath: string): boolean => {
  if (approvedEnsureFilePaths.has(filePath)) {
    return true;
  }

  for (const approvedDir of approvedEnsureFileDirectories) {
    if (isPathWithin(filePath, approvedDir)) {
      return true;
    }
  }

  for (const root of getAppOwnedRoots()) {
    if (isPathWithin(filePath, root)) {
      return true;
    }
  }

  return false;
};

const parseAllowedExternalUrl = (rawUrl: string): URL => {
  const trimmed = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!trimmed) {
    throw new Error('URL must be a non-empty string.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error('URL must be a valid absolute URL.');
  }

  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error(`Blocked URL protocol "${parsedUrl.protocol}". Allowed protocols: ${Array.from(ALLOWED_EXTERNAL_PROTOCOLS).join(', ')}.`);
  }

  return parsedUrl;
};

const parseSupportedTerminalCommand = (command: string): string => {
  const trimmed = typeof command === 'string' ? command.trim() : '';
  if (!trimmed) {
    throw new Error('Unsupported terminal command. Allowed: "opencode auth login" or "opencode auth login <https-url>".');
  }

  if (trimmed === TERMINAL_COMMAND_PREFIX) {
    return trimmed;
  }

  if (!trimmed.startsWith(`${TERMINAL_COMMAND_PREFIX} `)) {
    throw new Error('Unsupported terminal command. Allowed: "opencode auth login" or "opencode auth login <https-url>".');
  }

  const urlCandidate = trimmed.slice(TERMINAL_COMMAND_PREFIX.length + 1).trim();
  if (!urlCandidate || UNSAFE_SHELL_CHARS_PATTERN.test(urlCandidate)) {
    throw new Error('Unsupported terminal command. URL contains unsupported characters.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlCandidate);
  } catch {
    throw new Error('Unsupported terminal command. URL must be valid HTTP/HTTPS.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Unsupported terminal command. URL must use HTTP/HTTPS.');
  }

  return `${TERMINAL_COMMAND_PREFIX} ${urlCandidate}`;
};

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
    try {
      const parsedUrl = parseAllowedExternalUrl(url);
      void shell.openExternal(parsedUrl.toString());
    } catch (error) {
      console.warn('[Security] Blocked unsafe external window URL:', error instanceof Error ? error.message : String(error));
    }
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
  const dataDir = configStore.getDataDir();
  process.env.FLOWSTATE_DATA_DIR = dataDir;
  userProfile.configure({ dataDir });
  console.log('Configuration loaded');

  // Initialize auth manager
  try {
    await authManager.initialize();
    console.log('Auth manager initialized');
  } catch (error) {
    console.error('Failed to initialize auth manager:', error);
  }

  // Start pending auth watcher (for MCP tools that trigger auth flows)
  try {
    await startPendingAuthWatcher(dataDir);
    console.log('Pending auth watcher started');
  } catch (error) {
    console.error('Failed to start pending auth watcher:', error);
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

// Clean up before quitting
app.on('before-quit', async () => {
  await stopPendingAuthWatcher();
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
  const parsedUrl = parseAllowedExternalUrl(url);
  await shell.openExternal(parsedUrl.toString());
});

ipcMain.handle('app:showSaveDialog', async (_event, options?: { title?: string; defaultPath?: string }) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: options?.title ?? 'Choose a file location',
    defaultPath: options?.defaultPath,
    buttonLabel: 'Save',
    showsTagField: false,
  });

  if (result.canceled) return null;
  const filePath = result.filePath ?? null;
  if (filePath) {
    try {
      markEnsureFilePathApproved(normalizeAbsolutePath(filePath, 'filePath'));
    } catch (error) {
      console.warn('[Security] Failed to register save dialog approval:', error instanceof Error ? error.message : String(error));
    }
  }
  return filePath;
});

ipcMain.handle('app:showOpenDialog', async (_event, options?: { title?: string }) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: options?.title ?? 'Choose a folder',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled) return null;
  const selectedPath = result.filePaths[0] ?? null;
  if (selectedPath) {
    try {
      markEnsureFileDirectoryApproved(normalizeAbsolutePath(selectedPath, 'path'));
    } catch (error) {
      console.warn('[Security] Failed to register open dialog approval:', error instanceof Error ? error.message : String(error));
    }
  }
  return selectedPath;
});

ipcMain.handle('app:ensureFile', async (_event, filePath: string) => {
  try {
    const normalizedFilePath = normalizeAbsolutePath(filePath, 'filePath');
    if (!isEnsureFilePathAllowed(normalizedFilePath)) {
      return {
        success: false,
        error:
          'Refused to create file at an unapproved location. Choose a location using the app save/open dialog or use a path under app data.',
      };
    }

    const dir = path.dirname(normalizedFilePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(normalizedFilePath, '', { flag: 'a' });
    return { success: true };
  } catch (error) {
    console.error('Failed to ensure file exists:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('canvas:browserLogin', async (_event, payload: {
  canvasApiUrl: string;
  storageStatePath: string;
  confirmationFilePath?: string;
  timeoutSeconds?: number;
}) => {
  try {
    const result = await runCanvasBrowserLogin({
      canvasApiUrl: payload.canvasApiUrl,
      storageStatePath: payload.storageStatePath,
      confirmationFilePath: payload.confirmationFilePath,
      timeoutMs: payload.timeoutSeconds ? payload.timeoutSeconds * 1000 : undefined,
    });

    return { success: true, storageStatePath: result.storageStatePath };
  } catch (error) {
    console.error('Canvas browser login failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('outlook:browserLogin', async (_event, payload: {
  mailboxUrl?: string;
  storageStatePath: string;
  confirmationFilePath?: string;
  timeoutSeconds?: number;
}) => {
  try {
    const result = await runOutlookBrowserLogin({
      mailboxUrl: payload.mailboxUrl,
      storageStatePath: payload.storageStatePath,
      confirmationFilePath: payload.confirmationFilePath,
      timeoutMs: payload.timeoutSeconds ? payload.timeoutSeconds * 1000 : undefined,
    });

    return {
      success: true,
      storageStatePath: result.storageStatePath,
      mailboxUrl: result.mailboxUrl,
    };
  } catch (error) {
    console.error('Outlook browser login failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('outlook:readInbox', async (_event, payload: {
  maxItems?: number;
}) => {
  try {
    const token = await authManager.getToken('outlook');
    const storageStatePath = token?.additionalData?.outlookStorageStatePath;
    const mailboxUrl = token?.additionalData?.outlookMailboxUrl;

    if (!storageStatePath) {
      return {
        ok: false,
        message: 'Outlook browser session is not configured. Connect Outlook using Browser Session mode.',
        messages: [],
      };
    }

    return await readOutlookInboxWithBrowserSession({
      storageStatePath,
      mailboxUrl,
      maxItems: payload?.maxItems,
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      messages: [],
    };
  }
});

ipcMain.handle('app:openTerminal', async (_event, command: string) => {
  const safeCommand = parseSupportedTerminalCommand(command);

  try {
    await shell.openExternal(`terminal://${encodeURIComponent(safeCommand)}`);
  } catch (error) {
    console.error('Failed to open terminal via URL scheme:', error);
  }

  try {
    await execFileAsync('osascript', [
      '-e',
      'on run argv',
      '-e',
      'tell application "Terminal" to do script (item 1 of argv)',
      '-e',
      'end run',
      '--',
      safeCommand,
    ]);
  } catch (error) {
    console.error('Failed to open terminal via execFile:', error);
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

ipcMain.handle('config:path', () => {
  return configStore.getConfigPath();
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
 ipcMain.handle('auth:storeApiToken', async (_event, service: string, apiToken: string, additionalData?: Record<string, string>) => {
  try {
    await authManager.storeApiToken(service, apiToken, additionalData);

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
 * Re-authenticate a service using stored credentials
 */
ipcMain.handle('auth:reauthenticate', async (_event, service: string) => {
  try {
    const credentials = await authManager.getClientCredentials(service);
    if (!credentials?.clientId || !credentials?.clientSecret) {
      throw new Error(`Missing stored credentials for ${service}`);
    }

    const token = await oauthServer.startOAuth(service, credentials.clientId, credentials.clientSecret);
    await processManager.reloadMcpConfig();
    return token;
  } catch (error) {
    console.error(`[Auth] Error re-authenticating ${service}:`, error);
    throw error;
  }
});

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
  console.log('[IPC] opencode:send called with message length:', message.length);
  
  if (!processManager.running) {
    console.error('[IPC] OpenCode not running!');
    return {
      error: 'OpenCode not running',
      content: 'The AI assistant is not available. Please restart the application.',
    };
  }

  try {
    // Get the webContents from the event
    const webContents = event.sender;
    console.log('[IPC] Calling processManager.streamMessage()...');

    // Stream the message (sends events back via IPC)
    await processManager.streamMessage(message, webContents);

    console.log('[IPC] streamMessage completed successfully');
    return { success: true };
  } catch (error) {
    console.error('[IPC] Error in opencode:send:', error);
    const opencodeError = (error as Error & { opencode?: { error: string } }).opencode;
    const message = opencodeError?.error ?? (error instanceof Error ? error.message : String(error));
    return {
      error: message,
      content: message,
      errorDetails: opencodeError,
    };
  }
});

/**
 * Fire-and-forget send. Returns success once the request is enqueued.
 * The response (and any errors) still stream via IPC events.
 */
ipcMain.handle('opencode:sendAsync', async (event, message: string) => {
  console.log('[IPC] opencode:sendAsync called with message length:', message.length);

  if (!processManager.running) {
    console.error('[IPC] OpenCode not running!');
    return {
      error: 'OpenCode not running',
      content: 'The AI assistant is not available. Please restart the application.',
    };
  }

  try {
    const webContents = event.sender;
    void processManager.streamMessage(message, webContents).catch((error) => {
      console.error('[IPC] Error in opencode:sendAsync background stream:', error);
    });
    return { success: true };
  } catch (error) {
    console.error('[IPC] Error in opencode:sendAsync:', error);
    const opencodeError = (error as Error & { opencode?: { error: string } }).opencode;
    const msg = opencodeError?.error ?? (error instanceof Error ? error.message : String(error));
    return {
      error: msg,
      content: msg,
      errorDetails: opencodeError,
    };
  }
});

ipcMain.handle('opencode:cancelGeneration', async (_event, context?: { expectedSessionId?: string | null }) => {
  try {
    const result = await processManager.cancelActiveGeneration(context?.expectedSessionId);
    return { success: true, cancelled: result.cancelled };
  } catch (error) {
    console.error('[IPC] Error in opencode:cancelGeneration:', error);
    return { success: false, cancelled: false, error: error instanceof Error ? error.message : String(error) };
  }
});

/**
 * Get OpenCode status
 */
ipcMain.handle('opencode:status', async () => {
  try {
    const health = await processManager.healthCheck();
    return {
      running: processManager.running,
      // Back-compat for early renderer builds that expected `status`
      status: processManager.running,
      sessionId: processManager.sessionId,
      healthy: health.healthy,
      version: health.version,
    };
  } catch (error) {
    console.error('Failed to get OpenCode status:', error);
    return {
      running: false,
      status: false,
      sessionId: null,
      healthy: false,
      version: undefined,
    };
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

// ============================================================================
// Phase 3.5 - Feature-level IPC surfaces (typed via renderer/types/electron.d.ts)
// ============================================================================

const ipcError = <T>(code: IpcError['code'], message: string, details?: unknown): IpcResult<T> => ({
  ok: false,
  error: {
    code,
    message,
    ...(details === undefined ? {} : { details }),
  } as IpcError,
});

const ipcOk = <T>(data: T): IpcResult<T> => ({ ok: true, data });

const STUDY_MATERIAL_RUN_MODES = new Set(['conservative', 'coaching']);
const STUDY_MATERIAL_RUN_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'cancelled']);
const STUDY_MATERIAL_ARTIFACT_KINDS = new Set(['summary', 'practice_exam', 'flashcards', 'report']);
const STUDY_MATERIAL_MAX_LIMIT = 200;

const isFiniteInteger = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
};

const DEFAULT_CONVERSATION_TITLE = 'New Conversation';

const normalizeConversationTitle = (title: string): string => {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
};

const parseTitleSuffix = (title: string): { base: string; suffix: number | null } => {
  const match = /^(.*?)(?:\s\((\d+)\))?$/.exec(title.trim());
  if (!match) {
    return { base: title.trim(), suffix: null };
  }

  const base = (match[1] ?? '').trim();
  const suffix = match[2] ? Number(match[2]) : null;
  return { base, suffix: Number.isFinite(suffix) ? suffix : null };
};

const makeUniqueConversationTitle = (requested: string | undefined, existingTitles: string[]): string => {
  const initial = (requested ?? '').trim().replace(/\s+/g, ' ');
  const desired = initial.length ? initial : DEFAULT_CONVERSATION_TITLE;

  const existingNormalized = new Set(existingTitles.map(normalizeConversationTitle));
  const desiredNorm = normalizeConversationTitle(desired);
  if (!existingNormalized.has(desiredNorm)) {
    return desired;
  }

  const parsed = parseTitleSuffix(desired);
  const base = parsed.base.length ? parsed.base : DEFAULT_CONVERSATION_TITLE;
  const baseNorm = normalizeConversationTitle(base);

  const used = new Set<number>();
  for (const t of existingTitles) {
    const cleaned = t.trim().replace(/\s+/g, ' ');
    const { base: b, suffix } = parseTitleSuffix(cleaned);
    if (normalizeConversationTitle(b) !== baseNorm) {
      continue;
    }

    if (suffix && suffix > 0) {
      used.add(suffix);
    } else {
      used.add(1);
    }
  }

  for (let n = 2; n < 10_000; n += 1) {
    if (!used.has(n)) {
      return `${base} (${n})`;
    }
  }

  // Extremely unlikely fallback; keeps behavior deterministic.
  return `${base} (${Date.now()})`;
};

const configureTimelineStore = (): void => {
  // Avoid initializing with DEFAULT_DATA_DIR before ProcessManager has a chance
  // to point the store at the app userData dir.
  timelineStore.configure({ dataDir: configStore.getDataDir() });
};

const configureTaskStore = (): void => {
  // Keep Tasks persisted alongside TimelineStore in the same memory.db.
  taskStore.configure({ dataDir: configStore.getDataDir() });
};

const configureWorkflowRunStore = (): void => {
  // Keep workflow run history persisted in memory.db.
  workflowRunStore.configure({ dataDir: configStore.getDataDir() });
};

const configureStudyMaterialStore = (): void => {
  // Keep study material run history persisted in memory.db.
  studyMaterialStore.configure({ dataDir: configStore.getDataDir() });
};

const configureWorkflowsPinsStore = (): void => {
  workflowsPinsStore.configure({ dataDir: configStore.getDataDir() });
};

const configureApprovalsAuditStore = (): void => {
  approvalsAuditStore.configure({ dataDir: configStore.getDataDir() });
};

ipcMain.handle('settings:get', async () => {
  try {
    return configStore.get();
  } catch {
    return await configStore.load();
  }
});

ipcMain.handle('settings:update', async (_event, config: Parameters<typeof configStore.update>[0]) => {
  await configStore.update(config);
  return configStore.get();
});

ipcMain.handle('settings:getTheme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle('settings:getAppInfo', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    isDev,
  };
});

ipcMain.handle('gcal:listCalendars', async () => {
  return listGoogleCalendars();
});

ipcMain.handle('integrations:listAuthStatuses', async () => {
  try {
    return await authManager.getAllStatuses();
  } catch (error) {
    console.error('[Integrations] Error getting all statuses:', error);
    return [];
  }
});

ipcMain.handle('integrations:getMcpStatus', async () => {
  try {
    return await processManager.getMcpStatus();
  } catch (error) {
    console.error('[Integrations] Error getting MCP status:', error);
    return null;
  }
});

ipcMain.handle('integrations:reloadMcp', async () => {
  try {
    const result = await processManager.reloadMcpConfig();
    if (result.success) {
      return { success: true };
    }
    return { success: false, error: result.error ?? 'Failed to reload MCP config' };
  } catch (error) {
    console.error('[Integrations] Error reloading MCP config:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('integrations:healthCheck', async (_event, service: string) => {
  return await runIntegrationHealthCheck(service);
});

ipcMain.handle('integrations:healthCheckOAuthBatch', async () => {
  return await runOAuthBatchHealthCheck();
});

ipcMain.handle(
  'integrations:oauthStart',
  async (_event, service: string, clientId: string, clientSecret: string) => {
    try {
      await authManager.storeClientCredentials(service, {
        clientId,
        clientSecret,
      });

      const token = await oauthServer.startOAuth(service, clientId, clientSecret);
      await processManager.reloadMcpConfig();
      return token;
    } catch (error) {
      console.error(`[Integrations] Error starting OAuth for ${service}:`, error);
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

ipcMain.handle('integrations:oauthRefresh', async (_event, service: string) => {
  try {
    return await oauthServer.refreshToken(service);
  } catch (error) {
    console.error(`[Integrations] Error refreshing token for ${service}:`, error);
    return null;
  }
});

ipcMain.handle('integrations:oauthDisconnect', async (_event, service: string) => {
  try {
    await oauthServer.disconnect(service);
    await processManager.reloadMcpConfig();
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('oauth:disconnected', { service });
    }
  } catch (error) {
    console.error(`[Integrations] Error disconnecting ${service}:`, error);
    throw error;
  }
});

ipcMain.handle(
  'integrations:storeApiToken',
  async (_event, service: string, apiToken: string, additionalData?: Record<string, string>) => {
    try {
      await authManager.storeApiToken(service, apiToken, additionalData);
      await processManager.reloadMcpConfig();

      if (mainWindow?.webContents) {
        mainWindow.webContents.send('auth:apiTokenSuccess', { service });
      }

      return { success: true };
    } catch (error) {
      console.error(`[Integrations] Error storing API token for ${service}:`, error);
      throw error;
    }
  }
);

ipcMain.handle('chat:sendMessage', async (event, message: string) => {
  if (!processManager.running) {
    return {
      error: 'OpenCode not running',
      content: 'The AI assistant is not available. Please restart the application.',
    };
  }

  try {
    await processManager.streamMessage(message, event.sender);
    return { success: true };
  } catch (error) {
    console.error('[IPC] Error in chat:sendMessage:', error);
    const opencodeError = (error as Error & { opencode?: { error: string } }).opencode;
    const message = opencodeError?.error ?? (error instanceof Error ? error.message : String(error));
    return {
      error: message,
      content: message,
      errorDetails: opencodeError,
    };
  }
});

ipcMain.handle('chat:cancelGeneration', async (_event, context?: { expectedSessionId?: string | null }) => {
  try {
    const result = await processManager.cancelActiveGeneration(context?.expectedSessionId);
    return { success: true, cancelled: result.cancelled };
  } catch (error) {
    console.error('[IPC] Error in chat:cancelGeneration:', error);
    return { success: false, cancelled: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('chat:getStatus', async () => {
  const health = await processManager.healthCheck();
  return {
    running: processManager.running,
    status: processManager.running,
    sessionId: processManager.sessionId,
    healthy: health.healthy,
    version: health.version,
  };
});

ipcMain.handle('chat:newConversation', async (_event, title?: string) => {
  if (!processManager.running) {
    throw new Error('OpenCode not running');
  }

  const requestedTitle = (title ?? '').trim().replace(/\s+/g, ' ');
  let uniqueTitle: string | undefined;
  if (requestedTitle.length) {
    const sessions = await processManager.listSessions();
    uniqueTitle = makeUniqueConversationTitle(requestedTitle, sessions.map((s) => s.title));
  }

  const sessionId = await processManager.createSession(uniqueTitle);

  configureTimelineStore();
  timelineStore.upsertSessionMeta(sessionId, {
    ...(uniqueTitle ? { title: uniqueTitle } : {}),
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  });

  return { sessionId };
});

ipcMain.handle('chat:listConversations', async () => {
  const sessions = await processManager.listSessions();
  if (!sessions.length) {
    return sessions;
  }

  try {
    configureTimelineStore();
    const cutoff = timelineStore.getRetentionCutoffMs();
    const [knownIds, activeIds] = await Promise.all([
      timelineStore.listKnownSessionIds(),
      timelineStore.listActiveSessionIdsSince(cutoff),
    ]);

    return sessions.filter((s) => !knownIds.has(s.id) || activeIds.has(s.id));
  } catch (error) {
    console.warn('[IPC] Failed to apply conversation retention filter:', error);
    return sessions;
  }
});

ipcMain.handle('chat:switchConversation', async (_event, sessionId: string) => {
  await processManager.switchSession(sessionId);

  try {
    configureTimelineStore();
    timelineStore.touchSession(sessionId);
  } catch (error) {
    console.warn('[IPC] Failed to update conversation last_seen:', error);
  }

  return { sessionId };
});

ipcMain.handle('chat:getMessages', async () => {
  return await processManager.getSessionMessages();
});

ipcMain.handle('tasks:listRuns', async () => {
  try {
    configureTaskStore();
    const runs = taskStore.listRuns({ limit: 100, offset: 0 });
    return ipcOk<TaskRun[]>(runs.map(toRendererTaskRun));
  } catch (error) {
    console.warn('[IPC] Failed to list task runs:', error);
    return ipcError<TaskRun[]>('UNKNOWN', 'Failed to list task runs.');
  }
});

ipcMain.handle('tasks:getActiveRun', async () => {
  try {
    configureTaskStore();
    const record = taskStore.getActiveRun({ sessionId: processManager.sessionId ?? undefined });
    return ipcOk<TaskRun | null>(record ? toRendererTaskRun(record) : null);
  } catch (error) {
    console.warn('[IPC] Failed to get active task run:', error);
    return ipcError<TaskRun | null>('UNKNOWN', 'Failed to get active task run.');
  }
});

ipcMain.handle('tasks:cancel', async (_event, taskRunId: string) => {
  const id = typeof taskRunId === 'string' ? taskRunId.trim() : '';
  if (!id) {
    return ipcError<TaskRun>('INVALID_REQUEST', 'taskRunId must be a non-empty string.');
  }

  try {
    configureTaskStore();
    const record = taskStore.getRun(id);
    if (!record) {
      return ipcError<TaskRun>('INVALID_REQUEST', 'Task run not found.');
    }

    const updated = taskStore.updateRun(id, {
      status: 'cancelled',
      blockingReason: undefined,
      updatedAt: Date.now(),
      description: 'Cancelled by user.',
    });

    if (!updated) {
      return ipcError<TaskRun>('UNKNOWN', 'Failed to cancel task run.');
    }

    if (record.metadata && typeof record.metadata === 'object') {
      const workflowRunId = (record.metadata as { workflowRunId?: unknown }).workflowRunId;
      if (typeof workflowRunId === 'string' && workflowRunId.trim().length > 0) {
        workflowRunStore.configure({ dataDir: configStore.getDataDir() });
        workflowRunStore.updateRun(workflowRunId, {
          status: 'cancelled',
          finishedAt: Date.now(),
        });
      }
    }

    return ipcOk<TaskRun>(toRendererTaskRun(updated));
  } catch (error) {
    console.warn('[IPC] Failed to cancel task run:', error);
    return ipcError<TaskRun>('UNKNOWN', 'Failed to cancel task run.');
  }
});

ipcMain.handle('tasks:markRunning', async (_event, taskRunId: string) => {
  const id = typeof taskRunId === 'string' ? taskRunId.trim() : '';
  if (!id) {
    return ipcError<TaskRun>('INVALID_REQUEST', 'taskRunId must be a non-empty string.');
  }

  try {
    configureTaskStore();
    const record = taskStore.getRun(id);
    if (!record) {
      return ipcError<TaskRun>('INVALID_REQUEST', 'Task run not found.');
    }

    const updated = taskStore.updateRun(id, {
      status: 'running',
      blockingReason: undefined,
      updatedAt: Date.now(),
      ...(record.description === 'Waiting for input...' ? { description: 'Running...' } : {}),
    });

    if (!updated) {
      return ipcError<TaskRun>('UNKNOWN', 'Failed to update task run.');
    }

    if (record.metadata && typeof record.metadata === 'object') {
      const workflowRunId = (record.metadata as { workflowRunId?: unknown }).workflowRunId;
      if (typeof workflowRunId === 'string' && workflowRunId.trim().length > 0) {
        workflowRunStore.configure({ dataDir: configStore.getDataDir() });
        workflowRunStore.updateRun(workflowRunId, {
          status: 'running',
        });
      }
    }

    return ipcOk<TaskRun>(toRendererTaskRun(updated));
  } catch (error) {
    console.warn('[IPC] Failed to mark task run running:', error);
    return ipcError<TaskRun>('UNKNOWN', 'Failed to update task run.');
  }
});

ipcMain.handle('tasks:markComplete', async (_event, taskRunId: string) => {
  const id = typeof taskRunId === 'string' ? taskRunId.trim() : '';
  if (!id) {
    return ipcError<TaskRun>('INVALID_REQUEST', 'taskRunId must be a non-empty string.');
  }

  try {
    configureTaskStore();
    const record = taskStore.getRun(id);
    if (!record) {
      return ipcError<TaskRun>('INVALID_REQUEST', 'Task run not found.');
    }

    const updated = taskStore.updateRun(id, {
      status: 'completed',
      blockingReason: undefined,
      progress: 100,
      updatedAt: Date.now(),
    });

    if (!updated) {
      return ipcError<TaskRun>('UNKNOWN', 'Failed to complete task run.');
    }

    if (record.metadata && typeof record.metadata === 'object') {
      const workflowRunId = (record.metadata as { workflowRunId?: unknown }).workflowRunId;
      if (typeof workflowRunId === 'string' && workflowRunId.trim().length > 0) {
        workflowRunStore.configure({ dataDir: configStore.getDataDir() });
        workflowRunStore.updateRun(workflowRunId, {
          status: 'completed',
          finishedAt: Date.now(),
        });
      }
    }

    return ipcOk<TaskRun>(toRendererTaskRun(updated));
  } catch (error) {
    console.warn('[IPC] Failed to mark task run complete:', error);
    return ipcError<TaskRun>('UNKNOWN', 'Failed to complete task run.');
  }
});

ipcMain.handle('tasks:remove', async (_event, taskRunId: string) => {
  const id = typeof taskRunId === 'string' ? taskRunId.trim() : '';
  if (!id) {
    return ipcError<{ removed: boolean }>('INVALID_REQUEST', 'taskRunId must be a non-empty string.');
  }

  try {
    configureTaskStore();
    const record = taskStore.getRun(id);
    if (!record) {
      return ipcError<{ removed: boolean }>('INVALID_REQUEST', 'Task run not found.');
    }

    const removed = taskStore.deleteRun(id);

    if (record.metadata && typeof record.metadata === 'object') {
      const workflowRunId = (record.metadata as { workflowRunId?: unknown }).workflowRunId;
      if (typeof workflowRunId === 'string' && workflowRunId.trim().length > 0) {
        workflowRunStore.configure({ dataDir: configStore.getDataDir() });
        workflowRunStore.deleteRun(workflowRunId);
      }
    }

    return ipcOk<{ removed: boolean }>({ removed });
  } catch (error) {
    console.warn('[IPC] Failed to remove task run:', error);
    return ipcError<{ removed: boolean }>('UNKNOWN', 'Failed to remove task run.');
  }
});

ipcMain.handle('studyMaterials:runs:create', async (_event, input: StudyMaterialRunCreateInput) => {
  const id = typeof input?.id === 'string' ? input.id.trim() : '';
  const courseId = typeof input?.courseId === 'string' ? input.courseId.trim() : '';
  const mode = typeof input?.mode === 'string' ? input.mode.trim() : '';
  const destinationType = typeof input?.destinationType === 'string' ? input.destinationType.trim() : '';

  if (!id || !courseId || !mode || !destinationType) {
    return ipcError<StudyMaterialRun>('INVALID_REQUEST', 'id, courseId, mode, and destinationType are required.');
  }

  if (!STUDY_MATERIAL_RUN_MODES.has(mode)) {
    return ipcError<StudyMaterialRun>(
      'INVALID_REQUEST',
      `mode must be one of: ${Array.from(STUDY_MATERIAL_RUN_MODES).join(', ')}.`,
    );
  }

  const status = input?.status ?? 'queued';
  if (!STUDY_MATERIAL_RUN_STATUSES.has(status)) {
    return ipcError<StudyMaterialRun>(
      'INVALID_REQUEST',
      `status must be one of: ${Array.from(STUDY_MATERIAL_RUN_STATUSES).join(', ')}.`,
    );
  }

  if (input?.qualityScore !== undefined) {
    if (typeof input.qualityScore !== 'number' || !Number.isFinite(input.qualityScore)) {
      return ipcError<StudyMaterialRun>('INVALID_REQUEST', 'qualityScore must be a finite number between 0 and 1.');
    }

    if (input.qualityScore < 0 || input.qualityScore > 1) {
      return ipcError<StudyMaterialRun>('INVALID_REQUEST', 'qualityScore must be between 0 and 1.');
    }
  }

  try {
    configureStudyMaterialStore();
    const now = Date.now();
    const run = studyMaterialStore.createRun({
      id,
      courseId,
      ...(typeof input.taskRunId === 'string' && input.taskRunId.trim().length > 0
        ? { taskRunId: input.taskRunId.trim() }
        : {}),
      mode: mode as StudyMaterialRun['mode'],
      destinationType,
      status: status as StudyMaterialRun['status'],
      ...(typeof input.qualityScore === 'number' && Number.isFinite(input.qualityScore)
        ? { qualityScore: input.qualityScore }
        : {}),
      createdAt: now,
      updatedAt: now,
    });

    return ipcOk<StudyMaterialRun>(run);
  } catch (error) {
    console.warn('[IPC] Failed to create study material run:', error);
    return ipcError<StudyMaterialRun>('UNKNOWN', 'Failed to create study material run.');
  }
});

ipcMain.handle('studyMaterials:runs:list', async (_event, query?: { courseId?: string; limit?: number; offset?: number }) => {
  if (query?.limit !== undefined) {
    if (!isFiniteInteger(query.limit)) {
      return ipcError<StudyMaterialRun[]>('INVALID_REQUEST', 'limit must be a finite integer between 1 and 200.');
    }

    if (query.limit < 1 || query.limit > STUDY_MATERIAL_MAX_LIMIT) {
      return ipcError<StudyMaterialRun[]>('INVALID_REQUEST', 'limit must be between 1 and 200.');
    }
  }

  if (query?.offset !== undefined) {
    if (!isFiniteInteger(query.offset)) {
      return ipcError<StudyMaterialRun[]>('INVALID_REQUEST', 'offset must be a finite integer greater than or equal to 0.');
    }

    if (query.offset < 0) {
      return ipcError<StudyMaterialRun[]>('INVALID_REQUEST', 'offset must be greater than or equal to 0.');
    }
  }

  try {
    configureStudyMaterialStore();
    const runs = studyMaterialStore.listRuns({
      ...(typeof query?.courseId === 'string' && query.courseId.trim().length > 0
        ? { courseId: query.courseId.trim() }
        : {}),
      ...(typeof query?.limit === 'number' ? { limit: query.limit } : {}),
      ...(typeof query?.offset === 'number' ? { offset: query.offset } : {}),
    }) as unknown as StudyMaterialRun[];
    return ipcOk<StudyMaterialRun[]>(runs);
  } catch (error) {
    console.warn('[IPC] Failed to list study material runs:', error);
    return ipcError<StudyMaterialRun[]>('UNKNOWN', 'Failed to list study material runs.');
  }
});

ipcMain.handle('studyMaterials:runs:get', async (_event, studyRunId: string) => {
  const id = typeof studyRunId === 'string' ? studyRunId.trim() : '';
  if (!id) {
    return ipcError<StudyMaterialRun | null>('INVALID_REQUEST', 'studyRunId must be a non-empty string.');
  }

  try {
    configureStudyMaterialStore();
    const run = studyMaterialStore.getRun(id) as StudyMaterialRun | null;
    return ipcOk<StudyMaterialRun | null>(run);
  } catch (error) {
    console.warn('[IPC] Failed to get study material run:', error);
    return ipcError<StudyMaterialRun | null>('UNKNOWN', 'Failed to get study material run.');
  }
});

ipcMain.handle('studyMaterials:artifacts:create', async (_event, input: StudyMaterialArtifactCreateInput) => {
  const id = typeof input?.id === 'string' ? input.id.trim() : '';
  const studyRunId = typeof input?.studyRunId === 'string' ? input.studyRunId.trim() : '';
  const kind = typeof input?.kind === 'string' ? input.kind.trim() : '';
  const pathOrBlobRef = typeof input?.pathOrBlobRef === 'string' ? input.pathOrBlobRef.trim() : '';

  if (!id || !studyRunId || !kind || !pathOrBlobRef) {
    return ipcError<StudyMaterialArtifact>('INVALID_REQUEST', 'id, studyRunId, kind, and pathOrBlobRef are required.');
  }

  if (!STUDY_MATERIAL_ARTIFACT_KINDS.has(kind)) {
    return ipcError<StudyMaterialArtifact>(
      'INVALID_REQUEST',
      `kind must be one of: ${Array.from(STUDY_MATERIAL_ARTIFACT_KINDS).join(', ')}.`,
    );
  }

  try {
    configureStudyMaterialStore();
    const artifact = studyMaterialStore.createArtifact({
      id,
      studyRunId,
      kind: kind as StudyMaterialArtifact['kind'],
      pathOrBlobRef,
      ...(typeof input.mime === 'string' && input.mime.trim().length > 0 ? { mime: input.mime.trim() } : {}),
      createdAt: Date.now(),
    });
    return ipcOk<StudyMaterialArtifact>(artifact);
  } catch (error) {
    console.warn('[IPC] Failed to create study material artifact:', error);
    return ipcError<StudyMaterialArtifact>('UNKNOWN', 'Failed to create study material artifact.');
  }
});

ipcMain.handle('studyMaterials:artifacts:list', async (_event, studyRunId: string) => {
  const id = typeof studyRunId === 'string' ? studyRunId.trim() : '';
  if (!id) {
    return ipcError<StudyMaterialArtifact[]>('INVALID_REQUEST', 'studyRunId must be a non-empty string.');
  }

  try {
    configureStudyMaterialStore();
    const artifacts = studyMaterialStore.listArtifactsByRun(id) as unknown as StudyMaterialArtifact[];
    return ipcOk<StudyMaterialArtifact[]>(artifacts);
  } catch (error) {
    console.warn('[IPC] Failed to list study material artifacts:', error);
    return ipcError<StudyMaterialArtifact[]>('UNKNOWN', 'Failed to list study material artifacts.');
  }
});

ipcMain.handle('workflows:list', async () => {
  const result = await workflowsRunner.listDefinitions();
  if (result.ok) {
    return ipcOk<WorkflowDefinition[]>(result.data);
  }
  return ipcError<WorkflowDefinition[]>(result.code, result.message);
});

ipcMain.handle('workflows:run', async (event, workflowId: string, input?: unknown) => {
  const result = await workflowsRunner.run(workflowId, input, event.sender);
  if (result.ok) {
    return ipcOk<WorkflowRun>(result.data);
  }
  return ipcError<WorkflowRun>(result.code, result.message, result.details);
});

ipcMain.handle('workflows:runs:list', async (_event, workflowId: string, limit?: number, offset?: number) => {
  const id = typeof workflowId === 'string' ? workflowId.trim() : '';
  if (!id) {
    return ipcError<WorkflowRun[]>('INVALID_REQUEST', 'workflowId must be a non-empty string.');
  }

  try {
    configureWorkflowRunStore();
    const runs = workflowRunStore.listRunsByWorkflow(id, { limit, offset }) as unknown as WorkflowRun[];
    return ipcOk<WorkflowRun[]>(runs);
  } catch (error) {
    console.warn('[IPC] Failed to list workflow runs:', error);
    return ipcError<WorkflowRun[]>('UNKNOWN', 'Failed to list workflow runs.');
  }
});

ipcMain.handle('workflows:artifacts:list', async (_event, workflowRunId: string) => {
  const id = typeof workflowRunId === 'string' ? workflowRunId.trim() : '';
  if (!id) {
    return ipcError<WorkflowArtifact[]>('INVALID_REQUEST', 'workflowRunId must be a non-empty string.');
  }

  try {
    configureWorkflowRunStore();
    const artifacts = workflowRunStore.listArtifactsByRun(id) as unknown as WorkflowArtifact[];
    return ipcOk<WorkflowArtifact[]>(artifacts);
  } catch (error) {
    console.warn('[IPC] Failed to list workflow artifacts:', error);
    return ipcError<WorkflowArtifact[]>('UNKNOWN', 'Failed to list workflow artifacts.');
  }
});

ipcMain.handle('workflows:pins:get', async () => {
  try {
    configureWorkflowsPinsStore();
    const pinnedIds = workflowsPinsStore.listPins();
    return ipcOk<string[]>(pinnedIds);
  } catch (error) {
    console.warn('[IPC] Failed to list pinned workflows:', error);
    return ipcError<string[]>('UNKNOWN', 'Failed to list pinned workflows.');
  }
});

ipcMain.handle('workflows:pins:set', async (_event, workflowId: string, pinned: boolean) => {
  const id = typeof workflowId === 'string' ? workflowId.trim() : '';
  if (!id) {
    return ipcError<{ pinnedIds: string[] }>('INVALID_REQUEST', 'workflowId must be a non-empty string.');
  }

  try {
    configureWorkflowsPinsStore();
    workflowsPinsStore.setPinned(id, Boolean(pinned));
    return ipcOk<{ pinnedIds: string[] }>({ pinnedIds: workflowsPinsStore.listPins() });
  } catch (error) {
    if (error instanceof PinnedWorkflowsLimitError) {
      return ipcError<{ pinnedIds: string[] }>('INVALID_REQUEST', error.message, { limit: error.limit });
    }

    console.warn('[IPC] Failed to set workflow pin state:', error);
    return ipcError<{ pinnedIds: string[] }>('UNKNOWN', 'Failed to update pinned workflows.');
  }
});

ipcMain.handle('workflows:approvalOptIn:get', async (_event, workflowId: string) => {
  const id = typeof workflowId === 'string' ? workflowId.trim() : '';
  if (!id) {
    return ipcError<boolean>('INVALID_REQUEST', 'workflowId must be a non-empty string.');
  }

  try {
    const optedIn = await approvalPolicyStore.getWorkflowOptIn(id);
    return ipcOk<boolean>(optedIn);
  } catch (error) {
    console.warn('[IPC] Failed to get workflow approval opt-in:', error);
    return ipcError<boolean>('UNKNOWN', 'Failed to load workflow approval policy.');
  }
});

ipcMain.handle('workflows:approvalOptIn:set', async (_event, workflowId: string, optedIn: boolean) => {
  const id = typeof workflowId === 'string' ? workflowId.trim() : '';
  if (!id) {
    return ipcError<{ workflowId: string; optedIn: boolean }>(
      'INVALID_REQUEST',
      'workflowId must be a non-empty string.',
    );
  }

  try {
    const next = Boolean(optedIn);
    await approvalPolicyStore.setWorkflowOptIn(id, next);
    return ipcOk<{ workflowId: string; optedIn: boolean }>({ workflowId: id, optedIn: next });
  } catch (error) {
    console.warn('[IPC] Failed to set workflow approval opt-in:', error);
    return ipcError<{ workflowId: string; optedIn: boolean }>(
      'UNKNOWN',
      'Failed to update workflow approval policy.',
    );
  }
});

ipcMain.handle('workflows:approvalOptIns:list', async () => {
  try {
    const optIns = await approvalPolicyStore.listWorkflowOptIns();
    return ipcOk<Record<string, boolean>>(optIns);
  } catch (error) {
    console.warn('[IPC] Failed to list workflow approval opt-ins:', error);
    return ipcError<Record<string, boolean>>('UNKNOWN', 'Failed to load approval grants.');
  }
});

ipcMain.handle('workflows:generateFromIntent', async (_event, intent: string) => {
  const result = await workflowsGenerator.generateFromIntent(intent);
  if (result.ok) {
    return ipcOk(result.data);
  }
  return ipcError(result.code, result.message, result.details);
});

ipcMain.handle('workflows:skill:get', async (_event, workflowId: string) => {
  const result = await workflowsRunner.getSkillMarkdown(workflowId);
  if (result.ok) {
    return ipcOk(result.data);
  }
  return ipcError(result.code, result.message);
});

ipcMain.handle('workflows:skill:save', async (_event, workflowId: string, skillMarkdown: string) => {
  const result = await workflowsRunner.saveSkillMarkdown(workflowId, skillMarkdown);
  if (result.ok) {
    return ipcOk(result.data);
  }
  return ipcError(result.code, result.message);
});

ipcMain.handle('workflows:duplicate', async (_event, workflowId: string) => {
  const result = await workflowsRunner.duplicateWorkflow(workflowId);
  if (result.ok) {
    return ipcOk(result.data);
  }
  return ipcError(result.code, result.message);
});

ipcMain.handle('workflows:delete', async (_event, workflowId: string) => {
  const id = typeof workflowId === 'string' ? workflowId.trim() : '';
  const result = await workflowsRunner.deleteWorkflow(id);
  if (result.ok) {
    try {
      configureWorkflowsPinsStore();
      workflowsPinsStore.setPinned(id, false);
      try {
        await approvalPolicyStore.setWorkflowOptIn(id, false);
      } catch (error) {
        console.warn('[IPC] Failed to revoke workflow approval opt-in after delete:', error);
      }
      return ipcOk(result.data);
    } catch (error) {
      console.warn('[IPC] Failed to update pins after workflow delete:', error);
      return ipcOk(result.data);
    }
  }
  return ipcError(result.code, result.message);
});

ipcMain.handle('opencode:listModels', async (_event, provider?: string) => {
  try {
    const args = ['models'];
    if (typeof provider === 'string') {
      const normalizedProvider = provider.trim();
      if (normalizedProvider) {
        if (!SAFE_PROVIDER_PATTERN.test(normalizedProvider)) {
          return [];
        }
        args.push(normalizedProvider);
      }
    }
    const { stdout } = await execFileAsync('opencode', args);
    const models = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line.includes('/') && !line.includes(' '));
    return Array.from(new Set(models));
  } catch (error) {
    console.error('Failed to list OpenCode models:', error);
    return [];
  }
});


/**
 * Create a new session
 */
ipcMain.handle('opencode:newSession', async (_event, title?: string) => {
  if (!processManager.running) {
    throw new Error('OpenCode not running');
  }

  const requestedTitle = (title ?? '').trim().replace(/\s+/g, ' ');
  let uniqueTitle: string | undefined;
  if (requestedTitle.length) {
    const sessions = await processManager.listSessions();
    uniqueTitle = makeUniqueConversationTitle(requestedTitle, sessions.map((s) => s.title));
  }

  const sessionId = await processManager.createSession(uniqueTitle);

  configureTimelineStore();
  timelineStore.upsertSessionMeta(sessionId, {
    ...(uniqueTitle ? { title: uniqueTitle } : {}),
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  });

  return { sessionId };
});

/**
 * List all sessions
 */
ipcMain.handle('opencode:listSessions', async () => {
  const sessions = await processManager.listSessions();
  if (!sessions.length) {
    return sessions;
  }

  try {
    configureTimelineStore();
    const cutoff = timelineStore.getRetentionCutoffMs();
    const [knownIds, activeIds] = await Promise.all([
      timelineStore.listKnownSessionIds(),
      timelineStore.listActiveSessionIdsSince(cutoff),
    ]);
    return sessions.filter((s) => !knownIds.has(s.id) || activeIds.has(s.id));
  } catch (error) {
    console.warn('[IPC] Failed to apply session retention filter:', error);
    return sessions;
  }
});

/**
 * Switch to a different session
 */
ipcMain.handle('opencode:switchSession', async (_event, sessionId: string) => {
  await processManager.switchSession(sessionId);

  try {
    configureTimelineStore();
    timelineStore.touchSession(sessionId);
  } catch (error) {
    console.warn('[IPC] Failed to update session last_seen:', error);
  }

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

  ipcMain.handle('approvals:reply', async (_event, requestId: string, reply: ApprovalReply) => {
    if (!requestId || typeof requestId !== 'string') {
      return { success: false, error: 'Invalid requestId' };
    }

    if (reply !== 'once' && reply !== 'always' && reply !== 'deny') {
      return { success: false, error: 'Invalid reply' };
    }

    const normalizedRequestId = requestId.trim();
    if (!normalizedRequestId) {
      return { success: false, error: 'Empty requestId' };
    }

    // Security: Verify the requestId was actually tracked before accepting the reply.
    // This prevents malicious or stale requests from being processed.
    const sessionId = await processManager.getSessionIdForApprovalRequest(normalizedRequestId);
    if (!sessionId) {
      console.warn('[IPC] Rejected approval reply for unknown/untracked requestId:', normalizedRequestId);
      return { success: false, error: 'Unknown or expired approval request' };
    }

    // Audit the user's reply
    try {
      configureApprovalsAuditStore();
      approvalsAuditStore.log({
        kind: 'user_reply',
        requestId: normalizedRequestId,
        sessionId,
        reply,
        timestamp: Date.now(),
        summary: { source: 'ipc' },
      });
    } catch (error) {
      console.warn('[IPC] Failed to audit approval reply:', error);
    }

    try {
      await processManager.replyApproval(normalizedRequestId, reply);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });
  
  console.log('IPC handlers registered');

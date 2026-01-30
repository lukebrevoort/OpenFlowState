/**
 * FlowState Desktop App - Electron Main Process
 *
 * This is the entry point for the Electron main process.
 * It manages the application lifecycle, creates windows, and handles IPC.
 */

import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { configStore } from './config-store.js';
import { processManager } from './process-manager.js';
import { timelineStore } from './timeline-store.js';
import { authManager, ClientCredentials } from './auth-manager.js';
import { oauthServer } from './oauth-server.js';
import type { ApprovalReply } from './approval-policy-store.js';
import type { IpcError, IpcResult, TaskRun, WorkflowDefinition, WorkflowRun } from '../renderer/types/electron';
import { workflowsRunner } from './workflows-runner.js';
import { workflowsGenerator } from './workflows-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

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

const notImplemented = <T>(feature: string): IpcResult<T> => ({
  ok: false,
  error: {
    code: 'NOT_IMPLEMENTED',
    message: `${feature} is not available yet.`,
  },
});

const ipcError = <T>(code: IpcError['code'], message: string, details?: unknown): IpcResult<T> => ({
  ok: false,
  error: {
    code,
    message,
    ...(details === undefined ? {} : { details }),
  } as IpcError,
});

const ipcOk = <T>(data: T): IpcResult<T> => ({ ok: true, data });

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
    await processManager.reloadMcpConfig();
    return { success: true };
  } catch (error) {
    console.error('[Integrations] Error reloading MCP config:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
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

  const sessions = await processManager.listSessions();
  const uniqueTitle = makeUniqueConversationTitle(title, sessions.map((s) => s.title));
  const sessionId = await processManager.createSession(uniqueTitle);

  configureTimelineStore();
  timelineStore.upsertSessionMeta(sessionId, {
    title: uniqueTitle,
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
  return notImplemented<TaskRun[]>('tasks:listRuns');
});

ipcMain.handle('tasks:getActiveRun', async () => {
  return notImplemented<TaskRun | null>('tasks:getActiveRun');
});

ipcMain.handle('workflows:list', async () => {
  const result = await workflowsRunner.listDefinitions();
  if (result.ok) {
    return ipcOk<WorkflowDefinition[]>(result.data);
  }
  return ipcError<WorkflowDefinition[]>(result.code, result.message);
});

ipcMain.handle('workflows:run', async (_event, workflowId: string, input?: unknown) => {
  const result = await workflowsRunner.run(workflowId, input);
  if (result.ok) {
    return ipcOk<WorkflowRun>(result.data);
  }
  return ipcError<WorkflowRun>(result.code, result.message, result.details);
});

ipcMain.handle('workflows:generateFromIntent', async (_event, intent: string) => {
  const result = await workflowsGenerator.generateFromIntent(intent);
  if (result.ok) {
    return ipcOk(result.data);
  }
  return ipcError(result.code, result.message, result.details);
});

ipcMain.handle('opencode:listModels', async (_event, provider?: string) => {
  try {
    const args = ['models'];
    if (provider) {
      args.push(provider);
    }
    const { stdout } = await execAsync(`opencode ${args.join(' ')}`);
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

  const sessions = await processManager.listSessions();
  const uniqueTitle = makeUniqueConversationTitle(title, sessions.map((s) => s.title));
  const sessionId = await processManager.createSession(uniqueTitle);

  configureTimelineStore();
  timelineStore.upsertSessionMeta(sessionId, {
    title: uniqueTitle,
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

    try {
      await processManager.replyApproval(requestId, reply);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  });
  
  console.log('IPC handlers registered');

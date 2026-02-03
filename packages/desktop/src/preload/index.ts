/**
 * FlowState Desktop App - Electron Preload Script
 *
 * This script runs in a sandboxed environment and exposes
 * a safe API to the renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  FlowstateAPI as FlowstateAPIDefinition,
  OpenCodeMessage,
  OpenCodeProgress,
  OpenCodeError,
  OpenCodeEvent,
  TimelineEvent,
  OAuthSuccessEvent,
  OAuthErrorEvent,
  ApiTokenSuccessEvent,
  FlowstateConfig,
  ClientCredentials,
} from '../renderer/types/electron';

type Unsubscribe = () => void;

/**
 * Exposed API for the renderer process
 */
const flowstateAPI: FlowstateAPIDefinition = {
  // App information
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
    getTheme: () => ipcRenderer.invoke('app:getTheme'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
    openTerminal: (command: string) => ipcRenderer.invoke('app:openTerminal', command),
    showSaveDialog: (options?: { title?: string; defaultPath?: string }) =>
      ipcRenderer.invoke('app:showSaveDialog', options),
    showOpenDialog: (options?: { title?: string }) =>
      ipcRenderer.invoke('app:showOpenDialog', options),
    ensureFile: (filePath: string) => ipcRenderer.invoke('app:ensureFile', filePath),
  },

  // Window controls (for custom title bar)
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // Configuration
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (config: Partial<FlowstateConfig>) => ipcRenderer.invoke('config:set', config),
    getPath: () => ipcRenderer.invoke('config:path'),
  },

  // Authentication
  auth: {
    // Token management
    getToken: (service: string) => ipcRenderer.invoke('auth:getToken', service),
    getStatus: (service: string) => ipcRenderer.invoke('auth:getStatus', service),
    getAllStatuses: () => ipcRenderer.invoke('auth:getAllStatuses'),
    removeToken: (service: string) => ipcRenderer.invoke('auth:removeToken', service),

    reauthenticate: (service: string) => ipcRenderer.invoke('auth:reauthenticate', service),

    // Client credentials management
    setCredentials: (service: string, credentials: ClientCredentials) =>
      ipcRenderer.invoke('auth:setCredentials', service, credentials),
    getCredentials: (service: string) => ipcRenderer.invoke('auth:getCredentials', service),
    removeCredentials: (service: string) => ipcRenderer.invoke('auth:removeCredentials', service),

    // API token (for Notion Internal Integration, Canvas LMS, etc.)
    storeApiToken: (service: string, apiToken: string, additionalData?: Record<string, string>) =>
      ipcRenderer.invoke('auth:storeApiToken', service, apiToken, additionalData),

    // Event listener for API token success
    onApiTokenSuccess: (callback: (event: ApiTokenSuccessEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, data: ApiTokenSuccessEvent) => callback(data);
      ipcRenderer.on('auth:apiTokenSuccess', handler);
      return () => ipcRenderer.removeListener('auth:apiTokenSuccess', handler);
    },
  },

  // OAuth
  oauth: {
    // Start OAuth flow (opens browser)
    start: (service: string, clientId: string, clientSecret: string) =>
      ipcRenderer.invoke('oauth:start', service, clientId, clientSecret),

    // Refresh an existing token
    refresh: (service: string) => ipcRenderer.invoke('oauth:refresh', service),

    // Disconnect a service
    disconnect: (service: string) => ipcRenderer.invoke('oauth:disconnect', service),

    // Event listeners
    onSuccess: (callback: (event: OAuthSuccessEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, data: OAuthSuccessEvent) => callback(data);
      ipcRenderer.on('oauth:success', handler);
      return () => ipcRenderer.removeListener('oauth:success', handler);
    },

    onError: (callback: (event: OAuthErrorEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, data: OAuthErrorEvent) => callback(data);
      ipcRenderer.on('oauth:error', handler);
      return () => ipcRenderer.removeListener('oauth:error', handler);
    },

    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('oauth:success');
      ipcRenderer.removeAllListeners('oauth:error');
    },
  },

  // OpenCode integration
  opencode: {
    // Send a message and trigger streaming response
    send: (message: string) => ipcRenderer.invoke('opencode:send', message),

    // Fire-and-forget send (response streams via events)
    sendAsync: (message: string) => ipcRenderer.invoke('opencode:sendAsync', message),

    // Get OpenCode status
    status: () => ipcRenderer.invoke('opencode:status'),

    restart: () => ipcRenderer.invoke('opencode:restart'),

    listModels: (provider?: string) => ipcRenderer.invoke('opencode:listModels', provider),

    // Session management
    newSession: (title?: string) => ipcRenderer.invoke('opencode:newSession', title),
    listSessions: () => ipcRenderer.invoke('opencode:listSessions'),
    switchSession: (sessionId: string) => ipcRenderer.invoke('opencode:switchSession', sessionId),
    getMessages: () => ipcRenderer.invoke('opencode:getMessages'),

    // Event listeners for streaming responses
    onMessage: (callback: (message: OpenCodeMessage) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, message: OpenCodeMessage) => callback(message);
      ipcRenderer.on('opencode:message', handler);
      return () => ipcRenderer.removeListener('opencode:message', handler);
    },

    onProgress: (callback: (progress: OpenCodeProgress) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, progress: OpenCodeProgress) => callback(progress);
      ipcRenderer.on('opencode:progress', handler);
      return () => ipcRenderer.removeListener('opencode:progress', handler);
    },

    onError: (callback: (error: OpenCodeError) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, error: OpenCodeError) => callback(error);
      ipcRenderer.on('opencode:error', handler);
      return () => ipcRenderer.removeListener('opencode:error', handler);
    },

    onEvent: (callback: (event: OpenCodeEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, event: OpenCodeEvent) => callback(event);
      ipcRenderer.on('opencode:event', handler);
      return () => ipcRenderer.removeListener('opencode:event', handler);
    },

    onTimelineEvent: (callback: (event: TimelineEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, event: TimelineEvent) => callback(event);
      ipcRenderer.on('timeline:event', handler);
      return () => ipcRenderer.removeListener('timeline:event', handler);
    },

    // Remove all listeners (for cleanup)
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('opencode:message');
      ipcRenderer.removeAllListeners('opencode:progress');
      ipcRenderer.removeAllListeners('opencode:error');
      ipcRenderer.removeAllListeners('opencode:event');
      ipcRenderer.removeAllListeners('timeline:event');
    },
  },

  timeline: {
    list: (sessionId: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('timeline:list', sessionId, limit, offset),
    resolvePayload: (payloadRef: string) =>
      ipcRenderer.invoke('timeline:payload', payloadRef),
  },

  approvals: {
    reply: (requestId: string, reply: 'once' | 'always' | 'deny') =>
      ipcRenderer.invoke('approvals:reply', requestId, reply),
  },

  // MCP server management
  mcp: {
    // Reload MCP configuration (after connecting new integrations)
    reload: () => ipcRenderer.invoke('mcp:reload'),

    // Get MCP server status
    status: () => ipcRenderer.invoke('mcp:status'),
  },

  canvas: {
    browserLogin: (payload: {
      canvasApiUrl: string;
      storageStatePath: string;
      confirmationFilePath?: string;
      timeoutSeconds?: number;
    }) => ipcRenderer.invoke('canvas:browserLogin', payload),
  },

  // ============================================================================
  // Phase 3.5 - Typed feature surfaces
  // ============================================================================

  chat: {
    sendMessage: (message: string) => ipcRenderer.invoke('chat:sendMessage', message),
    getStatus: () => ipcRenderer.invoke('chat:getStatus'),
    newConversation: (title?: string) => ipcRenderer.invoke('chat:newConversation', title),
    listConversations: () => ipcRenderer.invoke('chat:listConversations'),
    switchConversation: (sessionId: string) => ipcRenderer.invoke('chat:switchConversation', sessionId),
    getMessages: () => ipcRenderer.invoke('chat:getMessages'),

    onMessage: (callback: (message: OpenCodeMessage) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, message: OpenCodeMessage) => callback(message);
      ipcRenderer.on('opencode:message', handler);
      return () => ipcRenderer.removeListener('opencode:message', handler);
    },

    onProgress: (callback: (progress: OpenCodeProgress) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, progress: OpenCodeProgress) => callback(progress);
      ipcRenderer.on('opencode:progress', handler);
      return () => ipcRenderer.removeListener('opencode:progress', handler);
    },

    onError: (callback: (error: OpenCodeError) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, error: OpenCodeError) => callback(error);
      ipcRenderer.on('opencode:error', handler);
      return () => ipcRenderer.removeListener('opencode:error', handler);
    },

    onEvent: (callback: (event: OpenCodeEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, event: OpenCodeEvent) => callback(event);
      ipcRenderer.on('opencode:event', handler);
      return () => ipcRenderer.removeListener('opencode:event', handler);
    },

    onTimelineEvent: (callback: (event: TimelineEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, event: TimelineEvent) => callback(event);
      ipcRenderer.on('timeline:event', handler);
      return () => ipcRenderer.removeListener('timeline:event', handler);
    },

    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('opencode:message');
      ipcRenderer.removeAllListeners('opencode:progress');
      ipcRenderer.removeAllListeners('opencode:error');
      ipcRenderer.removeAllListeners('opencode:event');
      ipcRenderer.removeAllListeners('timeline:event');
    },
  },

  tasks: {
    listRuns: () => ipcRenderer.invoke('tasks:listRuns'),
    getActiveRun: () => ipcRenderer.invoke('tasks:getActiveRun'),
    cancelRun: (taskRunId: string) => ipcRenderer.invoke('tasks:cancel', taskRunId),
    removeRun: (taskRunId: string) => ipcRenderer.invoke('tasks:remove', taskRunId),
    markRunning: (taskRunId: string) => ipcRenderer.invoke('tasks:markRunning', taskRunId),
    markComplete: (taskRunId: string) => ipcRenderer.invoke('tasks:markComplete', taskRunId),
  },

  workflows: {
    list: () => ipcRenderer.invoke('workflows:list'),
    run: (workflowId: string, input?: unknown) => ipcRenderer.invoke('workflows:run', workflowId, input),
    generateFromIntent: (intent: string) => ipcRenderer.invoke('workflows:generateFromIntent', intent),

    listRuns: (workflowId: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('workflows:runs:list', workflowId, limit, offset),
    listArtifacts: (workflowRunId: string) => ipcRenderer.invoke('workflows:artifacts:list', workflowRunId),

    getPins: () => ipcRenderer.invoke('workflows:pins:get'),
    setPinned: (workflowId: string, pinned: boolean) => ipcRenderer.invoke('workflows:pins:set', workflowId, pinned),
  },

  integrations: {
    listAuthStatuses: () => ipcRenderer.invoke('integrations:listAuthStatuses'),
    getMcpStatus: () => ipcRenderer.invoke('integrations:getMcpStatus'),
    reloadMcp: () => ipcRenderer.invoke('integrations:reloadMcp'),

    oauthStart: (service: string, clientId: string, clientSecret: string) =>
      ipcRenderer.invoke('integrations:oauthStart', service, clientId, clientSecret),
    oauthRefresh: (service: string) => ipcRenderer.invoke('integrations:oauthRefresh', service),
    oauthDisconnect: (service: string) => ipcRenderer.invoke('integrations:oauthDisconnect', service),

    storeApiToken: (service: string, apiToken: string, additionalData?: Record<string, string>) =>
      ipcRenderer.invoke('integrations:storeApiToken', service, apiToken, additionalData),

    onOAuthSuccess: (callback: (event: OAuthSuccessEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, data: OAuthSuccessEvent) => callback(data);
      ipcRenderer.on('oauth:success', handler);
      return () => ipcRenderer.removeListener('oauth:success', handler);
    },

    onOAuthError: (callback: (event: OAuthErrorEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, data: OAuthErrorEvent) => callback(data);
      ipcRenderer.on('oauth:error', handler);
      return () => ipcRenderer.removeListener('oauth:error', handler);
    },

    onApiTokenSuccess: (callback: (event: ApiTokenSuccessEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, data: ApiTokenSuccessEvent) => callback(data);
      ipcRenderer.on('auth:apiTokenSuccess', handler);
      return () => ipcRenderer.removeListener('auth:apiTokenSuccess', handler);
    },
  },

  gcal: {
    listCalendars: () => ipcRenderer.invoke('gcal:listCalendars'),
  },

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (config: Partial<FlowstateConfig>) => ipcRenderer.invoke('settings:update', config),
    getTheme: () => ipcRenderer.invoke('settings:getTheme'),
    getAppInfo: () => ipcRenderer.invoke('settings:getAppInfo'),
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('flowstate', flowstateAPI);

// Type declaration for TypeScript
export type FlowstateAPI = typeof flowstateAPI;

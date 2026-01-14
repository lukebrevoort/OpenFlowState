/**
 * FlowState Desktop App - Electron Preload Script
 *
 * This script runs in a sandboxed environment and exposes
 * a safe API to the renderer process via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Exposed API for the renderer process
 */
const flowstateAPI = {
  // App information
  app: {
    getInfo: () => ipcRenderer.invoke('app:getInfo'),
    getTheme: () => ipcRenderer.invoke('app:getTheme'),
    openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
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
    set: (config: unknown) => ipcRenderer.invoke('config:set', config),
  },

  // Authentication
  auth: {
    // Token management
    getToken: (service: string) => ipcRenderer.invoke('auth:getToken', service),
    getStatus: (service: string) => ipcRenderer.invoke('auth:getStatus', service),
    getAllStatuses: () => ipcRenderer.invoke('auth:getAllStatuses'),
    removeToken: (service: string) => ipcRenderer.invoke('auth:removeToken', service),

    // Client credentials management
    setCredentials: (service: string, credentials: unknown) =>
      ipcRenderer.invoke('auth:setCredentials', service, credentials),
    getCredentials: (service: string) => ipcRenderer.invoke('auth:getCredentials', service),
    removeCredentials: (service: string) => ipcRenderer.invoke('auth:removeCredentials', service),

    // API token (for Notion Internal Integration, etc.)
    storeApiToken: (service: string, apiToken: string) =>
      ipcRenderer.invoke('auth:storeApiToken', service, apiToken),

    // Event listener for API token success
    onApiTokenSuccess: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
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
    onSuccess: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('oauth:success', handler);
      return () => ipcRenderer.removeListener('oauth:success', handler);
    },

    onError: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
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

    // Get OpenCode status
    status: () => ipcRenderer.invoke('opencode:status'),

    // Session management
    newSession: (title?: string) => ipcRenderer.invoke('opencode:newSession', title),
    listSessions: () => ipcRenderer.invoke('opencode:listSessions'),
    switchSession: (sessionId: string) => ipcRenderer.invoke('opencode:switchSession', sessionId),
    getMessages: () => ipcRenderer.invoke('opencode:getMessages'),

    // Event listeners for streaming responses
    onMessage: (callback: (message: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, message: unknown) => callback(message);
      ipcRenderer.on('opencode:message', handler);
      return () => ipcRenderer.removeListener('opencode:message', handler);
    },

    onProgress: (callback: (progress: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => callback(progress);
      ipcRenderer.on('opencode:progress', handler);
      return () => ipcRenderer.removeListener('opencode:progress', handler);
    },

    onError: (callback: (error: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, error: unknown) => callback(error);
      ipcRenderer.on('opencode:error', handler);
      return () => ipcRenderer.removeListener('opencode:error', handler);
    },

    onEvent: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, event: unknown) => callback(event);
      ipcRenderer.on('opencode:event', handler);
      return () => ipcRenderer.removeListener('opencode:event', handler);
    },

    // Remove all listeners (for cleanup)
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('opencode:message');
      ipcRenderer.removeAllListeners('opencode:progress');
      ipcRenderer.removeAllListeners('opencode:error');
      ipcRenderer.removeAllListeners('opencode:event');
    },
  },

  // MCP server management
  mcp: {
    // Reload MCP configuration (after connecting new integrations)
    reload: () => ipcRenderer.invoke('mcp:reload'),

    // Get MCP server status
    status: () => ipcRenderer.invoke('mcp:status'),
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('flowstate', flowstateAPI);

// Type declaration for TypeScript
export type FlowstateAPI = typeof flowstateAPI;

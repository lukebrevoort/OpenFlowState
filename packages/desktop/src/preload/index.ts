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
    getToken: (service: string) => ipcRenderer.invoke('auth:getToken', service),
    setToken: (service: string, token: unknown) =>
      ipcRenderer.invoke('auth:setToken', service, token),
  },

  // OAuth
  oauth: {
    start: (service: string) => ipcRenderer.invoke('oauth:start', service),
  },

  // OpenCode integration
  opencode: {
    send: (message: string) => ipcRenderer.invoke('opencode:send', message),
    // Event listeners for streaming responses
    onMessage: (callback: (message: unknown) => void) => {
      ipcRenderer.on('opencode:message', (_event, message) => callback(message));
    },
    onProgress: (callback: (progress: unknown) => void) => {
      ipcRenderer.on('opencode:progress', (_event, progress) => callback(progress));
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('opencode:message');
      ipcRenderer.removeAllListeners('opencode:progress');
    },
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('flowstate', flowstateAPI);

// Type declaration for TypeScript
export type FlowstateAPI = typeof flowstateAPI;

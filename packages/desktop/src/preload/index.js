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
        openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
        openTerminal: (command) => ipcRenderer.invoke('app:openTerminal', command),
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
        set: (config) => ipcRenderer.invoke('config:set', config),
    },
    // Authentication
    auth: {
        getToken: (service) => ipcRenderer.invoke('auth:getToken', service),
        getStatus: (service) => ipcRenderer.invoke('auth:getStatus', service),
        getAllStatuses: () => ipcRenderer.invoke('auth:getAllStatuses'),
        removeToken: (service) => ipcRenderer.invoke('auth:removeToken', service),
        setCredentials: (service, credentials) => ipcRenderer.invoke('auth:setCredentials', service, credentials),
        getCredentials: (service) => ipcRenderer.invoke('auth:getCredentials', service),
        removeCredentials: (service) => ipcRenderer.invoke('auth:removeCredentials', service),
        storeApiToken: (service, apiToken) => ipcRenderer.invoke('auth:storeApiToken', service, apiToken),
        onApiTokenSuccess: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('auth:apiTokenSuccess', handler);
            return () => ipcRenderer.removeListener('auth:apiTokenSuccess', handler);
        },
    },
    // OAuth
    oauth: {
        start: (service, clientId, clientSecret) => ipcRenderer.invoke('oauth:start', service, clientId, clientSecret),
        refresh: (service) => ipcRenderer.invoke('oauth:refresh', service),
        disconnect: (service) => ipcRenderer.invoke('oauth:disconnect', service),
        onSuccess: (callback) => {
            const handler = (_event, data) => callback(data);
            ipcRenderer.on('oauth:success', handler);
            return () => ipcRenderer.removeListener('oauth:success', handler);
        },
        onError: (callback) => {
            const handler = (_event, data) => callback(data);
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
        send: (message) => ipcRenderer.invoke('opencode:send', message),
        status: () => ipcRenderer.invoke('opencode:status'),
        newSession: (title) => ipcRenderer.invoke('opencode:newSession', title),
        listSessions: () => ipcRenderer.invoke('opencode:listSessions'),
        switchSession: (sessionId) => ipcRenderer.invoke('opencode:switchSession', sessionId),
        getMessages: () => ipcRenderer.invoke('opencode:getMessages'),
        onMessage: (callback) => {
            const handler = (_event, message) => callback(message);
            ipcRenderer.on('opencode:message', handler);
            return () => ipcRenderer.removeListener('opencode:message', handler);
        },
        onProgress: (callback) => {
            const handler = (_event, progress) => callback(progress);
            ipcRenderer.on('opencode:progress', handler);
            return () => ipcRenderer.removeListener('opencode:progress', handler);
        },
        onError: (callback) => {
            const handler = (_event, error) => callback(error);
            ipcRenderer.on('opencode:error', handler);
            return () => ipcRenderer.removeListener('opencode:error', handler);
        },
        onEvent: (callback) => {
            const handler = (_event, event) => callback(event);
            ipcRenderer.on('opencode:event', handler);
            return () => ipcRenderer.removeListener('opencode:event', handler);
        },
        removeAllListeners: () => {
            ipcRenderer.removeAllListeners('opencode:message');
            ipcRenderer.removeAllListeners('opencode:progress');
            ipcRenderer.removeAllListeners('opencode:error');
            ipcRenderer.removeAllListeners('opencode:event');
        },
    },
    // MCP server management
    mcp: {
        reload: () => ipcRenderer.invoke('mcp:reload'),
        status: () => ipcRenderer.invoke('mcp:status'),
    },
};
// Expose the API to the renderer process
contextBridge.exposeInMainWorld('flowstate', flowstateAPI);

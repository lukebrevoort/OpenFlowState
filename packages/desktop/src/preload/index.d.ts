/**
 * FlowState Desktop App - Electron Preload Script
 *
 * This script runs in a sandboxed environment and exposes
 * a safe API to the renderer process via contextBridge.
 */
/**
 * Exposed API for the renderer process
 */
declare const flowstateAPI: {
    app: {
        getInfo: () => Promise<any>;
        getTheme: () => Promise<any>;
        openExternal: (url: string) => Promise<any>;
        openTerminal: (command: string) => Promise<any>;
    };
    window: {
        minimize: () => Promise<any>;
        maximize: () => Promise<any>;
        close: () => Promise<any>;
    };
    config: {
        get: () => Promise<any>;
        set: (config: unknown) => Promise<any>;
    };
    auth: {
        getToken: (service: string) => Promise<any>;
        getStatus: (service: string) => Promise<any>;
        getAllStatuses: () => Promise<any>;
        removeToken: (service: string) => Promise<any>;
        setCredentials: (service: string, credentials: unknown) => Promise<any>;
        getCredentials: (service: string) => Promise<any>;
        removeCredentials: (service: string) => Promise<any>;
        storeApiToken: (service: string, apiToken: string) => Promise<any>;
        onApiTokenSuccess: (callback: (event: unknown) => void) => () => void;
    };
    oauth: {
        start: (service: string, clientId: string, clientSecret: string) => Promise<any>;
        refresh: (service: string) => Promise<any>;
        disconnect: (service: string) => Promise<any>;
        onSuccess: (callback: (event: unknown) => void) => () => void;
        onError: (callback: (event: unknown) => void) => () => void;
        removeAllListeners: () => void;
    };
    opencode: {
        send: (message: string) => Promise<any>;
        status: () => Promise<any>;
        listModels: (provider?: string) => Promise<any>;
        newSession: (title?: string) => Promise<any>;
        listSessions: () => Promise<any>;
        switchSession: (sessionId: string) => Promise<any>;
        getMessages: () => Promise<any>;
        onMessage: (callback: (message: unknown) => void) => () => void;
        onProgress: (callback: (progress: unknown) => void) => () => void;
        onError: (callback: (error: unknown) => void) => () => void;
        onEvent: (callback: (event: unknown) => void) => () => void;
        removeAllListeners: () => void;
    };
    mcp: {
        reload: () => Promise<any>;
        status: () => Promise<any>;
    };
};
export type FlowstateAPI = typeof flowstateAPI;
export {};

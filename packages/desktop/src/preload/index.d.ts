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
        setToken: (service: string, token: unknown) => Promise<any>;
    };
    oauth: {
        start: (service: string) => Promise<any>;
    };
    opencode: {
        send: (message: string) => Promise<any>;
        onMessage: (callback: (message: unknown) => void) => void;
        onProgress: (callback: (progress: unknown) => void) => void;
        removeAllListeners: () => void;
    };
};
export type FlowstateAPI = typeof flowstateAPI;
export {};

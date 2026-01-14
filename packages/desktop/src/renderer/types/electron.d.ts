/**
 * Type declarations for the FlowState preload API
 * This is exposed to the renderer process via contextBridge
 */

export interface FlowstateAPI {
  app: {
    getInfo: () => Promise<{
      name: string;
      version: string;
      platform: string;
      isDev: boolean;
    }>;
    getTheme: () => Promise<'light' | 'dark'>;
    openExternal: (url: string) => Promise<void>;
  };

  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };

  config: {
    get: () => Promise<FlowstateConfig>;
    set: (config: Partial<FlowstateConfig>) => Promise<void>;
  };

  auth: {
    getToken: (service: string) => Promise<unknown | null>;
    setToken: (service: string, token: unknown) => Promise<void>;
  };

  oauth: {
    start: (service: string) => Promise<void>;
  };

  opencode: {
    send: (message: string) => Promise<{ response: string }>;
    onMessage: (callback: (message: unknown) => void) => void;
    onProgress: (callback: (progress: unknown) => void) => void;
    removeAllListeners: () => void;
  };
}

export interface FlowstateConfig {
  provider: {
    default: string;
    apiKeys: Record<string, string>;
  };
  mcpServers: Record<string, MCPServerConfig>;
  preferences: {
    timezone: string;
    workingHours: {
      start: string;
      end: string;
    };
    notifications: {
      approvals: boolean;
      taskComplete: boolean;
    };
  };
}

export interface MCPServerConfig {
  command?: string[];
  url?: string;
  enabled: boolean;
  headers?: Record<string, string>;
}

declare global {
  interface Window {
    flowstate: FlowstateAPI;
  }
}

export {};

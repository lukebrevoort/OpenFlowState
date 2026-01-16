/**
 * Type declarations for the FlowState preload API
 * This is exposed to the renderer process via contextBridge
 */

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  isDev: boolean;
}

export interface OpenCodeStatus {
  running: boolean;
  sessionId: string | null;
  healthy: boolean;
  version?: string;
}

export interface OpenCodeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  parts?: Array<{ type: string; text?: string }>;
}

export interface OpenCodeProgress {
  status: 'idle' | 'thinking' | 'error';
  sessionId?: string;
}

export interface OpenCodeError {
  error: string;
}

export interface OpenCodeEvent {
  type: string;
  data: unknown;
}

export type TimelineEventKind =
  | 'phase'
  | 'tool_call'
  | 'tool_result'
  | 'approval_request'
  | 'approval_response'
  | 'error'
  | 'status';

export interface TimelineEvent {
  id: string;
  sessionId: string;
  taskId?: string;
  timestamp: number;
  kind: TimelineEventKind;
  title: string;
  detail?: string;
  toolName?: string;
  payloadInline?: unknown;
  payloadRef?: string;
  redacted?: boolean;
}

export interface TaskRun {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  status: 'running' | 'waiting_approval' | 'completed' | 'failed';
  startedAt: number;
  updatedAt: number;
  progress: number;
  summary?: string;
  summarySent?: boolean;
}

export interface Session {
  id: string;
  title: string;
}

// ============================================================================
// Auth Types
// ============================================================================

export type AuthMethod = 'oauth' | 'api_token';

export interface AuthToken {
  service: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes: string[];
  email?: string;
  authMethod: AuthMethod;
}

export interface AuthStatus {
  service: string;
  connected: boolean;
  configured: boolean;
  email?: string;
  lastRefresh?: string;
  error?: string;
  authMethod?: AuthMethod;
}

export interface ClientCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export interface ApiTokenCredentials {
  apiToken: string;
}

export interface OAuthSuccessEvent {
  service: string;
}

export interface OAuthErrorEvent {
  service: string;
  error: string;
}

export interface ApiTokenSuccessEvent {
  service: string;
}

export interface McpServerStatus {
  status: 'connected' | 'disabled' | 'failed' | 'needs_auth' | 'needs_client_registration';
  error?: string;
}

export interface FlowstateAPI {
  app: {
    getInfo: () => Promise<AppInfo>;
    getTheme: () => Promise<'light' | 'dark'>;
    openExternal: (url: string) => Promise<void>;
    openTerminal: (command: string) => Promise<void>;
  };

  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };

  config: {
    get: () => Promise<FlowstateConfig>;
    set: (config: Partial<FlowstateConfig>) => Promise<FlowstateConfig>;
  };

  auth: {
    // Token management
    getToken: (service: string) => Promise<AuthToken | null>;
    getStatus: (service: string) => Promise<AuthStatus>;
    getAllStatuses: () => Promise<AuthStatus[]>;
    removeToken: (service: string) => Promise<void>;

    // Client credentials management
    setCredentials: (service: string, credentials: ClientCredentials) => Promise<void>;
    getCredentials: (service: string) => Promise<ClientCredentials | null>;
    removeCredentials: (service: string) => Promise<void>;

    // API token (for Notion Internal Integration, etc.)
    storeApiToken: (service: string, apiToken: string) => Promise<{ success: boolean }>;
    onApiTokenSuccess: (callback: (event: ApiTokenSuccessEvent) => void) => () => void;
  };

  oauth: {
    // Start OAuth flow (opens browser)
    start: (service: string, clientId: string, clientSecret: string) => Promise<AuthToken>;
    
    // Refresh an existing token
    refresh: (service: string) => Promise<AuthToken | null>;
    
    // Disconnect a service
    disconnect: (service: string) => Promise<void>;

    // Event listeners
    onSuccess: (callback: (event: OAuthSuccessEvent) => void) => () => void;
    onError: (callback: (event: OAuthErrorEvent) => void) => () => void;
    removeAllListeners: () => void;
  };

  opencode: {
    // Send a message (triggers streaming response via events)
    send: (message: string) => Promise<{ success?: boolean; error?: string; content?: string }>;

    // Get status
    status: () => Promise<OpenCodeStatus>;
    restart: () => Promise<void>;

    // Session management
    newSession: (title?: string) => Promise<{ sessionId: string }>;
    listSessions: () => Promise<Session[]>;
    switchSession: (sessionId: string) => Promise<{ sessionId: string }>;
    getMessages: () => Promise<OpenCodeMessage[]>;

    // Event listeners (return cleanup functions)
    onMessage: (callback: (message: OpenCodeMessage) => void) => () => void;
    onProgress: (callback: (progress: OpenCodeProgress) => void) => () => void;
    onError: (callback: (error: OpenCodeError) => void) => () => void;
    onEvent: (callback: (event: OpenCodeEvent) => void) => () => void;
    onTimelineEvent: (callback: (event: TimelineEvent) => void) => () => void;

    // Cleanup
    removeAllListeners: () => void;
  };

  timeline: {
    list: (sessionId: string, limit?: number, offset?: number) => Promise<TimelineEvent[]>;
    resolvePayload: (payloadRef: string) => Promise<unknown | null>;
  };

  mcp: {
    // Reload MCP configuration (after connecting new integrations)
    reload: () => Promise<{ success: boolean }>;

    // Get MCP server status
    status: () => Promise<Record<string, McpServerStatus> | null>;
  };
}

export interface FlowstateConfig {
  $schema?: string;
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
  onboardingComplete?: boolean;
}

export interface MCPServerConfig {
  command?: string[];
  url?: string;
  enabled: boolean;
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

declare global {
  interface Window {
    flowstate: FlowstateAPI;
  }
}

export {};

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
  message?: string;
  code?: string;
  provider?: string;
  model?: string;
  status?: number;
  retryAfter?: number;
  details?: unknown;
}

export interface OpenCodeEvent {
  type: string;
  data: unknown;
}

export interface IpcError {
  code: 'NOT_IMPLEMENTED' | 'INVALID_REQUEST' | 'UNAVAILABLE' | 'UNKNOWN';
  message: string;
  details?: unknown;
}

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IpcError };

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
  payloadInline?: {
    requestId?: string;
    title?: string;
    summary?: string;
    body?: string;
    approveLabel?: string;
    alwaysApproveLabel?: string;
    denyLabel?: string;
  } | unknown;
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

export interface WorkflowDefinition {
  id: string;
  title: string;
  description?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt: number;
  finishedAt?: number;
  output?: unknown;
  error?: string;
}

export interface WorkflowGenerationResult {
  definition: WorkflowDefinition;
  skillMarkdown: string;
}

export type ChatSendResult = {
  success?: boolean;
  error?: string;
  content?: string;
  errorDetails?: OpenCodeError;
};

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

export interface GoogleCalendarListEntry {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
  timeZone?: string;
  backgroundColor?: string;
}

export interface FlowstateAPI {
  app: {
    getInfo: () => Promise<AppInfo>;
    getTheme: () => Promise<'light' | 'dark'>;
    openExternal: (url: string) => Promise<void>;
    openTerminal: (command: string) => Promise<void>;
    showSaveDialog: (options?: { title?: string; defaultPath?: string }) => Promise<string | null>;
    showOpenDialog: (options?: { title?: string }) => Promise<string | null>;
    ensureFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  };

  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };

  config: {
    get: () => Promise<FlowstateConfig>;
    set: (config: Partial<FlowstateConfig>) => Promise<FlowstateConfig>;
    getPath: () => Promise<string>;
  };

  auth: {
    // Token management
    getToken: (service: string) => Promise<AuthToken | null>;
    getStatus: (service: string) => Promise<AuthStatus>;
    getAllStatuses: () => Promise<AuthStatus[]>;
    removeToken: (service: string) => Promise<void>;
    reauthenticate: (service: string) => Promise<AuthToken>;

    // Client credentials management
    setCredentials: (service: string, credentials: ClientCredentials) => Promise<void>;
    getCredentials: (service: string) => Promise<ClientCredentials | null>;
    removeCredentials: (service: string) => Promise<void>;

    // API token (for Notion Internal Integration, Canvas LMS, etc.)
    storeApiToken: (service: string, apiToken: string, additionalData?: Record<string, string>) => Promise<{ success: boolean }>;
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
    send: (message: string) => Promise<{ success?: boolean; error?: string; content?: string; errorDetails?: OpenCodeError }>;

    // Get status
    status: () => Promise<OpenCodeStatus>;
    restart: () => Promise<{ success: boolean; error?: string }>;
    listModels: (provider?: string) => Promise<string[]>;

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

  approvals: {
    reply: (requestId: string, reply: 'once' | 'always' | 'deny') => Promise<{ success: boolean; error?: string }>;
  };

  mcp: {
    // Reload MCP configuration (after connecting new integrations)
    reload: () => Promise<{ success: boolean; error?: string }>;

    // Get MCP server status
    status: () => Promise<Record<string, McpServerStatus> | null>;
  };

  canvas: {
    browserLogin: (payload: {
      canvasApiUrl: string;
      storageStatePath: string;
      confirmationFilePath?: string;
      timeoutSeconds?: number;
    }) => Promise<{ success: boolean; error?: string; storageStatePath?: string }>;
  };

  // ============================================================================
  // Phase 3.5 - Typed feature surfaces (aliases over lower-level IPC)
  // ============================================================================

  chat: {
    sendMessage: (message: string) => Promise<ChatSendResult>;
    getStatus: () => Promise<OpenCodeStatus>;

    newConversation: (title?: string) => Promise<{ sessionId: string }>;
    listConversations: () => Promise<Session[]>;
    switchConversation: (sessionId: string) => Promise<{ sessionId: string }>;
    getMessages: () => Promise<OpenCodeMessage[]>;

    onMessage: (callback: (message: OpenCodeMessage) => void) => () => void;
    onProgress: (callback: (progress: OpenCodeProgress) => void) => () => void;
    onError: (callback: (error: OpenCodeError) => void) => () => void;
    onEvent: (callback: (event: OpenCodeEvent) => void) => () => void;
    onTimelineEvent: (callback: (event: TimelineEvent) => void) => () => void;
    removeAllListeners: () => void;
  };

  tasks: {
    listRuns: () => Promise<IpcResult<TaskRun[]>>;
    getActiveRun: () => Promise<IpcResult<TaskRun | null>>;
  };

  workflows: {
    list: () => Promise<IpcResult<WorkflowDefinition[]>>;
    run: (workflowId: string, input?: unknown) => Promise<IpcResult<WorkflowRun>>;
    generateFromIntent: (intent: string) => Promise<IpcResult<WorkflowGenerationResult>>;
  };

  integrations: {
    listAuthStatuses: () => Promise<AuthStatus[]>;
    getMcpStatus: () => Promise<Record<string, McpServerStatus> | null>;
    reloadMcp: () => Promise<{ success: boolean; error?: string }>;

    oauthStart: (service: string, clientId: string, clientSecret: string) => Promise<AuthToken>;
    oauthRefresh: (service: string) => Promise<AuthToken | null>;
    oauthDisconnect: (service: string) => Promise<void>;

    storeApiToken: (
      service: string,
      apiToken: string,
      additionalData?: Record<string, string>
    ) => Promise<{ success: boolean }>;

    onOAuthSuccess: (callback: (event: OAuthSuccessEvent) => void) => () => void;
    onOAuthError: (callback: (event: OAuthErrorEvent) => void) => () => void;
    onApiTokenSuccess: (callback: (event: ApiTokenSuccessEvent) => void) => () => void;
  };

  gcal: {
    listCalendars: () => Promise<GoogleCalendarListEntry[]>;
  };

  settings: {
    get: () => Promise<FlowstateConfig>;
    update: (config: Partial<FlowstateConfig>) => Promise<FlowstateConfig>;
    getTheme: () => Promise<'light' | 'dark'>;
    getAppInfo: () => Promise<AppInfo>;
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

    /**
     * When true/false, overrides system prefers-reduced-motion.
     * When undefined, the renderer should follow the system preference.
     */
    reduceMotion?: boolean;

    /**
     * Controls decorative background motion.
     * When undefined, the renderer should default to 'animated'.
     */
    backgroundMotion?: 'animated' | 'static';
  };
  integrations?: {
    gcal?: {
      readCalendarIds?: string[];
      writeCalendarId?: string;
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

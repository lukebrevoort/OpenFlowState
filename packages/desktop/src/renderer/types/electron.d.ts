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

export interface FileDialogFilter {
  name: string;
  extensions: string[];
}

export interface OpenFilesDialogOptions {
  title?: string;
  filters?: FileDialogFilter[];
  multiSelect?: boolean;
}

export interface OpenCodeStatus {
  running: boolean;
  sessionId: string | null;
  healthy: boolean;
  version?: string;
  startError?: string | null;
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

export type TimelineEventBatch = {
  type: 'batch';
  events: TimelineEvent[];
};

export type TimelineEventEnvelope = TimelineEvent | TimelineEventBatch;

export interface TaskRun {
  id: string;
  sessionId: string;
  title: string;
  description: string;
  status: 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  /** Why the task is currently blocked (if it is). */
  blockingReason?:
    | { kind: 'permission' }
    | { kind: 'response' };
  startedAt: number;
  updatedAt: number;
  progress: number;
  summary?: string;
  summarySent?: boolean;
  metadata?: unknown;
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
  taskRunId?: string;
  sessionId?: string;
  assistantMessageId?: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | (string & {});
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  inputJson?: string;
  outputPreview?: string;
  output?: unknown;
  error?: string;
}

export interface WorkflowArtifact {
  artifactId: string;
  workflowRunId: string;
  kind: 'final_output' | 'summary' | 'export' | (string & {});
  title?: string;
  mime?: string;
  createdAt: number;
  payloadText?: string;
}

export interface SourceDocument {
  id: string;
  courseId: string;
  origin: 'canvas' | 'local' | (string & {});
  fileType: string;
  title: string;
  sourceRef: string;
  versionHash: string;
  ingestedAt: number;
}

export interface StudyMaterialRun {
  id: string;
  courseId: string;
  taskRunId?: string;
  mode: 'conservative' | 'coaching' | (string & {});
  destinationType: string;
  status:
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'awaiting_destination'
    | 'awaiting_quality_override'
    | (string & {});
  qualityScore?: number;
  createdAt: number;
  updatedAt: number;
}

export interface StudyMaterialArtifact {
  id: string;
  studyRunId: string;
  kind: 'summary' | 'practice_exam' | 'flashcards' | 'report' | (string & {});
  pathOrBlobRef: string;
  mime?: string;
  createdAt: number;
}

export interface CitationSpan {
  id: string;
  studyRunId: string;
  artifactId: string;
  sectionId: string;
  sourceDocumentId: string;
  sourceLocator: string;
  confidence?: number;
}

export interface ExtractionIssue {
  id: string;
  studyRunId: string;
  sourceDocumentId: string;
  kind: string;
  detail: string;
  severity: string;
}

export interface StudyRunDiff {
  id: string;
  studyRunId: string;
  previousStudyRunId: string;
  summary: string;
}

export interface StudyMaterialRunCreateInput {
  id: string;
  courseId: string;
  taskRunId?: string;
  mode: 'conservative' | 'coaching' | (string & {});
  destinationType: string;
  status?: StudyMaterialRun['status'];
  qualityScore?: number;
}

export interface StudyMaterialArtifactCreateInput {
  id: string;
  studyRunId: string;
  kind: StudyMaterialArtifact['kind'];
  pathOrBlobRef: string;
  mime?: string;
}

export interface CitationSpanCreateInput {
  id: string;
  studyRunId: string;
  artifactId: string;
  sectionId: string;
  sourceDocumentId: string;
  sourceLocator: string;
  confidence?: number;
}

export interface CitationSpanListQuery {
  studyRunId: string;
  artifactId?: string;
}

export interface ExtractionIssueCreateInput {
  id: string;
  studyRunId: string;
  sourceDocumentId: string;
  kind: string;
  detail: string;
  severity: string;
}

export interface ExtractionIssueListQuery {
  studyRunId: string;
  sourceDocumentId?: string;
}

export interface StudyRunDiffCreateInput {
  id: string;
  studyRunId: string;
  previousStudyRunId: string;
  summary: string;
}

export interface StudyMaterialRunConfirmDestinationInput {
  studyRunId: string;
  destinationType: string;
  status?: StudyMaterialRun['status'];
  qualityScore?: number;
}

export type StudyMaterialFallbackClassification =
  | 'auth_expired'
  | 'external_host'
  | 'inaccessible'
  | 'timeout'
  | 'unknown';

export interface StudyMaterialFallbackClassificationInput {
  message?: string;
  status?: number | string;
  code?: string;
  url?: string;
}

export interface StudyMaterialFallbackClassificationResult {
  classification: StudyMaterialFallbackClassification;
  recommendation: string;
  localUploadPrimaryAction: boolean;
}

export interface StudyMaterialQualityGateThresholds {
  minCitationCoverage: number;
  maxDuplicateQuestionRatio: number;
  minSourceCoverageRatio: number;
}

export interface StudyMaterialQualityGateThresholdOverrides {
  minCitationCoverage?: number;
  maxDuplicateQuestionRatio?: number;
  minSourceCoverageRatio?: number;
}

export interface StudyMaterialQualityGateEvaluateInput {
  citationCoverage: number;
  duplicateQuestionRatio: number;
  sourceCoverageRatio: number;
  extractionIssueCount: number;
  writeAnywayRequested: boolean;
  thresholds?: StudyMaterialQualityGateThresholdOverrides;
}

export interface StudyMaterialQualityGateCheck {
  metric: 'citationCoverage' | 'duplicateQuestionRatio' | 'sourceCoverageRatio' | 'extractionIssueCount';
  comparator: '>=' | '<=';
  threshold: number;
  value: number;
  passed: boolean;
}

export interface StudyMaterialQualityGateEvaluateResult {
  passed: boolean;
  blocked: boolean;
  score: number;
  checks: StudyMaterialQualityGateCheck[];
  summary: string;
}

export interface SourceDocumentCreateInput {
  id: string;
  courseId: string;
  origin: SourceDocument['origin'];
  fileType: string;
  title: string;
  sourceRef: string;
  versionHash: string;
  ingestedAt?: number;
}

export interface SourceDocumentListQuery {
  courseId?: string;
  origin?: string;
  limit?: number;
  offset?: number;
}

export type StudyMaterialLocalSourceIssueCode =
  | 'INVALID_PATH'
  | 'NOT_ABSOLUTE_PATH'
  | 'NOT_FOUND'
  | 'NOT_FILE'
  | 'UNSUPPORTED_EXTENSION'
  | 'FILE_TOO_LARGE'
  | 'SIGNATURE_MISMATCH'
  | 'READ_FAILED'
  | 'INVALID_SIZE_LIMIT';

export interface StudyMaterialLocalSourceValidationIssue {
  code: StudyMaterialLocalSourceIssueCode;
  message: string;
}

export interface StudyMaterialLocalSourceValidationInput {
  filePath: string;
  maxBytes?: number;
}

export interface StudyMaterialLocalSourceValidationResult {
  ok: boolean;
  normalizedPath: string | null;
  fileName: string | null;
  extension: '.pdf' | '.pptx' | null;
  fileType: 'pdf' | 'pptx' | null;
  sizeBytes: number | null;
  versionHash: string | null;
  detectedMime: string | null;
  issue: StudyMaterialLocalSourceValidationIssue | null;
}

export interface WorkflowGenerationResult {
  definition: WorkflowDefinition;
  skillMarkdown: string;
}

export interface WorkflowSkillFile {
  workflowId: string;
  skillMarkdown: string;
  source: 'user' | 'project';
}

export interface WorkflowSkillSaveResult {
  definition: WorkflowDefinition;
  skillMarkdown: string;
  source: 'user' | 'project';
}

export interface WorkflowDuplicateResult {
  definition: WorkflowDefinition;
}

export type ChatSendResult = {
  success?: boolean;
  error?: string;
  content?: string;
  errorDetails?: OpenCodeError;
};

export type CancelGenerationResult = {
  success: boolean;
  cancelled: boolean;
  error?: string;
};

export type CancelGenerationContext = {
  expectedSessionId?: string | null;
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
  additionalData?: Record<string, string>;
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

export interface ApprovalNotificationClickEvent {
  requestId: string;
  sessionId: string;
  taskRunId?: string;
}

export interface McpServerStatus {
  status: 'connected' | 'disabled' | 'failed' | 'needs_auth' | 'needs_client_registration';
  error?: string;
}

export interface IntegrationHealthCheckResult {
  ok: boolean;
  checkedAt: string;
  message?: string;
  email?: string;
}

export type OAuthIntegrationService = 'gmail' | 'gcal' | 'notion' | 'outlook';

export type OAuthBatchHealthCheckResult = Record<OAuthIntegrationService, IntegrationHealthCheckResult>;

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
    showOpenFilesDialog: (options?: OpenFilesDialogOptions) => Promise<string[] | null>;
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

    // Fire-and-forget send (response still streams via events)
    sendAsync: (message: string) => Promise<{ success?: boolean; error?: string; content?: string; errorDetails?: OpenCodeError }>;
    cancelGeneration: (context?: CancelGenerationContext) => Promise<CancelGenerationResult>;

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
    onTimelineEvent: (callback: (event: TimelineEventEnvelope) => void) => () => void;

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

  notifications: {
    onApprovalClick: (callback: (event: ApprovalNotificationClickEvent) => void) => () => void;
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

  outlook: {
    browserLogin: (payload: {
      mailboxUrl?: string;
      storageStatePath: string;
      confirmationFilePath?: string;
      timeoutSeconds?: number;
    }) => Promise<{ success: boolean; error?: string; storageStatePath?: string; mailboxUrl?: string }>;
    readInbox: (payload?: {
      maxItems?: number;
    }) => Promise<{
      ok: boolean;
      message?: string;
      messages: Array<{
        subject: string;
        sender?: string;
        preview?: string;
        receivedAt?: string;
      }>;
    }>;
  };

  // ============================================================================
  // Phase 3.5 - Typed feature surfaces (aliases over lower-level IPC)
  // ============================================================================

  chat: {
    sendMessage: (message: string) => Promise<ChatSendResult>;
    cancelGeneration: (context?: CancelGenerationContext) => Promise<CancelGenerationResult>;
    getStatus: () => Promise<OpenCodeStatus>;

    newConversation: (title?: string) => Promise<{ sessionId: string }>;
    listConversations: () => Promise<Session[]>;
    switchConversation: (sessionId: string) => Promise<{ sessionId: string }>;
    getMessages: () => Promise<OpenCodeMessage[]>;

    onMessage: (callback: (message: OpenCodeMessage) => void) => () => void;
    onProgress: (callback: (progress: OpenCodeProgress) => void) => () => void;
    onError: (callback: (error: OpenCodeError) => void) => () => void;
    onEvent: (callback: (event: OpenCodeEvent) => void) => () => void;
    onTimelineEvent: (callback: (event: TimelineEventEnvelope) => void) => () => void;
    removeAllListeners: () => void;
  };

  tasks: {
    listRuns: () => Promise<IpcResult<TaskRun[]>>;
    getActiveRun: () => Promise<IpcResult<TaskRun | null>>;
    cancelRun: (taskRunId: string) => Promise<IpcResult<TaskRun>>;
    removeRun: (taskRunId: string) => Promise<IpcResult<{ removed: boolean }>>;
    markRunning: (taskRunId: string) => Promise<IpcResult<TaskRun>>;
    markComplete: (taskRunId: string) => Promise<IpcResult<TaskRun>>;
  };

  studyMaterials: {
    createRun: (input: StudyMaterialRunCreateInput) => Promise<IpcResult<StudyMaterialRun>>;
    listRuns: (query?: { courseId?: string; limit?: number; offset?: number }) => Promise<IpcResult<StudyMaterialRun[]>>;
    getRun: (studyRunId: string) => Promise<IpcResult<StudyMaterialRun | null>>;
    confirmDestination: (input: StudyMaterialRunConfirmDestinationInput) => Promise<IpcResult<StudyMaterialRun>>;
    classifyFallback: (
      input?: StudyMaterialFallbackClassificationInput
    ) => Promise<IpcResult<StudyMaterialFallbackClassificationResult>>;
    evaluateQuality: (
      input: StudyMaterialQualityGateEvaluateInput
    ) => Promise<IpcResult<StudyMaterialQualityGateEvaluateResult>>;
    createSource: (input: SourceDocumentCreateInput) => Promise<IpcResult<SourceDocument>>;
    validateLocalSource: (
      input: StudyMaterialLocalSourceValidationInput
    ) => Promise<IpcResult<StudyMaterialLocalSourceValidationResult>>;
    getSource: (sourceId: string) => Promise<IpcResult<SourceDocument | null>>;
    listSources: (query?: SourceDocumentListQuery) => Promise<IpcResult<SourceDocument[]>>;
    createArtifact: (input: StudyMaterialArtifactCreateInput) => Promise<IpcResult<StudyMaterialArtifact>>;
    listArtifacts: (studyRunId: string) => Promise<IpcResult<StudyMaterialArtifact[]>>;
    createCitation: (input: CitationSpanCreateInput) => Promise<IpcResult<CitationSpan>>;
    listCitations: (query: CitationSpanListQuery) => Promise<IpcResult<CitationSpan[]>>;
    createIssue: (input: ExtractionIssueCreateInput) => Promise<IpcResult<ExtractionIssue>>;
    listIssues: (query: ExtractionIssueListQuery) => Promise<IpcResult<ExtractionIssue[]>>;
    createDiff: (input: StudyRunDiffCreateInput) => Promise<IpcResult<StudyRunDiff>>;
    getDiff: (studyRunId: string) => Promise<IpcResult<StudyRunDiff | null>>;
  };

  workflows: {
    list: () => Promise<IpcResult<WorkflowDefinition[]>>;
    run: (workflowId: string, input?: unknown) => Promise<IpcResult<WorkflowRun>>;
    generateFromIntent: (intent: string) => Promise<IpcResult<WorkflowGenerationResult>>;
    getSkillMarkdown: (workflowId: string) => Promise<IpcResult<WorkflowSkillFile>>;
    saveSkillMarkdown: (workflowId: string, skillMarkdown: string) => Promise<IpcResult<WorkflowSkillSaveResult>>;
    duplicateWorkflow: (workflowId: string) => Promise<IpcResult<WorkflowDuplicateResult>>;
    deleteWorkflow: (workflowId: string) => Promise<IpcResult<{ removed: boolean }>>;

    listRuns: (workflowId: string, limit?: number, offset?: number) => Promise<IpcResult<WorkflowRun[]>>;
    listArtifacts: (workflowRunId: string) => Promise<IpcResult<WorkflowArtifact[]>>;

    getPins: () => Promise<IpcResult<string[]>>;
    setPinned: (workflowId: string, pinned: boolean) => Promise<IpcResult<{ pinnedIds: string[] }>>;

    getApprovalOptIn: (workflowId: string) => Promise<IpcResult<boolean>>;
    setApprovalOptIn: (
      workflowId: string,
      optedIn: boolean,
    ) => Promise<IpcResult<{ workflowId: string; optedIn: boolean }>>;
    listApprovalOptIns: () => Promise<IpcResult<Record<string, boolean>>>;
  };

  integrations: {
    listAuthStatuses: () => Promise<AuthStatus[]>;
    getMcpStatus: () => Promise<Record<string, McpServerStatus> | null>;
    reloadMcp: () => Promise<{ success: boolean; error?: string }>;
    healthCheck: (service: string) => Promise<IntegrationHealthCheckResult>;
    healthCheckOAuthBatch: () => Promise<OAuthBatchHealthCheckResult>;

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

    studyMaterials?: {
      externalKnowledgeAllowlistEnabled?: boolean;
      defaultGenerationMode?: 'conservative' | 'coaching';
      maxConcurrentRuns?: number;
      retention?: {
        globalRetentionDays?: number;
        perCourseRetentionEnabled?: boolean;
      };
    };
  };
  integrations?: {
    gcal?: {
      readCalendarIds?: string[];
      writeCalendarId?: string;
    };
    canvas?: {
      apiUrl?: string;
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

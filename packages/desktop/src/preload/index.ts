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
  TimelineEventEnvelope,
  OAuthSuccessEvent,
  OAuthErrorEvent,
  ApiTokenSuccessEvent,
  FlowstateConfig,
  ClientCredentials,
  ApprovalNotificationClickEvent,
  OpenFilesDialogOptions,
  SourceDocumentCreateInput,
  SourceDocumentListQuery,
  StudyMaterialFallbackClassificationInput,
  StudyMaterialQualityGateEvaluateInput,
  StudyMaterialLocalSourceValidationInput,
  StudyMaterialArtifactCreateInput,
  CitationSpanCreateInput,
  CitationSpanListQuery,
  ExtractionIssueCreateInput,
  ExtractionIssueListQuery,
  StudyMaterialRunConfirmDestinationInput,
  StudyRunDiffCreateInput,
  StudyMaterialRunCreateInput,
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
    showOpenFilesDialog: (options?: OpenFilesDialogOptions) =>
      ipcRenderer.invoke('app:showOpenFilesDialog', options),
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

    cancelGeneration: (context?: { expectedSessionId?: string | null }) =>
      ipcRenderer.invoke('opencode:cancelGeneration', context),

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

    onTimelineEvent: (callback: (event: TimelineEventEnvelope) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, event: TimelineEventEnvelope) => callback(event);
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

  notifications: {
    onApprovalClick: (callback: (event: ApprovalNotificationClickEvent) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, data: ApprovalNotificationClickEvent) => callback(data);
      ipcRenderer.on('notifications:approvalClick', handler);
      return () => ipcRenderer.removeListener('notifications:approvalClick', handler);
    },
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

  outlook: {
    browserLogin: (payload: {
      mailboxUrl?: string;
      storageStatePath: string;
      confirmationFilePath?: string;
      timeoutSeconds?: number;
    }) => ipcRenderer.invoke('outlook:browserLogin', payload),
    readInbox: (payload?: { maxItems?: number }) => ipcRenderer.invoke('outlook:readInbox', payload),
  },

  // ============================================================================
  // Phase 3.5 - Typed feature surfaces
  // ============================================================================

  chat: {
    sendMessage: (message: string) => ipcRenderer.invoke('chat:sendMessage', message),
    cancelGeneration: (context?: { expectedSessionId?: string | null }) =>
      ipcRenderer.invoke('chat:cancelGeneration', context),
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

    onTimelineEvent: (callback: (event: TimelineEventEnvelope) => void): Unsubscribe => {
      const handler = (_event: Electron.IpcRendererEvent, event: TimelineEventEnvelope) => callback(event);
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

  studyMaterials: {
    createRun: (input: StudyMaterialRunCreateInput) => ipcRenderer.invoke('studyMaterials:runs:create', input),
    listRuns: (query?: { courseId?: string; limit?: number; offset?: number }) =>
      ipcRenderer.invoke('studyMaterials:runs:list', query),
    getRun: (studyRunId: string) => ipcRenderer.invoke('studyMaterials:runs:get', studyRunId),
    confirmDestination: (input: StudyMaterialRunConfirmDestinationInput) =>
      ipcRenderer.invoke('studyMaterials:runs:confirmDestination', input),
    classifyFallback: (input?: StudyMaterialFallbackClassificationInput) =>
      ipcRenderer.invoke('studyMaterials:fallback:classify', input),
    evaluateQuality: (input: StudyMaterialQualityGateEvaluateInput) =>
      ipcRenderer.invoke('studyMaterials:quality:evaluate', input),
    createSource: (input: SourceDocumentCreateInput) => ipcRenderer.invoke('studyMaterials:sources:create', input),
    validateLocalSource: (input: StudyMaterialLocalSourceValidationInput) =>
      ipcRenderer.invoke('studyMaterials:sources:validateLocal', input),
    getSource: (sourceId: string) => ipcRenderer.invoke('studyMaterials:sources:get', sourceId),
    listSources: (query?: SourceDocumentListQuery) => ipcRenderer.invoke('studyMaterials:sources:list', query),
    createArtifact: (input: StudyMaterialArtifactCreateInput) =>
      ipcRenderer.invoke('studyMaterials:artifacts:create', input),
    listArtifacts: (studyRunId: string) => ipcRenderer.invoke('studyMaterials:artifacts:list', studyRunId),
    createCitation: (input: CitationSpanCreateInput) =>
      ipcRenderer.invoke('studyMaterials:citations:create', input),
    listCitations: (query: CitationSpanListQuery) => ipcRenderer.invoke('studyMaterials:citations:list', query),
    createIssue: (input: ExtractionIssueCreateInput) => ipcRenderer.invoke('studyMaterials:issues:create', input),
    listIssues: (query: ExtractionIssueListQuery) => ipcRenderer.invoke('studyMaterials:issues:list', query),
    createDiff: (input: StudyRunDiffCreateInput) => ipcRenderer.invoke('studyMaterials:diffs:create', input),
    getDiff: (studyRunId: string) => ipcRenderer.invoke('studyMaterials:diffs:get', studyRunId),
  },

  workflows: {
    list: () => ipcRenderer.invoke('workflows:list'),
    run: (workflowId: string, input?: unknown) => ipcRenderer.invoke('workflows:run', workflowId, input),
    generateFromIntent: (intent: string) => ipcRenderer.invoke('workflows:generateFromIntent', intent),
    getSkillMarkdown: (workflowId: string) => ipcRenderer.invoke('workflows:skill:get', workflowId),
    saveSkillMarkdown: (workflowId: string, skillMarkdown: string) =>
      ipcRenderer.invoke('workflows:skill:save', workflowId, skillMarkdown),
    duplicateWorkflow: (workflowId: string) => ipcRenderer.invoke('workflows:duplicate', workflowId),
    deleteWorkflow: (workflowId: string) => ipcRenderer.invoke('workflows:delete', workflowId),

    listRuns: (workflowId: string, limit?: number, offset?: number) =>
      ipcRenderer.invoke('workflows:runs:list', workflowId, limit, offset),
    listArtifacts: (workflowRunId: string) => ipcRenderer.invoke('workflows:artifacts:list', workflowRunId),

    getPins: () => ipcRenderer.invoke('workflows:pins:get'),
    setPinned: (workflowId: string, pinned: boolean) => ipcRenderer.invoke('workflows:pins:set', workflowId, pinned),

    getApprovalOptIn: (workflowId: string) => ipcRenderer.invoke('workflows:approvalOptIn:get', workflowId),
    setApprovalOptIn: (workflowId: string, optedIn: boolean) =>
      ipcRenderer.invoke('workflows:approvalOptIn:set', workflowId, optedIn),
    listApprovalOptIns: () => ipcRenderer.invoke('workflows:approvalOptIns:list'),
  },

  integrations: {
    listAuthStatuses: () => ipcRenderer.invoke('integrations:listAuthStatuses'),
    getMcpStatus: () => ipcRenderer.invoke('integrations:getMcpStatus'),
    reloadMcp: () => ipcRenderer.invoke('integrations:reloadMcp'),
    healthCheck: (service: string) => ipcRenderer.invoke('integrations:healthCheck', service),
    healthCheckOAuthBatch: () => ipcRenderer.invoke('integrations:healthCheckOAuthBatch'),

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

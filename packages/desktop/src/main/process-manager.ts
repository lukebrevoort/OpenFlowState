/**
 * FlowState Desktop App - Process Manager & OpenCode Bridge
 *
 * This module is responsible for:
 * 1. Managing the OpenCode server lifecycle (start/stop)
 * 2. Creating and maintaining the OpenCode SDK client
 * 3. Handling session state and communication
 * 4. Streaming events to the renderer process
 * 5. Configuring MCP servers with auth tokens
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { createOpencode, McpLocalConfig } from '@opencode-ai/sdk';
import { authManager } from './auth-manager.js';
import { configStore } from './config-store.js';
import { authManager } from './auth-manager.js';
import { oauthServer } from './oauth-server.js';
import { timelineStore } from './timeline-store.js';
import { normalizeOpenCodeEvent } from './timeline-normalizer.js';
import { approvalPolicyStore, type ApprovalReply } from './approval-policy-store.js';
import { taskStore } from './task-store.js';
import type { TaskRunRecord } from './task-types.js';

// Use the return type of createOpencode for proper typing
type OpenCodeInstance = Awaited<ReturnType<typeof createOpencode>>;

type OpenCodeErrorPayload = {
  error: string;
  message?: string;
  code?: string;
  provider?: string;
  model?: string;
  status?: number;
  retryAfter?: number;
  details?: unknown;
};

const parseErrorDetails = (message: string): Record<string, unknown> | null => {
  const trimmed = message.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  const match = trimmed.match(/Prompt failed:\s*(\{[\s\S]*\})/);
  if (match?.[1]) {
    try {
      return JSON.parse(match[1]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return null;
};

const extractErrorRecord = (raw: unknown): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  if (raw instanceof Error) {
    return parseErrorDetails(raw.message);
  }

  return raw as Record<string, unknown>;
};

const buildOpenCodeError = (
  raw: unknown,
  context?: { model?: string; provider?: string }
): OpenCodeErrorPayload => {
  const errorRecord = extractErrorRecord(raw) ?? (raw instanceof Error ? parseErrorDetails(raw.message) : null);
  const messageFromRecord =
    typeof errorRecord?.message === 'string'
      ? errorRecord.message
      : typeof errorRecord?.error === 'string'
        ? errorRecord.error
        : undefined;
  const fallbackMessage =
    typeof raw === 'string'
      ? raw
      : raw instanceof Error
        ? raw.message
        : errorRecord
          ? JSON.stringify(errorRecord)
          : 'OpenCode request failed.';
  const message = messageFromRecord ?? fallbackMessage;
  const details = errorRecord ?? parseErrorDetails(message) ?? undefined;
  const model =
    typeof details?.model === 'string'
      ? details.model
      : context?.model;
  const inferredProvider = model ? model.split('/')[0] : undefined;
  const provider =
    typeof details?.provider === 'string'
      ? details.provider
      : inferredProvider ?? context?.provider;
  const code = typeof details?.code === 'string' ? details.code : undefined;
  const status = typeof details?.status === 'number' ? details.status : undefined;
  const retryAfter =
    typeof details?.retryAfter === 'number'
      ? details.retryAfter
      : typeof details?.retry_after === 'number'
        ? details.retry_after
        : typeof details?.retry_after_ms === 'number'
          ? Math.ceil(details.retry_after_ms / 1000)
          : undefined;

  return {
    error: message,
    message,
    code,
    provider,
    model,
    status,
    retryAfter,
    details,
  };
};

const clampMessage = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
};

class ProcessManager {
  private instance: OpenCodeInstance | null = null;
  private isRunning: boolean = false;
  private activeSessionId: string | null = null;
  private eventStreamAbortController: AbortController | null = null;
  private flowstatePrompt: string | null = null;
  private timelineInitialized = false;
  private reauthCooldown = new Map<string, number>();
  private readonly reauthCooldownMs = 5 * 60 * 1000;
  private taskPromotionState = new Map<
    string,
    { promoted: boolean; completed: boolean; startAt: number; toolCalls: number; message?: string }
  >();

  // Batch timeline IPC events to reduce renderer churn during high-volume streams.
  private timelineEventBuffer: unknown[] = [];
  private timelineFlushTimer: NodeJS.Timeout | null = null;
  private timelineFlushWebContents: Electron.WebContents | null = null;
  private readonly timelineFlushIntervalMs = 75;
  private readonly timelineFlushMaxBatchSize = 250;

  private readonly defaultAgent = 'flowstate-assistant';

  private extractToolService(payload: unknown): string | null {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const candidates = [record?.service, record?.tool, record?.toolName, record?.name, record?.provider];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const normalized = candidate.toLowerCase().trim();
      if (!normalized) continue;
      const prefix = normalized.split(/[._\s-]/)[0];
      if (prefix && ['gmail', 'gcal', 'notion', 'canvas'].includes(prefix)) {
        return prefix;
      }
    }
    return null;
  }

  private extractErrorMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const record = payload as Record<string, unknown>;
    const candidates = [
      record.error,
      record.message,
      record.reason,
      record.summary,
      record.detail,
      (record.error && typeof record.error === 'object') ? (record.error as { message?: unknown }).message : undefined,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  }

  private isAuthErrorMessage(message: string | null): boolean {
    if (!message) return false;
    const normalized = message.toLowerCase();
    return (
      normalized.includes('unauthorized') ||
      normalized.includes('permission denied') ||
      normalized.includes('authentication') ||
      normalized.includes('invalid_grant') ||
      normalized.includes('token expired')
    );
  }

  private shouldAttemptReauth(service: string): boolean {
    const lastAttempt = this.reauthCooldown.get(service) ?? 0;
    return Date.now() - lastAttempt > this.reauthCooldownMs;
  }

  private async attemptReauth(service: string, webContents: Electron.WebContents, reason?: string) {
    if (!this.shouldAttemptReauth(service)) return;
    this.reauthCooldown.set(service, Date.now());

    try {
      const credentials = await authManager.getClientCredentials(service);
      if (!credentials?.clientId || !credentials?.clientSecret) {
        console.warn(`[Reauth] Missing stored credentials for ${service}`);
        webContents.send('auth:reauthRequired', {
          service,
          reason: reason ?? 'Authentication expired',
          missingCredentials: true,
        });
        return;
      }

      webContents.send('auth:reauthStarted', { service });
      await oauthServer.startOAuth(service, credentials.clientId, credentials.clientSecret);
      await this.reloadMcpConfig();
      webContents.send('auth:reauthSuccess', { service });
    } catch (error) {
      console.error(`[Reauth] Failed to re-authenticate ${service}:`, error);
      webContents.send('auth:reauthFailed', {
        service,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private inferTaskRunId(sessionId: string, payload: unknown, fallbackTaskId?: string): string {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const taskIdFromPayload = record && typeof record.taskId === 'string' && record.taskId.trim().length > 0 ? record.taskId : undefined;
    const candidate = taskIdFromPayload ?? fallbackTaskId;
    return candidate && candidate.trim().length > 0 ? candidate : sessionId;
  }

  private inferTaskRunKind(payload: unknown): TaskRunRecord['kind'] {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const workflowId = record
      ? (typeof record.workflowId === 'string' ? record.workflowId : typeof record.workflow_id === 'string' ? record.workflow_id : undefined)
      : undefined;
    return workflowId ? 'workflow' : 'chat';
  }

  private pickTaskText(
    payload: unknown,
    normalizedTitle: string,
    normalizedDetail?: string
  ): { title: string; description: string; summary?: string } {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const fromPayloadTitle = record && typeof record.title === 'string' ? record.title : undefined;
    const fromPayloadDescription = record && typeof record.description === 'string' ? record.description : undefined;
    const fromPayloadSummary = record && typeof record.summary === 'string' ? record.summary : undefined;
    const fromPayloadMessage = record && typeof record.message === 'string' ? record.message : undefined;
    const bestSummary = fromPayloadSummary ?? fromPayloadMessage;

    // Prefer user intent text over lifecycle labels like "Task promoted".
    const titleCandidate = fromPayloadTitle ?? (bestSummary ? clampMessage(bestSummary, 72) : undefined);
    const title = titleCandidate && titleCandidate.trim().length > 0 ? titleCandidate.trim() : normalizedTitle;

    const descriptionCandidate = fromPayloadDescription ?? bestSummary ?? normalizedDetail;
    const description =
      descriptionCandidate && descriptionCandidate.trim().length > 0
        ? clampMessage(descriptionCandidate.trim(), 240)
        : 'Working...';

    return {
      title,
      description,
      ...(bestSummary ? { summary: clampMessage(bestSummary, 600) } : {}),
    };
  }

  private handleTaskStoreFromNormalizedEvent(
    rawType: string,
    normalized: {
      event: { sessionId: string; taskId?: string; title: string; detail?: string; timestamp: number };
      payload?: unknown;
    },
    sessionId: string
  ): void {
    try {
      if (rawType === 'task.promoted') {
        const id = this.inferTaskRunId(sessionId, normalized.payload, normalized.event.taskId);
        const text = this.pickTaskText(normalized.payload, normalized.event.title, normalized.event.detail);

        const run: TaskRunRecord = {
          id,
          sessionId,
          kind: this.inferTaskRunKind(normalized.payload),
          title: text.title,
          description: text.description,
          status: 'running',
          startedAt: normalized.event.timestamp,
          updatedAt: normalized.event.timestamp,
          progress: 0,
        };
        taskStore.upsertRun(run);
        return;
      }

      if (rawType === 'task.completed') {
        const id = this.inferTaskRunId(sessionId, normalized.payload, normalized.event.taskId);
        const updated = taskStore.updateRun(id, { status: 'completed', updatedAt: normalized.event.timestamp, progress: 100 });
        if (!updated) {
          const text = this.pickTaskText(normalized.payload, 'Task', normalized.event.detail);
          taskStore.upsertRun({
            id,
            sessionId,
            kind: this.inferTaskRunKind(normalized.payload),
            title: text.title,
            description: text.description,
            status: 'completed',
            startedAt: normalized.event.timestamp,
            updatedAt: normalized.event.timestamp,
            progress: 100,
          });
        }
        return;
      }

      if (rawType === 'task.summary') {
        const id = this.inferTaskRunId(sessionId, normalized.payload, normalized.event.taskId);
        const summary = (() => {
          const record =
            normalized.payload && typeof normalized.payload === 'object'
              ? (normalized.payload as Record<string, unknown>)
              : null;
          const value = record && typeof record.summary === 'string' ? record.summary : undefined;
          return value ?? normalized.event.detail;
        })();

        if (summary && summary.trim().length > 0) {
          const updated = taskStore.updateRun(id, {
            summary: clampMessage(summary.trim(), 1200),
            updatedAt: normalized.event.timestamp,
          });

          if (!updated) {
            const text = this.pickTaskText(normalized.payload, 'Task', normalized.event.detail);
            taskStore.upsertRun({
              id,
              sessionId,
              kind: this.inferTaskRunKind(normalized.payload),
              title: text.title,
              description: text.description,
              status: 'running',
              startedAt: normalized.event.timestamp,
              updatedAt: normalized.event.timestamp,
              progress: 0,
              summary: clampMessage(summary.trim(), 1200),
            });
          }
        }
        return;
      }

      if (rawType === 'permission.asked' || rawType.startsWith('approval.') || rawType.startsWith('permission.')) {
        // Best-effort: if an approval request arrives while a task is active, surface it.
        const record =
          normalized.payload && typeof normalized.payload === 'object'
            ? (normalized.payload as Record<string, unknown>)
            : null;
        const explicitTaskId = record && typeof record.taskId === 'string' ? record.taskId : undefined;
        const candidateId = explicitTaskId ?? taskStore.getActiveRun({ sessionId })?.id;
        if (!candidateId) return;

        const existing = taskStore.getRun(candidateId);
        if (!existing) return;
        if (existing.status !== 'running' && existing.status !== 'starting') return;

        // Only treat explicit "asked"/"request" events as blocking.
        const isRequest = rawType.endsWith('.asked') || rawType.includes('asked') || rawType.includes('request');
        if (!isRequest) return;

        taskStore.updateRun(candidateId, { status: 'waiting_approval', updatedAt: normalized.event.timestamp });
      }
    } catch (error) {
      console.warn('[ProcessManager] Failed to update TaskStore:', error);
    }
  }

  constructor() {
    // Handle app shutdown
    app.on('before-quit', async () => {
      await this.stop();
    });
  }

  private enqueueTimelineEvent(webContents: Electron.WebContents, event: unknown) {
    if (!webContents || webContents.isDestroyed()) return;

    this.timelineFlushWebContents = webContents;
    this.timelineEventBuffer.push(event);

    if (this.timelineEventBuffer.length >= this.timelineFlushMaxBatchSize) {
      this.flushTimelineEvents();
      return;
    }

    if (this.timelineFlushTimer) return;

    this.timelineFlushTimer = setTimeout(() => {
      this.flushTimelineEvents();
    }, this.timelineFlushIntervalMs);
  }

  private flushTimelineEvents() {
    if (this.timelineFlushTimer) {
      clearTimeout(this.timelineFlushTimer);
      this.timelineFlushTimer = null;
    }

    const webContents = this.timelineFlushWebContents;
    if (!webContents || webContents.isDestroyed()) {
      this.timelineEventBuffer = [];
      this.timelineFlushWebContents = null;
      return;
    }

    if (this.timelineEventBuffer.length === 0) return;

    const events = this.timelineEventBuffer;
    this.timelineEventBuffer = [];

    if (events.length === 1) {
      webContents.send('timeline:event', events[0]);
      return;
    }

    webContents.send('timeline:event', { type: 'batch', events });
  }

  /**
   * Get the OpenCode client
   */
  get client() {
    return this.instance?.client ?? null;
  }

  /**
   * Check if OpenCode is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get the active session ID
   */
  get sessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * Get the path to MCP server packages
   */
  private getMcpPackagesDir(): string {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const appPath = app.getAppPath();
    
    let packagesDir: string;
    if (isDev) {
      // In development, go up from packages/desktop to packages/
      // app.getAppPath() may be packages/desktop or packages/desktop/dist/main
      const isDistMain = appPath.endsWith(`${path.sep}dist${path.sep}main`);
      packagesDir = isDistMain
        ? path.resolve(appPath, '../../..')
        : path.resolve(appPath, '..');
    } else {
      packagesDir = path.join(appPath, 'mcp-servers');
    }
    
    console.log('[ProcessManager] App path:', appPath);
    console.log('[ProcessManager] isDev:', isDev);
    console.log('[ProcessManager] MCP packages dir:', packagesDir);
    
    return packagesDir;
  }

  private getRepoRoot(): string {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const appPath = app.getAppPath();

    if (!isDev) {
      return appPath;
    }

    const isDistMain = appPath.endsWith(`${path.sep}dist${path.sep}main`);
    const packagesDir = isDistMain
      ? path.resolve(appPath, '../../..')
      : path.resolve(appPath, '..');
    return path.resolve(packagesDir, '..');
  }

  /**
   * Directory used for workspace-scoped OpenCode operations (find, command list, etc.)
   */
  getProjectDirectory(): string {
    return this.getRepoRoot();
  }

  private async updateAgentModelFiles(model: string): Promise<void> {
    const repoRoot = this.getRepoRoot();
    const agentPaths = [
      path.join(repoRoot, '.opencode', 'agent', 'flowstate.md'),
      path.join(repoRoot, 'agents', 'flowstate.md'),
    ];

    for (const agentPath of agentPaths) {
      try {
        if (!fs.existsSync(agentPath)) {
          continue;
        }
        const raw = await fsPromises.readFile(agentPath, 'utf8');
        const lines = raw.split('\n');
        const firstDelimiter = lines.indexOf('---');
        const secondDelimiter = lines.indexOf('---', firstDelimiter + 1);
        if (firstDelimiter === -1 || secondDelimiter === -1) {
          continue;
        }

        let updated = false;
        for (let i = firstDelimiter + 1; i < secondDelimiter; i += 1) {
          if (lines[i].trim().startsWith('model:')) {
            lines[i] = `model: ${model}`;
            updated = true;
            break;
          }
        }

        if (!updated) {
          lines.splice(secondDelimiter, 0, `model: ${model}`);
          updated = true;
        }

        if (updated) {
          await fsPromises.writeFile(agentPath, lines.join('\n'));
        }
      } catch (error) {
        console.warn('[ProcessManager] Failed to update agent model file:', agentPath, error);
      }
    }

    const configPath = path.join(repoRoot, 'flowstate.config.json');
    try {
      if (fs.existsSync(configPath)) {
        const rawConfig = await fsPromises.readFile(configPath, 'utf8');
        const config = JSON.parse(rawConfig) as { preferences?: { defaultProvider?: string } };
        if (config.preferences) {
          config.preferences.defaultProvider = model;
          await fsPromises.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
        }
      }
    } catch (error) {
      console.warn('[ProcessManager] Failed to update flowstate.config.json', error);
    }
  }

  /**
   * Verify an MCP server script exists
   */
  private verifyMcpServer(packagesDir: string, serverName: string): string | null {
    const serverPath = path.join(packagesDir, serverName, 'dist/index.js');
    const exists = fs.existsSync(serverPath);
    
    console.log(`[ProcessManager] MCP server ${serverName}: ${serverPath} (exists: ${exists})`);
    
    return exists ? serverPath : null;
  }

  /**
   * Build MCP configuration with auth tokens from auth-manager
   */
  private loadFlowstatePrompt(packagesDir: string): string | null {
    try {
      const agentsDir = path.resolve(packagesDir, '..', 'agents');
      const agentPath = path.join(agentsDir, 'flowstate.md');
      const raw = fs.readFileSync(agentPath, 'utf8');
      const parts = raw.split('---');
      if (parts.length >= 3) {
        return parts.slice(2).join('---').trim();
      }
      return raw.trim();
    } catch (error) {
      console.error('[ProcessManager] Failed to load FlowState agent prompt:', error);
      return null;
    }
  }

  private async buildMcpConfig(): Promise<Record<string, McpLocalConfig>> {
    const mcpConfig: Record<string, McpLocalConfig> = {};
    const packagesDir = this.getMcpPackagesDir();

    if (!this.flowstatePrompt) {
      this.flowstatePrompt = this.loadFlowstatePrompt(packagesDir);
    }

    // Gmail MCP
    const gmailToken = await authManager.getToken('gmail');
    const gmailCreds = await authManager.getClientCredentials('gmail');
    const gmailPath = this.verifyMcpServer(packagesDir, 'mcp-gmail');
    if (gmailToken && gmailPath) {
      mcpConfig['flowstate-gmail'] = {
        type: 'local',
        command: ['node', gmailPath],
        environment: {
          GMAIL_ACCESS_TOKEN: gmailToken.accessToken,
          GMAIL_REFRESH_TOKEN: gmailToken.refreshToken || '',
          GOOGLE_CLIENT_ID: gmailCreds?.clientId || '',
          GOOGLE_CLIENT_SECRET: gmailCreds?.clientSecret || '',
        },
        enabled: true,
        timeout: 10000,
      };
      console.log('[ProcessManager] Gmail MCP configured with token and credentials');
    } else if (gmailToken && !gmailPath) {
      console.error('[ProcessManager] Gmail token found but MCP server not built!');
    }

    // Google Calendar MCP
    const gcalToken = await authManager.getToken('gcal');
    const gcalCreds = await authManager.getClientCredentials('gcal');
    const gcalPath = this.verifyMcpServer(packagesDir, 'mcp-gcal');
    if (gcalToken && gcalPath) {
      mcpConfig['flowstate-gcal'] = {
        type: 'local',
        command: ['node', gcalPath],
        environment: {
          GCAL_ACCESS_TOKEN: gcalToken.accessToken,
          GCAL_REFRESH_TOKEN: gcalToken.refreshToken || '',
          GOOGLE_CLIENT_ID: gcalCreds?.clientId || '',
          GOOGLE_CLIENT_SECRET: gcalCreds?.clientSecret || '',
        },
        enabled: true,
        timeout: 10000,
      };
      console.log('[ProcessManager] Google Calendar MCP configured with token and credentials');
    } else if (gcalToken && !gcalPath) {
      console.error('[ProcessManager] GCal token found but MCP server not built!');
    }

    // Notion MCP (remote package via npx)
    const notionToken = await authManager.getToken('notion');
    if (notionToken) {
      mcpConfig['notion'] = {
        type: 'local',
        command: ['npx', '-y', '@notionhq/notion-mcp-server'],
        environment: {
          NOTION_TOKEN: notionToken.accessToken,
        },
        enabled: true,
        timeout: 10000,
      };
      console.log('[ProcessManager] Notion MCP configured with token');
    }

    // System MCP (no auth needed)
    const systemPath = this.verifyMcpServer(packagesDir, 'mcp-system');
    if (systemPath) {
      mcpConfig['flowstate-system'] = {
        type: 'local',
        command: ['node', systemPath],
        enabled: true,
        timeout: 10000,
      };
      console.log('[ProcessManager] System MCP configured');
    }

    // Canvas LMS MCP (token or browser session auth)
    const canvasToken = await authManager.getToken('canvas');
    const canvasPath = this.verifyMcpServer(packagesDir, 'mcp-canvas');
    if (canvasToken && canvasPath) {
      const canvasAuthMode = canvasToken.additionalData?.canvasAuthMode;
      const useBrowserAuth = canvasAuthMode === 'browser';

      mcpConfig['flowstate-canvas'] = {
        type: 'local',
        command: ['node', canvasPath],
        environment: {
          CANVAS_API_URL: canvasToken.additionalData?.canvasApiUrl || '',
          CANVAS_AUTH_MODE: useBrowserAuth ? 'browser' : 'token',
          ...(useBrowserAuth
            ? {
                CANVAS_STORAGE_STATE_PATH:
                  canvasToken.additionalData?.canvasStorageStatePath || '',
              }
            : {
                CANVAS_API_TOKEN: canvasToken.accessToken,
              }),
        },
        enabled: true,
        timeout: 10000,
      };
      console.log(
        `[ProcessManager] Canvas LMS MCP configured (${useBrowserAuth ? 'browser' : 'token'} auth)`
      );
    } else if (canvasToken && !canvasPath) {
      console.error('[ProcessManager] Canvas token found but MCP server not built!');
    }

    console.log('[ProcessManager] Final MCP config keys:', Object.keys(mcpConfig));
    return mcpConfig;
  }

  /**
   * Start the OpenCode server and client
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('OpenCode already running');
      return;
    }

    console.log('Starting OpenCode server...');

    try {
      const selectedModel = configStore.get()?.provider.default ?? 'opencode/grok-code';
      await this.updateAgentModelFiles(selectedModel);

      // Build MCP configuration with auth tokens
      const mcpConfig = await this.buildMcpConfig();
      console.log('[ProcessManager] MCP servers configured:', Object.keys(mcpConfig));
      console.log('[ProcessManager] Full MCP config:', JSON.stringify(mcpConfig, null, 2));

      // Start OpenCode (both server and client)
      // Using port 0 lets the OS assign an available port
      console.log('[ProcessManager] Using OpenCode model:', selectedModel);
      this.instance = await createOpencode({
        hostname: '127.0.0.1',
        port: 0,
        timeout: 30000, // 30 second timeout for server start
        config: {
          model: selectedModel,
          // Configure MCP servers with tokens
          mcp: mcpConfig,
        },
      });

      this.isRunning = true;
      console.log(`OpenCode server started at ${this.instance.server.url}`);

      // Don't eagerly create a session with a generic title.
      // The first user interaction (or explicit "new conversation") will create the session,
      // allowing OpenCode/agents to auto-title it based on the actual conversation.

      // Check MCP status after a short delay to let servers connect
      setTimeout(() => this.logMcpStatus(), 2000);

      // Initialize timeline storage
      if (!this.timelineInitialized) {
        timelineStore.configure({ dataDir: configStore.getDataDir() });
        timelineStore.initialize();
        this.timelineInitialized = true;
      }


    } catch (error) {
      console.error('Failed to start OpenCode:', error);
      this.isRunning = false;
      this.instance = null;
      throw error;
    }
  }

  /**
   * Log MCP server status (for debugging)
   */
  async logMcpStatus(): Promise<void> {
    if (!this.instance?.client) {
      console.warn('[ProcessManager] Cannot check MCP status: client not available');
      return;
    }

    try {
      const result = await this.instance.client.mcp.status({});
      console.log('[ProcessManager] MCP Status:', JSON.stringify(result.data, null, 2));
      
      // Log any failed servers
      if (result.data) {
        for (const [name, status] of Object.entries(result.data)) {
          if (status.status === 'failed') {
            console.error(`[ProcessManager] MCP server ${name} FAILED:`, (status as { error?: string }).error);
          } else if (status.status === 'connected') {
            console.log(`[ProcessManager] MCP server ${name} connected successfully`);
          }
        }
      }
    } catch (error) {
      console.error('[ProcessManager] Error checking MCP status:', error);
    }
  }

  /**
   * Get MCP server status
   */
  async getMcpStatus(): Promise<Record<string, unknown> | null> {
    if (!this.instance?.client) {
      return null;
    }

    try {
      const result = await this.instance.client.mcp.status({});
      return result.data || null;
    } catch (error) {
      console.error('[ProcessManager] Error getting MCP status:', error);
      return null;
    }
  }

  /**
   * Reload MCP configuration (call after connecting/disconnecting integrations)
   * Uses the mcp.add() API for dynamic server management
   */
  async reloadMcpConfig(): Promise<void> {
    if (!this.instance?.client) {
      console.warn('[ProcessManager] Cannot reload MCP config: OpenCode not running');
      return;
    }

    try {
      console.log('[ProcessManager] Reloading MCP configuration...');
      
      const mcpConfig = await this.buildMcpConfig();
      
      // Add each MCP server individually using the mcp.add() API
      for (const [name, config] of Object.entries(mcpConfig)) {
        try {
          console.log(`[ProcessManager] Adding MCP server: ${name}`);
          const result = await this.instance.client.mcp.add({
            body: {
              name,
              config,
            },
          });
          console.log(`[ProcessManager] MCP server ${name} add result:`, JSON.stringify(result.data, null, 2));
        } catch (addError) {
          console.error(`[ProcessManager] Failed to add MCP server ${name}:`, addError);
        }
      }
      
      // Log final status
      await this.logMcpStatus();
      
      console.log('[ProcessManager] MCP config reload complete');
    } catch (error) {
      console.error('[ProcessManager] Failed to reload MCP config:', error);
    }
  }

  /**
   * Stop the OpenCode server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.instance) {
      return;
    }

    console.log('Stopping OpenCode server...');

    // Stop event stream
    if (this.eventStreamAbortController) {
      this.eventStreamAbortController.abort();
      this.eventStreamAbortController = null;
    }

    // Flush any remaining timeline events before shutdown.
    this.flushTimelineEvents();

    try {
      this.instance.server.close();
      console.log('OpenCode server stopped');
    } catch (error) {
      console.error('Error stopping OpenCode:', error);
    } finally {
      this.instance = null;
      this.isRunning = false;
      this.activeSessionId = null;
    }
  }

  /**
   * Create a new chat session
   */
  async createSession(title?: string): Promise<string> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    try {
      const result = await this.instance.client.session.create(
        title && title.trim().length
          ? {
              body: {
                title: title.trim(),
              },
            }
          : {}
      );

      if (result.error) {
        throw new Error(`Failed to create session: ${JSON.stringify(result.error)}`);
      }

      this.activeSessionId = result.data?.id ?? null;

      console.log(`Created new session: ${this.activeSessionId}`);
      return this.activeSessionId!;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Send a message to the active session and get a response
   */
  async sendMessage(content: string, webContents?: Electron.WebContents): Promise<{
    content: string;
    parts: Array<{ type: string; text?: string }>;
  }> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    // Ensure we have a session
    if (!this.activeSessionId) {
      await this.createSession();
    }

    const systemPrompt = this.flowstatePrompt ?? undefined;

    this.startTaskPromotionTracking(this.activeSessionId!, { message: content });

    // Notify renderer that we're processing
    if (webContents) {
      webContents.send('opencode:progress', { status: 'thinking', sessionId: this.activeSessionId });
    }

    try {
      const result = await this.instance.client.session.prompt({
        path: { id: this.activeSessionId! },
        body: {
          agent: this.defaultAgent,
          system: systemPrompt,
          parts: [{ type: 'text', text: content }],
        },
      });

      console.log('[ProcessManager] Prompt result received:', result.data ? 'YES' : 'NO');
      if (result.error) {
        console.error('[ProcessManager] Prompt error:', JSON.stringify(result.error, null, 2));
        const errorPayload = buildOpenCodeError(result.error, {
          model: configStore.get()?.provider.default,
        });
        const thrown = new Error(errorPayload.error);
        (thrown as Error & { opencode?: OpenCodeErrorPayload }).opencode = errorPayload;
        throw thrown;
      }

      if (!result.data) {
        console.error('[ProcessManager] No data in prompt result!');
        throw new Error('No data in prompt result');
      }

      // Extract text content from parts
      const parts = result.data?.parts ?? [];
      console.log('[ProcessManager] Response parts count:', parts.length);
      const textContent = parts
        .filter((p: { type: string }) => p.type === 'text')
        .map((p: { type: string; text?: string }) => p.text || '')
        .join('') || '';

      console.log('[ProcessManager] Response text length:', textContent.length);
      if (textContent.length > 0) {
        console.log('[ProcessManager] Response preview:', textContent.substring(0, 100));
      }

      // Send the complete message to renderer
      const assistantMessage = {
        id: (result.data as { info?: { id?: string } })?.info?.id || Date.now().toString(),
        role: 'assistant' as const,
        content: textContent || ' ',
        timestamp: new Date().toISOString(),
        parts: parts,
      };

      if (webContents) {
        webContents.send('opencode:message', assistantMessage);
        webContents.send('opencode:progress', { status: 'idle', sessionId: this.activeSessionId });
        this.finishTaskTracking(this.activeSessionId!, webContents, textContent);
      }

      return {
        content: textContent,
        parts: parts,
      };
    } catch (error) {
      console.error('Error sending message:', error);

      const errorPayload =
        (error as Error & { opencode?: OpenCodeErrorPayload }).opencode ??
        buildOpenCodeError(error, { model: configStore.get()?.provider.default });

      if (webContents) {
        webContents.send('opencode:progress', { status: 'error', sessionId: this.activeSessionId });
        webContents.send('opencode:error', errorPayload);
      }

      throw error;
    }
  }

  /**
   * Send a message and stream the response to the renderer
   */
  async streamMessage(content: string, webContents: Electron.WebContents): Promise<void> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    // Ensure we have a session
    if (!this.activeSessionId) {
      await this.createSession();
    }

    const systemPrompt = this.flowstatePrompt ?? undefined;

    this.startTaskPromotionTracking(this.activeSessionId!, { message: content });

    // Notify renderer that we're processing
    webContents.send('opencode:progress', { status: 'thinking', sessionId: this.activeSessionId });

    try {
      // Send the prompt
      console.log('[ProcessManager] Calling session.prompt()...');
      const result = await this.instance.client.session.prompt({
        path: { id: this.activeSessionId! },
        body: {
          agent: this.defaultAgent,
          system: systemPrompt,
          parts: [{ type: 'text', text: content }],
        },
      });

      console.log('[ProcessManager] session.prompt() returned:', result.data ? 'YES' : 'NO');
      if (result.error) {
        console.error('[ProcessManager] Prompt error:', JSON.stringify(result.error, null, 2));
        const errorPayload = buildOpenCodeError(result.error, {
          model: configStore.get()?.provider.default,
        });
        const thrown = new Error(errorPayload.error);
        (thrown as Error & { opencode?: OpenCodeErrorPayload }).opencode = errorPayload;
        throw thrown;
      }

      if (!result.data) {
        console.error('[ProcessManager] No data in prompt result!');
        throw new Error('No data in prompt result');
      }

      // Extract text content from parts
      const parts = result.data?.parts ?? [];
      console.log('[ProcessManager] Response parts count:', parts.length);
      const textContent = parts
        .filter((p: { type: string }) => p.type === 'text')
        .map((p: { type: string; text?: string }) => p.text || '')
        .join('') || '';

      console.log('[ProcessManager] Response text length:', textContent.length);
      if (textContent.length > 0) {
        console.log('[ProcessManager] Response preview:', textContent.substring(0, 100));
      }

      this.finishTaskTracking(this.activeSessionId!, webContents, textContent);

      // Send the complete message to renderer
      const assistantMessage = {
        id: (result.data as { info?: { id?: string } })?.info?.id || Date.now().toString(),
        role: 'assistant' as const,
        content: textContent || ' ',
        timestamp: new Date().toISOString(),
        parts: parts,
      };

      console.log('[ProcessManager] Sending message to renderer:', assistantMessage.id, 'content length:', assistantMessage.content.length);
      webContents.send('opencode:message', assistantMessage);
      console.log('[ProcessManager] Message sent to renderer successfully');
      webContents.send('opencode:progress', { status: 'idle', sessionId: this.activeSessionId });

    } catch (error) {
      console.error('Error in streamMessage:', error);
      const errorPayload =
        (error as Error & { opencode?: OpenCodeErrorPayload }).opencode ??
        buildOpenCodeError(error, { model: configStore.get()?.provider.default });
      webContents.send('opencode:error', errorPayload);
      webContents.send('opencode:progress', { status: 'error', sessionId: this.activeSessionId });
      throw error;
    }
  }

  /**
   * Start the global event stream from OpenCode
   * This forwards relevant events to the renderer process
   */
  async startEventStream(webContents: Electron.WebContents): Promise<void> {
    if (!this.instance?.client) {
      console.warn('Cannot start event stream: OpenCode not running');
      return;
    }

    // Abort any existing stream
    if (this.eventStreamAbortController) {
      this.eventStreamAbortController.abort();
    }

    this.eventStreamAbortController = new AbortController();

    console.log('Starting OpenCode event stream...');

    const extractRequestId = (properties: unknown): string | undefined => {
      if (!properties || typeof properties !== 'object') return undefined;
      const record = properties as Record<string, unknown>;
      const candidates = [record.requestID, record.requestId, record.request_id, record.id];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          return candidate;
        }
      }
      return undefined;
    };

    // Run event stream in background
    (async () => {
      try {
        // Use the event.subscribe() method which returns a ServerSentEventsResult
        const sseResult = await this.instance!.client.event.subscribe();

        // The result has a 'stream' property which is an AsyncGenerator
        for await (const event of sseResult.stream) {
          // Check if we should stop
          if (this.eventStreamAbortController?.signal.aborted) {
            break;
          }

          // Type the event
          const typedEvent = event as { type?: string; properties?: unknown };

          // Forward relevant events to renderer
          if (typedEvent.type) {
            webContents.send('opencode:event', {
              type: typedEvent.type,
              data: typedEvent.properties,
            });

            const payloadSessionId =
              typeof typedEvent.properties === 'object' && typedEvent.properties
                ? ((typedEvent.properties as { sessionID?: string; sessionId?: string }).sessionID ??
                    (typedEvent.properties as { sessionID?: string; sessionId?: string }).sessionId)
                : undefined;
            const sessionId = payloadSessionId ?? this.activeSessionId ?? 'unknown-session';

            const requestId = extractRequestId(typedEvent.properties);
            if (requestId && sessionId !== 'unknown-session') {
              approvalPolicyStore.trackRequest(requestId, sessionId);

              if (typedEvent.type === 'permission.asked' && approvalPolicyStore.isSessionAlwaysApprove(sessionId)) {
                this.replyApproval(requestId, 'always').catch((error) => {
                  console.warn('[ProcessManager] Failed to auto-approve permission request:', error);
                });
              }
            }

            const errorMessage = this.extractErrorMessage(typedEvent.properties);
            const toolService = this.extractToolService(typedEvent.properties);
            const isToolResultEvent =
              typedEvent.type.includes('tool') &&
              (typedEvent.type.includes('result') || typedEvent.type.includes('error') || typedEvent.type.includes('failed'));
            if (isToolResultEvent && toolService && this.isAuthErrorMessage(errorMessage)) {
              void this.attemptReauth(toolService, webContents, errorMessage ?? undefined);
            }

            const normalized = normalizeOpenCodeEvent(
              { type: typedEvent.type, properties: typedEvent.properties },
              sessionId
            );
            if (normalized) {
              this.handleTaskStoreFromNormalizedEvent(typedEvent.type, normalized, sessionId);
              const isApprovalEvent =
                normalized.event.kind === 'approval_request' || normalized.event.kind === 'approval_response';
              const shouldStore =
                isApprovalEvent ||
                (this.taskPromotionState.has(sessionId) && (payloadSessionId || sessionId === this.activeSessionId));
              if (!shouldStore) {
                continue;
              }
              try {
                const stored = await timelineStore.appendWithPayload({
                  ...normalized.event,
                  redacted: normalized.redacted,
                  payload: normalized.payload,
                });
                this.enqueueTimelineEvent(webContents, stored);
                this.trackTaskPromotion(sessionId, normalized.event, webContents);
              } catch (error) {
                console.warn('[ProcessManager] Failed to persist timeline event:', error);
              }
            }
          }


        }

        // Flush any remaining events if the stream ends naturally.
        this.flushTimelineEvents();
      } catch (error) {
        if (!this.eventStreamAbortController?.signal.aborted) {
          console.error('Event stream error:', error);
        }

        // Attempt to flush anything queued before exiting.
        this.flushTimelineEvents();
      }
    })();
  }

  /**
   * Get session history
   */
  async getSessionMessages(): Promise<Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
  }>> {
    if (!this.instance?.client || !this.activeSessionId) {
      return [];
    }

    try {
      const result = await this.instance.client.session.messages({
        path: { id: this.activeSessionId },
      });

      if (result.error || !result.data) {
        return [];
      }

      return (result.data as Array<{ info: { id: string; role: string; createdAt?: string; sessionId?: string }; parts: Array<{ type: string; text?: string }> }>).map((msg) => ({
        id: msg.info.id,
        role: msg.info.role,
        content: (msg.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text || '')
          .join('')) || ' ',
        timestamp: msg.info.createdAt || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error getting session messages:', error);
      return [];
    }
  }

  /**
   * Get timeline events for current session
   */
  async getTimelineEventsForSession(sessionId: string, limit: number = 100, offset: number = 0) {
    if (!sessionId) {
      return [];
    }

    return timelineStore.list({
      sessionId,
      limit,
      offset,
    });
  }

  /**
   * Resolve a timeline payload from blob storage
   */
  async getTimelinePayload(ref: string) {
    return timelineStore.resolvePayload(ref);
  }

  private trackTaskPromotion(
    sessionId: string,
    event: { kind: string; title: string; detail?: string; timestamp: number },
    webContents: Electron.WebContents
  ) {
    const state = this.taskPromotionState.get(sessionId);
    if (!state) {
      return;
    }

    if (event.kind === 'tool_call') {
      state.toolCalls += 1;
    }

    if (event.kind === 'status' && event.title === 'Task promoted') {
      state.promoted = true;
    }

    if (event.kind === 'status' && event.title === 'Task completed') {
      state.completed = true;
    }

    const elapsed = Date.now() - state.startAt;
    const shouldPromote = !state.promoted && (elapsed > 15000 || state.toolCalls >= 2);

    if (shouldPromote) {
      state.promoted = true;
      const promotion = normalizeOpenCodeEvent(
        {
          type: 'task.promoted',
          properties: {
            sessionId,
            taskId: `task-${sessionId}`,
            summary: state.message ?? event.detail ?? 'Task promoted from long-running request',
          },
        },
        sessionId
      );
      if (promotion) {
        this.handleTaskStoreFromNormalizedEvent('task.promoted', promotion, sessionId);
        timelineStore.appendWithPayload({
          ...promotion.event,
          redacted: promotion.redacted,
          payload: promotion.payload,
        }).then((stored) => {
          this.enqueueTimelineEvent(webContents, stored);
        }).catch((error) => {
          console.warn('[ProcessManager] Failed to persist promotion event:', error);
        });
      }
    }

    this.taskPromotionState.set(sessionId, state);
  }

  private clearTaskTracking(sessionId: string) {
    this.taskPromotionState.delete(sessionId);
  }

  private finishTaskTracking(sessionId: string, webContents: Electron.WebContents, detail?: string) {
    const state = this.taskPromotionState.get(sessionId);
    if (!state || state.completed) {
      return;
    }

    // If the request never met promotion criteria, do not create Task lifecycle events.
    // This keeps fast chat responses ("hello") from showing up as stuck tasks.
    if (!state.promoted) {
      const responseEvent = {
        id: `status-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        sessionId,
        timestamp: Date.now(),
        kind: 'status' as const,
        title: 'Response sent',
        detail: detail ? clampMessage(detail, 120) : 'Ready for the next request',
      };

      timelineStore.appendWithPayload(responseEvent).then((stored) => {
        this.enqueueTimelineEvent(webContents, stored);
      }).catch((error) => {
        console.warn('[ProcessManager] Failed to persist response event:', error);
      });

      this.clearTaskTracking(sessionId);
      return;
    }

    state.completed = true;

    const completion = normalizeOpenCodeEvent(
      {
        type: 'task.completed',
        properties: {
          sessionId,
          taskId: `task-${sessionId}`,
          summary: detail ?? 'Task completed',
        },
      },
      sessionId
    );
    if (completion) {
      this.handleTaskStoreFromNormalizedEvent('task.completed', completion, sessionId);
      timelineStore.appendWithPayload({
        ...completion.event,
        redacted: completion.redacted,
        payload: completion.payload,
      }).then((stored) => {
        this.enqueueTimelineEvent(webContents, stored);
      }).catch((error) => {
        console.warn('[ProcessManager] Failed to persist completion event:', error);
      });
    }

    const summary = normalizeOpenCodeEvent(
      {
        type: 'task.summary',
        properties: {
          sessionId,
          taskId: `task-${sessionId}`,
          summary: detail ?? 'Task summary available',
        },
      },
      sessionId
    );
    if (summary) {
      this.handleTaskStoreFromNormalizedEvent('task.summary', summary, sessionId);
      timelineStore.appendWithPayload({
        ...summary.event,
        redacted: summary.redacted,
        payload: summary.payload,
      }).then((stored) => {
        this.enqueueTimelineEvent(webContents, stored);
      }).catch((error) => {
        console.warn('[ProcessManager] Failed to persist summary event:', error);
      });
    }

    this.clearTaskTracking(sessionId);
  }

  private startTaskPromotionTracking(sessionId: string, payload?: { message?: string }) {
    const existing = this.taskPromotionState.get(sessionId);
    if (existing) {
      existing.startAt = Date.now();
      existing.toolCalls = 0;
      existing.promoted = false;
      existing.completed = false;
      this.taskPromotionState.set(sessionId, existing);
      return;
    }

    this.taskPromotionState.set(sessionId, {
      promoted: false,
      completed: false,
      startAt: Date.now(),
      toolCalls: 0,
      message: payload?.message,
    });
  }


  /**
   * List all sessions
   */
  async listSessions(): Promise<Array<{ id: string; title: string }>> {
    if (!this.instance?.client) {
      return [];
    }

    try {
      const result = await this.instance.client.session.list();
      
      if (result.error || !result.data) {
        return [];
      }

      return (result.data as Array<{ id: string; title?: string }>).map((s) => ({
        id: s.id,
        title: s.title || 'Untitled Session',
      }));
    } catch (error) {
      console.error('Error listing sessions:', error);
      return [];
    }
  }

  /**
   * Switch to a different session
   */
  async switchSession(sessionId: string): Promise<void> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    // Verify session exists
    const result = await this.instance.client.session.get({
      path: { id: sessionId },
    });

    if (result.error) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.activeSessionId = sessionId;
    console.log(`Switched to session: ${sessionId}`);
  }

  /**
   * Health check - verify the server is responding
   */
  async healthCheck(): Promise<{ healthy: boolean; version?: string }> {
    if (!this.instance?.client) {
      return { healthy: false };
    }

    try {
      // Use session.list as a health check since there's no dedicated health endpoint
      const result = await this.instance.client.session.list();
      return {
        healthy: !result.error,
        version: 'unknown', // SDK doesn't expose version
      };
    } catch {
      return { healthy: false };
    }
  }

  async replyApproval(requestId: string, reply: ApprovalReply): Promise<void> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    if (!requestId || typeof requestId !== 'string') {
      throw new Error('Invalid approval request id');
    }

    const mappedReply: 'once' | 'always' | 'reject' = reply === 'deny' ? 'reject' : reply;

    const sessionId = approvalPolicyStore.getSessionIdForRequest(requestId) ?? this.activeSessionId ?? undefined;
    if (reply === 'always' && sessionId) {
      approvalPolicyStore.setSessionAlwaysApprove(sessionId, true);
    }

    const permissionClient = (this.instance.client as unknown as { permission?: { reply: (input: { requestID: string; reply: 'once' | 'always' | 'reject' }) => Promise<{ error?: unknown }> } }).permission;
    if (!permissionClient) {
      throw new Error('OpenCode permission API unavailable');
    }

    const result = await permissionClient.reply({
      requestID: requestId,
      reply: mappedReply,
    });

    if (result.error) {
      throw new Error(`Failed to reply to approval request: ${JSON.stringify(result.error)}`);
    }
  }
}

export const processManager = new ProcessManager();
export default processManager;

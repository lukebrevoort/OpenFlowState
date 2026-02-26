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

import { app, BrowserWindow, Notification } from 'electron';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { createOpencode, McpLocalConfig, McpRemoteConfig } from '@opencode-ai/sdk';
import { userProfile, type UserProfile } from '@flowstate/core';
import { authManager } from './auth-manager.js';
import { configStore } from './config-store.js';
import { oauthServer } from './oauth-server.js';
import { timelineStore } from './timeline-store.js';
import { normalizeOpenCodeEvent } from './timeline-normalizer.js';
import { normalizeCustomMcpServers, type OpencodeMcpConfig } from './mcp-config.js';
import { approvalPolicyStore, type ApprovalReply } from './approval-policy-store.js';
import { approvalsAuditStore } from './approvals-audit-store.js';
import { deriveApprovalBlockingPatch, isApprovalEventType } from './approval-blocking.js';
import { taskStore } from './task-store.js';
import { workflowRunStore } from './workflow-run-store.js';
import { clampText, parseResponseHeader, requiresUserInput } from './workflow-response-utils.js';
import type { TaskRunRecord } from './task-types.js';
import { heuristicTaskTitleFromPrompt, sanitizeTaskTitle, shouldAttemptLlmTitle } from './task-title.js';
import { buildFlowstatePromptCandidatePaths } from './process-manager-paths.js';
import { ensureOpencodeCliAvailable } from './opencode-cli.js';

// Use the return type of createOpencode for proper typing
type OpenCodeInstance = Awaited<ReturnType<typeof createOpencode>>;

const PROCESS_MANAGER_DIR = path.dirname(fileURLToPath(import.meta.url));

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

const redactSecrets = (input: string): string => {
  const patterns: RegExp[] = [
    /\bsk-[A-Za-z0-9]{16,}\b/g,
    /\brk-[A-Za-z0-9]{16,}\b/g,
    /\bAIza[0-9A-Za-z\-_]{30,}\b/g,
    /\bghp_[A-Za-z0-9]{30,}\b/g,
    /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
    /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g,
    /\bBearer\s+[A-Za-z0-9_\-\.~=]{20,}\b/gi,
    /\bBasic\s+[A-Za-z0-9_\-\.~=]{20,}\b/gi,
  ];

  let redacted = input;
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }

  redacted = redacted.replace(
    /(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s\n]{8,}/gi,
    (_m, key) => `${String(key)}=[REDACTED]`
  );

  if (redacted.length > 2000) {
    redacted = `${redacted.slice(0, 2000)}...`;
  }

  return redacted;
};

class ProcessManager {
  private instance: OpenCodeInstance | null = null;
  private isRunning: boolean = false;
  private lastStartError: string | null = null;
  private packagedWorkspaceDirectory: string | null = null;
  private activeSessionId: string | null = null;
  private eventStreamAbortController: AbortController | null = null;
  private eventStreamWebContents: Electron.WebContents | null = null;
  private flowstatePrompt: string | null = null;
  private timelineInitialized = false;
  private mcpDiagnostics: {
    updatedAt: number;
    errors: Record<string, string>;
    skipped: Record<string, string>;
  } = {
    updatedAt: Date.now(),
    errors: {},
    skipped: {},
  };

  private redactMcpConfigForLog(config: OpencodeMcpConfig): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [name, entry] of Object.entries(config)) {
      if (!entry || typeof entry !== 'object') {
        redacted[name] = entry as unknown;
        continue;
      }

      const type = (entry as { type?: string }).type;
      if (type === 'local') {
        const env = (entry as McpLocalConfig).environment;
        const environment = env
          ? Object.fromEntries(Object.keys(env).map((key) => [key, '[redacted]']))
          : undefined;
        redacted[name] = {
          ...(entry as McpLocalConfig),
          ...(environment ? { environment } : {}),
        };
        continue;
      }

      if (type === 'remote') {
        const hdrs = (entry as McpRemoteConfig).headers;
        const headers = hdrs
          ? Object.fromEntries(Object.keys(hdrs).map((key) => [key, '[redacted]']))
          : undefined;
        redacted[name] = {
          ...(entry as McpRemoteConfig),
          ...(headers ? { headers } : {}),
        };
        continue;
      }

      redacted[name] = entry as unknown;
    }

    return redacted;
  }
  private reauthCooldown = new Map<string, number>();
  private readonly reauthCooldownMs = 5 * 60 * 1000;

  private approvalNotificationSeenAt = new Map<string, number>();
  private readonly approvalNotificationDedupeTtlMs = 60 * 60 * 1000;
  private taskCompletionNotificationSeenAt = new Map<string, number>();
  private readonly taskCompletionNotificationDedupeTtlMs = 60 * 60 * 1000;

  // Sessions whose timeline events should be persisted, even when not active.
  // This is used by workflow sessions so the Tasks UI can load their timelines.
  private persistedTimelineSessions = new Set<string>();
  private taskPromotionState = new Map<
    string,
    { promoted: boolean; completed: boolean; startAt: number; toolCalls: number; message?: string }
  >();

  private readonly reliabilityMaxAttempts = 5;
  private readonly reliabilityBaseBackoffMs = 1000;
  private readonly reliabilityMaxBackoffMs = 15000;
  private reliabilityRetryState = new Map<
    string,
    { requestId: string; attempt: number; startedAt: number; lastError?: OpenCodeErrorPayload }
  >();
  private activePromptAbortController: AbortController | null = null;
  private activePromptSessionId: string | null = null;

  private createAbortError(message: string = 'Request cancelled'): Error {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
  }

  private isAbortLikeError(error: unknown): boolean {
    if (!error) return false;

    if (error instanceof Error) {
      const name = error.name.toLowerCase();
      const message = error.message.toLowerCase();
      if (name.includes('abort') || name.includes('cancel')) return true;
      if (message.includes('abort') || message.includes('cancel')) return true;
      if (message.includes('request superseded')) return true;
    }

    if (typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const code = typeof record.code === 'string' ? record.code.toLowerCase() : '';
      const message = typeof record.message === 'string' ? record.message.toLowerCase() : '';
      if (code.includes('abort') || code.includes('cancel')) return true;
      if (message.includes('abort') || message.includes('cancel')) return true;
    }

    if (typeof error === 'string') {
      const text = error.toLowerCase();
      return text.includes('abort') || text.includes('cancel') || text.includes('request superseded');
    }

    return false;
  }

  private getTimelineWebContents(explicit?: Electron.WebContents): Electron.WebContents | null {
    const candidate = explicit ?? this.eventStreamWebContents;
    if (!candidate || candidate.isDestroyed()) return null;
    return candidate;
  }

  private computeReliabilityBackoffMs(nextAttempt: number): number {
    // nextAttempt is 2..N (attempt 1 has no backoff).
    const exponent = Math.max(0, nextAttempt - 2);
    const value = this.reliabilityBaseBackoffMs * 2 ** exponent;
    return Math.min(this.reliabilityMaxBackoffMs, Math.max(0, Math.trunc(value)));
  }

  private isRetryableIntegrationFailure(errorPayload: OpenCodeErrorPayload): boolean {
    const message = (errorPayload.message ?? errorPayload.error ?? '').toLowerCase();
    const code = (errorPayload.code ?? '').toLowerCase();
    const details = (() => {
      try {
        return JSON.stringify(errorPayload.details ?? {});
      } catch {
        return '';
      }
    })().toLowerCase();
    const haystack = `${code} ${message} ${details}`;

    const mentionsTooling = haystack.includes('mcp') || haystack.includes('tool');
    if (!mentionsTooling) return false;

    const transientMarkers = [
      'disconnected',
      'disconnect',
      'connection',
      'socket',
      'hang up',
      'timeout',
      'timed out',
      'econnreset',
      'econnrefused',
      'epipe',
      'eof',
      'broken pipe',
      'stream closed',
      'transport',
      'temporarily unavailable',
    ];
    if (transientMarkers.some((marker) => haystack.includes(marker))) return true;

    const status = errorPayload.status;
    if (status && [502, 503, 504].includes(status)) return true;

    return false;
  }

  private async emitReliabilityTimelineEvent(args: {
    type: 'flowstate.reliability.retry' | 'flowstate.reliability.failed';
    sessionId: string;
    attempt: number;
    maxAttempts: number;
    waitMs?: number;
    reason?: string;
    action?: string;
    error?: OpenCodeErrorPayload;
    webContents?: Electron.WebContents;
  }): Promise<void> {
    const webContents = this.getTimelineWebContents(args.webContents);
    if (!webContents) return;

    const payload: Record<string, unknown> = {
      attempt: args.attempt,
      maxAttempts: args.maxAttempts,
      ...(typeof args.waitMs === 'number'
        ? { waitMs: args.waitMs, waitSeconds: Math.max(1, Math.ceil(args.waitMs / 1000)) }
        : {}),
      ...(args.reason ? { reason: args.reason } : {}),
      ...(args.action ? { action: args.action } : {}),
      ...(args.error
        ? {
            error: args.error.message ?? args.error.error,
            code: args.error.code,
            provider: args.error.provider,
            model: args.error.model,
            status: args.error.status,
          }
        : {}),
    };

    const normalized = normalizeOpenCodeEvent({ type: args.type, properties: payload }, args.sessionId);
    if (!normalized) return;

    try {
      const stored = await timelineStore.appendWithPayload({
        ...normalized.event,
        redacted: normalized.redacted,
        payload: normalized.payload,
      });
      this.enqueueTimelineEvent(webContents, stored);
    } catch (error) {
      console.warn('[ProcessManager] Failed to persist reliability timeline event:', error);
    }
  }

  private async sleepReliability(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return;
    if (signal?.aborted) {
      throw this.createAbortError();
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        resolve();
      }, ms);

      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(this.createAbortError());
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  private async promptWithReliabilityPolicy(args: {
    sessionId: string;
    body: { agent: string; system?: string; parts: Array<{ type: 'text'; text: string }> };
    webContents?: Electron.WebContents;
    signal?: AbortSignal;
  }): Promise<{ data?: unknown; error?: unknown }> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    const requestId = randomUUID();
    const startedAt = Date.now();
    this.reliabilityRetryState.set(args.sessionId, { requestId, attempt: 1, startedAt });

    try {
      for (let attempt = 1; attempt <= this.reliabilityMaxAttempts; attempt += 1) {
        if (args.signal?.aborted) {
          throw this.createAbortError();
        }

        const state = this.reliabilityRetryState.get(args.sessionId);
        if (!state || state.requestId !== requestId) {
          // Another request superseded this one.
          throw this.createAbortError('Request superseded');
        }

        let result: { data?: unknown; error?: unknown };
        try {
          const promptRequest: {
            path: { id: string };
            body: { agent: string; system?: string; parts: Array<{ type: 'text'; text: string }> };
            signal?: AbortSignal;
          } = {
            path: { id: args.sessionId },
            body: args.body,
            ...(args.signal ? { signal: args.signal } : {}),
          };
          result = (await this.instance.client.session.prompt(promptRequest as unknown as {
            path: { id: string };
            body: { agent: string; system?: string; parts: Array<{ type: 'text'; text: string }> };
          })) as { data?: unknown; error?: unknown };
        } catch (error) {
          if (args.signal?.aborted || this.isAbortLikeError(error)) {
            throw this.createAbortError();
          }
          result = { error };
        }

        if (!result.error) {
          return result;
        }

        const errorPayload = buildOpenCodeError(result.error, {
          model: configStore.get()?.provider.default,
        });
        this.reliabilityRetryState.set(args.sessionId, {
          requestId,
          attempt,
          startedAt,
          lastError: errorPayload,
        });

        const retryable = this.isRetryableIntegrationFailure(errorPayload);
        if (!retryable || attempt >= this.reliabilityMaxAttempts) {
          if (retryable) {
            const finalMessage = `Integration connection dropped during tool use. Retried ${attempt}/${this.reliabilityMaxAttempts} times but the integration is still unavailable. Open Integrations to reconnect, then retry.`;
            await this.emitReliabilityTimelineEvent({
              type: 'flowstate.reliability.failed',
              sessionId: args.sessionId,
              attempt,
              maxAttempts: this.reliabilityMaxAttempts,
              reason: errorPayload.message ?? errorPayload.error,
              action: 'Open Integrations to reconnect, then retry the task.',
              error: errorPayload,
              webContents: args.webContents,
            });
            const thrown = new Error(finalMessage);
            (thrown as Error & { opencode?: OpenCodeErrorPayload }).opencode = {
              ...errorPayload,
              error: finalMessage,
              message: finalMessage,
            };
            throw thrown;
          }

          const thrown = new Error(errorPayload.error);
          (thrown as Error & { opencode?: OpenCodeErrorPayload }).opencode = errorPayload;
          throw thrown;
        }

        const nextAttempt = attempt + 1;
        const waitMs = this.computeReliabilityBackoffMs(nextAttempt);
        await this.emitReliabilityTimelineEvent({
          type: 'flowstate.reliability.retry',
          sessionId: args.sessionId,
          attempt: nextAttempt,
          maxAttempts: this.reliabilityMaxAttempts,
          waitMs,
          reason: errorPayload.message ?? errorPayload.error,
          error: errorPayload,
          webContents: args.webContents,
        });
        await this.sleepReliability(waitMs, args.signal);
      }

      // Should be unreachable.
      throw new Error('Retry budget exhausted');
    } finally {
      const state = this.reliabilityRetryState.get(args.sessionId);
      if (state?.requestId === requestId) {
        this.reliabilityRetryState.delete(args.sessionId);
      }
    }
  }

  private registerTimelineSession(sessionId: string): void {
    if (!sessionId || typeof sessionId !== 'string') return;
    this.persistedTimelineSessions.add(sessionId);
  }

  private async resolveSessionIdForApprovalRequest(requestId: string): Promise<string | undefined> {
    const fromPolicy = approvalPolicyStore.getSessionIdForRequest(requestId);
    if (fromPolicy) return fromPolicy;

    try {
      const fromTimeline = await timelineStore.findSessionIdByApprovalRequestId(requestId);
      if (fromTimeline) {
        approvalPolicyStore.trackRequest(requestId, fromTimeline);
        return fromTimeline;
      }
    } catch (error) {
      console.warn('[ProcessManager] Failed to resolve approval request session from timeline:', error);
    }

    if (this.activeSessionId) {
      return this.activeSessionId;
    }

    return undefined;
  }

  async getSessionIdForApprovalRequest(requestId: string): Promise<string | undefined> {
    if (!requestId || typeof requestId !== 'string') return undefined;
    return this.resolveSessionIdForApprovalRequest(requestId.trim());
  }

  private getApprovalsNotificationEnabled(): boolean {
    try {
      return configStore.get()?.preferences?.notifications?.approvals ?? true;
    } catch {
      return true;
    }
  }

  private getTaskCompletionNotificationEnabled(): boolean {
    try {
      return configStore.get()?.preferences?.notifications?.taskComplete ?? true;
    } catch {
      return true;
    }
  }

  private shouldNotifyApproval(requestId: string): boolean {
    const id = requestId.trim();
    if (!id) return false;

    const now = Date.now();
    const last = this.approvalNotificationSeenAt.get(id);
    if (last && now - last < this.approvalNotificationDedupeTtlMs) {
      return false;
    }

    this.approvalNotificationSeenAt.set(id, now);

    // Opportunistic pruning to avoid unbounded growth.
    for (const [key, ts] of this.approvalNotificationSeenAt.entries()) {
      if (now - ts > this.approvalNotificationDedupeTtlMs) {
        this.approvalNotificationSeenAt.delete(key);
      }
    }

    return true;
  }

  /**
   * Build a per-run dedupe key. Chat task IDs are session-scoped and can be
   * reused across runs (e.g. "task-1" appears in every conversation), so keying
   * only on `taskRunId` would suppress later completions for an hour. Including
   * `startedAt` (the run's start timestamp) makes the key unique per run.
   */
  private buildCompletionDedupeKey(taskRunId: string, startedAt?: number): string {
    const id = taskRunId.trim();
    return startedAt != null ? `${id}:${startedAt}` : id;
  }

  private shouldNotifyTaskCompletion(taskRunId: string, startedAt?: number): boolean {
    const key = this.buildCompletionDedupeKey(taskRunId, startedAt);
    if (!key) return false;

    const now = Date.now();
    const last = this.taskCompletionNotificationSeenAt.get(key);
    if (last && now - last < this.taskCompletionNotificationDedupeTtlMs) {
      return false;
    }

    this.taskCompletionNotificationSeenAt.set(key, now);

    for (const [k, ts] of this.taskCompletionNotificationSeenAt.entries()) {
      if (now - ts > this.taskCompletionNotificationDedupeTtlMs) {
        this.taskCompletionNotificationSeenAt.delete(k);
      }
    }

    return true;
  }

  private safeNotificationText(value: unknown, maxLen: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const cleaned = value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) return undefined;
    const redacted = redactSecrets(cleaned);
    return clampText(redacted, maxLen);
  }

  private notifyApprovalRequest(args: {
    requestId: string;
    sessionId: string;
    webContents: Electron.WebContents;
    title?: unknown;
    summary?: unknown;
    detail?: unknown;
  }): void {
    if (!Notification.isSupported()) return;
    if (!this.getApprovalsNotificationEnabled()) return;
    if (!this.shouldNotifyApproval(args.requestId)) return;

    const title =
      this.safeNotificationText(args.title, 72) ??
      this.safeNotificationText(args.detail, 72) ??
      'Approval requested';
    const body =
      this.safeNotificationText(args.summary, 200) ??
      this.safeNotificationText(args.detail, 200) ??
      'Open FlowState to review.';

    const notification = new Notification({
      title,
      body,
    });

    notification.on('click', () => {
      try {
        const win = BrowserWindow.fromWebContents(args.webContents);
        if (win) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        } else {
          app.focus({ steal: true });
        }
      } catch {
        // ignore
      }

      const taskRunId = (() => {
        try {
          return (
            this.getWorkflowTaskRunId(args.sessionId) ??
            taskStore.getActiveRun({ sessionId: args.sessionId })?.id ??
            null
          );
        } catch {
          return null;
        }
      })();

      args.webContents.send('notifications:approvalClick', {
        requestId: args.requestId,
        sessionId: args.sessionId,
        ...(taskRunId ? { taskRunId } : {}),
      });
    });

    try {
      notification.show();
    } catch (error) {
      console.warn('[ProcessManager] Failed to show approval notification:', error);
    }
  }

  private notifyTaskCompleted(args: {
    sessionId: string;
    taskRunId: string;
    startedAt?: number;
    webContents: Electron.WebContents;
    title?: unknown;
    summary?: unknown;
    detail?: unknown;
  }): void {
    if (!Notification.isSupported()) return;
    if (!this.getTaskCompletionNotificationEnabled()) return;
    if (!this.shouldNotifyTaskCompletion(args.taskRunId, args.startedAt)) return;

    const title =
      this.safeNotificationText(args.title, 72) ??
      this.safeNotificationText(args.detail, 72) ??
      'Task completed';
    const body =
      this.safeNotificationText(args.summary, 200) ??
      this.safeNotificationText(args.detail, 200) ??
      'Open FlowState for details.';

    const notification = new Notification({ title, body });
    notification.on('click', () => {
      try {
        const win = BrowserWindow.fromWebContents(args.webContents);
        if (win) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        } else {
          app.focus({ steal: true });
        }
      } catch {
        // ignore
      }
    });

    try {
      notification.show();
    } catch (error) {
      console.warn('[ProcessManager] Failed to show task completion notification:', error);
    }
  }

  private notifyTaskNeedsResponse(args: {
    sessionId: string;
    taskRunId: string;
    webContents: Electron.WebContents;
    title?: unknown;
    summary?: unknown;
    detail?: unknown;
  }): void {
    if (!Notification.isSupported()) return;
    if (!this.getApprovalsNotificationEnabled()) return;

    const title =
      this.safeNotificationText(args.title, 72) ??
      this.safeNotificationText(args.detail, 72) ??
      'Response needed';
    const body =
      this.safeNotificationText(args.summary, 200) ??
      this.safeNotificationText(args.detail, 200) ??
      'Open FlowState to continue this workflow.';

    const notification = new Notification({ title, body });
    notification.on('click', () => {
      try {
        const win = BrowserWindow.fromWebContents(args.webContents);
        if (win) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        } else {
          app.focus({ steal: true });
        }
      } catch {
        // ignore
      }

      args.webContents.send('notifications:approvalClick', {
        requestId: `workflow-response-${args.taskRunId}`,
        sessionId: args.sessionId,
        taskRunId: args.taskRunId,
      });
    });

    try {
      notification.show();
    } catch (error) {
      console.warn('[ProcessManager] Failed to show response-needed notification:', error);
    }
  }

  notifyWorkflowRunStatus(args: {
    sessionId: string;
    taskRunId: string;
    startedAt?: number;
    webContents?: Electron.WebContents;
    title?: string;
    summary?: string;
    detail?: string;
    needsResponse?: boolean;
    completed?: boolean;
  }): void {
    if (!args.webContents) return;

    if (args.needsResponse) {
      this.notifyTaskNeedsResponse({
        sessionId: args.sessionId,
        taskRunId: args.taskRunId,
        webContents: args.webContents,
        title: args.title,
        summary: args.summary,
        detail: args.detail,
      });
      return;
    }

    if (args.completed) {
      this.notifyTaskCompleted({
        sessionId: args.sessionId,
        taskRunId: args.taskRunId,
        startedAt: args.startedAt,
        webContents: args.webContents,
        title: args.title,
        summary: args.summary,
        detail: args.detail,
      });
    }
  }

  // Batch timeline IPC events to reduce renderer churn during high-volume streams.
  private timelineEventBuffer: unknown[] = [];
  private timelineFlushTimer: NodeJS.Timeout | null = null;
  private timelineFlushWebContents: Electron.WebContents | null = null;
  private readonly timelineFlushIntervalMs = 75;
  private readonly timelineFlushMaxBatchSize = 250;

  private readonly defaultAgent = 'flowstate-assistant';

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') return null;
    return value as Record<string, unknown>;
  }

  private normalizeResponseParts(parts: unknown): Array<{ type: string; text?: string }> {
    if (!Array.isArray(parts)) return [];

    const normalized: Array<{ type: string; text?: string }> = [];

    for (const part of parts) {
      if (typeof part === 'string') {
        const text = part.trim();
        if (text.length > 0) {
          normalized.push({ type: 'text', text: part });
        }
        continue;
      }

      const record = this.asRecord(part);
      if (!record) continue;

      const type = typeof record.type === 'string' ? record.type : 'unknown';

      const directText =
        typeof record.text === 'string'
          ? record.text
          : typeof record.content === 'string'
            ? record.content
            : undefined;

      if (directText && directText.length > 0) {
        normalized.push({ type, text: directText });
        continue;
      }

      const textRecord = this.asRecord(record.text);
      if (textRecord && typeof textRecord.value === 'string' && textRecord.value.length > 0) {
        normalized.push({ type, text: textRecord.value });
        continue;
      }

      const nestedParts = this.normalizeResponseParts(record.parts);
      if (nestedParts.length > 0) {
        normalized.push(...nestedParts);
        continue;
      }

      const nestedContent = this.normalizeResponseParts(record.content);
      if (nestedContent.length > 0) {
        normalized.push(...nestedContent);
        continue;
      }

      normalized.push({ type });
    }

    return normalized;
  }

  private extractPromptPayload(data: unknown): {
    parts: Array<{ type: string; text?: string }>;
    text: string;
    assistantMessageId?: string;
  } {
    const record = this.asRecord(data);
    if (!record) {
      return { parts: [], text: '' };
    }

    const infoRecord = this.asRecord(record.info);
    const messageRecord = this.asRecord(record.message);
    const responseRecord = this.asRecord(record.response);

    const partCandidates: unknown[] = [
      record.parts,
      messageRecord?.parts,
      messageRecord?.content,
      record.content,
      record.output,
      responseRecord?.parts,
      responseRecord?.content,
      responseRecord?.output,
    ];

    const messages = Array.isArray(record.messages) ? record.messages : [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = this.asRecord(messages[i]);
      if (!message) continue;
      const role = typeof message.role === 'string' ? message.role : this.asRecord(message.info)?.role;
      if (role !== 'assistant') continue;
      partCandidates.push(message.parts, message.content);
      break;
    }

    for (const candidate of partCandidates) {
      const parts = this.normalizeResponseParts(candidate);
      const text = parts
        .filter((part) => part.type === 'text' || part.type === 'output_text')
        .map((part) => part.text ?? '')
        .join('');
      if (text.trim().length > 0 || parts.length > 0) {
        const assistantMessageId =
          typeof infoRecord?.id === 'string'
            ? infoRecord.id
            : typeof messageRecord?.id === 'string'
              ? messageRecord.id
              : undefined;
        return {
          parts,
          text,
          ...(assistantMessageId ? { assistantMessageId } : {}),
        };
      }
    }

    if (typeof record.text === 'string' && record.text.trim().length > 0) {
      return {
        parts: [{ type: 'text', text: record.text }],
        text: record.text,
        ...(typeof infoRecord?.id === 'string' ? { assistantMessageId: infoRecord.id } : {}),
      };
    }

    return {
      parts: [],
      text: '',
      ...(typeof infoRecord?.id === 'string' ? { assistantMessageId: infoRecord.id } : {}),
    };
  }

  private summarizePromptData(data: unknown): string {
    const record = this.asRecord(data);
    if (!record) return '[non-object payload]';

    const keys = Object.keys(record);
    const summary: Record<string, unknown> = { keys };

    if (Array.isArray(record.parts)) {
      summary.partsCount = record.parts.length;
      summary.partTypes = record.parts
        .map((part) => this.asRecord(part)?.type)
        .filter((value) => typeof value === 'string')
        .slice(0, 12);
    }

    if (Array.isArray(record.messages)) {
      summary.messagesCount = record.messages.length;
      const last = this.asRecord(record.messages[record.messages.length - 1]);
      const info = this.asRecord(last?.info);
      summary.lastMessageRole = typeof info?.role === 'string' ? info.role : undefined;
      summary.lastMessageId = typeof info?.id === 'string' ? info.id : undefined;
    }

    return JSON.stringify(summary);
  }

  private async recoverLatestAssistantPayload(sessionId: string): Promise<{
    parts: Array<{ type: string; text?: string }>;
    text: string;
    assistantMessageId?: string;
  } | null> {
    if (!this.instance?.client) {
      return null;
    }

    try {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const history = await this.instance.client.session.messages({
          path: { id: sessionId },
        });

        if (!history.error && Array.isArray(history.data)) {
          for (let i = history.data.length - 1; i >= 0; i -= 1) {
            const message = this.asRecord(history.data[i]);
            if (!message) continue;
            const info = this.asRecord(message.info);
            const role = typeof info?.role === 'string' ? info.role : undefined;
            if (role !== 'assistant') continue;

            const parts = this.normalizeResponseParts(message.parts ?? message.content);
            const text = parts
              .filter((part) => part.type === 'text' || part.type === 'output_text')
              .map((part) => part.text ?? '')
              .join('');

            if (text.trim().length > 0 || parts.length > 0) {
              return {
                parts,
                text,
                ...(typeof info?.id === 'string' ? { assistantMessageId: info.id } : {}),
              };
            }
          }
        }

        if (attempt < 9) {
          await sleep(150);
        }
      }
    } catch (error) {
      console.warn('[ProcessManager] Failed to recover latest assistant payload:', error);
    }

    return null;
  }

  private async waitForAssistantPayload(args: {
    sessionId: string;
    startedAtMs: number;
    previousAssistantMessageId?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
  }): Promise<{
    parts: Array<{ type: string; text?: string }>;
    text: string;
    assistantMessageId?: string;
  } | null> {
    if (!this.instance?.client) return null;

    const timeoutMs = args.timeoutMs ?? 45000;
    const deadline = Date.now() + timeoutMs;

    const parseTs = (value: unknown): number | null => {
      if (typeof value !== 'string') return null;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    while (Date.now() < deadline) {
      if (args.signal?.aborted) {
        return null;
      }

      try {
        const history = await this.instance.client.session.messages({
          path: { id: args.sessionId },
        });

        if (!history.error && Array.isArray(history.data)) {
          for (let i = history.data.length - 1; i >= 0; i -= 1) {
            const message = this.asRecord(history.data[i]);
            if (!message) continue;

            const info = this.asRecord(message.info);
            const role = typeof info?.role === 'string' ? info.role : undefined;
            if (role !== 'assistant') continue;

            const id = typeof info?.id === 'string' ? info.id : undefined;
            if (id && args.previousAssistantMessageId && id === args.previousAssistantMessageId) {
              continue;
            }

            const createdAtMs = parseTs(info?.createdAt);
            if (createdAtMs !== null && createdAtMs < args.startedAtMs - 1000) {
              continue;
            }

            const parts = this.normalizeResponseParts(message.parts ?? message.content);
            const text = parts
              .filter((part) => part.type === 'text' || part.type === 'output_text')
              .map((part) => part.text ?? '')
              .join('');

            if (text.trim().length > 0 || parts.length > 0) {
              return {
                parts,
                text,
                ...(id ? { assistantMessageId: id } : {}),
              };
            }
          }
        }
      } catch {
        // Keep polling until timeout.
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return null;
  }

  private extractToolService(payload: unknown): string | null {
    const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const candidates = [record?.service, record?.tool, record?.toolName, record?.name, record?.provider];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const normalized = candidate.toLowerCase().trim();
      if (!normalized) continue;
      const prefix = normalized.split(/[._\s-]/)[0];
      if (prefix && ['gmail', 'gcal', 'notion', 'outlook', 'canvas'].includes(prefix)) {
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

  private getWorkflowTaskRunId(sessionId: string): string | null {
    if (!sessionId) return null;
    try {
      workflowRunStore.configure({ dataDir: configStore.getDataDir() });
      const run = workflowRunStore.getRunBySessionId(sessionId);
      return run?.taskRunId ?? null;
    } catch (error) {
      console.warn('[ProcessManager] Failed to resolve workflow task run ID:', error);
      return null;
    }
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

  private async generateTaskTitleFromPrompt(prompt: string, fallbackTitle: string): Promise<string> {
    const fallback = sanitizeTaskTitle(fallbackTitle) ?? heuristicTaskTitleFromPrompt(prompt);

    // Keep things fast (and avoid extra calls) when heuristics are good enough.
    if (!shouldAttemptLlmTitle(prompt, fallback)) {
      return fallback;
    }

    if (!this.instance?.client) {
      return fallback;
    }

    const redactedPrompt = redactSecrets(prompt);
    const titlePrompt = [
      'You are a task title generator.',
      '',
      'Create a short, specific task title for the user request.',
      'Rules:',
      '- Return ONLY the title text (no quotes, no markdown, no punctuation at the end).',
      '- 3 to 7 words, <= 60 characters.',
      '- Start with a verb when possible.',
      '- Do NOT include filler like "Can you" / "Please" / "Yes" / "No".',
      '- Do NOT include private data or secrets.',
      '',
      `User request: "${redactedPrompt.replace(/[\r\n]+/g, ' ').trim()}"`,
    ].join('\n');

    try {
      // Use a dedicated short-lived session to avoid polluting the current conversation.
      const created = await this.instance.client.session.create({});
      if (created.error || !created.data?.id) {
        return fallback;
      }
      const titleSessionId = created.data.id;

      const result = await this.instance.client.session.prompt({
        path: { id: titleSessionId },
        body: {
          agent: this.defaultAgent,
          system: undefined,
          parts: [{ type: 'text', text: titlePrompt }],
        },
      });

      // Best-effort cleanup.
      try {
        await this.instance.client.session.delete({ path: { id: titleSessionId } });
      } catch {
        // ignore
      }

      if (result.error || !result.data) {
        return fallback;
      }

      const textContent = this.extractPromptPayload(result.data).text.trim();

      const sanitized = sanitizeTaskTitle(textContent);
      if (!sanitized) return fallback;
      if (sanitized.length > 60) return fallback;
      return sanitized;
    } catch (error) {
      console.warn('[ProcessManager] Failed to generate LLM task title:', error);
      return fallback;
    }
  }

  private handleTaskStoreFromNormalizedEvent(
    rawType: string,
    normalized: {
      event: { sessionId: string; taskId?: string; title: string; detail?: string; timestamp: number };
      payload?: unknown;
    },
    sessionId: string,
    webContents?: Electron.WebContents
  ): void {
    try {
      const workflowTaskRunId = this.getWorkflowTaskRunId(sessionId);
      const inferredId = this.inferTaskRunId(sessionId, normalized.payload, normalized.event.taskId);
      const resolvedId = workflowTaskRunId ?? inferredId;
      const existingRun = taskStore.getRun(resolvedId);
      if (existingRun?.status === 'cancelled') {
        return;
      }

      if (rawType === 'task.promoted') {
        const id = resolvedId;
        const text = this.pickTaskText(normalized.payload, normalized.event.title, normalized.event.detail);

        if (workflowTaskRunId) {
          const updated = taskStore.updateRun(id, {
            status: 'running',
            updatedAt: normalized.event.timestamp,
            description: text.description,
            ...(text.summary ? { summary: text.summary } : {}),
          });

          if (!updated) {
            const run: TaskRunRecord = {
              id,
              sessionId,
              kind: 'workflow',
              title: text.title,
              description: text.description,
              status: 'running',
              startedAt: normalized.event.timestamp,
              updatedAt: normalized.event.timestamp,
              progress: 0,
              ...(text.summary ? { summary: text.summary } : {}),
            };
            taskStore.upsertRun(run);
          }
          return;
        }

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

        // Async: improve the title after promotion via LLM, fallback to heuristics.
        const record = normalized.payload && typeof normalized.payload === 'object' ? (normalized.payload as Record<string, unknown>) : null;
        const promptFromPayload = typeof record?.summary === 'string'
          ? record.summary
          : typeof record?.message === 'string'
            ? record.message
            : typeof record?.detail === 'string'
              ? record.detail
              : null;

        if (promptFromPayload && promptFromPayload.trim().length > 0) {
          void this.generateTaskTitleFromPrompt(promptFromPayload, run.title).then((betterTitle) => {
            if (betterTitle && betterTitle !== run.title) {
              try {
                taskStore.updateRun(id, { title: betterTitle, updatedAt: Date.now() });
              } catch (error) {
                console.warn('[ProcessManager] Failed to update task title:', error);
              }
            }
          });
        }
        return;
      }

      if (rawType === 'task.completed') {
        const id = resolvedId;
        const updated = taskStore.updateRun(id, {
          status: 'completed',
          blockingReason: undefined,
          updatedAt: normalized.event.timestamp,
          progress: 100,
        });
        if (!updated) {
          const text = this.pickTaskText(normalized.payload, 'Task', normalized.event.detail);
          taskStore.upsertRun({
            id,
            sessionId,
            kind: workflowTaskRunId ? 'workflow' : this.inferTaskRunKind(normalized.payload),
            title: text.title,
            description: text.description,
            status: 'completed',
            startedAt: normalized.event.timestamp,
            updatedAt: normalized.event.timestamp,
            progress: 100,
          });
        }

        if (webContents) {
          const run = taskStore.getRun(id);
          this.notifyTaskCompleted({
            sessionId,
            taskRunId: id,
            startedAt: run?.startedAt,
            webContents,
            title: run?.title ?? normalized.event.title,
            summary: run?.summary,
            detail: normalized.event.detail ?? run?.description,
          });
        }

        return;
      }

      if (rawType === 'task.summary') {
        const id = resolvedId;
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
              kind: workflowTaskRunId ? 'workflow' : this.inferTaskRunKind(normalized.payload),
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

      if (isApprovalEventType(rawType)) {
        // Best-effort: toggle task status when approvals are requested/resolved.
        // Requests should block the task; responses should unblock it.
        const record =
          normalized.payload && typeof normalized.payload === 'object'
            ? (normalized.payload as Record<string, unknown>)
            : null;
        const explicitTaskId = record && typeof record.taskId === 'string' ? record.taskId : undefined;
        const candidateId = workflowTaskRunId ?? explicitTaskId ?? taskStore.getActiveRun({ sessionId })?.id;
        if (!candidateId) return;

        const existing = taskStore.getRun(candidateId);
        if (!existing) return;

        const patch = deriveApprovalBlockingPatch(rawType, existing);
        if (!patch) return;
        taskStore.updateRun(candidateId, {
          ...patch,
          updatedAt: normalized.event.timestamp,
        });
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

  get startError(): string | null {
    return this.lastStartError;
  }

  setPackagedWorkspaceDirectory(directory: string | null): void {
    const normalized = typeof directory === 'string' ? directory.trim() : '';
    this.packagedWorkspaceDirectory = normalized.length > 0 ? path.resolve(normalized) : null;
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
      const asarPackagesDir = path.join(appPath, 'node_modules', '@flowstate');
      const resourcesPackagesDir = path.join(process.resourcesPath, 'node_modules', '@flowstate');
      const legacyPackagesDir = path.join(process.resourcesPath, 'mcp-servers');

      const asarExists = fs.existsSync(asarPackagesDir);
      const resourcesExists = fs.existsSync(resourcesPackagesDir);
      const legacyExists = fs.existsSync(legacyPackagesDir);

      packagesDir = asarExists ? asarPackagesDir : resourcesExists ? resourcesPackagesDir : legacyPackagesDir;
      console.log('[ProcessManager] MCP packages (asar) exists:', asarExists);
      console.log('[ProcessManager] MCP packages (resources/node_modules) exists:', resourcesExists);
      console.log('[ProcessManager] MCP packages (legacy mcp-servers) exists:', legacyExists);
      if (packagesDir === legacyPackagesDir && !resourcesExists) {
        console.log('[ProcessManager] Falling back to legacy extraResources MCP directory');
      }
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
      return this.packagedWorkspaceDirectory ?? appPath;
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
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    if (!isDev) {
      try {
        // Packaged builds must avoid mutating bundled resources (app.asar / extraResources).
        // Persist the selected model only in user-writable runtime config.
        await configStore.setProvider(model);
      } catch (error) {
        console.warn('[ProcessManager] Failed to persist packaged model selection', error);
      }
      return;
    }

    const repoRoot = this.getRepoRoot();
    const agentPaths = [
      path.join(repoRoot, '.opencode', 'agent', 'flowstate.md'),
      path.join(repoRoot, 'agents', 'flowstate.md'),
    ];

    const stripModelFromAgentFile = async (agentPath: string): Promise<void> => {
      try {
        if (!fs.existsSync(agentPath)) return;
        const raw = await fsPromises.readFile(agentPath, 'utf8');
        const lines = raw.split('\n');
        const firstDelimiter = lines.indexOf('---');
        const secondDelimiter = lines.indexOf('---', firstDelimiter + 1);
        if (firstDelimiter === -1 || secondDelimiter === -1) return;

        const before = lines.join('\n');
        const frontmatterLines = lines.slice(firstDelimiter + 1, secondDelimiter);
        const filtered = frontmatterLines.filter((line) => !line.trim().startsWith('model:'));
        if (filtered.length === frontmatterLines.length) return;

        const updatedLines = [
          ...lines.slice(0, firstDelimiter + 1),
          ...filtered,
          ...lines.slice(secondDelimiter),
        ];

        const after = updatedLines.join('\n');
        if (after !== before) {
          await fsPromises.writeFile(agentPath, after);
        }
      } catch (error) {
        console.warn('[ProcessManager] Failed to strip model from agent file:', agentPath, error);
      }
    };

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

    // Subagents should inherit the base model, so they must NOT declare a model.
    const subagentNames = ['scheduler', 'organizer', 'communicator', 'executor'];
    const subagentPaths: string[] = [];
    for (const name of subagentNames) {
      subagentPaths.push(path.join(repoRoot, '.opencode', 'agent', `${name}.md`));
      subagentPaths.push(path.join(repoRoot, 'agents', 'subagents', `${name}.md`));
    }

    for (const agentPath of subagentPaths) {
      await stripModelFromAgentFile(agentPath);
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

  private resolveNpxRuntimeCommand(): string[] | null {
    const envPath = process.env.PATH ?? '';
    const pathEntries = envPath
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const candidates: string[] = [];
    for (const entry of pathEntries) {
      candidates.push(path.join(entry, 'npx'));
    }
    candidates.push('/opt/homebrew/bin/npx', '/usr/local/bin/npx', '/usr/bin/npx');

    const uniqueCandidates = Array.from(new Set(candidates));
    for (const candidate of uniqueCandidates) {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return [candidate, '-y'];
      } catch {
        // try next candidate
      }
    }

    return null;
  }

  private resolveManagedMcpRuntime(
    serverName: 'mcp-gmail' | 'mcp-gcal' | 'mcp-system' | 'mcp-canvas' | 'mcp-notion',
    _serverPathFromConfiguredPackagesDir: string | null
  ): { command: string[]; environment: Record<string, string> } | null {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    const legacyServerPath = path.join(process.resourcesPath, 'mcp-servers', serverName, 'dist', 'index.js');
    const legacyExists = fs.existsSync(legacyServerPath);

    const resourcesPackagePath = path.join(
      process.resourcesPath,
      'node_modules',
      '@flowstate',
      serverName,
      'dist',
      'index.js'
    );
    const resourcesPackageExists = fs.existsSync(resourcesPackagePath);

    const nodePathEntries: string[] = [];
    // app.getAppPath() points at app.asar in packaged builds.
    // Electron's ASAR-aware fs implementation can resolve modules from this path
    // when running with ELECTRON_RUN_AS_NODE.
    nodePathEntries.push(path.join(app.getAppPath(), 'node_modules'));
    nodePathEntries.push(path.join(process.resourcesPath, 'node_modules'));
    const nodePath = nodePathEntries.join(path.delimiter);

    if (isDev) {
      if (!_serverPathFromConfiguredPackagesDir) return null;
      return {
        command: ['node', _serverPathFromConfiguredPackagesDir],
        environment: {},
      };
    }

    const asarPath = path.join(app.getAppPath(), 'node_modules', '@flowstate', serverName, 'dist', 'index.js');
    const asarExists = fs.existsSync(asarPath);
    const mcpRunnerPath = path.join(PROCESS_MANAGER_DIR, 'mcp-runner.js');
    const mcpRunnerExists = fs.existsSync(mcpRunnerPath);
    console.log(`[ProcessManager] Packaged MCP runtime for ${serverName}: ${asarPath} (exists: ${asarExists})`);
    console.log(
      `[ProcessManager] Packaged MCP runtime (resources/node_modules) for ${serverName}: ${resourcesPackagePath} (exists: ${resourcesPackageExists})`
    );
    console.log(`[ProcessManager] MCP runner path: ${mcpRunnerPath} (exists: ${mcpRunnerExists})`);

    // Prefer running through our MCP runner so imports resolve consistently in packaged builds.
    // This avoids relying on `node` existing on the user's PATH.
    if ((asarExists || resourcesPackageExists) && mcpRunnerExists) {
      return {
        command: [process.execPath, mcpRunnerPath, serverName],
        environment: {
          ELECTRON_RUN_AS_NODE: '1',
          NODE_PATH: nodePath,
          FLOWSTATE_MCP_PACKAGED: '1',
        },
      };
    }

    console.log(`[ProcessManager] Legacy MCP runtime for ${serverName}: ${legacyServerPath} (exists: ${legacyExists})`);

    if (!legacyExists) return null;

    return {
      command: [process.execPath, legacyServerPath],
      environment: {
        ELECTRON_RUN_AS_NODE: '1',
        NODE_PATH: nodePath,
        FLOWSTATE_MCP_PACKAGED: '1',
      },
    };
  }

  /**
   * Build MCP configuration with auth tokens from auth-manager
   */
  private loadFlowstatePrompt(packagesDir: string): string | null {
    const candidatePaths = buildFlowstatePromptCandidatePaths({
      envAgentsDir: typeof process.env.FLOWSTATE_AGENTS_DIR === 'string' ? process.env.FLOWSTATE_AGENTS_DIR : '',
      resourcesPath: process.resourcesPath,
      appPath: app.getAppPath(),
      repoRoot: this.getRepoRoot(),
      packagesDir,
    });

    for (const agentPath of candidatePaths) {
      try {
        if (!fs.existsSync(agentPath)) {
          continue;
        }
        const raw = fs.readFileSync(agentPath, 'utf8');
        const parts = raw.split('---');
        if (parts.length >= 3) {
          return parts.slice(2).join('---').trim();
        }
        return raw.trim();
      } catch (error) {
        console.warn('[ProcessManager] Failed to load FlowState agent prompt candidate:', agentPath, error);
      }
    }

    console.error('[ProcessManager] Failed to load FlowState agent prompt from all candidates');
    return null;
  }

  private formatUserProfileForPrompt(profile: UserProfile): string | null {
    const lines: string[] = [];

    if (profile.preferredName) {
      lines.push(`- Preferred name: ${profile.preferredName}`);
    }

    if (profile.timezone) {
      lines.push(`- Timezone: ${profile.timezone}`);
    }

    if (profile.location) {
      lines.push(`- Location: ${profile.location}`);
    }

    const formatWindow = (label: string, window?: { start?: string; end?: string; days?: string[] }) => {
      if (!window) return;
      const parts: string[] = [];
      if (window.days && window.days.length > 0) {
        parts.push(window.days.join(', '));
      }
      if (window.start || window.end) {
        const start = window.start ?? 'unspecified';
        const end = window.end ?? 'unspecified';
        parts.push(`${start}-${end}`);
      }
      if (parts.length > 0) {
        lines.push(`- ${label}: ${parts.join(' | ')}`);
      }
    };

    formatWindow('Study hours', profile.studyHours);
    formatWindow('Working hours', profile.workingHours);

    if (profile.notes) {
      lines.push(`- Notes: ${profile.notes}`);
    }

    return lines.length > 0 ? lines.join('\n') : null;
  }

  private async getSystemPrompt(): Promise<string | undefined> {
    if (!this.flowstatePrompt) {
      const packagesDir = this.getMcpPackagesDir();
      this.flowstatePrompt = this.loadFlowstatePrompt(packagesDir);
    }

    const basePrompt = this.flowstatePrompt ?? undefined;
    if (!basePrompt) return undefined;

    try {
      const profile = await userProfile.getProfile();
      const formatted = this.formatUserProfileForPrompt(profile);
      if (!formatted) return basePrompt;
      return `${basePrompt}\n\n## User Profile\n${formatted}`;
    } catch (error) {
      console.error('[ProcessManager] Failed to load user profile:', error);
      return basePrompt;
    }
  }

  private async buildMcpConfigWithDiagnostics(): Promise<{
    config: OpencodeMcpConfig;
    errors: Record<string, string>;
    skipped: Record<string, string>;
  }> {
    const mcpConfig: OpencodeMcpConfig = {};
    const packagesDir = this.getMcpPackagesDir();
    const flowstateDataDir = configStore.getDataDir();

    const currentConfig = (() => {
      try {
        return configStore.get();
      } catch {
        return null;
      }
    })();

    const loadedConfig = currentConfig ?? (await configStore.load());

    const errors: Record<string, string> = {};
    const skipped: Record<string, string> = {};

    if (!this.flowstatePrompt) {
      this.flowstatePrompt = this.loadFlowstatePrompt(packagesDir);
    }

    // Gmail MCP
    const gmailToken = await authManager.getToken('gmail');
    const gmailCreds = await authManager.getClientCredentials('gmail');
    const gmailPath = this.verifyMcpServer(packagesDir, 'mcp-gmail');
    const gmailRuntime = this.resolveManagedMcpRuntime('mcp-gmail', gmailPath);
    if (gmailToken && gmailRuntime) {
      mcpConfig['flowstate-gmail'] = {
        type: 'local',
        command: gmailRuntime.command,
        environment: {
          FLOWSTATE_DATA_DIR: flowstateDataDir,
          ...gmailRuntime.environment,
          GMAIL_ACCESS_TOKEN: gmailToken.accessToken,
          GMAIL_REFRESH_TOKEN: gmailToken.refreshToken || '',
          GOOGLE_CLIENT_ID: gmailCreds?.clientId || '',
          GOOGLE_CLIENT_SECRET: gmailCreds?.clientSecret || '',
        },
        enabled: true,
        timeout: 10000,
      } satisfies McpLocalConfig;
      console.log('[ProcessManager] Gmail MCP configured with token and credentials');
    } else if (gmailToken && !gmailPath) {
      const message = 'Gmail is authenticated but the packaged Gmail MCP runtime was not found.';
      errors['flowstate-gmail'] = message;
      console.error('[ProcessManager] Gmail token found but MCP server not built!');
    }

    // Google Calendar MCP
    const gcalToken = await authManager.getToken('gcal');
    const gcalCreds = await authManager.getClientCredentials('gcal');
    const gcalPath = this.verifyMcpServer(packagesDir, 'mcp-gcal');
    const gcalRuntime = this.resolveManagedMcpRuntime('mcp-gcal', gcalPath);
    if (gcalToken && gcalRuntime) {
      const gcalPrefs = loadedConfig.integrations?.gcal;
      const readCalendarIds = Array.isArray(gcalPrefs?.readCalendarIds)
        ? gcalPrefs?.readCalendarIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
        : undefined;
      const writeCalendarId = typeof gcalPrefs?.writeCalendarId === 'string'
        ? gcalPrefs.writeCalendarId.trim()
        : '';

      // Build calendar IDs env var:
      // - If readCalendarIds is undefined/null: not configured, use default (primary)
      // - If readCalendarIds is empty array: user selected "All Calendars"
      // - If readCalendarIds has items: use those specific calendars
      let calendarIdsEnv: string | undefined;
      if (readCalendarIds === undefined || readCalendarIds === null) {
        // Not configured - don't set env var, MCP will default to primary
        calendarIdsEnv = undefined;
      } else if (readCalendarIds.length === 0) {
        // Explicitly empty - user wants all calendars, use '*' marker
        calendarIdsEnv = '*';
      } else {
        // Specific calendars selected
        calendarIdsEnv = readCalendarIds.join(',');
      }

      mcpConfig['flowstate-gcal'] = {
        type: 'local',
        command: gcalRuntime.command,
        environment: {
          FLOWSTATE_DATA_DIR: flowstateDataDir,
          ...gcalRuntime.environment,
          GCAL_ACCESS_TOKEN: gcalToken.accessToken,
          GCAL_REFRESH_TOKEN: gcalToken.refreshToken || '',
          GOOGLE_CLIENT_ID: gcalCreds?.clientId || '',
          GOOGLE_CLIENT_SECRET: gcalCreds?.clientSecret || '',
          ...(calendarIdsEnv !== undefined
            ? { GCAL_READ_CALENDAR_IDS: calendarIdsEnv }
            : {}),
          ...(writeCalendarId.length > 0
            ? { GCAL_WRITE_CALENDAR_ID: writeCalendarId }
            : {}),
        },
        enabled: true,
        timeout: 10000,
      } satisfies McpLocalConfig;
      console.log('[ProcessManager] Google Calendar MCP configured with token and credentials');
    } else if (gcalToken && !gcalPath) {
      const message = 'Google Calendar is authenticated but the packaged Google Calendar MCP runtime was not found.';
      errors['flowstate-gcal'] = message;
      console.error('[ProcessManager] GCal token found but MCP server not built!');
    }

    const npxCommand = this.resolveNpxRuntimeCommand();

    // Notion MCP (prefer bundled @flowstate/mcp-notion; fallback to npx)
    const notionToken = await authManager.getToken('notion');
    const notionPath = this.verifyMcpServer(packagesDir, 'mcp-notion');
    const notionRuntime = this.resolveManagedMcpRuntime('mcp-notion', notionPath);
    if (notionToken && notionRuntime) {
      mcpConfig['notion'] = {
        type: 'local',
        command: notionRuntime.command,
        environment: {
          FLOWSTATE_DATA_DIR: flowstateDataDir,
          ...notionRuntime.environment,
          NOTION_ACCESS_TOKEN: notionToken.accessToken,
        },
        enabled: true,
        timeout: 10000,
      } satisfies McpLocalConfig;
      console.log('[ProcessManager] Notion MCP configured with token (bundled runtime)');
    } else if (notionToken) {
      if (!npxCommand) {
        errors['notion'] =
          'Notion MCP requires npx or the bundled FlowState Notion MCP runtime, but neither was found. Install Node.js (with npm/npx) or rebuild FlowState MCP packages.';
      } else {
        mcpConfig['notion'] = {
          type: 'local',
          command: [...npxCommand, '@notionhq/notion-mcp-server'],
          environment: {
            FLOWSTATE_DATA_DIR: flowstateDataDir,
            NOTION_TOKEN: notionToken.accessToken,
          },
          enabled: true,
          timeout: 10000,
        } satisfies McpLocalConfig;
        console.log('[ProcessManager] Notion MCP configured with token (npx fallback)');
      }
    }

    // Outlook MCP (OAuth + browser-session mode)
    const outlookToken = await authManager.getToken('outlook');
    if (outlookToken) {
      const outlookAuthMode = outlookToken.additionalData?.outlookAuthMode;
      const useBrowserAuth = outlookAuthMode === 'browser';

      if (!useBrowserAuth && outlookToken.accessToken) {
        if (!npxCommand) {
          errors['flowstate-outlook'] =
            'Outlook OAuth MCP requires npx, but no executable was found in PATH. Install Node.js (with npm/npx) or use Browser Session mode.';
        } else {
          mcpConfig['flowstate-outlook'] = {
            type: 'local',
            command: [...npxCommand, '@softeria/ms-365-mcp-server', '--org-mode', '--preset', 'mail'],
            environment: {
              FLOWSTATE_DATA_DIR: flowstateDataDir,
              MS365_MCP_OAUTH_TOKEN: outlookToken.accessToken,
            },
            enabled: true,
            timeout: 10000,
          } satisfies McpLocalConfig;
          console.log('[ProcessManager] Outlook MCP configured with OAuth token');
        }
      } else if (useBrowserAuth) {
        const outlookStorageStatePath = outlookToken.additionalData?.outlookStorageStatePath?.trim();
        const outlookMailboxUrl = outlookToken.additionalData?.outlookMailboxUrl?.trim();
        const outlookWriteEnabled = outlookToken.additionalData?.outlookWriteEnabled === 'true';
        const outlookBrowserMcpPath = path.join(PROCESS_MANAGER_DIR, 'outlook-browser-mcp.js');
        const packagedOutlookBrowserMcpPath = path.join(app.getAppPath(), 'dist', 'main', 'outlook-browser-mcp.js');
        const isPackagedBuild = app.isPackaged && process.env.NODE_ENV !== 'development';
        const packagedOutlookExists = isPackagedBuild && fs.existsSync(packagedOutlookBrowserMcpPath);
        const outlookCommand = packagedOutlookExists
          ? [process.execPath, packagedOutlookBrowserMcpPath]
          : ['node', outlookBrowserMcpPath];
        const outlookRuntimeEnv: Record<string, string> = {};
        if (packagedOutlookExists) {
          outlookRuntimeEnv.ELECTRON_RUN_AS_NODE = '1';
        }

        if (!outlookStorageStatePath) {
          console.warn('[ProcessManager] Outlook browser mode missing storage state path; MCP not configured');
        } else if (!packagedOutlookExists && !fs.existsSync(outlookBrowserMcpPath)) {
          console.warn('[ProcessManager] Outlook browser MCP executable missing; run desktop main build');
        } else {
          mcpConfig['flowstate-outlook'] = {
            type: 'local',
            command: outlookCommand,
            environment: {
              FLOWSTATE_DATA_DIR: flowstateDataDir,
              ...outlookRuntimeEnv,
              OUTLOOK_AUTH_MODE: 'browser',
              OUTLOOK_STORAGE_STATE_PATH: outlookStorageStatePath,
              OUTLOOK_BROWSER_WRITE_ENABLED: outlookWriteEnabled ? 'true' : 'false',
              ...(outlookMailboxUrl ? { OUTLOOK_MAILBOX_URL: outlookMailboxUrl } : {}),
            },
            enabled: true,
            timeout: 10000,
          } satisfies McpLocalConfig;
          console.log(
            `[ProcessManager] Outlook MCP configured with browser session (${outlookWriteEnabled ? 'write-enabled' : 'read-only'})`
          );
        }
      }
    }

    // System MCP (no auth needed)
    const systemPath = this.verifyMcpServer(packagesDir, 'mcp-system');
    const systemRuntime = this.resolveManagedMcpRuntime('mcp-system', systemPath);
    if (systemRuntime) {
      const systemNotificationsEnabled =
        this.getApprovalsNotificationEnabled() || this.getTaskCompletionNotificationEnabled();
      mcpConfig['flowstate-system'] = {
        type: 'local',
        command: systemRuntime.command,
        environment: {
          FLOWSTATE_DATA_DIR: flowstateDataDir,
          ...systemRuntime.environment,
          FLOWSTATE_NOTIFY_SYSTEM_ENABLED: String(systemNotificationsEnabled),
        },
        enabled: true,
        timeout: 10000,
      } satisfies McpLocalConfig;
      console.log('[ProcessManager] System MCP configured');
    }

    // Canvas LMS MCP (token or browser session auth)
    const canvasToken = await authManager.getToken('canvas');
    const canvasPath = this.verifyMcpServer(packagesDir, 'mcp-canvas');
    const canvasRuntime = this.resolveManagedMcpRuntime('mcp-canvas', canvasPath);
    if (canvasToken && canvasRuntime) {
      const canvasAuthMode = canvasToken.additionalData?.canvasAuthMode;
      const useBrowserAuth = canvasAuthMode === 'browser';

      mcpConfig['flowstate-canvas'] = {
        type: 'local',
        command: canvasRuntime.command,
        environment: {
          FLOWSTATE_DATA_DIR: flowstateDataDir,
          ...canvasRuntime.environment,
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
      } satisfies McpLocalConfig;
      console.log(
        `[ProcessManager] Canvas LMS MCP configured (${useBrowserAuth ? 'browser' : 'token'} auth)`
      );
    } else if (canvasToken && !canvasPath) {
      const message = 'Canvas is authenticated but the packaged Canvas MCP runtime was not found.';
      errors['flowstate-canvas'] = message;
      console.error('[ProcessManager] Canvas token found but MCP server not built!');
    }

    // Custom MCP servers (user-defined in config)
    const custom = normalizeCustomMcpServers(loadedConfig.mcpServers);
    Object.assign(errors, custom.errors);
    Object.assign(skipped, custom.skipped);

    for (const [name, config] of Object.entries(custom.config)) {
      if (name in mcpConfig) {
        errors[name] = 'Name collides with managed FlowState integration';
        continue;
      }
      mcpConfig[name] = config as McpLocalConfig | McpRemoteConfig;
    }

    const keys = Object.keys(mcpConfig);
    console.log('[ProcessManager] Final MCP config keys:', keys);
    if (Object.keys(errors).length > 0) {
      console.warn('[ProcessManager] MCP config validation errors:', JSON.stringify(errors, null, 2));
    }
    this.mcpDiagnostics = {
      updatedAt: Date.now(),
      errors: { ...errors },
      skipped: { ...skipped },
    };
    return { config: mcpConfig, errors, skipped };
  }

  /**
   * Start the OpenCode server and client
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('OpenCode already running');
      return;
    }

    this.lastStartError = null;

    console.log('Starting OpenCode server...');

    try {
      const opencodeCliPath = ensureOpencodeCliAvailable();
      console.log(`[ProcessManager] Using OpenCode CLI at: ${opencodeCliPath}`);
      console.log(`[ProcessManager] OpenCode startup cwd: ${process.cwd()}`);
      if (this.packagedWorkspaceDirectory) {
        console.log(`[ProcessManager] Packaged workspace directory: ${this.packagedWorkspaceDirectory}`);
      }

      const selectedModel = configStore.get()?.provider.default ?? 'opencode/grok-code';
      await this.updateAgentModelFiles(selectedModel);

      // Build MCP configuration with auth tokens
      const { config: mcpConfig, errors } = await this.buildMcpConfigWithDiagnostics();
      console.log('[ProcessManager] MCP servers configured:', Object.keys(mcpConfig));
      console.log(
        '[ProcessManager] Full MCP config (redacted):',
        JSON.stringify(this.redactMcpConfigForLog(mcpConfig), null, 2)
      );
      if (Object.keys(errors).length > 0) {
        console.warn('[ProcessManager] Some MCP servers are invalid and were not added');
      }

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
      this.lastStartError = error instanceof Error ? error.message : String(error);
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

      const runtimeErrors: Record<string, string> = {};
      
      // Log any failed servers
      if (result.data) {
        for (const [name, status] of Object.entries(result.data)) {
          if (status.status === 'failed') {
            const message = (status as { error?: string }).error ?? 'Unknown MCP error';
            runtimeErrors[name] = message;
            console.error(`[ProcessManager] MCP server ${name} FAILED:`, message);
          } else if (status.status === 'connected') {
            console.log(`[ProcessManager] MCP server ${name} connected successfully`);
          }
        }
      }

      if (Object.keys(runtimeErrors).length > 0) {
        // Merge runtime failures into diagnostics so the Integrations UI can surface actionable info.
        this.mcpDiagnostics = {
          updatedAt: Date.now(),
          errors: {
            ...this.mcpDiagnostics.errors,
            ...runtimeErrors,
          },
          skipped: { ...this.mcpDiagnostics.skipped },
        };
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

  getMcpDiagnostics(): { updatedAt: number; errors: Record<string, string>; skipped: Record<string, string> } {
    return {
      updatedAt: this.mcpDiagnostics.updatedAt,
      errors: { ...this.mcpDiagnostics.errors },
      skipped: { ...this.mcpDiagnostics.skipped },
    };
  }

  /**
   * Reload MCP configuration (call after connecting/disconnecting integrations)
   * Uses the mcp.add() API for dynamic server management
   */
  async reloadMcpConfig(): Promise<{ success: boolean; error?: string }>
  {
    if (!this.instance?.client) {
      const error = 'OpenCode not running';
      console.warn(`[ProcessManager] Cannot reload MCP config: ${error}`);
      return { success: false, error };
    }

    console.log('[ProcessManager] Reloading MCP configuration...');

    const { config: desired, errors: validationErrors } = await this.buildMcpConfigWithDiagnostics();
    const failed: Record<string, string> = { ...validationErrors };

    try {
      const status = await this.instance.client.mcp.status({});
      const current = status.data ? Object.keys(status.data) : [];

      // Disconnect MCPs removed from config (best-effort; OpenCode has no remove API).
      for (const name of current) {
        if (name in desired) continue;
        try {
          console.log(`[ProcessManager] Disconnecting MCP server: ${name}`);
          await this.instance.client.mcp.disconnect({ path: { name } });
        } catch (disconnectError) {
          const message = disconnectError instanceof Error ? disconnectError.message : String(disconnectError);
          console.warn(`[ProcessManager] Failed to disconnect MCP server ${name}: ${message}`);
        }
      }
    } catch (statusError) {
      console.warn('[ProcessManager] Unable to read current MCP status before reload:', statusError);
    }

    // Add each MCP server individually using the mcp.add() API
    for (const [name, config] of Object.entries(desired)) {
      try {
        console.log(`[ProcessManager] Adding MCP server: ${name}`);
        const result = await this.instance.client.mcp.add({
          body: {
            name,
            config,
          },
        });
        console.log(`[ProcessManager] MCP server ${name} add result:`, JSON.stringify(result.data?.[name] ?? result.data, null, 2));
      } catch (addError) {
        const message = addError instanceof Error ? addError.message : String(addError);
        console.error(`[ProcessManager] Failed to add MCP server ${name}: ${message}`);
        failed[name] = message;
      }
    }

    await this.logMcpStatus();

    const failedNames = Object.keys(failed);
    if (failedNames.length > 0) {
      const error = `Failed to load ${failedNames.length} MCP server(s): ${failedNames.join(', ')}`;
      console.warn(`[ProcessManager] MCP config reload completed with errors: ${error}`);
      return { success: false, error };
    }

    console.log('[ProcessManager] MCP config reload complete');
    return { success: true };
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

    if (this.activePromptAbortController) {
      this.activePromptAbortController.abort();
      this.activePromptAbortController = null;
      this.activePromptSessionId = null;
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
   * Create a new OpenCode session without changing the active chat session.
   * Used by workflows so they do not pollute the current conversation.
   */
  async createDetachedSession(title?: string): Promise<string> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    const result = await this.instance.client.session.create(
      title && title.trim().length
        ? {
            body: {
              title: title.trim(),
            },
          }
        : {}
    );

    if (result.error || !result.data?.id) {
      throw new Error(`Failed to create session: ${JSON.stringify(result.error ?? 'unknown error')}`);
    }

    return result.data.id;
  }

  /**
   * Register a session so timeline events are persisted.
   * This opt-in gates storage for non-active sessions.
   */
  registerTaskSession(sessionId: string, message?: string): void {
    if (!sessionId || typeof sessionId !== 'string') return;
    void message;
    this.registerTimelineSession(sessionId);
  }

  /**
   * Prompt an explicit session (used for workflow sessions).
   * Does not stream to renderer and does not change the active session.
   */
  async promptSession(
    sessionId: string,
    content: string
  ): Promise<{ content: string; parts: unknown[]; assistantMessageId?: string }> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid sessionId');
    }

    const systemPrompt = await this.getSystemPrompt();
    this.registerTaskSession(sessionId, content);
    const previousAssistant = await this.recoverLatestAssistantPayload(sessionId);
    const promptStartedAtMs = Date.now();

    try {
      const result = await this.promptWithReliabilityPolicy({
        sessionId,
        body: {
          agent: this.defaultAgent,
          system: systemPrompt,
          parts: [{ type: 'text', text: content }],
        },
      });

      if (result.error) {
        const errorPayload = buildOpenCodeError(result.error, {
          model: configStore.get()?.provider.default,
        });
        const thrown = new Error(errorPayload.error);
        (thrown as Error & { opencode?: OpenCodeErrorPayload }).opencode = errorPayload;
        throw thrown;
      }

      if (!result.data) {
        throw new Error('No data in prompt result');
      }

      let extracted = this.extractPromptPayload(result.data);
      if (extracted.text.trim().length === 0) {
        const recovered = await this.recoverLatestAssistantPayload(sessionId);
        if (recovered) extracted = recovered;
      }
      if (extracted.text.trim().length === 0) {
        const waited = await this.waitForAssistantPayload({
          sessionId,
          startedAtMs: promptStartedAtMs,
          previousAssistantMessageId: previousAssistant?.assistantMessageId,
          timeoutMs: 60000,
        });
        if (waited) extracted = waited;
      }
      if (extracted.text.trim().length === 0 && extracted.parts.length === 0) {
        throw new Error('OpenCode returned no assistant output for this prompt');
      }

      return {
        content: extracted.text,
        parts: extracted.parts,
        ...(extracted.assistantMessageId ? { assistantMessageId: extracted.assistantMessageId } : {}),
      };
    } catch (error) {
      const errorPayload =
        (error as Error & { opencode?: OpenCodeErrorPayload }).opencode ??
        buildOpenCodeError(error, { model: configStore.get()?.provider.default });
      const thrown = new Error(errorPayload.error);
      (thrown as Error & { opencode?: OpenCodeErrorPayload }).opencode = errorPayload;
      throw thrown;
    }
  }

  /**
   * Send a message to the active session and get a response
   */
  async sendMessage(
    content: string,
    webContents?: Electron.WebContents,
    options?: { skipTaskTracking?: boolean; skipWorkflowSync?: boolean }
  ): Promise<{
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

    const systemPrompt = await this.getSystemPrompt();

    const shouldTrackTasks = Boolean(webContents) && !options?.skipTaskTracking;
    if (shouldTrackTasks) {
      this.startTaskPromotionTracking(this.activeSessionId!, { message: content });
    }

    // Notify renderer that we're processing
    if (webContents) {
      webContents.send('opencode:progress', { status: 'thinking', sessionId: this.activeSessionId });
    }

    const previousAssistant = await this.recoverLatestAssistantPayload(this.activeSessionId!);
    const promptStartedAtMs = Date.now();

    try {
      const result = await this.promptWithReliabilityPolicy({
        sessionId: this.activeSessionId!,
        webContents,
        body: {
          agent: this.defaultAgent,
          system: systemPrompt,
          parts: [{ type: 'text', text: content }],
        },
      });

      console.log('[ProcessManager] Prompt result received:', result.data ? 'YES' : 'NO');
      if (result.error) {
        // promptWithReliabilityPolicy should throw before returning an error, but guard just in case.
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

      let extracted = this.extractPromptPayload(result.data);
      if (extracted.text.trim().length === 0) {
        const recovered = await this.recoverLatestAssistantPayload(this.activeSessionId!);
        if (recovered) extracted = recovered;
      }
      if (extracted.text.trim().length === 0) {
        const waited = await this.waitForAssistantPayload({
          sessionId: this.activeSessionId!,
          startedAtMs: promptStartedAtMs,
          previousAssistantMessageId: previousAssistant?.assistantMessageId,
          timeoutMs: 60000,
        });
        if (waited) extracted = waited;
      }
      if (extracted.text.trim().length === 0 && extracted.parts.length === 0) {
        throw new Error('OpenCode returned no assistant output for this prompt');
      }

      const parts = extracted.parts;
      console.log('[ProcessManager] Response parts count:', parts.length);
      const textContent = extracted.text || '';

      console.log('[ProcessManager] Response text length:', textContent.length);
      if (textContent.length > 0) {
        console.log('[ProcessManager] Response preview:', textContent.substring(0, 100));
      }

      // Send the complete message to renderer
      const assistantMessage = {
        id: extracted.assistantMessageId || Date.now().toString(),
        role: 'assistant' as const,
        content: textContent || ' ',
        timestamp: new Date().toISOString(),
        parts: parts,
      };

      if (!options?.skipWorkflowSync) {
        this.syncWorkflowRunFromAssistant(this.activeSessionId!, textContent, assistantMessage.id);
      }

      if (webContents) {
        webContents.send('opencode:message', assistantMessage);
        webContents.send('opencode:progress', { status: 'idle', sessionId: this.activeSessionId });
        if (shouldTrackTasks) {
          this.finishTaskTracking(this.activeSessionId!, webContents, textContent);
        }
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
   * Cancel the active in-flight generation, if any
   */
  async cancelActiveGeneration(expectedSessionId?: string | null): Promise<{ cancelled: boolean }> {
    const activeGenerationSessionId = this.activePromptSessionId;
    if (!activeGenerationSessionId) {
      return { cancelled: false };
    }

    const normalizedExpectedSessionId =
      typeof expectedSessionId === 'string' ? expectedSessionId.trim() : '';
    if (normalizedExpectedSessionId && normalizedExpectedSessionId !== activeGenerationSessionId) {
      return { cancelled: false };
    }

    let cancelled = false;

    if (this.activePromptAbortController && !this.activePromptAbortController.signal.aborted) {
      this.activePromptAbortController.abort();
      cancelled = true;
    }

    this.reliabilityRetryState.delete(activeGenerationSessionId);

    if (this.instance?.client) {
      const client = this.instance.client as unknown as {
        session?: {
          abort?: (input: { path: { id: string } } | { body: { id: string } }) => Promise<{ error?: unknown }>;
          cancel?: (input: { path: { id: string } } | { body: { id: string } }) => Promise<{ error?: unknown }>;
          stop?: (input: { path: { id: string } } | { body: { id: string } }) => Promise<{ error?: unknown }>;
        };
      };

      const handlers = [client.session?.abort, client.session?.cancel, client.session?.stop].filter(
        (handler): handler is NonNullable<typeof handler> => typeof handler === 'function'
      );

      for (const handler of handlers) {
        try {
          const result = await handler({ path: { id: activeGenerationSessionId } });
          if (!result?.error) {
            cancelled = true;
            break;
          }
        } catch {
          try {
            const result = await handler({ body: { id: activeGenerationSessionId } });
            if (!result?.error) {
              cancelled = true;
              break;
            }
          } catch {
            // Continue trying additional API signatures.
          }
        }
      }
    }

    return { cancelled };
  }

  async streamMessage(content: string, webContents: Electron.WebContents): Promise<void> {
    if (!this.instance?.client) {
      throw new Error('OpenCode not started');
    }

    // Ensure we have a session
    if (!this.activeSessionId) {
      await this.createSession();
    }
    const requestSessionId = this.activeSessionId!;

    const systemPrompt = await this.getSystemPrompt();

    this.startTaskPromotionTracking(requestSessionId, { message: content });

    if (this.activePromptAbortController && !this.activePromptAbortController.signal.aborted) {
      this.activePromptAbortController.abort();
    }
    const promptAbortController = new AbortController();
    this.activePromptAbortController = promptAbortController;
    this.activePromptSessionId = requestSessionId;

    // Notify renderer that we're processing
    webContents.send('opencode:progress', { status: 'thinking', sessionId: requestSessionId });

    const previousAssistant = await this.recoverLatestAssistantPayload(requestSessionId);
    const promptStartedAtMs = Date.now();

    try {
      // Send the prompt
      console.log('[ProcessManager] Calling session.prompt()...');
      const result = await this.promptWithReliabilityPolicy({
        sessionId: requestSessionId,
        webContents,
        body: {
          agent: this.defaultAgent,
          system: systemPrompt,
          parts: [{ type: 'text', text: content }],
        },
        signal: promptAbortController.signal,
      });

      console.log('[ProcessManager] session.prompt() returned:', result.data ? 'YES' : 'NO');
      if (result.error) {
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

      let extracted = this.extractPromptPayload(result.data);
      if (extracted.text.trim().length === 0) {
        const recovered = await this.recoverLatestAssistantPayload(requestSessionId);
        if (recovered) extracted = recovered;
      }
      if (extracted.text.trim().length === 0) {
        const waited = await this.waitForAssistantPayload({
          sessionId: requestSessionId,
          startedAtMs: promptStartedAtMs,
          previousAssistantMessageId: previousAssistant?.assistantMessageId,
          signal: promptAbortController.signal,
          timeoutMs: 60000,
        });
        if (waited) extracted = waited;
      }
      if (extracted.text.trim().length === 0 && extracted.parts.length === 0) {
        throw new Error('OpenCode returned no assistant output for this prompt');
      }

      if (extracted.text.trim().length === 0) {
        console.warn('[ProcessManager] Empty assistant text after prompt extraction', this.summarizePromptData(result.data));
      }

      const parts = extracted.parts;
      console.log('[ProcessManager] Response parts count:', parts.length);
      const textContent = extracted.text || '';

      console.log('[ProcessManager] Response text length:', textContent.length);
      if (textContent.length > 0) {
        console.log('[ProcessManager] Response preview:', textContent.substring(0, 100));
      }

      this.finishTaskTracking(requestSessionId, webContents, textContent);

      // Send the complete message to renderer
      const assistantMessage = {
        id: extracted.assistantMessageId || Date.now().toString(),
        role: 'assistant' as const,
        content: textContent || ' ',
        timestamp: new Date().toISOString(),
        parts: parts,
      };

      this.syncWorkflowRunFromAssistant(requestSessionId, textContent, assistantMessage.id);

      console.log('[ProcessManager] Sending message to renderer:', assistantMessage.id, 'content length:', assistantMessage.content.length);
      webContents.send('opencode:message', assistantMessage);
      console.log('[ProcessManager] Message sent to renderer successfully');
      webContents.send('opencode:progress', { status: 'idle', sessionId: requestSessionId });

    } catch (error) {
      if (this.isAbortLikeError(error) || promptAbortController.signal.aborted) {
        this.clearTaskTracking(requestSessionId);
        webContents.send('opencode:progress', { status: 'idle', sessionId: requestSessionId });
        return;
      }

      console.error('Error in streamMessage:', error);
      const errorPayload =
        (error as Error & { opencode?: OpenCodeErrorPayload }).opencode ??
        buildOpenCodeError(error, { model: configStore.get()?.provider.default });
      webContents.send('opencode:error', errorPayload);
      webContents.send('opencode:progress', { status: 'error', sessionId: requestSessionId });
      throw error;
    } finally {
      if (this.activePromptAbortController === promptAbortController) {
        this.activePromptAbortController = null;
        this.activePromptSessionId = null;
      }
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

    approvalsAuditStore.configure({ dataDir: configStore.getDataDir() });

    // Abort any existing stream
    if (this.eventStreamAbortController) {
      this.eventStreamAbortController.abort();
    }

    this.eventStreamAbortController = new AbortController();
    this.eventStreamWebContents = webContents;

    console.log('Starting OpenCode event stream...');

    const extractRequestId = (properties: unknown): string | undefined => {
      if (!properties || typeof properties !== 'object') return undefined;
      const record = properties as Record<string, unknown>;
      const nestedPermission =
        record.permission && typeof record.permission === 'object' && !Array.isArray(record.permission)
          ? (record.permission as Record<string, unknown>)
          : null;
      const candidates = [
        record.requestID,
        record.requestId,
        record.request_id,
        record.permissionID,
        record.permissionId,
        record.permission_id,
        nestedPermission?.id,
        nestedPermission?.requestID,
        nestedPermission?.requestId,
        record.id,
      ];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          return candidate.trim();
        }
      }
      return undefined;
    };

    const extractApprovalReply = (properties: unknown): string | undefined => {
      if (!properties || typeof properties !== 'object') return undefined;
      const record = properties as Record<string, unknown>;
      const candidates = [record.reply, record.decision, record.response, record.result, record.outcome];
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          return candidate.trim();
        }
      }

      const boolCandidates = [record.approved, record.allow, record.allowed, record.granted];
      for (const candidate of boolCandidates) {
        if (typeof candidate === 'boolean') {
          return candidate ? 'approve' : 'deny';
        }
      }

      return undefined;
    };

    const buildApprovalAuditSummary = (eventType: string, payload: unknown): Record<string, unknown> => {
      const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
      const title = typeof record.title === 'string' ? record.title : undefined;
      const summary = typeof record.summary === 'string' ? record.summary : undefined;
      const body = typeof record.body === 'string' ? record.body : undefined;
      return {
        eventType,
        title,
        summary,
        bodyLength: body ? body.length : undefined,
        bodyPreview: body ? body.slice(0, 1000) : undefined,
      };
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
            const isApprovalType =
              typedEvent.type === 'permission.asked' ||
              typedEvent.type?.startsWith('permission.') ||
              typedEvent.type?.startsWith('approval.');
            if (requestId && sessionId !== 'unknown-session' && isApprovalType) {
              approvalPolicyStore.trackRequest(requestId, sessionId);

              if (
                (typedEvent.type === 'permission.asked' || typedEvent.type === 'permission.updated') &&
                approvalPolicyStore.isSessionAlwaysApprove(sessionId)
              ) {
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
              this.handleTaskStoreFromNormalizedEvent(typedEvent.type, normalized, sessionId, webContents);
              const isApprovalEvent =
                normalized.event.kind === 'approval_request' || normalized.event.kind === 'approval_response';

              if (normalized.event.kind === 'approval_request') {
                const payload = normalized.payload;
                const payloadRecord = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
                const payloadRequestId = payloadRecord && typeof payloadRecord.requestId === 'string' ? payloadRecord.requestId : requestId;
                if (payloadRequestId) {
                  this.notifyApprovalRequest({
                    requestId: payloadRequestId,
                    sessionId,
                    webContents,
                    title: payloadRecord?.title ?? normalized.event.title,
                    summary: payloadRecord?.summary,
                    detail: normalized.event.detail,
                  });
                }
              }

              if (isApprovalEvent) {
                const payload = normalized.payload;
                const payloadRecord = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
                const payloadRequestId = payloadRecord && typeof payloadRecord.requestId === 'string' ? payloadRecord.requestId : requestId;
                const replyValue = normalized.event.kind === 'approval_response' ? extractApprovalReply(typedEvent.properties) : undefined;

                if (payloadRequestId) {
                  approvalsAuditStore.log({
                    kind: normalized.event.kind === 'approval_request' ? 'request' : 'response',
                    requestId: payloadRequestId,
                    sessionId,
                    reply: replyValue,
                    timestamp: Date.now(),
                    summary: buildApprovalAuditSummary(typedEvent.type ?? 'unknown', payloadRecord ?? {}),
                    redacted: Boolean(normalized.redacted),
                  });
                }
              }

              const shouldStore =
                isApprovalEvent ||
                (this.persistedTimelineSessions.has(sessionId) && (payloadSessionId || sessionId === this.activeSessionId));
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

      return (result.data as unknown[])
        .map((rawMsg) => {
          const msg = this.asRecord(rawMsg);
          if (!msg) return null;
          const info = this.asRecord(msg.info);
          const id = typeof info?.id === 'string' ? info.id : Date.now().toString();
          const role = typeof info?.role === 'string' ? info.role : 'assistant';
          const timestamp = typeof info?.createdAt === 'string' ? info.createdAt : new Date().toISOString();
          const parts = this.normalizeResponseParts(msg.parts ?? msg.content);
          const content = parts
            .filter((part) => part.type === 'text' || part.type === 'output_text')
            .map((part) => part.text ?? '')
            .join('');

          return {
            id,
            role,
            content: content.length > 0 ? content : ' ',
            timestamp,
          };
        })
        .filter((msg): msg is { id: string; role: string; content: string; timestamp: string } => Boolean(msg));
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
    if (this.getWorkflowTaskRunId(sessionId)) {
      return;
    }
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
        this.handleTaskStoreFromNormalizedEvent('task.promoted', promotion, sessionId, webContents);
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

  private syncWorkflowRunFromAssistant(sessionId: string, content: string, assistantMessageId?: string): void {
    if (!sessionId || !content.trim()) return;

    try {
      workflowRunStore.configure({ dataDir: configStore.getDataDir() });
      taskStore.configure({ dataDir: configStore.getDataDir() });

      const run = workflowRunStore.getRunBySessionId(sessionId);
      if (!run) return;

      const parsed = parseResponseHeader(content);
      const needsInput = parsed.hasHeader ? parsed.status === 'needs_response' : requiresUserInput(content);
      const isInProgress = parsed.hasHeader && parsed.status === 'in_progress';
      const isBlocked = parsed.hasHeader && parsed.status === 'blocked';
      const isComplete = parsed.hasHeader ? parsed.status === 'complete' : !needsInput;
      const now = Date.now();
      const runStatus = isBlocked
        ? 'failed'
        : needsInput
          ? 'needs_response'
          : isInProgress
            ? 'running'
            : isComplete
              ? 'completed'
              : 'running';

      workflowRunStore.updateRun(run.id, {
        status: runStatus,
        ...(runStatus === 'completed' || runStatus === 'failed' ? { finishedAt: now } : {}),
        ...(assistantMessageId ? { assistantMessageId } : {}),
        outputPreview: clampText(content, 280),
      });

      workflowRunStore.createArtifact({
        artifactId: randomUUID(),
        workflowRunId: run.id,
        kind: 'final_output',
        title: 'Final output',
        mime: 'text/plain',
        createdAt: now,
        payloadText: content,
      });

      if (run.taskRunId) {
        const existingTask = taskStore.getRun(run.taskRunId);
        taskStore.updateRun(run.taskRunId, {
          status: runStatus === 'completed' ? 'completed' : runStatus === 'failed' ? 'failed' : 'running',
          ...(needsInput ? { blockingReason: { kind: 'response' } } : { blockingReason: undefined }),
          progress: runStatus === 'completed' ? 100 : needsInput ? 50 : Math.max(60, existingTask?.progress ?? 0),
          updatedAt: now,
          ...(needsInput
            ? { description: 'Waiting for input...' }
            : existingTask?.description === 'Waiting for input...'
              ? { description: 'Running...' }
              : {}),
        });
      }
    } catch (error) {
      console.warn('[ProcessManager] Failed to sync workflow run from assistant response:', error);
    }
  }

  private clearTaskTracking(sessionId: string) {
    this.taskPromotionState.delete(sessionId);
  }

  private finishTaskTracking(sessionId: string, webContents: Electron.WebContents, detail?: string) {
    if (this.getWorkflowTaskRunId(sessionId)) {
      this.clearTaskTracking(sessionId);
      return;
    }
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
      this.handleTaskStoreFromNormalizedEvent('task.completed', completion, sessionId, webContents);
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
      this.handleTaskStoreFromNormalizedEvent('task.summary', summary, sessionId, webContents);
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
    this.registerTimelineSession(sessionId);
    if (this.getWorkflowTaskRunId(sessionId)) {
      return;
    }
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
    const sessionId = await this.resolveSessionIdForApprovalRequest(requestId.trim());

    const v2Client = this.instance.client as unknown as {
      permission?: {
        reply: (input: {
          requestID: string;
          reply: 'once' | 'always' | 'reject';
        }) => Promise<{ error?: unknown }>;
      };
    };
    const legacyClient = this.instance.client as unknown as {
      postSessionIdPermissionsPermissionId?: (input: {
        path: { id: string; permissionID: string };
        body: { response: 'once' | 'always' | 'reject' };
      }) => Promise<{ error?: unknown }>;
    };

    let result: { error?: unknown } | undefined;
    if (v2Client.permission?.reply) {
      result = await v2Client.permission.reply({
        requestID: requestId.trim(),
        reply: mappedReply,
      });
    } else if (legacyClient.postSessionIdPermissionsPermissionId) {
      if (!sessionId) {
        throw new Error('Unable to resolve session for approval request');
      }

      result = await legacyClient.postSessionIdPermissionsPermissionId({
        path: {
          id: sessionId,
          permissionID: requestId.trim(),
        },
        body: {
          response: mappedReply,
        },
      });
    } else {
      throw new Error('OpenCode permission API unavailable');
    }

    if (result?.error) {
      throw new Error(`Failed to reply to approval request: ${JSON.stringify(result.error)}`);
    }

    if (reply === 'always' && sessionId) {
      approvalPolicyStore.setSessionAlwaysApprove(sessionId, true);
    }
    approvalPolicyStore.untrackRequest(requestId);
  }
}

export const processManager = new ProcessManager();
export default processManager;

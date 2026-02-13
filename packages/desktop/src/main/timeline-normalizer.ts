import { TimelineEvent } from './timeline-types.js';

type OpenCodeEventPayload = Record<string, unknown>;

const SECRET_PATTERN = /(token|secret|key|password|credential|bearer)/i;

const MAX_DETAIL_LENGTH = 120;

let eventSequence = 0;

// Approval payloads should NOT be truncated - users need full context to make
// informed decisions. TimelineStore handles large payloads via inline/blob storage
// (10KB inline, blob for larger). The UI (ApprovalCard) is responsible for
// rendering large content gracefully with expandable sections.
// See Phase 5.5 Step 2 in PLAN.md for details.

const friendlyToolNames: Record<string, string> = {
  gmail: 'Gmail',
  gcal: 'Google Calendar',
  notion: 'Notion',
  system: 'System',
};

const clampDetail = (value?: string) => {
  if (!value) return undefined;
  if (value.length <= MAX_DETAIL_LENGTH) return value;
  return `${value.slice(0, MAX_DETAIL_LENGTH)}…`;
};

const extractToolName = (data: OpenCodeEventPayload) => {
  const candidates = [
    data.tool,
    data.toolName,
    data.name,
    data.service,
    data.provider,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const normalized = candidate.toLowerCase();
      return friendlyToolNames[normalized] || candidate;
    }
  }

  return undefined;
};

const extractDetail = (data: OpenCodeEventPayload) => {
  const candidates = [data.action, data.intent, data.summary, data.step];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return clampDetail(candidate);
    }
  }

  return undefined;
};

const formatRetryDetail = (data: OpenCodeEventPayload) => {
  const candidates = [data.message, data.error, data.reason, data.summary];
  let message: string | undefined;
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      message = candidate.trim();
      break;
    }
  }

  const next = typeof data.next === 'number' ? data.next : undefined;
  if (!message && !next) return undefined;

  if (message && next) {
    return clampDetail(`${message} (next retry at ${new Date(next).toISOString()})`);
  }

  if (message) return clampDetail(message);
  return clampDetail(`Retry scheduled at ${new Date(next!).toISOString()}`);
};

const listFromUnknown = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }

  return [];
};

const humanizePermission = (value?: string) => {
  if (!value) return undefined;
  const normalized = value
    .replace(/[._]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return undefined;
  return normalized;
};

const objectFromUnknown = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const extractApprovalPayload = (data: OpenCodeEventPayload, fallbackDetail?: string) => {
  const requestIdCandidates = [
    data.requestId,
    data.requestID,
    data.request_id,
    data.permissionId,
    data.permissionID,
    data.permission_id,
    objectFromUnknown(data.permission)?.id,
    objectFromUnknown(data.permission)?.requestID,
    objectFromUnknown(data.permission)?.requestId,
    data.id,
  ];
  const permissionName =
    (typeof data.permission === 'string' && data.permission.trim()) ||
    (typeof data.type === 'string' && data.type.trim()) ||
    undefined;
  const patterns = listFromUnknown(data.patterns).concat(listFromUnknown(data.pattern));
  const alwaysPatterns = listFromUnknown(data.always);
  const metadata = objectFromUnknown(data.metadata);
  const tool = objectFromUnknown(data.tool);

  const explicitTitleCandidates = [data.title, data.action, data.intent, data.summary];
  const explicitSummaryCandidates = [data.summary, data.intent, data.action, fallbackDetail];
  const explicitBodyCandidates = [data.body, data.preview, data.message];

  const pickText = (candidates: unknown[]) => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return undefined;
  };

  const explicitTitle = pickText(explicitTitleCandidates);
  const explicitSummary = pickText(explicitSummaryCandidates);
  const explicitBody = pickText(explicitBodyCandidates);

  let requestId: string | undefined;
  for (const candidate of requestIdCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      requestId = candidate;
      break;
    }
  }

  const permissionLabel = humanizePermission(permissionName);
  const title =
    explicitTitle ??
    (permissionLabel ? `Approval requested: ${permissionLabel}` : 'Approval requested');

  // Approval summaries are NOT truncated - users need full context.
  // TimelineStore handles large payloads via blob storage.
  const summary =
    explicitSummary ??
    (() => {
      if (permissionLabel && patterns.length > 0) {
        const preview = patterns.slice(0, 2).join(', ');
        const extra = patterns.length > 2 ? ` +${patterns.length - 2} more` : '';
        return `${permissionLabel} requested for ${preview}${extra}`;
      }
      if (permissionLabel) {
        return `${permissionLabel} permission requested`;
      }
      if (fallbackDetail) {
        return fallbackDetail;
      }
      return undefined;
    })();

  // Approval bodies are NOT truncated - users need full context to make
  // informed decisions. The UI (ApprovalCard) handles large content.
  const body =
    explicitBody ??
    (() => {
      const sections: string[] = [];

      if (permissionLabel) {
        sections.push(`Permission: ${permissionLabel}`);
      }

      if (patterns.length > 0) {
        sections.push(`Targets:\n${patterns.map((pattern) => `- ${pattern}`).join('\n')}`);
      }

      if (alwaysPatterns.length > 0) {
        sections.push(
          `Always-approve scope:\n${alwaysPatterns.map((pattern) => `- ${pattern}`).join('\n')}`
        );
      }

      if (tool) {
        const details = [
          typeof tool.messageID === 'string' && tool.messageID ? `message: ${tool.messageID}` : '',
          typeof tool.callID === 'string' && tool.callID ? `call: ${tool.callID}` : '',
        ].filter(Boolean);
        if (details.length > 0) {
          sections.push(`Tool call: ${details.join(' | ')}`);
        }
      }

      if (metadata && Object.keys(metadata).length > 0) {
        sections.push(`Metadata:\n${JSON.stringify(metadata, null, 2)}`);
      }

      if (sections.length === 0) {
        return undefined;
      }

      return sections.join('\n\n');
    })();

  return {
    requestId,
    title,
    summary,
    body,
    approveLabel: typeof data.approveLabel === 'string' ? data.approveLabel : undefined,
    alwaysApproveLabel:
      typeof data.alwaysApproveLabel === 'string' ? data.alwaysApproveLabel : undefined,
    denyLabel: typeof data.denyLabel === 'string' ? data.denyLabel : undefined,
  };
};

const redactValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (SECRET_PATTERN.test(key)) {
          return [key, '[REDACTED]'];
        }
        return [key, redactValue(entry)];
      })
    );
  }

  return value;
};

export const redactPayload = (payload: OpenCodeEventPayload | null): { payload: OpenCodeEventPayload | null; redacted: boolean } => {
  if (!payload) return { payload, redacted: false };

  let redacted = false;
  const sanitized = Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (SECRET_PATTERN.test(key)) {
        redacted = true;
        return [key, '[REDACTED]'];
      }
      const nextValue = redactValue(value);
      if (nextValue !== value) {
        redacted = true;
      }
      return [key, nextValue];
    })
  ) as OpenCodeEventPayload;

  return { payload: sanitized, redacted };
};

const buildBaseEvent = (
  input: {
    sessionId: string;
    taskId?: string;
    kind: TimelineEvent['kind'];
    title: string;
    detail?: string;
    toolName?: string;
  }
): Omit<TimelineEvent, 'payloadInline' | 'payloadRef'> => ({
  // Deterministic within a process lifetime; avoids Math.random() nondeterminism.
  id: `${input.kind}-${Date.now()}-${(eventSequence += 1)}`,
  sessionId: input.sessionId,
  taskId: input.taskId,
  timestamp: Date.now(),
  kind: input.kind,
  title: input.title,
  detail: input.detail,
  toolName: input.toolName,
});

const formatReliabilityRetryDetail = (data: OpenCodeEventPayload) => {
  const attempt = typeof data.attempt === 'number' ? data.attempt : undefined;
  const maxAttempts = typeof data.maxAttempts === 'number' ? data.maxAttempts : undefined;
  const waitMs = typeof data.waitMs === 'number' ? data.waitMs : undefined;
  const waitSeconds = typeof data.waitSeconds === 'number'
    ? data.waitSeconds
    : waitMs !== undefined
      ? Math.max(1, Math.ceil(waitMs / 1000))
      : undefined;
  const reason = typeof data.reason === 'string' && data.reason.trim().length > 0
    ? data.reason.trim()
    : typeof data.error === 'string' && data.error.trim().length > 0
      ? data.error.trim()
      : typeof data.message === 'string' && data.message.trim().length > 0
        ? data.message.trim()
        : undefined;

  const parts: string[] = [];
  if (attempt && maxAttempts) {
    parts.push(`Attempt ${attempt}/${maxAttempts}`);
  } else if (attempt) {
    parts.push(`Attempt ${attempt}`);
  }

  if (waitSeconds !== undefined) {
    parts.push(`Retrying in ${waitSeconds}s`);
  }

  if (reason) {
    parts.push(clampDetail(reason) ?? reason);
  }

  return parts.length > 0 ? clampDetail(parts.join(' - ')) : undefined;
};

const formatReliabilityFailureDetail = (data: OpenCodeEventPayload) => {
  const attempt = typeof data.attempt === 'number' ? data.attempt : undefined;
  const maxAttempts = typeof data.maxAttempts === 'number' ? data.maxAttempts : undefined;
  const reason = typeof data.reason === 'string' && data.reason.trim().length > 0
    ? data.reason.trim()
    : typeof data.error === 'string' && data.error.trim().length > 0
      ? data.error.trim()
      : typeof data.message === 'string' && data.message.trim().length > 0
        ? data.message.trim()
        : undefined;
  const action = typeof data.action === 'string' && data.action.trim().length > 0
    ? data.action.trim()
    : undefined;

  const parts: string[] = [];
  if (attempt && maxAttempts) {
    parts.push(`Retry budget exhausted (${attempt}/${maxAttempts})`);
  } else {
    parts.push('Retry budget exhausted');
  }
  if (reason) parts.push(clampDetail(reason) ?? reason);
  if (action) parts.push(clampDetail(action) ?? action);
  return clampDetail(parts.join(' - '));
};

export const normalizeOpenCodeEvent = (event: { type?: string; properties?: unknown }, sessionId: string): {
  event: Omit<TimelineEvent, 'payloadInline' | 'payloadRef'>;
  payload?: OpenCodeEventPayload;
  redacted?: boolean;
} | null => {
  const payload = (event.properties && typeof event.properties === 'object') ? (event.properties as OpenCodeEventPayload) : null;
  const { payload: sanitizedPayload, redacted } = redactPayload(payload);

  const type = event.type ?? 'unknown';
  const toolName = sanitizedPayload ? extractToolName(sanitizedPayload) : undefined;
  const detail = sanitizedPayload ? extractDetail(sanitizedPayload) : undefined;

  if (type === 'flowstate.reliability.retry') {
    return {
      event: buildBaseEvent({
        sessionId,
        kind: 'status',
        title: 'Retrying integration',
        detail: formatReliabilityRetryDetail(sanitizedPayload ?? {}) ?? detail ?? 'Retrying after integration failure',
      }),
      payload: sanitizedPayload ?? undefined,
      redacted,
    };
  }

  if (type === 'flowstate.reliability.failed') {
    return {
      event: buildBaseEvent({
        sessionId,
        kind: 'error',
        title: 'Integration failed',
        detail: formatReliabilityFailureDetail(sanitizedPayload ?? {}) ?? detail ?? 'Integration failure after retries',
      }),
      payload: sanitizedPayload ?? undefined,
      redacted,
    };
  }

  if (type.startsWith('message.')) {
    return {
      event: buildBaseEvent({
        sessionId,
        kind: 'phase',
        title: 'Drafting response',
        detail: detail ?? 'Composing the next response',
      }),
      payload: sanitizedPayload ?? undefined,
      redacted,
    };
  }

  if (type.startsWith('session.')) {
    const statusType =
      typeof sanitizedPayload?.type === 'string'
        ? sanitizedPayload.type
        : typeof sanitizedPayload?.status === 'string'
          ? sanitizedPayload.status
          : typeof sanitizedPayload?.status === 'object' && sanitizedPayload.status
            ? ((sanitizedPayload.status as { type?: unknown }).type as string | undefined)
            : undefined;

    if (statusType === 'retry') {
      return {
        event: buildBaseEvent({
          sessionId,
          kind: 'error',
          title: 'Request delayed',
          detail: formatRetryDetail(sanitizedPayload ?? {}) ?? detail ?? 'Request delayed due to provider retry',
        }),
        payload: sanitizedPayload ?? undefined,
        redacted,
      };
    }

    return {
      event: buildBaseEvent({
        sessionId,
        kind: 'status',
        title: 'Session updated',
        detail: detail ?? 'Session state changed',
      }),
      payload: sanitizedPayload ?? undefined,
      redacted,
    };
  }

  if (type === 'task.promoted') {
    const taskId = typeof sanitizedPayload?.taskId === 'string'
      ? sanitizedPayload.taskId
      : undefined;
    return {
      event: buildBaseEvent({
        sessionId,
        taskId,
        kind: 'status',
        title: 'Task promoted',
        detail: detail ?? 'This request is now running as a Task',
      }),
      payload: sanitizedPayload ?? undefined,
      redacted,
    };
  }

  if (type === 'task.completed') {
    const taskId = typeof sanitizedPayload?.taskId === 'string'
      ? sanitizedPayload.taskId
      : undefined;
    return {
      event: buildBaseEvent({
        sessionId,
        taskId,
        kind: 'status',
        title: 'Task completed',
        detail: detail ?? 'Task finished successfully',
      }),
      payload: sanitizedPayload ?? undefined,
      redacted,
    };
  }

  if (type === 'task.summary') {
    const taskId = typeof sanitizedPayload?.taskId === 'string'
      ? sanitizedPayload.taskId
      : undefined;
    return {
      event: buildBaseEvent({
        sessionId,
        taskId,
        kind: 'status',
        title: 'Task summary',
        detail: detail ?? 'Task summary ready',
      }),
      payload: sanitizedPayload ?? undefined,
      redacted,
    };
  }

  if (type.startsWith('tool.') || type.includes('tool') || type.includes('mcp')) {
    return {
      event: buildBaseEvent({
        sessionId,
        kind: type.includes('result') ? 'tool_result' : 'tool_call',
        title: toolName ? `Using ${toolName}` : 'Using tool',
        detail: detail ?? (toolName ? `Running ${toolName}` : 'Running tool'),
        toolName,
      }),
      payload: sanitizedPayload ?? undefined,
      redacted,
    };
  }

  if (type.startsWith('permission.') || type.startsWith('approval.')) {
    const approvalPayload = extractApprovalPayload(sanitizedPayload ?? {}, detail);

    const isRequest =
      type === 'permission.updated' ||
      type.endsWith('.asked') ||
      type.includes('asked') ||
      type.includes('request');

    return {
      event: buildBaseEvent({
        sessionId,
        kind: isRequest ? 'approval_request' : 'approval_response',
        title: approvalPayload.title ?? (isRequest ? 'Approval requested' : 'Approval updated'),
        detail: approvalPayload.summary ?? detail ?? (isRequest ? 'User approval required' : 'Approval response recorded'),
      }),
      payload: approvalPayload,
      redacted,
    };
  }

  if (type.startsWith('error')) {
    return {
      event: buildBaseEvent({
        sessionId,
        kind: 'error',
        title: 'Error',
        detail: detail ?? 'An error occurred',
      }),
      payload: sanitizedPayload ?? undefined,
      redacted,
    };
  }

  return {
    event: buildBaseEvent({
      sessionId,
      kind: 'status',
      title: 'Activity update',
      detail: detail ?? 'Working...',
    }),
    payload: sanitizedPayload ?? undefined,
    redacted,
  };
};

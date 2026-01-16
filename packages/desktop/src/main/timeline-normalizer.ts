import { TimelineEvent } from './timeline-types.js';

type OpenCodeEventPayload = Record<string, unknown>;

const SECRET_PATTERN = /(token|secret|key|password|credential|bearer)/i;

const MAX_DETAIL_LENGTH = 120;

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

const extractApprovalPayload = (data: OpenCodeEventPayload, fallbackDetail?: string) => {
  const titleCandidates = [data.title, data.action, data.intent, data.summary];
  const summaryCandidates = [data.summary, data.intent, data.action, fallbackDetail];
  const bodyCandidates = [data.body, data.preview, data.message];

  const pickText = (candidates: unknown[]) => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return clampDetail(candidate);
      }
    }
    return undefined;
  };

  const title = pickText(titleCandidates);
  const summary = pickText(summaryCandidates);
  const body = pickText(bodyCandidates);

  return {
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
  id: `${input.kind}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  sessionId: input.sessionId,
  taskId: input.taskId,
  timestamp: Date.now(),
  kind: input.kind,
  title: input.title,
  detail: input.detail,
  toolName: input.toolName,
});

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
    return {
      event: buildBaseEvent({
        sessionId,
        kind: type.includes('approved') ? 'approval_response' : 'approval_request',
        title: approvalPayload.title ?? (type.includes('approved') ? 'Approval granted' : 'Approval requested'),
        detail: approvalPayload.summary ?? detail ?? 'User approval required',
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

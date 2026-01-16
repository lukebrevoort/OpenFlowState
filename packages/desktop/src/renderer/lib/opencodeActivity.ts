import type { OpenCodeEvent } from '../types/electron';

export type ActivityStep = {
  id: string;
  title: string;
  detail?: string;
  kind: 'phase' | 'tool' | 'note';
  dedupeKey?: string;
  timestamp: number;
};

const MAX_DETAIL_LENGTH = 120;

const friendlyToolNames: Record<string, string> = {
  gmail: 'Gmail',
  gcal: 'Google Calendar',
  notion: 'Notion',
  system: 'System',
};

const sanitizeLabel = (value: string) => {
  const trimmed = value.replace(/[_-]+/g, ' ').trim();
  if (!trimmed) return '';
  return trimmed
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const clampDetail = (value?: string) => {
  if (!value) return undefined;
  if (value.length <= MAX_DETAIL_LENGTH) return value;
  return `${value.slice(0, MAX_DETAIL_LENGTH)}…`;
};

const extractToolName = (data: Record<string, unknown>) => {
  const candidates = [
    data.tool,
    data.toolName,
    data.name,
    data.service,
    data.provider,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      const sanitized = candidate.toLowerCase();
      return friendlyToolNames[sanitized] || sanitizeLabel(candidate);
    }
  }

  return null;
};

const extractDetail = (data: Record<string, unknown>) => {
  const candidates = [data.action, data.intent, data.summary, data.step, data.message, data.plan];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return clampDetail(candidate);
    }
  }

  return undefined;
};

export const initialActivitySteps = (): ActivityStep[] => [
  {
    id: `phase-intent-${Date.now()}`,
    title: 'Understanding your request',
    detail: 'Analyzing goals and constraints',
    kind: 'phase',
    dedupeKey: 'phase-intent',
    timestamp: Date.now(),
  },
];

export const completionActivityStep = (): ActivityStep => ({
  id: `phase-complete-${Date.now()}`,
  title: 'Done',
  detail: 'Response ready',
  kind: 'phase',
  dedupeKey: 'phase-complete',
  timestamp: Date.now(),
});

export const errorActivityStep = (): ActivityStep => ({
  id: `phase-error-${Date.now()}`,
  title: 'Something went wrong',
  detail: 'Try again or refresh connections',
  kind: 'note',
  dedupeKey: 'phase-error',
  timestamp: Date.now(),
});

export const stepFromOpenCodeEvent = (event: OpenCodeEvent): ActivityStep | null => {
  const timestamp = Date.now();
  const data = typeof event.data === 'object' && event.data ? (event.data as Record<string, unknown>) : {};

  if (event.type?.startsWith('message.')) {
    return {
      id: `phase-message-${timestamp}`,
      title: 'Drafting response',
      detail: extractDetail(data) || 'Composing the best answer',
      kind: 'phase',
      dedupeKey: 'phase-draft',
      timestamp,
    };
  }

  if (event.type === 'session.updated') {
    return {
      id: `phase-session-${timestamp}`,
      title: 'Planning approach',
      detail: extractDetail(data) || 'Mapping the next steps',
      kind: 'phase',
      dedupeKey: 'phase-plan',
      timestamp,
    };
  }

  if (event.type?.includes('tool') || event.type?.includes('mcp')) {
    const toolName = extractToolName(data) || 'Tool';
    return {
      id: `tool-${toolName}-${timestamp}`,
      title: `Using ${toolName}`,
      detail: extractDetail(data) || 'Fetching the latest context',
      kind: 'tool',
      dedupeKey: `tool-${toolName}`,
      timestamp,
    };
  }

  const toolName = extractToolName(data);
  if (toolName) {
    return {
      id: `tool-${toolName}-${timestamp}`,
      title: `Using ${toolName}`,
      detail: extractDetail(data) || 'Fetching the latest context',
      kind: 'tool',
      dedupeKey: `tool-${toolName}`,
      timestamp,
    };
  }

  return null;
};

export const mergeActivityStep = (steps: ActivityStep[], step: ActivityStep, limit = 10) => {
  const dedupeKey = step.dedupeKey || step.title;
  const lastStep = steps[steps.length - 1];

  if (lastStep && (lastStep.dedupeKey || lastStep.title) === dedupeKey) {
    const updated = { ...lastStep, ...step, id: lastStep.id };
    return [...steps.slice(0, -1), updated];
  }

  return [...steps, step].slice(-limit);
};

export type TimelineEventKind =
  | 'phase'
  | 'tool_call'
  | 'tool_result'
  | 'approval_request'
  | 'approval_response'
  | 'error'
  | 'status';

export type TimelineEvent = {
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
};

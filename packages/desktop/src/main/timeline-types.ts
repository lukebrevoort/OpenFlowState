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
};

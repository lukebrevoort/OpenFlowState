import { useMemo } from 'react';
import { CheckCircle2, Loader2, AlertTriangle, Wrench, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { TimelineEvent } from '../types/electron';
import { ApprovalCard } from './ApprovalCard';

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const iconByKind: Record<TimelineEvent['kind'], typeof CheckCircle2> = {
  phase: Loader2,
  tool_call: Wrench,
  tool_result: CheckCircle2,
  approval_request: ShieldQuestion,
  approval_response: ShieldCheck,
  error: AlertTriangle,
  status: Loader2,
};

const colorByKind: Record<TimelineEvent['kind'], string> = {
  phase: 'text-[#C87137]',
  tool_call: 'text-[#A5B574]',
  tool_result: 'text-[#4A7C59]',
  approval_request: 'text-[#D4A574]',
  approval_response: 'text-[#4A7C59]',
  error: 'text-destructive',
  status: 'text-muted-foreground',
};

const dedupeKeyForEvent = (event: TimelineEvent) =>
  `${event.kind}-${event.title}-${event.detail ?? ''}-${event.toolName ?? ''}`;

const latestEventByTimestamp = (events: TimelineEvent[]) => {
  // Keep behavior consistent with stable sort: for ties, prefer the first
  // occurrence in the original array.
  let latest = events[0];
  for (let i = 1; i < events.length; i += 1) {
    const candidate = events[i];
    if (candidate.timestamp > latest.timestamp) {
      latest = candidate;
    }
  }
  return latest;
};

interface ActivityTimelineProps {
  events: TimelineEvent[];
  title?: string;
  collapsed?: boolean;
  maxItems?: number;
  maxItemsExpanded?: number;
  emptyMessage?: string;
  variant?: 'default' | 'compact';
  showTimestamp?: boolean;
  animateIcons?: boolean;
  onApprove?: (event: TimelineEvent) => void | Promise<void>;
  onAlwaysApprove?: (event: TimelineEvent) => void | Promise<void>;
  onDeny?: (event: TimelineEvent) => void | Promise<void>;
}

type ApprovalInlinePayload = {
  requestId?: string;
  title?: string;
  summary?: string;
  body?: string;
  approveLabel?: string;
  alwaysApproveLabel?: string;
  denyLabel?: string;
};

const isApprovalInlinePayload = (value: unknown): value is ApprovalInlinePayload => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  return (
    'title' in maybe ||
    'summary' in maybe ||
    'body' in maybe ||
    'approveLabel' in maybe ||
    'alwaysApproveLabel' in maybe ||
    'denyLabel' in maybe
  );
};

export function ActivityTimeline({
  events,
  title = 'Activity',
  collapsed = false,
  maxItems = 5,
  maxItemsExpanded = 20,
  emptyMessage = 'No activity yet',
  variant = 'default',
  showTimestamp = true,
  animateIcons = true,
  onApprove,
  onAlwaysApprove,
  onDeny,
}: ActivityTimelineProps) {
  if (!events || events.length === 0) {
    if (variant === 'compact') {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-2.5 py-1.5">
          <div className="w-5 h-5 rounded-full bg-muted/50 border border-border flex items-center justify-center">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50" aria-hidden="true" />
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="bg-card/70 border border-border rounded-2xl p-5 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const isSingleItemCompact = variant === 'compact' && maxItems === 1;

  const latestForCompact = useMemo(() => latestEventByTimestamp(events), [events]);

  const deduped = useMemo(() => {
    if (isSingleItemCompact) {
      return null;
    }

    const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
    const seenKeys = new Set<string>();
    return sorted.filter((event) => {
      const key = dedupeKeyForEvent(event);
      if (seenKeys.has(key)) {
        return false;
      }
      seenKeys.add(key);
      return true;
    });
  }, [events, isSingleItemCompact]);

  const visible = useMemo(() => {
    if (!deduped) {
      return null;
    }
    const limit = collapsed ? maxItems : maxItemsExpanded;
    return deduped.slice(0, limit);
  }, [deduped, collapsed, maxItems, maxItemsExpanded]);

  const latest = isSingleItemCompact ? latestForCompact : visible?.[0];

  const approvalResponseAtByRequestId = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of events) {
      if (event.kind !== 'approval_response') continue;
      const payload = isApprovalInlinePayload(event.payloadInline) ? event.payloadInline : undefined;
      const requestId = typeof payload?.requestId === 'string' ? payload.requestId.trim() : '';
      if (!requestId) continue;
      const current = map.get(requestId);
      if (!current || event.timestamp > current) {
        map.set(requestId, event.timestamp);
      }
    }
    return map;
  }, [events]);

  const logFallback = (action: string, event: TimelineEvent) => {
    // eslint-disable-next-line no-console
    console.log(`[timeline] ${action}`, event);
  };

  const handleApprove = (event: TimelineEvent) => (onApprove ? onApprove(event) : logFallback('approve', event));
  const handleAlwaysApprove = (event: TimelineEvent) =>
    onAlwaysApprove ? onAlwaysApprove(event) : logFallback('always_approve', event);
  const handleDeny = (event: TimelineEvent) => (onDeny ? onDeny(event) : logFallback('deny', event));

  if (variant === 'compact') {
    const event = latest ?? latestForCompact;
    const Icon = iconByKind[event.kind] ?? Loader2;
    const tone = colorByKind[event.kind] ?? 'text-muted-foreground';
    const shouldSpin = animateIcons && event.kind === 'phase';

    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-2 py-1">
        <div
          className={`w-4 h-4 rounded-full bg-muted/50 border border-border flex items-center justify-center ${tone}`}
        >
          <Icon
            className={
              shouldSpin ? 'w-3 h-3 animate-spin' : 'w-3 h-3'
            }
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-foreground truncate">
            {event.title}
          </p>
        </div>

        {showTimestamp && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {formatTime(event.timestamp)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card/70 border border-border rounded-2xl p-5 shadow-sm backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{(deduped ?? []).length} steps</span>
      </div>
      <div className="mt-4 space-y-3">
        {(visible ?? []).map((event, index) => {
          const Icon = iconByKind[event.kind] ?? Loader2;
          const tone = colorByKind[event.kind] ?? 'text-muted-foreground';
          const isLast = index === (visible ?? []).length - 1;
          const shouldSpin = animateIcons && event.kind === 'phase';
          const inline = isApprovalInlinePayload(event.payloadInline) ? event.payloadInline : undefined;
          const isApprovalRequest = event.kind === 'approval_request';
          const requestId = isApprovalRequest
            ? (typeof inline?.requestId === 'string' ? inline.requestId.trim() : '')
            : '';
          const resolvedAt = requestId ? approvalResponseAtByRequestId.get(requestId) : undefined;
          const isResolvedApproval = Boolean(isApprovalRequest && resolvedAt && resolvedAt >= event.timestamp);

          return (
            <div key={event.id} className="flex items-start gap-3">
              <div className="relative mt-0.5">
                <div
                  className={`w-8 h-8 rounded-full bg-muted/50 border border-border flex items-center justify-center ${tone}`}
                >
                  <Icon
                    className={
                      shouldSpin ? 'w-4 h-4 animate-spin' : 'w-4 h-4'
                    }
                  />
                </div>
                {!isLast && (
                  <div className="absolute left-1/2 top-8 -translate-x-1/2 h-6 w-px bg-border" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-foreground">{event.title}</p>
                    {event.detail && (
                      <p className="text-xs text-muted-foreground mt-1">{event.detail}</p>
                    )}
                  </div>
                  {showTimestamp && (
                    <span className="text-xs text-muted-foreground">{formatTime(event.timestamp)}</span>
                  )}
                </div>
                {event.toolName && (
                  <span className="mt-2 inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                    {event.toolName}
                  </span>
                )}

                {isApprovalRequest && !isResolvedApproval && (
                  <div className="mt-3">
                    <ApprovalCard
                      title={inline?.title ?? event.title}
                      summary={inline?.summary ?? event.detail ?? 'This action requires your approval.'}
                      body={inline?.body ?? ''}
                      primaryActionLabel={inline?.approveLabel}
                      alwaysApproveLabel={inline?.alwaysApproveLabel}
                      denyLabel={inline?.denyLabel}
                      onApprove={isResolvedApproval ? undefined : () => handleApprove(event)}
                      onAlwaysApprove={isResolvedApproval ? undefined : () => handleAlwaysApprove(event)}
                      onDeny={isResolvedApproval ? undefined : () => handleDeny(event)}
                    />
                  </div>
                )}

                {isApprovalRequest && isResolvedApproval && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Request resolved
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

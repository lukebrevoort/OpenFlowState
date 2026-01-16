import { CheckCircle2, Loader2, AlertTriangle, Wrench, ShieldCheck, ShieldQuestion } from 'lucide-react';
import type { TimelineEvent } from '../types/electron';

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

interface ActivityTimelineProps {
  events: TimelineEvent[];
  title?: string;
  collapsed?: boolean;
  maxItems?: number;
  maxItemsExpanded?: number;
  emptyMessage?: string;
  variant?: 'default' | 'compact';
}

export function ActivityTimeline({
  events,
  title = 'Activity',
  collapsed = false,
  maxItems = 5,
  maxItemsExpanded = 20,
  emptyMessage = 'No activity yet',
  variant = 'default',
}: ActivityTimelineProps) {
  if (!events || events.length === 0) {
    if (variant === 'compact') {
      return <div className="text-xs text-muted-foreground">{emptyMessage}</div>;
    }

    return (
      <div className="bg-card/70 border border-border rounded-2xl p-5 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
  const seenKeys = new Set<string>();
  const deduped = sorted.filter((event) => {
    const key = `${event.kind}-${event.title}-${event.detail ?? ''}-${event.toolName ?? ''}`;
    if (seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    return true;
  });
  const visible = collapsed
    ? deduped.slice(0, maxItems)
    : deduped.slice(0, maxItemsExpanded);
  const latest = visible[0];

  if (variant === 'compact') {
    const Icon = iconByKind[latest.kind] ?? Loader2;
    const tone = colorByKind[latest.kind] ?? 'text-muted-foreground';

    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-2.5 py-1.5">
        <div
          className={`w-5 h-5 rounded-full bg-muted/50 border border-border flex items-center justify-center ${tone}`}
        >
          <Icon
            className={
              latest.kind === 'phase' || latest.kind === 'status'
                ? 'w-3 h-3 animate-spin'
                : 'w-3 h-3'
            }
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-foreground truncate">
            {latest.detail ? `${latest.title} — ${latest.detail}` : latest.title}
          </p>
        </div>

        <span className="text-[10px] text-muted-foreground tabular-nums">
          {formatTime(latest.timestamp)}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-card/70 border border-border rounded-2xl p-5 shadow-sm backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground">{deduped.length} steps</span>
      </div>
      <div className="mt-4 space-y-3">
        {visible.map((event, index) => {
          const Icon = iconByKind[event.kind] ?? Loader2;
          const tone = colorByKind[event.kind] ?? 'text-muted-foreground';
          const isLast = index === visible.length - 1;

          return (
            <div key={event.id} className="flex items-start gap-3">
              <div className="relative mt-0.5">
                <div
                  className={`w-8 h-8 rounded-full bg-muted/50 border border-border flex items-center justify-center ${tone}`}
                >
                  <Icon
                    className={
                      event.kind === 'phase' || event.kind === 'status'
                        ? 'w-4 h-4 animate-spin'
                        : 'w-4 h-4'
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
                  <span className="text-xs text-muted-foreground">{formatTime(event.timestamp)}</span>
                </div>
                {event.toolName && (
                  <span className="mt-2 inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                    {event.toolName}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

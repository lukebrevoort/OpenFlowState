import type { HTMLAttributes } from 'react';

export type ZenStatus = 'ready' | 'thinking' | 'error';

export interface StatusPillProps extends HTMLAttributes<HTMLDivElement> {
  status: ZenStatus;
  label?: string;
}

function StatusPill({ status, label, className, ...rest }: StatusPillProps) {
  const resolvedLabel =
    label ?? (status === 'ready' ? 'Ready' : status === 'thinking' ? 'Thinking' : 'Error');

  const dotClassName =
    status === 'ready'
      ? 'bg-[#4A7C59]'
      : status === 'thinking'
        ? 'bg-[#C87137]'
        : 'bg-destructive';

  return (
    <div
      className={
        `inline-flex h-7 items-center gap-2 rounded-full border border-border bg-muted/20 px-2.5 text-[11px] text-muted-foreground ${
          className ?? ''
        }`
      }
      role="status"
      aria-label={resolvedLabel}
      title={resolvedLabel}
      {...rest}
    >
      <span
        className={`h-2 w-2 rounded-full ${dotClassName}`}
        aria-hidden="true"
      />
      <span className="sr-only">{resolvedLabel}</span>
    </div>
  );
}

export default StatusPill;
export { StatusPill };

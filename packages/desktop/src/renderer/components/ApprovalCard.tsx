import { useEffect, useId, useMemo, useRef, useState } from 'react';

const COLLAPSE_LINE_THRESHOLD = 14;
const COLLAPSE_CHAR_THRESHOLD = 1200;
const PREVIEW_MAX_LINES = 12;
const PREVIEW_MAX_CHARS = 2000;

const countLines = (value: string) => {
  if (value.length === 0) {
    return 0;
  }

  let lines = 1;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) === 10) {
      lines += 1;
    }
  }
  return lines;
};

const truncateForPreview = (value: string, maxLines: number, maxChars: number) => {
  let lines = 1;
  let end = Math.min(value.length, maxChars);

  for (let i = 0; i < end; i += 1) {
    if (value.charCodeAt(i) === 10) {
      lines += 1;
      if (lines > maxLines) {
        end = i;
        break;
      }
    }
  }

  while (end > 0 && (value[end - 1] === '\n' || value[end - 1] === '\r')) {
    end -= 1;
  }

  return { text: value.slice(0, end), truncated: end < value.length };
};

const isCodeLike = (value: string) => {
  if (value.includes('```')) {
    return true;
  }

  const trimmed = value.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return true;
  }

  // Shell-style prompts and common commands.
  if (/^\s*[$>#]\s/m.test(value)) {
    return true;
  }
  if (/\b(curl|git|npm|pnpm|yarn|bun|node)\b/m.test(value)) {
    return true;
  }

  return false;
};

interface ApprovalCardProps {
  title: string;
  summary: string;
  body: string;
  primaryActionLabel?: string;
  alwaysApproveLabel?: string;
  denyLabel?: string;
  onApprove?: () => void | Promise<void>;
  onAlwaysApprove?: () => void | Promise<void>;
  onDeny?: () => void | Promise<void>;
}

export function ApprovalCard({
  title,
  summary,
  body,
  primaryActionLabel = 'Approve',
  alwaysApproveLabel = 'Always Approve',
  denyLabel = 'Deny',
  onApprove,
  onAlwaysApprove,
  onDeny,
}: ApprovalCardProps) {
  const titleId = useId();
  const bodyId = useId();
  const hasBody = body.trim().length > 0;
  const [expanded, setExpanded] = useState(false);
  const [actionState, setActionState] = useState<null | {
    action: 'approve' | 'always' | 'deny';
    status: 'sending' | 'sent' | 'error';
    message?: string;
  }>(null);
  const actionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setExpanded(false);
    setActionState(null);
    if (actionTimerRef.current) {
      window.clearTimeout(actionTimerRef.current);
      actionTimerRef.current = null;
    }
  }, [body]);

  useEffect(() => {
    return () => {
      if (actionTimerRef.current) {
        window.clearTimeout(actionTimerRef.current);
      }
    };
  }, []);

  const runAction = async (
    action: 'approve' | 'always' | 'deny',
    handler?: () => void | Promise<void>
  ) => {
    if (!handler) return;
    if (actionState?.status === 'sending') return;

    if (actionTimerRef.current) {
      window.clearTimeout(actionTimerRef.current);
      actionTimerRef.current = null;
    }

    setActionState({ action, status: 'sending' });
    try {
      await handler();
      setActionState({
        action,
        status: 'sent',
        message: 'Approval sent. Waiting for the agent to continue...',
      });

      actionTimerRef.current = window.setTimeout(() => {
        setActionState(null);
        actionTimerRef.current = null;
      }, 3500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send approval.';
      setActionState({ action, status: 'error', message });
    }
  };

  const isSending = actionState?.status === 'sending';
  const disableActions = isSending;

  const bodyLineCount = useMemo(() => countLines(body), [body]);
  const codeLikeBody = useMemo(() => isCodeLike(body), [body]);

  const { previewBody, shouldCollapse } = useMemo(() => {
    if (!hasBody) {
      return { previewBody: '', shouldCollapse: false };
    }

    const long = body.length > COLLAPSE_CHAR_THRESHOLD || bodyLineCount > COLLAPSE_LINE_THRESHOLD;
    if (!long) {
      return { previewBody: body, shouldCollapse: false };
    }

    const preview = truncateForPreview(body, PREVIEW_MAX_LINES, PREVIEW_MAX_CHARS);
    return {
      previewBody: preview.text,
      shouldCollapse: preview.truncated,
    };
  }, [body, bodyLineCount, hasBody]);

  const visibleBody = expanded || !shouldCollapse ? body : previewBody;

  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={hasBody ? bodyId : undefined}
      className="bg-card/90 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Approval required
          </p>
          <h3 id={titleId} className="text-lg text-foreground mt-2">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{summary}</p>
        </div>
      </div>

      {hasBody && (
        <div className="mt-4">
          <div
            id={bodyId}
            className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground relative"
          >
            <div
              className={`pr-1 ${
                codeLikeBody ? 'overflow-x-auto' : ''
              } ${
                shouldCollapse
                  ? expanded
                    ? 'max-h-[50vh] overflow-auto'
                    : codeLikeBody
                      ? 'max-h-44 overflow-x-auto overflow-y-hidden'
                      : 'max-h-44 overflow-hidden'
                  : ''
              }`}
            >
              {codeLikeBody ? (
                <pre className="m-0 font-mono text-[12px] leading-relaxed whitespace-pre tabular-nums">
                  {visibleBody}
                </pre>
              ) : (
                <div className="whitespace-pre-line break-words leading-relaxed">{visibleBody}</div>
              )}
            </div>

            {shouldCollapse && !expanded && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-muted/80 to-transparent"
              />
            )}
          </div>

          {shouldCollapse && (
            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                aria-controls={bodyId}
                className="px-3 py-1.5 rounded-lg border border-border bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-300 ease-in-out text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Approval actions">
        <button
          type="button"
          onClick={() => void runAction('approve', onApprove)}
          disabled={disableActions || !onApprove}
          className="px-4 py-2 rounded-lg border border-border bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:pointer-events-none"
        >
          {isSending && actionState?.action === 'approve' ? 'Sending...' : primaryActionLabel}
        </button>
        <button
          type="button"
          onClick={() => void runAction('always', onAlwaysApprove)}
          disabled={disableActions || !onAlwaysApprove}
          className="px-4 py-2 rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-all duration-300 ease-in-out text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:pointer-events-none"
        >
          {isSending && actionState?.action === 'always' ? 'Sending...' : alwaysApproveLabel}
        </button>
        <button
          type="button"
          onClick={() => void runAction('deny', onDeny)}
          disabled={disableActions || !onDeny}
          className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-destructive/10 transition-all duration-300 ease-in-out text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:pointer-events-none"
        >
          {isSending && actionState?.action === 'deny' ? 'Sending...' : denyLabel}
        </button>
      </div>

      {actionState && (
        <p
          className={
            actionState.status === 'error'
              ? 'mt-3 text-xs text-destructive'
              : 'mt-3 text-xs text-muted-foreground'
          }
          role={actionState.status === 'error' ? 'alert' : undefined}
        >
          {actionState.status === 'sending' ? 'Sending approval...' : actionState.message}
        </p>
      )}
    </section>
  );
}

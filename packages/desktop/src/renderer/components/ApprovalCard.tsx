interface ApprovalCardProps {
  title: string;
  summary: string;
  body: string;
  primaryActionLabel?: string;
  alwaysApproveLabel?: string;
  denyLabel?: string;
  onApprove?: () => void;
  onAlwaysApprove?: () => void;
  onDeny?: () => void;
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
  return (
    <div className="bg-card/90 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Approval required
          </p>
          <h3 className="text-lg text-foreground mt-2">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{summary}</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground whitespace-pre-line">
        {body}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="px-4 py-2 rounded-lg border border-border bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out text-sm"
        >
          {primaryActionLabel}
        </button>
        <button
          type="button"
          onClick={onAlwaysApprove}
          className="px-4 py-2 rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary/80 transition-all duration-300 ease-in-out text-sm"
        >
          {alwaysApproveLabel}
        </button>
        <button
          type="button"
          onClick={onDeny}
          className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-destructive/10 transition-all duration-300 ease-in-out text-sm"
        >
          {denyLabel}
        </button>
      </div>
    </div>
  );
}

type StudyRunDiffCardProps = {
  title?: string;
  summary: string;
};

export function StudyRunDiffCard({
  title = 'Study Run Diff',
  summary,
}: StudyRunDiffCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card/80 px-3 py-2 text-left shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 text-xs text-foreground">{summary}</p>
    </div>
  );
}

import { ArrowRight } from 'lucide-react';

interface TaskHandoffCardProps {
  title: string;
  description: string;
  onViewTask?: () => void;
  compact?: boolean;
}

export function TaskHandoffCard({
  title,
  description,
  onViewTask,
  compact = false,
}: TaskHandoffCardProps) {
  if (compact) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground">
            <span className="mr-2 font-semibold uppercase tracking-[0.15em] text-primary/85">
              Task promoted
            </span>
            {description || title}
          </p>

          <button
            type="button"
            onClick={onViewTask}
            className="shrink-0 rounded-md border border-primary/35 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-all duration-300 ease-in-out hover:bg-primary/15 flex items-center gap-1"
          >
            View task
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/90 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-md">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Task running</p>
      <h3 className="text-lg text-foreground mt-2">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onViewTask}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out text-sm flex items-center gap-2"
        >
          View Task
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

import { ArrowRight } from 'lucide-react';

interface TaskHandoffCardProps {
  title: string;
  description: string;
  onViewTask?: () => void;
}

export function TaskHandoffCard({ title, description, onViewTask }: TaskHandoffCardProps) {
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

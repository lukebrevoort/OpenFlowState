import { CheckCircle2, Loader2 } from 'lucide-react';

interface RunningTask {
  id: number;
  title: string;
  description: string;
  progress: number;
  status: 'analyzing' | 'processing' | 'finalizing';
}

interface CompletedTask {
  id: number;
  title: string;
  description: string;
  completedAt: Date;
}

function RunningTaskCard({ task }: { task: RunningTask }) {
  const statusText = {
    analyzing: 'Analyzing...',
    processing: 'Processing...',
    finalizing: 'Finalizing...',
  };

  return (
    <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base text-foreground mb-1">{task.title}</h3>
          <p className="text-sm text-muted-foreground">{task.description}</p>
        </div>
        <Loader2 className="w-5 h-5 text-[#A5B574] animate-spin flex-shrink-0 ml-3" />
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#A5B574] to-[#C87137] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{statusText[task.status]}</span>
        <span className="text-xs text-foreground">{task.progress}%</span>
      </div>
    </div>
  );
}

function CompletedTaskItem({ task }: { task: CompletedTask }) {
  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-start gap-4 pb-4 relative">
      {/* Timeline connector */}
      <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />
      
      {/* Checkmark icon */}
      <div className="flex-shrink-0 mt-0.5 relative z-10">
        <div className="w-6 h-6 rounded-full bg-[#A5B574] flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Task content */}
      <div className="flex-1 pt-0.5">
        <h4 className="text-sm text-foreground mb-0.5">{task.title}</h4>
        <p className="text-xs text-muted-foreground mb-1">{task.description}</p>
        <span className="text-xs text-muted-foreground/80">{timeAgo(task.completedAt)}</span>
      </div>
    </div>
  );
}

export function TasksPage() {
  const runningTasks: RunningTask[] = [
    {
      id: 1,
      title: 'Market Research Analysis',
      description: 'Analyzing competitor trends and market positioning',
      progress: 67,
      status: 'processing',
    },
    {
      id: 2,
      title: 'Content Generation',
      description: 'Creating blog post outline and key points',
      progress: 34,
      status: 'analyzing',
    },
    {
      id: 3,
      title: 'Data Aggregation',
      description: 'Compiling weekly metrics and performance data',
      progress: 89,
      status: 'finalizing',
    },
  ];

  const completedTasks: CompletedTask[] = [
    {
      id: 1,
      title: 'Email Campaign Optimization',
      description: 'Improved subject lines and call-to-action buttons',
      completedAt: new Date(Date.now() - 600000), // 10 min ago
    },
    {
      id: 2,
      title: 'Customer Feedback Summary',
      description: 'Summarized 47 customer reviews into key insights',
      completedAt: new Date(Date.now() - 3600000), // 1 hour ago
    },
    {
      id: 3,
      title: 'Social Media Post Scheduling',
      description: 'Scheduled 15 posts across platforms for next week',
      completedAt: new Date(Date.now() - 7200000), // 2 hours ago
    },
    {
      id: 4,
      title: 'Meeting Notes Transcription',
      description: 'Transcribed and organized key takeaways from team meeting',
      completedAt: new Date(Date.now() - 86400000), // Yesterday
    },
    {
      id: 5,
      title: 'Invoice Processing',
      description: 'Processed and categorized 23 invoices',
      completedAt: new Date(Date.now() - 172800000), // 2 days ago
    },
  ];

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Running Tasks Section */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-2xl text-foreground mb-1">Running Tasks</h2>
            <p className="text-sm text-muted-foreground">Currently active processes</p>
          </div>
          
          <div className="grid gap-4">
            {runningTasks.map((task) => (
              <RunningTaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>

        {/* Completed Tasks Section */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl text-foreground mb-1">Completed Tasks</h2>
            <p className="text-sm text-muted-foreground">Recent accomplishments</p>
          </div>
          
          <div className="bg-card/50 backdrop-blur-xl border border-border rounded-xl p-6">
            {completedTasks.map((task, index) => (
              <div key={task.id} className={index < completedTasks.length - 1 ? 'mb-2' : ''}>
                <CompletedTaskItem task={task} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

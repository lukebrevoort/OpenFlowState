import { CheckCircle2, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { ApprovalCard } from '../components/ApprovalCard';
import { useMemo, useState } from 'react';
import type { TimelineEvent } from '../types/electron';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { useChatStore } from '../stores/chatStore';

interface RunningTask {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: 'analyzing' | 'processing' | 'finalizing';
  timeline: TimelineEvent[];
}

interface CompletedTask {
  id: number;
  title: string;
  description: string;
  completedAt: Date;
}

const deriveProgress = (events: TimelineEvent[]) => {
  if (!events || events.length === 0) return 0;
  const total = events.length;
  const completed = events.filter((event) => ['tool_result', 'approval_response'].includes(event.kind)).length;
  return Math.min(100, Math.round((completed / total) * 100));
};

function RunningTaskCard({ task }: { task: RunningTask }) {
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const statusText = {
    analyzing: 'Analyzing...',
    processing: 'Processing...',
    finalizing: 'Finalizing...',
  };
  const isComplete = task.progress >= 100 || task.status === 'finalizing';

  return (
    <div className="bg-card/80 backdrop-blur-xl border border-border rounded-xl p-5 shadow-sm transition-all duration-300 ease-in-out">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base text-foreground mb-1">{task.title}</h3>
          <p className="text-sm text-muted-foreground">{task.description}</p>
        </div>
        {isComplete ? (
          <CheckCircle2 className="w-5 h-5 text-[#4A7C59] flex-shrink-0 ml-3" />
        ) : (
          <Loader2 className="w-5 h-5 text-[#A5B574] animate-spin flex-shrink-0 ml-3" />
        )}
      </div>

      <div className="mb-2">
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#A5B574] to-[#C87137] rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{statusText[task.status]}</span>
        <span className="text-xs text-foreground">{task.progress}%</span>
      </div>

      <button
        type="button"
        onClick={() => setIsTimelineOpen((prev) => !prev)}
        className="mt-4 flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/60"
      >
        <span>{isTimelineOpen ? 'Hide timeline' : 'Show timeline'}</span>
        {isTimelineOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {isTimelineOpen && (
        <div className="mt-4">
          <ActivityTimeline
            events={task.timeline}
            title="Task Activity"
            collapsed={false}
            maxItems={8}
          />
        </div>
      )}
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
      <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-border" />

      <div className="flex-shrink-0 mt-0.5 relative z-10">
        <div className="w-6 h-6 rounded-full bg-[#A5B574] flex items-center justify-center shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
      </div>

      <div className="flex-1 pt-0.5">
        <h4 className="text-sm text-foreground mb-0.5">{task.title}</h4>
        <p className="text-xs text-muted-foreground mb-1">{task.description}</p>
        <span className="text-xs text-muted-foreground/80">{timeAgo(task.completedAt)}</span>
      </div>
    </div>
  );
}

function TasksMode() {
  const timeline = useChatStore((state) => state.timeline);
  const activeTask = useChatStore((state) => state.activeTask);
  const sampleTimeline: TimelineEvent[] = useMemo(() => [], []);

  const runningTasks: RunningTask[] = useMemo(() => {
    if (activeTask) {
      const timelineEvents = timeline.length > 0 ? timeline : sampleTimeline;
      const progress = activeTask.progress || deriveProgress(timelineEvents);
      const status = activeTask.status === 'completed'
        ? 'finalizing'
        : progress > 0
          ? 'processing'
          : 'analyzing';

      return [
        {
          id: activeTask.id,
          title: activeTask.title,
          description: activeTask.description,
          status,
          timeline: timelineEvents,
          progress,
        },
      ];
    }

    return [];
  }, [activeTask, sampleTimeline, timeline]);

  const pendingApprovals = timeline
    .filter((event) => event.kind === 'approval_request')
    .map((event) => {
      const payload = event.payloadInline;
      const title =
        typeof payload?.title === 'string'
          ? payload.title
          : event.title;
      const summary =
        typeof payload?.summary === 'string'
          ? payload.summary
          : event.detail ?? 'Approval required';
      const body =
        typeof payload?.body === 'string'
          ? payload.body
          : 'Open the task timeline for full context.';
      const approveLabel =
        typeof payload?.approveLabel === 'string'
          ? payload.approveLabel
          : 'Approve';
      const alwaysApproveLabel =
        typeof payload?.alwaysApproveLabel === 'string'
          ? payload.alwaysApproveLabel
          : 'Always Approve';
      const denyLabel =
        typeof payload?.denyLabel === 'string'
          ? payload.denyLabel
          : 'Deny';

      return {
        id: event.id,
        title,
        summary,
        body,
        approveLabel,
        alwaysApproveLabel,
        denyLabel,
      };
    });

  const completedTasks: CompletedTask[] = activeTask?.status === 'completed'
    ? [
        {
          id: Number(activeTask.startedAt),
          title: activeTask.title,
          description: activeTask.summary ?? 'Task completed',
          completedAt: new Date(activeTask.updatedAt),
        },
      ]
    : [];

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <div className="mb-4">
            <h2 className="text-xl text-foreground mb-1">Active Task</h2>
            <p className="text-sm text-muted-foreground">Live task details</p>
          </div>

          <div className="grid gap-4">
            {runningTasks.length > 0 ? (
              runningTasks.map((task) => (
                <RunningTaskCard key={task.id} task={task} />
              ))
            ) : (
              <div className="rounded-xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
                No active task yet.
              </div>
            )}
          </div>
        </div>

        {pendingApprovals.length > 0 && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl text-foreground mb-1">Waiting for Approval</h2>
              <p className="text-sm text-muted-foreground">Review and approve pending actions</p>
            </div>

            <div className="grid gap-4">
              {pendingApprovals.map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    title={approval.title}
                    summary={approval.summary}
                    body={approval.body}
                    primaryActionLabel={approval.approveLabel}
                    alwaysApproveLabel={approval.alwaysApproveLabel}
                    denyLabel={approval.denyLabel}
                    onApprove={() => console.log('Approved', approval.id)}
                    onAlwaysApprove={() => console.log('Always approve', approval.id)}
                    onDeny={() => console.log('Denied', approval.id)}
                  />

              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-4">
            <h2 className="text-xl text-foreground mb-1">Completed Tasks</h2>
            <p className="text-sm text-muted-foreground">Recent accomplishments</p>
          </div>

          <div className="bg-card/50 backdrop-blur-xl border border-border rounded-xl p-5">
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

export default TasksMode;

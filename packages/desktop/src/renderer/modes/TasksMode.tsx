import { CheckCircle2, Loader2, RefreshCw, AlertTriangle, MessageSquare, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TimelineEvent } from '../types/electron';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { useTasksStore } from '../stores/tasksStore';
import { useOpenCode } from '../hooks/useOpenCode';

type ApprovalPayloadInline = {
  requestId?: string;
  title?: string;
  summary?: string;
  body?: string;
  approveLabel?: string;
  alwaysApproveLabel?: string;
  denyLabel?: string;
};

const isApprovalPayloadInline = (payload: unknown): payload is ApprovalPayloadInline => {
  return Boolean(payload) && typeof payload === 'object' && !Array.isArray(payload);
};

const deriveProgress = (events: TimelineEvent[]) => {
  if (!events || events.length === 0) return 0;
  const total = events.length;
  const completed = events.filter((event) => ['tool_result', 'approval_response'].includes(event.kind)).length;
  return Math.min(100, Math.round((completed / total) * 100));
};

function TasksMode({ onOpenChat }: { onOpenChat?: () => void }) {
  const runs = useTasksStore((state) => state.runs);
  const selectedRunId = useTasksStore((state) => state.selectedRunId);
  const selectedTimeline = useTasksStore((state) => state.selectedTimeline);
  const selectedWorkflow = useTasksStore((state) => state.selectedWorkflow);
  const selectedArtifacts = useTasksStore((state) => state.selectedArtifacts);
  const isLoadingRuns = useTasksStore((state) => state.isLoadingRuns);
  const isLoadingTimeline = useTasksStore((state) => state.isLoadingTimeline);
  const isLoadingArtifacts = useTasksStore((state) => state.isLoadingArtifacts);
  const error = useTasksStore((state) => state.error);
  const artifactsError = useTasksStore((state) => state.artifactsError);
  const reloadRuns = useTasksStore((state) => state.reloadRuns);
  const loadActiveRun = useTasksStore((state) => state.loadActiveRun);
  const selectRun = useTasksStore((state) => state.selectRun);
  const reloadSelectedTimeline = useTasksStore((state) => state.reloadSelectedTimeline);
  const reloadSelectedArtifacts = useTasksStore((state) => state.reloadSelectedArtifacts);
  const { switchSession, sendMessage } = useOpenCode();

  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);

  useEffect(() => {
    void loadActiveRun();
    void reloadRuns();
  }, [loadActiveRun, reloadRuns]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadActiveRun({ silent: true });
      void reloadRuns({ silent: true });
      void reloadSelectedTimeline({ silent: true });
      void reloadSelectedArtifacts({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadActiveRun, reloadRuns, reloadSelectedTimeline, reloadSelectedArtifacts]);

  const sortedRuns = useMemo(() => {
    const priority: Record<string, number> = {
      running: 0,
      waiting_approval: 1,
      completed: 2,
      failed: 3,
    };

    return [...runs].sort((a, b) => {
      const byStatus = (priority[a.status] ?? 99) - (priority[b.status] ?? 99);
      if (byStatus !== 0) return byStatus;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
  }, [runs]);

  const selectedRun = useMemo(
    () => sortedRuns.find((run) => run.id === selectedRunId) ?? null,
    [selectedRunId, sortedRuns]
  );

  const workflowArtifacts = useMemo(() => {
    if (!selectedWorkflow || !selectedArtifacts) return null;
    const byKind = (kind: string) => selectedArtifacts.filter((artifact) => artifact.kind === kind);
    const pickLatest = (items: typeof selectedArtifacts) => {
      if (items.length === 0) return null;
      return items.reduce((latest, current) => (current.createdAt > latest.createdAt ? current : latest));
    };

    const finalOutput = pickLatest(byKind('final_output'));
    const summary = pickLatest(byKind('summary'));
    return { finalOutput, summary };
  }, [selectedArtifacts, selectedWorkflow]);

  const canRespond = Boolean(selectedWorkflow && selectedRun?.status === 'waiting_approval');

  const handleSendReply = async () => {
    if (!selectedRun || !replyText.trim()) return;
    setIsSendingReply(true);
    setReplyError(null);

    try {
      await switchSession(selectedRun.sessionId);
      const result = await sendMessage(replyText.trim(), { allowWhileRunning: true });
      if (!result || !result.success) {
        setReplyError(result?.error ?? 'Failed to send response.');
        return;
      }

      setShowReplyModal(false);
      setReplyText('');
      await reloadRuns({ silent: true });
      await reloadSelectedTimeline({ silent: true });
      await reloadSelectedArtifacts({ silent: true });
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Failed to send response.');
    } finally {
      setIsSendingReply(false);
    }
  };

  const selectedProgress = useMemo(() => {
    if (!selectedRun) return 0;
    if (selectedRun.progress > 0) return Math.min(100, Math.round(selectedRun.progress));
    return deriveProgress(selectedTimeline);
  }, [selectedRun, selectedTimeline]);

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 15) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const statusMeta = (status: string) => {
    switch (status) {
      case 'running':
        return { label: 'Running', chip: 'bg-[#A5B574]/15 text-[#4A7C59] border-[#A5B574]/30' };
      case 'waiting_approval':
        return { label: 'Needs approval', chip: 'bg-[#D4A574]/15 text-[#C87137] border-[#D4A574]/30' };
      case 'completed':
        return { label: 'Completed', chip: 'bg-[#4A7C59]/15 text-[#4A7C59] border-[#4A7C59]/30' };
      case 'failed':
        return { label: 'Failed', chip: 'bg-destructive/10 text-destructive border-destructive/30' };
      default:
        return { label: status, chip: 'bg-muted/50 text-muted-foreground border-border' };
    }
  };

  const requestIdForEvent = (event: TimelineEvent) => {
    const payload = isApprovalPayloadInline(event.payloadInline) ? event.payloadInline : undefined;
    return typeof payload?.requestId === 'string' ? payload.requestId : null;
  };

  const handleOpenChat = async () => {
    if (!selectedRun) return;
    try {
      await switchSession(selectedRun.sessionId);
      onOpenChat?.();
    } catch (err) {
      console.error('Failed to open chat for task session', err);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-[360px] lg:flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl text-foreground mb-1">Tasks</h2>
                <p className="text-sm text-muted-foreground">Runs saved from previous sessions</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadActiveRun();
                  void reloadRuns();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/50"
              >
                <RefreshCw className={isLoadingRuns ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                Refresh
              </button>
            </div>

            <div className="bg-card/60 backdrop-blur-xl border border-border rounded-2xl p-3 shadow-sm">
              {sortedRuns.length === 0 && !isLoadingRuns ? (
                <div className="rounded-xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
                  No tasks yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedRuns.map((run) => {
                    const isSelected = run.id === selectedRunId;
                    const meta = statusMeta(run.status);
                    const icon = run.status === 'completed' ? CheckCircle2 : run.status === 'failed' ? AlertTriangle : Loader2;
                    const Icon = icon;

                    return (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => void selectRun(run.id)}
                        className={
                          isSelected
                            ? 'w-full rounded-xl border border-[#A5B574]/40 bg-card/80 p-4 text-left shadow-sm transition-all duration-200'
                            : 'w-full rounded-xl border border-border bg-muted/10 p-4 text-left transition-all duration-200 hover:bg-muted/20'
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground truncate">{run.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground truncate">{run.description}</p>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-2">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${meta.chip}`}>
                              {meta.label}
                            </span>
                            <Icon
                              className={
                                run.status === 'running'
                                  ? 'h-4 w-4 text-[#A5B574] animate-spin'
                                  : run.status === 'waiting_approval'
                                    ? 'h-4 w-4 text-[#C87137]'
                                    : run.status === 'failed'
                                      ? 'h-4 w-4 text-destructive'
                                      : 'h-4 w-4 text-[#4A7C59]'
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{timeAgo(run.updatedAt)}</span>
                            <span className="tabular-nums">{Math.min(100, Math.round(run.progress ?? 0))}%</span>
                          </div>
                          <div className="mt-2 w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#A5B574] to-[#C87137] rounded-full transition-all duration-300 ease-in-out"
                              style={{ width: `${Math.min(100, Math.round(run.progress ?? 0))}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="mb-3">
              <h2 className="text-xl text-foreground mb-1">Task Details</h2>
              <p className="text-sm text-muted-foreground">Timeline and approvals for the selected run</p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {!selectedRun ? (
              <div className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted-foreground">
                Select a task to view details.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-card/70 border border-border rounded-2xl p-5 shadow-sm backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base text-foreground truncate">{selectedRun.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedRun.description}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] ${statusMeta(selectedRun.status).chip}`}
                    >
                      {statusMeta(selectedRun.status).label}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span className="tabular-nums">{selectedProgress}%</span>
                    </div>
                    <div className="mt-2 w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#A5B574] to-[#C87137] rounded-full transition-all duration-300 ease-in-out"
                        style={{ width: `${selectedProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-border px-3 py-1">Updated {timeAgo(selectedRun.updatedAt)}</span>
                    <span className="rounded-full border border-border px-3 py-1">Started {timeAgo(selectedRun.startedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenChat}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/50"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Open chat
                    </button>
                    <button
                      type="button"
                      onClick={() => void reloadSelectedTimeline()}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/50"
                    >
                      <RefreshCw className={isLoadingTimeline ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                      Refresh timeline
                    </button>
                  </div>
                </div>

                {selectedWorkflow && (
                  <div className="bg-card/70 border border-border rounded-2xl p-5 shadow-sm backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">Outputs</h3>
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          Workflow run {selectedWorkflow.workflowRunId}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {canRespond && (
                          <button
                            type="button"
                            onClick={() => setShowReplyModal(true)}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#A5B574]/40 bg-[#A5B574]/10 px-3 py-2 text-xs text-[#4A7C59] transition-all duration-300 hover:bg-[#A5B574]/20"
                          >
                            Respond
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleOpenChat}
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/50"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Open output chat
                        </button>
                        <button
                          type="button"
                          onClick={() => void reloadSelectedArtifacts()}
                          className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/50"
                        >
                          <RefreshCw className={isLoadingArtifacts ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                          Refresh outputs
                        </button>
                      </div>
                    </div>

                    {artifactsError && (
                      <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
                        {artifactsError}
                      </div>
                    )}

                    {isLoadingArtifacts && !workflowArtifacts?.finalOutput?.payloadText && !artifactsError ? (
                      <div className="mt-4 rounded-xl border border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                        Loading outputs...
                      </div>
                    ) : !workflowArtifacts?.finalOutput?.payloadText && !artifactsError ? (
                      <div className="mt-4 rounded-xl border border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                        No outputs yet.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-4" aria-busy={isLoadingArtifacts ? 'true' : 'false'}>
                        {workflowArtifacts?.summary?.payloadText && (
                          <p className="text-sm text-muted-foreground">{workflowArtifacts.summary.payloadText}</p>
                        )}
                        {workflowArtifacts?.finalOutput?.payloadText && (
                          <pre className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-foreground whitespace-pre-wrap break-words overflow-x-auto">
                            {workflowArtifacts.finalOutput.payloadText}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <ActivityTimeline
                  events={selectedTimeline}
                  title="Task Activity"
                  collapsed={false}
                  maxItems={12}
                  maxItemsExpanded={200}
                  emptyMessage={isLoadingTimeline ? 'Loading activity...' : 'No activity yet'}
                  onApprove={(event) => {
                    const requestId = requestIdForEvent(event);
                    if (!requestId) return;
                    window.flowstate.approvals.reply(requestId, 'once').then(() => {
                      void reloadSelectedTimeline();
                    }).catch((err) => {
                      console.error('Failed to approve request', err);
                    });
                  }}
                  onAlwaysApprove={(event) => {
                    const requestId = requestIdForEvent(event);
                    if (!requestId) return;
                    window.flowstate.approvals.reply(requestId, 'always').then(() => {
                      void reloadSelectedTimeline();
                    }).catch((err) => {
                      console.error('Failed to always-approve request', err);
                    });
                  }}
                  onDeny={(event) => {
                    const requestId = requestIdForEvent(event);
                    if (!requestId) return;
                    window.flowstate.approvals.reply(requestId, 'deny').then(() => {
                      void reloadSelectedTimeline();
                    }).catch((err) => {
                      console.error('Failed to deny request', err);
                    });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {showReplyModal && selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card/90 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Respond to workflow</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your response will continue the workflow and update this task.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReplyModal(false)}
                className="rounded-lg border border-border bg-muted/20 p-2 text-muted-foreground transition hover:bg-muted/40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {workflowArtifacts?.finalOutput?.payloadText && (
              <div className="mt-4 rounded-xl border border-border bg-muted/10 p-3 text-xs text-muted-foreground line-clamp-4">
                {workflowArtifacts.finalOutput.payloadText}
              </div>
            )}

            <div className="mt-4">
              <label className="text-xs font-semibold text-muted-foreground">Your response</label>
              <textarea
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Type your response..."
                rows={4}
                className="mt-2 w-full rounded-xl border border-border bg-muted/10 p-3 text-sm text-foreground outline-none focus:border-[#A5B574]/60"
              />
              {replyError && (
                <div className="mt-2 rounded-lg border border-destructive/25 bg-destructive/5 p-2 text-xs text-destructive">
                  {replyError}
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReplyModal(false)}
                className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted/40"
                disabled={isSendingReply}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendReply}
                disabled={isSendingReply || !replyText.trim()}
                className="rounded-lg border border-[#A5B574]/40 bg-[#A5B574]/15 px-4 py-2 text-xs text-[#4A7C59] transition hover:bg-[#A5B574]/25 disabled:opacity-60"
              >
                {isSendingReply ? 'Sending...' : 'Send response'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TasksMode;

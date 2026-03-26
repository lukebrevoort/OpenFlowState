import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TimelineEvent } from "../types/electron";
import { ActivityTimeline } from "../components/ActivityTimeline";
import { ApprovalCard } from "../components/ApprovalCard";
import { useTasksStore } from "../stores/tasksStore";
import { useOpenCode } from "../hooks/useOpenCode";
import { parseResponseHeader, getCleanContent } from "../lib/responseHeaders";

import AssistantMarkdown from "../components/AssistantMarkdown";

const DEV = Boolean(
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ??
    (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } })
      .process?.env?.NODE_ENV === "development",
);
const TASKS_PER_PAGE = 5;
const TASK_RETENTION_DAYS = 10;
const TASK_RETENTION_MS = TASK_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type ApprovalPayloadInline = {
  requestId?: string;
  title?: string;
  summary?: string;
  body?: string;
  approveLabel?: string;
  alwaysApproveLabel?: string;
  denyLabel?: string;
};

const isApprovalPayloadInline = (
  payload: unknown,
): payload is ApprovalPayloadInline => {
  return (
    Boolean(payload) && typeof payload === "object" && !Array.isArray(payload)
  );
};

const deriveProgress = (events: TimelineEvent[]) => {
  if (!events || events.length === 0) return 0;
  const total = events.length;
  const completed = events.filter((event) =>
    ["tool_result", "approval_response"].includes(event.kind),
  ).length;
  return Math.min(100, Math.round((completed / total) * 100));
};

function TasksMode({ onOpenChat }: { onOpenChat?: () => void }) {
  const runs = useTasksStore((state) => state.runs);
  const selectedRunId = useTasksStore((state) => state.selectedRunId);
  const focusedApprovalRequestId = useTasksStore(
    (state) => state.focusedApprovalRequestId,
  );
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
  const setFocusedApprovalRequestId = useTasksStore(
    (state) => state.setFocusedApprovalRequestId,
  );
  const reloadSelectedTimeline = useTasksStore(
    (state) => state.reloadSelectedTimeline,
  );
  const reloadSelectedArtifacts = useTasksStore(
    (state) => state.reloadSelectedArtifacts,
  );
  const cancelRun = useTasksStore((state) => state.cancelRun);
  const removeRun = useTasksStore((state) => state.removeRun);
  const markRunning = useTasksStore((state) => state.markRunning);
  const markComplete = useTasksStore((state) => state.markComplete);
  const updateRunLocal = useTasksStore((state) => state.updateRunLocal);
  const { switchSession, sendMessage } = useOpenCode();

  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [runsPage, setRunsPage] = useState(1);

  const isRefreshing = isLoadingRuns || isLoadingTimeline || isLoadingArtifacts;
  const approvalsAvailable = Boolean(window.flowstate?.approvals?.reply);

  const handleRefreshAll = () => {
    void loadActiveRun();
    void reloadRuns();
    void reloadSelectedTimeline();
    void reloadSelectedArtifacts();
  };

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
  }, [
    loadActiveRun,
    reloadRuns,
    reloadSelectedTimeline,
    reloadSelectedArtifacts,
  ]);

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

  const recentRuns = useMemo(() => {
    const cutoff = Date.now() - TASK_RETENTION_MS;
    return sortedRuns.filter((run) => {
      const runTimestamp = run.updatedAt ?? run.startedAt ?? 0;
      return runTimestamp >= cutoff;
    });
  }, [sortedRuns]);

  const totalRunPages = useMemo(
    () => Math.max(1, Math.ceil(recentRuns.length / TASKS_PER_PAGE)),
    [recentRuns.length],
  );

  const paginatedRuns = useMemo(() => {
    const start = (runsPage - 1) * TASKS_PER_PAGE;
    return recentRuns.slice(start, start + TASKS_PER_PAGE);
  }, [recentRuns, runsPage]);

  const selectedRun = useMemo(
    () => recentRuns.find((run) => run.id === selectedRunId) ?? null,
    [selectedRunId, recentRuns],
  );

  useEffect(() => {
    setRunsPage((currentPage) => Math.min(currentPage, totalRunPages));
  }, [totalRunPages]);

  useEffect(() => {
    if (recentRuns.length === 0) return;
    if (selectedRunId && recentRuns.some((run) => run.id === selectedRunId))
      return;
    void selectRun(recentRuns[0]!.id);
  }, [recentRuns, selectedRunId, selectRun]);

  const workflowArtifacts = useMemo(() => {
    if (!selectedWorkflow || !selectedArtifacts) return null;
    const byKind = (kind: string) =>
      selectedArtifacts.filter((artifact) => artifact.kind === kind);
    const pickLatest = (items: typeof selectedArtifacts) => {
      if (items.length === 0) return null;
      return items.reduce((latest, current) =>
        current.createdAt > latest.createdAt ? current : latest,
      );
    };

    const finalOutput = pickLatest(byKind("final_output"));
    const summary = pickLatest(byKind("summary"));

    // Parse the final output for status headers
    const parsed = finalOutput?.payloadText
      ? parseResponseHeader(finalOutput.payloadText)
      : null;

    return {
      finalOutput,
      summary,
      parsed,
      // Clean content with header stripped
      cleanContent: parsed?.content ?? finalOutput?.payloadText ?? null,
      // Whether the response explicitly needs user input via header
      needsResponse: parsed?.hasHeader && parsed.status === "needs_response",
    };
  }, [selectedArtifacts, selectedWorkflow]);

  const requestIdForEvent = (event: TimelineEvent) => {
    const payload = isApprovalPayloadInline(event.payloadInline)
      ? event.payloadInline
      : undefined;
    return typeof payload?.requestId === "string"
      ? payload.requestId.trim()
      : null;
  };

  const selectedBlockingKind = useMemo(() => {
    if (!selectedRun) return null;
    if (selectedRun.blockingReason?.kind)
      return selectedRun.blockingReason.kind;

    // Best-effort inference for older runs.
    const lastApprovalRequest = selectedTimeline
      .filter((event) => event.kind === "approval_request")
      .reduce((latest, event) => Math.max(latest, event.timestamp ?? 0), 0);
    const lastApprovalResponse = selectedTimeline
      .filter((event) => event.kind === "approval_response")
      .reduce((latest, event) => Math.max(latest, event.timestamp ?? 0), 0);
    if (lastApprovalRequest > lastApprovalResponse)
      return "permission" as const;

    // Only use header-based fallback when the run still looks blocked for input.
    // This prevents stale [NEEDS_RESPONSE] artifacts from keeping the UI stuck
    // after the user already replied.
    if (
      workflowArtifacts?.needsResponse &&
      selectedRun.description === "Waiting for input..."
    ) {
      return "response" as const;
    }
    return null;
  }, [selectedRun, selectedTimeline, workflowArtifacts]);

  const pendingApprovalCount = useMemo(() => {
    if (!selectedTimeline || selectedTimeline.length === 0) return 0;

    const responded = new Set<string>();
    for (const event of selectedTimeline) {
      if (event.kind !== "approval_response") continue;
      const id = requestIdForEvent(event);
      if (id) responded.add(id);
    }

    let pending = 0;
    for (const event of selectedTimeline) {
      if (event.kind !== "approval_request") continue;
      const id = requestIdForEvent(event);
      if (!id || !responded.has(id)) {
        pending += 1;
      }
    }

    return pending;
  }, [selectedTimeline]);

  const pendingApprovals = useMemo(() => {
    if (!selectedTimeline || selectedTimeline.length === 0) {
      return { latest: null as null | TimelineEvent, count: 0 };
    }

    const responded = new Set<string>();
    for (const event of selectedTimeline) {
      if (event.kind !== "approval_response") continue;
      const requestId = requestIdForEvent(event);
      if (requestId) responded.add(requestId);
    }

    const pending: TimelineEvent[] = [];
    for (const event of selectedTimeline) {
      if (event.kind !== "approval_request") continue;
      const requestId = requestIdForEvent(event);
      // Only treat approval requests with a valid requestId that has not been responded to as pending.
      if (!requestId || responded.has(requestId)) continue;
      pending.push(event);
    }

    if (pending.length === 0) {
      return { latest: null as null | TimelineEvent, count: 0 };
    }

    const focused = focusedApprovalRequestId
      ? pending.find((event) => requestIdForEvent(event) === focusedApprovalRequestId)
      : null;

    if (focused) {
      return { latest: focused, count: pending.length };
    }

    let latest = pending[0]!;
    for (let i = 1; i < pending.length; i += 1) {
      if (pending[i]!.timestamp > latest.timestamp) {
        latest = pending[i]!;
      }
    }

    return { latest, count: pending.length };
  }, [focusedApprovalRequestId, selectedTimeline]);

  useEffect(() => {
    if (!focusedApprovalRequestId) return;
    if (pendingApprovals.latest) return;
    setFocusedApprovalRequestId(null);
  }, [
    focusedApprovalRequestId,
    pendingApprovals.latest,
    setFocusedApprovalRequestId,
  ]);

  const approvalPayloadForEvent = (event: TimelineEvent) =>
    isApprovalPayloadInline(event.payloadInline) ? event.payloadInline : undefined;

  const normalizeApprovalErrorMessage = (error: unknown) => {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Failed to process approval.";
    const lowered = message.toLowerCase();

    if (
      lowered.includes("already") &&
      (lowered.includes("processed") || lowered.includes("resolved"))
    ) {
      return "This approval has already been processed.";
    }
    if (
      lowered.includes("expired") ||
      lowered.includes("not found") ||
      lowered.includes("unknown request")
    ) {
      return "This approval is no longer available (it may have expired).";
    }
    return message;
  };

  const replyToApproval = (requestId: string, mode: "once" | "always" | "deny") => {
    if (!approvalsAvailable) {
      return Promise.reject(
        new Error(
          "Approvals bridge unavailable — restart FlowState to reload the preload API.",
        ),
      );
    }

    return window.flowstate.approvals
      .reply(requestId, mode)
      .then((result) => {
        if (!result.success) {
          throw new Error(result.error ?? "Failed to send approval response.");
        }
        return Promise.all([
          reloadSelectedTimeline(),
          reloadRuns({ silent: true }),
          loadActiveRun({ silent: true }),
        ]).then(() => undefined);
      })
      .catch((error) => {
        throw new Error(normalizeApprovalErrorMessage(error));
      });
  };

  // Determine if user can respond - use header-based detection when available
  const canRespond = useMemo(() => {
    if (!selectedWorkflow || !selectedRun) return false;

    return selectedBlockingKind === "response";
  }, [selectedWorkflow, selectedRun, selectedBlockingKind]);
  const canCancel = Boolean(
    selectedRun &&
      (selectedRun.status === "running" ||
        selectedRun.status === "waiting_approval"),
  );
  const canMarkComplete = Boolean(
    selectedRun &&
      selectedRun.status !== "completed" &&
      selectedRun.status !== "cancelled",
  );
  const canRemove = Boolean(
    selectedRun &&
      (selectedRun.status === "completed" ||
        selectedRun.status === "failed" ||
        selectedRun.status === "cancelled"),
  );

  const handleSendReply = async () => {
    if (!selectedRun || !replyText.trim()) return;
    setIsSendingReply(true);
    setReplyError(null);

    try {
      await switchSession(selectedRun.sessionId);
      const result = await sendMessage(replyText.trim(), {
        allowWhileRunning: true,
        fireAndForget: true,
      });
      if (!result || !result.success) {
        setReplyError(result?.error ?? "Failed to send response.");
        return;
      }

      await markRunning(selectedRun.id);

      // Close immediately on success; background polling will pick up new events.
      setShowReplyModal(false);
      setReplyText("");
      setIsSendingReply(false);
      setToast("Response sent — continuing workflow");
      updateRunLocal(selectedRun.id, {
        status: "running",
        blockingReason: undefined,
        description:
          selectedRun.description === "Waiting for input..."
            ? "Running..."
            : selectedRun.description,
      });
      window.setTimeout(() => setToast(null), 2500);

      // Give the session a moment to start streaming, then refresh once.
      window.setTimeout(() => {
        void loadActiveRun({ silent: true });
        void reloadRuns({ silent: true });
        void reloadSelectedTimeline({ silent: true });
        void reloadSelectedArtifacts({ silent: true });
      }, 600);
    } catch (err) {
      setReplyError(
        err instanceof Error ? err.message : "Failed to send response.",
      );
    } finally {
      setIsSendingReply(false);
    }
  };

  const selectedProgress = useMemo(() => {
    if (!selectedRun) return 0;
    if (selectedRun.progress > 0)
      return Math.min(100, Math.round(selectedRun.progress));
    return deriveProgress(selectedTimeline);
  }, [selectedRun, selectedTimeline]);

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 15) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const statusMeta = (
    status: string,
    blockingKind?: "permission" | "response" | null,
  ) => {
    if (blockingKind === "response") {
      return {
        label: "Needs response",
        chip: "bg-[#7BA7B4]/15 text-[#2C5E68] border-[#7BA7B4]/30",
      };
    }

    switch (status) {
      case "running":
        return {
          label: "Running",
          chip: "bg-[#A5B574]/15 text-[#4A7C59] border-[#A5B574]/30",
        };
      case "waiting_approval":
        return {
          label: "Needs approval",
          chip: "bg-[#D4A574]/15 text-[#C87137] border-[#D4A574]/30",
        };
      case "completed":
        return {
          label: "Completed",
          chip: "bg-[#4A7C59]/15 text-[#4A7C59] border-[#4A7C59]/30",
        };
      case "failed":
        return {
          label: "Failed",
          chip: "bg-destructive/10 text-destructive border-destructive/30",
        };
      case "cancelled":
        return {
          label: "Cancelled",
          chip: "bg-muted/50 text-muted-foreground border-border",
        };
      default:
        return {
          label: status,
          chip: "bg-muted/50 text-muted-foreground border-border",
        };
    }
  };

  const handleOpenChat = async () => {
    if (!selectedRun) return;
    try {
      await switchSession(selectedRun.sessionId);
      onOpenChat?.();
    } catch (err) {
      console.error("Failed to open chat for task session", err);
    }
  };

  const handleCancelRun = async () => {
    if (!selectedRun) return;
    const confirmCancel = window.confirm(
      "Cancel this task? It may still finish in the background.",
    );
    if (!confirmCancel) return;

    const ok = await cancelRun(selectedRun.id);
    if (ok) {
      setToast("Task cancelled");
      window.setTimeout(() => setToast(null), 2000);
      void reloadRuns({ silent: true });
    }
  };

  const handleRemoveRun = async () => {
    if (!selectedRun) return;
    const confirmRemove = window.confirm("Remove this task from history?");
    if (!confirmRemove) return;

    const ok = await removeRun(selectedRun.id);
    if (ok) {
      setToast("Task removed");
      window.setTimeout(() => setToast(null), 2000);
      void reloadRuns({ silent: true });
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedRun) return;
    const confirmComplete = window.confirm("Mark this task as complete?");
    if (!confirmComplete) return;

    const ok = await markComplete(selectedRun.id);
    if (ok) {
      setToast("Task marked complete");
      window.setTimeout(() => setToast(null), 2000);
      void reloadRuns({ silent: true });
    }
  };

  const handleDevForceRunning = async () => {
    if (!DEV || !selectedRun) return;
    const ok = await markRunning(selectedRun.id);
    if (ok) {
      setToast("Dev: forced task to running");
      window.setTimeout(() => setToast(null), 2000);
      void reloadRuns({ silent: true });
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
                <p className="text-sm text-muted-foreground">
                  Runs from the last {TASK_RETENTION_DAYS} days
                </p>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-xl border border-border rounded-2xl p-3 shadow-sm">
              {recentRuns.length === 0 && !isLoadingRuns ? (
                <div className="rounded-xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
                  No recent tasks.
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedRuns.map((run) => {
                    const isSelected = run.id === selectedRunId;
                    const meta = statusMeta(
                      run.status,
                      run.blockingReason?.kind ?? null,
                    );
                    const icon =
                      run.status === "completed"
                        ? CheckCircle2
                        : run.status === "failed"
                          ? AlertTriangle
                          : run.blockingReason?.kind === "response"
                            ? MessageSquare
                            : Loader2;
                    const Icon = icon;

                    return (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => void selectRun(run.id)}
                        className={
                          isSelected
                            ? "w-full rounded-xl border border-[#A5B574]/40 bg-card/80 p-4 text-left shadow-sm transition-all duration-200"
                            : "w-full rounded-xl border border-border bg-muted/10 p-4 text-left transition-all duration-200 hover:bg-muted/20"
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground truncate">
                              {run.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground truncate">
                              {run.description}
                            </p>
                          </div>
                          <div className="flex-shrink-0 flex flex-col items-end gap-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${meta.chip}`}
                            >
                              {meta.label}
                            </span>
                            <Icon
                              className={
                                run.blockingReason?.kind === "response"
                                  ? "h-4 w-4 text-[#2C5E68]"
                                  : run.status === "running"
                                    ? "h-4 w-4 text-[#A5B574] animate-spin"
                                    : run.status === "waiting_approval"
                                      ? "h-4 w-4 text-[#C87137]"
                                      : run.status === "failed"
                                        ? "h-4 w-4 text-destructive"
                                        : "h-4 w-4 text-[#4A7C59]"
                              }
                            />
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{timeAgo(run.updatedAt)}</span>
                            <span className="tabular-nums">
                              {Math.min(100, Math.round(run.progress ?? 0))}%
                            </span>
                          </div>
                          <div className="mt-2 w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#A5B574] to-[#C87137] rounded-full transition-all duration-300 ease-in-out"
                              style={{
                                width: `${Math.min(100, Math.round(run.progress ?? 0))}%`,
                              }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {recentRuns.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setRunsPage((page) => Math.max(1, page - 1))
                          }
                          disabled={runsPage <= 1}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-all hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          Prev
                        </button>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          Page {runsPage} of {totalRunPages}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRunsPage((page) =>
                              Math.min(totalRunPages, page + 1),
                            )
                          }
                          disabled={runsPage >= totalRunPages}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-all hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="mb-3">
              <h2 className="text-xl text-foreground mb-1">Task Details</h2>
              <p className="text-sm text-muted-foreground">
                Timeline and approvals for the selected run
              </p>
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
                      <h3 className="text-base text-foreground truncate">
                        {selectedRun.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedRun.description}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] ${statusMeta(selectedRun.status, selectedBlockingKind).chip}`}
                    >
                      {
                        statusMeta(selectedRun.status, selectedBlockingKind)
                          .label
                      }
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
                    <span className="rounded-full border border-border px-3 py-1">
                      Updated {timeAgo(selectedRun.updatedAt)}
                    </span>
                    <span className="rounded-full border border-border px-3 py-1">
                      Started {timeAgo(selectedRun.startedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    Controls
                  </h3>
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
                    {pendingApprovals.latest && (
                      <button
                        type="button"
                        onClick={() => {
                          const node = document.getElementById(
                            "task-approval-interface",
                          );
                          node?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#D4A574]/50 bg-[#D4A574]/10 px-3 py-2 text-xs text-[#C87137] transition-all duration-300 hover:bg-[#D4A574]/20"
                      >
                        View approval
                      </button>
                    )}
                    {canMarkComplete && (
                      <button
                        type="button"
                        onClick={handleMarkComplete}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#4A7C59]/30 bg-[#4A7C59]/10 px-3 py-2 text-xs text-[#4A7C59] transition-all duration-300 hover:bg-[#4A7C59]/20"
                      >
                        Mark complete
                      </button>
                    )}
                    {canCancel ? (
                      <button
                        type="button"
                        onClick={handleCancelRun}
                        className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive transition-all duration-300 hover:bg-destructive/10"
                      >
                        Cancel task
                      </button>
                    ) : canRemove ? (
                      <button
                        type="button"
                        onClick={handleRemoveRun}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/50"
                      >
                        Remove task
                      </button>
                    ) : null}

                    {DEV && selectedRun?.status === "waiting_approval" && (
                      <button
                        type="button"
                        onClick={handleDevForceRunning}
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/30"
                        title="Development fallback if task state gets stuck"
                      >
                        Force running (dev)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenChat}
                      disabled={!selectedRun}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Open chat
                    </button>
                    <button
                      type="button"
                      onClick={handleRefreshAll}
                      disabled={isRefreshing}
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-all duration-300 hover:bg-muted/50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <RefreshCw
                        className={
                          isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"
                        }
                      />
                      Refresh all
                    </button>
                  </div>
                </div>

                {pendingApprovals.latest && (
                  <div
                    id="task-approval-interface"
                    className="bg-card/70 border border-border rounded-2xl p-5 shadow-sm backdrop-blur-xl"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground">
                        Approval Required
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        {pendingApprovals.count > 1
                          ? `${pendingApprovals.count} approvals pending - showing latest.`
                          : "Approval pending."}
                      </span>
                    </div>

                    <ApprovalCard
                      title={
                        approvalPayloadForEvent(pendingApprovals.latest)?.title ??
                        pendingApprovals.latest.title
                      }
                      summary={
                        approvalPayloadForEvent(pendingApprovals.latest)?.summary ??
                        pendingApprovals.latest.detail ??
                        "This action requires your approval."
                      }
                      body={
                        approvalPayloadForEvent(pendingApprovals.latest)?.body ?? ""
                      }
                      primaryActionLabel={
                        approvalPayloadForEvent(pendingApprovals.latest)
                          ?.approveLabel
                      }
                      alwaysApproveLabel={
                        approvalPayloadForEvent(pendingApprovals.latest)
                          ?.alwaysApproveLabel
                      }
                      denyLabel={
                        approvalPayloadForEvent(pendingApprovals.latest)?.denyLabel
                      }
                      onApprove={() => {
                        const requestId = requestIdForEvent(
                          pendingApprovals.latest!,
                        );
                        if (!requestId) {
                          throw new Error("Approval request is missing an id.");
                        }
                        return replyToApproval(requestId, "once");
                      }}
                      onAlwaysApprove={() => {
                        const requestId = requestIdForEvent(
                          pendingApprovals.latest!,
                        );
                        if (!requestId) {
                          throw new Error("Approval request is missing an id.");
                        }
                        return replyToApproval(requestId, "always");
                      }}
                      onDeny={() => {
                        const requestId = requestIdForEvent(
                          pendingApprovals.latest!,
                        );
                        if (!requestId) {
                          throw new Error("Approval request is missing an id.");
                        }
                        return replyToApproval(requestId, "deny");
                      }}
                    />
                  </div>
                )}

                {selectedBlockingKind === "permission" && !pendingApprovals.latest && (
                  <div className="rounded-2xl border border-[#D4A574]/30 bg-[#D4A574]/10 p-4 text-sm text-[#7A4D22]">
                    This approval is no longer actionable. It may have already
                    been processed or expired.
                  </div>
                )}

                {selectedWorkflow && (
                  <div className="bg-card/70 border border-border rounded-2xl p-5 shadow-sm backdrop-blur-xl overflow-hidden">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">
                          Outputs
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          Workflow run {selectedWorkflow.workflowRunId}
                        </p>
                      </div>
                    </div>

                    {artifactsError && (
                      <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">
                        {artifactsError}
                      </div>
                    )}

                    {(() => {
                      const hasSummary = Boolean(
                        workflowArtifacts?.summary?.payloadText,
                      );
                      const hasFinal = Boolean(
                        workflowArtifacts?.finalOutput?.payloadText,
                      );
                      const hasCleanContent = Boolean(
                        workflowArtifacts?.cleanContent,
                      );
                      const hasVisibleOutput =
                        hasSummary || hasFinal || hasCleanContent;

                      if (
                        isLoadingArtifacts &&
                        !hasVisibleOutput &&
                        !artifactsError
                      ) {
                        return (
                          <div className="mt-4 rounded-xl border border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                            Loading outputs...
                          </div>
                        );
                      }

                      if (!hasVisibleOutput && !artifactsError) {
                        return (
                          <div className="mt-4 rounded-xl border border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                            No outputs yet.
                          </div>
                        );
                      }

                      return (
                        <div
                          className="mt-4 space-y-4 overflow-hidden"
                          aria-busy={isLoadingArtifacts ? "true" : "false"}
                        >
                          {workflowArtifacts?.summary?.payloadText && (
                            <AssistantMarkdown
                              content={getCleanContent(
                                workflowArtifacts.summary.payloadText,
                              )}
                            />
                          )}
                          {workflowArtifacts?.cleanContent && (
                            <AssistantMarkdown
                              content={workflowArtifacts.cleanContent}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <ActivityTimeline
                  events={selectedTimeline}
                  title="Task Activity"
                  collapsed={false}
                  maxItems={12}
                  maxItemsExpanded={200}
                  emptyMessage={
                    isLoadingTimeline
                      ? "Loading activity..."
                      : "No activity yet"
                  }
                  onApprove={(event) => {
                    const requestId = requestIdForEvent(event);
                    if (!requestId) return;
                    return replyToApproval(requestId, "once").catch((err) => {
                      console.error("Failed to approve request", err);
                      throw err;
                    });
                  }}
                  onAlwaysApprove={(event) => {
                    const requestId = requestIdForEvent(event);
                    if (!requestId) return;
                    return replyToApproval(requestId, "always").catch((err) => {
                      console.error("Failed to always-approve request", err);
                      throw err;
                    });
                  }}
                  onDeny={(event) => {
                    const requestId = requestIdForEvent(event);
                    if (!requestId) return;
                    return replyToApproval(requestId, "deny").catch((err) => {
                      console.error("Failed to deny request", err);
                      throw err;
                    });
                  }}
                />

                {pendingApprovalCount > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {pendingApprovalCount} pending{" "}
                    {pendingApprovalCount === 1 ? "approval" : "approvals"}.
                  </p>
                )}

                {!approvalsAvailable && (
                  <p className="mt-2 text-[11px] text-destructive">
                    Approvals bridge unavailable — restart FlowState to reload
                    the preload API.
                  </p>
                )}
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
                <h3 className="text-lg font-semibold text-foreground">
                  Respond to workflow
                </h3>
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

            {workflowArtifacts?.cleanContent && (
              <div className="mt-4 rounded-xl border border-border bg-muted/10 p-3 text-xs text-muted-foreground line-clamp-4">
                {workflowArtifacts.cleanContent}
              </div>
            )}

            <div className="mt-4">
              <label className="text-xs font-semibold text-muted-foreground">
                Your response
              </label>
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
                {isSendingReply ? "Sending..." : "Send response"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-[#4A7C59]/30 bg-[#4A7C59]/10 px-4 py-2 text-xs text-[#4A7C59] shadow-lg backdrop-blur">
            <Check className="h-4 w-4" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

export default TasksMode;

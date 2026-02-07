import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Star,
  Play,
  Newspaper,
  PenLine,
  BarChart3,
  Mic,
  Search,
  Mail,
  Loader2,
  AlertCircle,
  RefreshCw,
  PanelRight,
  X,
  Clock,
  Check,
  Trash2,
  FileText,
  Save,
  Shield,
} from 'lucide-react';
import { useWorkflowsStore } from '../stores/workflowsStore';
import type { WorkflowDefinition, WorkflowRun } from '../types/electron';
import { workflowsAdapter } from '../lib/workflowsAdapter';

interface Workflow {
  id: string;
  name: string;
  description: string;
  icon: typeof Newspaper;
  isPinned: boolean;
  color: string;
}

const CARD_ICONS = [Newspaper, PenLine, BarChart3, Mic, Search, Mail];
const CARD_COLORS = ['#C87137', '#A5B574', '#3E2F27', '#E8BFA0'];

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function workflowToCardModel(
  workflow: WorkflowDefinition,
  pinnedIds: Set<string>,
): Workflow {
  const safeDescription = workflow.description ?? 'No description provided.';
  const hash = hashString(workflow.id);
  const isPinned = pinnedIds.has(workflow.id);
  const icon = CARD_ICONS[hash % CARD_ICONS.length] ?? Newspaper;
  const color = CARD_COLORS[hash % CARD_COLORS.length] ?? '#A5B574';

  return {
    id: workflow.id,
    name: workflow.title,
    description: safeDescription,
    icon,
    isPinned,
    color,
  };
}

function statusLabel(status: string) {
  switch (status) {
    case 'queued':
      return { label: 'Queued', chip: 'bg-muted/50 text-muted-foreground border-border' };
    case 'running':
      return { label: 'Running', chip: 'bg-[#A5B574]/15 text-[#4A7C59] border-[#A5B574]/30' };
    case 'completed':
      return { label: 'Completed', chip: 'bg-[#4A7C59]/15 text-[#4A7C59] border-[#4A7C59]/30' };
    case 'failed':
      return { label: 'Failed', chip: 'bg-destructive/10 text-destructive border-destructive/30' };
    case 'cancelled':
      return { label: 'Cancelled', chip: 'bg-muted/50 text-muted-foreground border-border' };
    default:
      return { label: status, chip: 'bg-muted/50 text-muted-foreground border-border' };
  }
}

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return null;
  if (durationMs < 1000) return `${durationMs}ms`;
  const seconds = Math.round(durationMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${minutes}m ${rem}s`;
}

function timeAgo(timestampMs: number) {
  const diffMs = Date.now() - timestampMs;
  if (!Number.isFinite(diffMs)) return '';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestampMs).toLocaleDateString();
}

function WorkflowCard({
  workflow,
  onTogglePin,
  onRun,
  onOpenDetails,
  onDelete,
  lastRun,
  isStarting,
  isDeleting,
  deletePending,
}: {
  workflow: Workflow;
  onTogglePin: (id: string) => void;
  onRun: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onDelete: (id: string) => void;
  lastRun: WorkflowRun | null;
  isStarting: boolean;
  isDeleting: boolean;
  deletePending: boolean;
}) {
  const runMeta = lastRun ? statusLabel(lastRun.status) : null;
  const durationLabel = lastRun ? formatDuration(lastRun.durationMs) : null;
  const preview = lastRun?.error ? lastRun.error : lastRun?.outputPreview;

  return (
    <div className="group relative bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 ease-in-out hover:scale-[1.02]">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTogglePin(workflow.id)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-200"
          aria-label={workflow.isPinned ? 'Unpin workflow' : 'Pin workflow'}
        >
          <Star
            className={`h-4 w-4 ${workflow.isPinned ? 'fill-current text-[#A5B574]' : ''}`}
          />
        </button>
        <button
          type="button"
          onClick={() => onOpenDetails(workflow.id)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-200"
          aria-label="Open workflow details"
        >
          <PanelRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(workflow.id)}
          disabled={isDeleting}
          className={
            deletePending
              ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-destructive text-destructive-foreground transition-all duration-200'
              : 'inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-200'
          }
          aria-label={deletePending ? 'Confirm delete workflow' : 'Delete workflow'}
        >
          {deletePending ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="mb-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md"
          style={{ backgroundColor: workflow.color }}
        >
          <workflow.icon className="h-6 w-6 text-white" />
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-lg text-foreground mb-1 pr-6">{workflow.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{workflow.description}</p>
      </div>

      <div className="mb-4">
        {!lastRun ? (
          <p className="text-xs text-muted-foreground">No runs yet</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${runMeta?.chip}`}
            >
              {runMeta?.label}
            </span>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{timeAgo(lastRun.startedAt)}</span>
              {durationLabel ? <span className="tabular-nums">• {durationLabel}</span> : null}
            </div>
          </div>
        )}
        {preview ? (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{preview}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onRun(workflow.id)}
          disabled={isStarting}
          className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out text-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
        >
          {isStarting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function WorkflowDetailsDrawer({
  workflow,
  pinned,
  pinsError,
  alwaysApprove,
  alwaysApproveStatus,
  alwaysApproveError,
  runs,
  isRunning,
  deletePending,
  isDeleting,
  deleteError,
  skillDraft,
  skillStatus,
  skillSource,
  skillError,
  isSkillDirty,
  onClose,
  onTogglePin,
  onToggleAlwaysApprove,
  onRun,
  onDelete,
  onSkillChange,
  onSaveSkill,
  onOpenTaskRun,
}: {
  workflow: WorkflowDefinition;
  pinned: boolean;
  pinsError: string | null;
  alwaysApprove: boolean;
  alwaysApproveStatus: 'idle' | 'loading' | 'saving' | 'error';
  alwaysApproveError: string | null;
  runs: WorkflowRun[];
  isRunning: boolean;
  deletePending: boolean;
  isDeleting: boolean;
  deleteError: string | null;
  skillDraft: string;
  skillStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error';
  skillSource: 'user' | 'project' | null;
  skillError: string | null;
  isSkillDirty: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onToggleAlwaysApprove: () => void;
  onRun: () => void;
  onDelete: () => void;
  onSkillChange: (next: string) => void;
  onSaveSkill: () => void;
  onOpenTaskRun: (taskRunId: string) => void;
}) {
  const alwaysApproveBusy = alwaysApproveStatus === 'loading' || alwaysApproveStatus === 'saving';
  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="absolute right-0 top-0 h-full w-full max-w-[480px] bg-card/95 border-l border-border shadow-2xl backdrop-blur-xl">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Workflow</p>
              <h3 className="mt-1 text-lg text-foreground truncate">{workflow.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-200"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="text-sm text-muted-foreground">{workflow.description ?? 'No description provided.'}</p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onTogglePin}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground transition-all duration-200 hover:bg-muted/40"
              >
                <Star className={`h-4 w-4 ${pinned ? 'fill-current text-[#A5B574]' : ''}`} />
                {pinned ? 'Pinned' : 'Pin'}
              </button>
              {pinsError ? (
                <p className="text-xs text-destructive">{pinsError}</p>
              ) : null}
            </div>

            <div className="mt-6 rounded-xl border border-border bg-muted/10 p-4">
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold text-foreground">Always Approve</h4>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Skip permission prompts for this workflow. You can revoke this grant in Settings.
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={alwaysApprove}
                  aria-label="Always approve tool requests for this workflow"
                  onClick={onToggleAlwaysApprove}
                  disabled={alwaysApproveBusy}
                  className={`relative h-6 w-12 flex-shrink-0 rounded-full border border-border transition-colors ${
                    alwaysApprove ? 'bg-primary' : 'bg-switch-background'
                  } ${alwaysApproveBusy ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform ${
                      alwaysApprove ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {alwaysApproveStatus === 'saving' ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Saving...</p>
              ) : null}
              {alwaysApproveError ? (
                <p className="mt-2 text-xs text-destructive">{alwaysApproveError}</p>
              ) : null}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-foreground">Command file</h4>
                </div>
                {skillSource ? (
                  <span className="text-[11px] text-muted-foreground">
                    {skillSource === 'user' ? 'User file' : 'Project file'}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 rounded-xl border border-border bg-background/40">
                {skillStatus === 'loading' ? (
                  <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading command...
                  </div>
                ) : (
                  <textarea
                    value={skillDraft}
                    onChange={(event) => onSkillChange(event.target.value)}
                    className="min-h-[220px] w-full resize-y rounded-xl bg-transparent px-4 py-3 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    spellCheck={false}
                  />
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSaveSkill}
                  disabled={!isSkillDirty || skillStatus === 'saving' || skillStatus === 'loading'}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground transition-all duration-200 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {skillStatus === 'saving' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </button>
                <span className="text-[11px] text-muted-foreground">
                  {skillStatus === 'saved' ? 'Saved' : isSkillDirty ? 'Unsaved changes' : 'Up to date'}
                </span>
              </div>
              {skillError ? (
                <p className="mt-2 text-xs text-destructive">{skillError}</p>
              ) : null}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Recent runs</h4>
                <p className="text-xs text-muted-foreground">Last 5</p>
              </div>

              {runs.length === 0 ? (
                <div className="mt-3 rounded-xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                  No runs yet.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {runs.map((run) => {
                    const meta = statusLabel(run.status);
                    const durationLabel = formatDuration(run.durationMs);
                    const preview = run.error ? run.error : run.outputPreview;

                    return (
                      <div
                        key={run.id}
                        className="rounded-xl border border-border bg-muted/10 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${meta.chip}`}
                              >
                                {meta.label}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{timeAgo(run.startedAt)}</span>
                              {durationLabel ? (
                                <span className="text-[11px] text-muted-foreground tabular-nums">• {durationLabel}</span>
                              ) : null}
                            </div>
                            {preview ? (
                              <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{preview}</p>
                            ) : null}
                          </div>

                          {run.taskRunId ? (
                            <button
                              type="button"
                              onClick={() => onOpenTaskRun(run.taskRunId as string)}
                              className="flex-shrink-0 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs text-foreground transition-all duration-200 hover:bg-card"
                            >
                              View task
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-destructive">Delete workflow</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    This removes the workflow file and unpins it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isDeleting}
                  className={
                    deletePending
                      ? 'inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs text-destructive-foreground transition-all duration-200'
                      : 'inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive transition-all duration-200 hover:bg-destructive/10'
                  }
                >
                  {deletePending ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {deletePending ? 'Confirm' : 'Delete'}
                </button>
              </div>
              {deleteError ? (
                <p className="mt-2 text-xs text-destructive">{deleteError}</p>
              ) : null}
            </div>
          </div>

          <div className="border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={onRun}
              disabled={isRunning}
              className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-in-out text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <Play className="w-4 h-4" />
              Run workflow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowsMode({
  onOpenTaskRun,
}: {
  onOpenTaskRun?: (taskRunId: string) => void;
}) {
  const workflows = useWorkflowsStore((state) => state.workflows);
  const isLoading = useWorkflowsStore((state) => state.isLoading);
  const error = useWorkflowsStore((state) => state.error);
  const reload = useWorkflowsStore((state) => state.reload);
  const runWorkflow = useWorkflowsStore((state) => state.run);
  const isRunning = useWorkflowsStore((state) => state.isRunning);
  const generateFromIntent = useWorkflowsStore((state) => state.generateFromIntent);
  const isGenerating = useWorkflowsStore((state) => state.isGenerating);
  const generateError = useWorkflowsStore((state) => state.generateError);
  const getSkillMarkdown = useWorkflowsStore((state) => state.getSkillMarkdown);
  const saveSkillMarkdown = useWorkflowsStore((state) => state.saveSkillMarkdown);
  const deleteWorkflow = useWorkflowsStore((state) => state.deleteWorkflow);
  const pinnedIds = useWorkflowsStore((state) => state.pinnedIds);
  const loadPins = useWorkflowsStore((state) => state.loadPins);
  const setPinned = useWorkflowsStore((state) => state.setPinned);
  const pinsError = useWorkflowsStore((state) => state.pinsError);
  const runsByWorkflowId = useWorkflowsStore((state) => state.runsByWorkflowId);
  const ensureRunsLoaded = useWorkflowsStore((state) => state.ensureRunsLoaded);
  const [drawerWorkflowId, setDrawerWorkflowId] = useState<string | null>(null);
  const [startingWorkflowId, setStartingWorkflowId] = useState<string | null>(null);
  const [startToast, setStartToast] = useState<{
    message: string;
    variant: 'loading' | 'success' | 'error';
  } | null>(null);

  const [builderIntent, setBuilderIntent] = useState('');
  const [builderPreview, setBuilderPreview] = useState<string | null>(null);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [generatedDefinition, setGeneratedDefinition] = useState<WorkflowDefinition | null>(null);
  const builderIntentRef = useRef<HTMLTextAreaElement | null>(null);
  const deleteTimerRef = useRef<number | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingWorkflowId, setDeletingWorkflowId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [skillDraft, setSkillDraft] = useState('');
  const [skillSnapshot, setSkillSnapshot] = useState('');
  const [skillStatus, setSkillStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [skillError, setSkillError] = useState<string | null>(null);
  const [skillSource, setSkillSource] = useState<'user' | 'project' | null>(null);

  const [approvalOptIn, setApprovalOptIn] = useState(false);
  const [approvalOptInStatus, setApprovalOptInStatus] = useState<'idle' | 'loading' | 'saving' | 'error'>('idle');
  const [approvalOptInError, setApprovalOptInError] = useState<string | null>(null);

  const keyHint = useMemo(() => {
    if (typeof navigator === 'undefined') return 'Ctrl';
    return navigator.platform.toLowerCase().includes('mac') ? 'Cmd' : 'Ctrl';
  }, []);

  useEffect(() => {
    reload();
    loadPins();
  }, [loadPins, reload]);

  useEffect(() => {
    if (!workflows || workflows.length === 0) return;
    const ids = workflows.map((workflow) => workflow.id);

    let cancelled = false;
    const run = async () => {
      for (const id of ids) {
        if (cancelled) return;
        await ensureRunsLoaded(id, 1);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [ensureRunsLoaded, workflows]);

  const handleTogglePin = async (id: string) => {
    const isPinned = new Set(pinnedIds).has(id);
    await setPinned(id, !isPinned);
  };

  const clearDeleteTimer = () => {
    if (deleteTimerRef.current) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (pendingDeleteId !== id) {
      setDeleteError(null);
      setPendingDeleteId(id);
      clearDeleteTimer();
      deleteTimerRef.current = window.setTimeout(() => {
        setPendingDeleteId((current) => (current === id ? null : current));
      }, 3500);
      return;
    }

    clearDeleteTimer();
    setPendingDeleteId(null);
    setDeletingWorkflowId(id);
    setDeleteError(null);

    const result = await deleteWorkflow(id);
    setDeletingWorkflowId(null);

    if (!result.ok) {
      setDeleteError(result.error ?? 'Failed to delete workflow.');
      return;
    }

    if (drawerWorkflowId === id) {
      setDrawerWorkflowId(null);
    }
  };

  const handleRun = async (id: string) => {
    setStartingWorkflowId(id);
    setStartToast({ message: 'Starting workflow...', variant: 'loading' });
    const result = await runWorkflow(id);
    void ensureRunsLoaded(id, 5);

    setStartingWorkflowId(null);
    if (drawerWorkflowId === id) {
      setDrawerWorkflowId(null);
    }

    if (result?.taskRunId) {
      if (onOpenTaskRun) {
        // Keep feedback visible until this view is replaced by task details.
        setStartToast({ message: 'Opening task...', variant: 'loading' });
        onOpenTaskRun(result.taskRunId);
        return;
      }

      setStartToast({ message: 'Workflow started', variant: 'success' });
      window.setTimeout(() => setStartToast(null), 1400);
      return;
    }

    setStartToast({ message: 'Failed to start workflow', variant: 'error' });
    window.setTimeout(() => setStartToast(null), 2600);
  };

  const handleGeneratePreview = async () => {
    const trimmed = builderIntent.trim();
    if (!trimmed) {
      setBuilderError('Describe what you want to automate first.');
      setBuilderPreview(null);
      setGeneratedDefinition(null);
      builderIntentRef.current?.focus();
      return;
    }

    setBuilderError(null);
    const result = await generateFromIntent(trimmed);
    if (!result) {
      setBuilderPreview(null);
      setGeneratedDefinition(null);
      return;
    }

    setBuilderPreview(result.skillMarkdown);
    setGeneratedDefinition(result.definition);
  };

  const handleRunPreview = () => {
    if (!generatedDefinition) return;
    void handleRun(generatedDefinition.id);
  };

  const handleSaveSkill = async () => {
    if (!drawerWorkflowId) return;
    setSkillError(null);
    setSkillStatus('saving');
    const result = await saveSkillMarkdown(drawerWorkflowId, skillDraft);
    if (!result.ok || !result.data) {
      setSkillStatus('error');
      setSkillError(result.error ?? 'Failed to save workflow file.');
      return;
    }

    setSkillSnapshot(result.data.skillMarkdown);
    setSkillDraft(result.data.skillMarkdown);
    setSkillSource(result.data.source);
    setSkillStatus('saved');
    window.setTimeout(() => {
      setSkillStatus((current) => (current === 'saved' ? 'idle' : current));
    }, 1200);
  };

  const activeBuilderError = builderError ?? generateError;

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const workflowCards = useMemo(
    () => workflows.map((workflow) => workflowToCardModel(workflow, pinnedSet)),
    [workflows, pinnedSet],
  );

  const pinnedWorkflows = workflowCards.filter((workflow) => workflow.isPinned);
  const unpinnedWorkflows = workflowCards.filter((workflow) => !workflow.isPinned);

  const drawerWorkflow = useMemo(() => {
    if (!drawerWorkflowId) return null;
    return workflows.find((workflow) => workflow.id === drawerWorkflowId) ?? null;
  }, [drawerWorkflowId, workflows]);

  useEffect(() => {
    if (!drawerWorkflowId) return;
    void ensureRunsLoaded(drawerWorkflowId, 5);
  }, [drawerWorkflowId, ensureRunsLoaded]);

  useEffect(() => {
    setDeleteError(null);
  }, [drawerWorkflowId]);

  useEffect(() => {
    if (!drawerWorkflowId) {
      setSkillDraft('');
      setSkillSnapshot('');
      setSkillStatus('idle');
      setSkillError(null);
      setSkillSource(null);

      setApprovalOptIn(false);
      setApprovalOptInStatus('idle');
      setApprovalOptInError(null);
      return;
    }

    let active = true;
    setSkillStatus('loading');
    setSkillError(null);
    setSkillDraft('');
    setSkillSnapshot('');
    setSkillSource(null);
    void (async () => {
      const result = await getSkillMarkdown(drawerWorkflowId);
      if (!active) return;
      if (!result.ok || !result.data) {
        setSkillStatus('error');
        setSkillError(result.error ?? 'Failed to load workflow file.');
        return;
      }
      setSkillDraft(result.data.skillMarkdown);
      setSkillSnapshot(result.data.skillMarkdown);
      setSkillSource(result.data.source);
      setSkillStatus('idle');
    })();

    return () => {
      active = false;
    };
  }, [drawerWorkflowId, getSkillMarkdown]);

  useEffect(() => {
    if (!drawerWorkflowId) return;

    let active = true;
    setApprovalOptInStatus('loading');
    setApprovalOptInError(null);
    void (async () => {
      const result = await workflowsAdapter.getApprovalOptIn(drawerWorkflowId);
      if (!active) return;
      if (result.ok) {
        setApprovalOptIn(Boolean(result.data));
        setApprovalOptInStatus('idle');
        return;
      }
      setApprovalOptIn(false);
      setApprovalOptInStatus('error');
      setApprovalOptInError(result.error.message);
    })();

    return () => {
      active = false;
    };
  }, [drawerWorkflowId]);

  const handleToggleAlwaysApprove = async () => {
    if (!drawerWorkflowId) return;
    if (approvalOptInStatus === 'loading' || approvalOptInStatus === 'saving') return;

    const next = !approvalOptIn;
    setApprovalOptIn(next);
    setApprovalOptInStatus('saving');
    setApprovalOptInError(null);

    const result = await workflowsAdapter.setApprovalOptIn(drawerWorkflowId, next);
    if (result.ok) {
      setApprovalOptIn(Boolean(result.data.optedIn));
      setApprovalOptInStatus('idle');
      return;
    }

    setApprovalOptIn(!next);
    setApprovalOptInStatus('error');
    setApprovalOptInError(result.error.message);
  };

  useEffect(() => {
    return () => clearDeleteTimer();
  }, []);

  const isSkillDirty = skillDraft !== skillSnapshot;

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl text-foreground mb-2">Workflows</h2>
          <p className="text-muted-foreground mb-6">Create, customize, and manage your AI automation workflows</p>

          <button className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out shadow-md hover:scale-105 active:scale-95">
            + Create New Workflow
          </button>
        </div>

        <div className="mb-10 bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <PenLine className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-xl text-foreground">Build a workflow</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Describe what you want in plain English. We&apos;ll generate a command preview you can run.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label htmlFor="workflow-builder-intent" className="text-sm text-foreground">
                What should this workflow do?
              </label>
              <div className="mt-2">
                <textarea
                  id="workflow-builder-intent"
                  ref={builderIntentRef}
                  value={builderIntent}
                  onChange={(event) => {
                    setBuilderIntent(event.target.value);
                    if (builderError) setBuilderError(null);
                  }}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                      event.preventDefault();
                      handleGeneratePreview();
                    }
                  }}
                  placeholder="e.g. Every morning, summarize my calendar and inbox, then post highlights into Notion"
                  className="w-full min-h-[120px] resize-y rounded-xl bg-background/40 border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-invalid={activeBuilderError ? 'true' : 'false'}
                  aria-describedby={activeBuilderError ? 'workflow-builder-error' : 'workflow-builder-help'}
                />
                <p id="workflow-builder-help" className="mt-2 text-xs text-muted-foreground">
                  Tip: press {keyHint}+Enter to generate.
                </p>
                {activeBuilderError && (
                  <div
                    id="workflow-builder-error"
                    role="alert"
                    className="mt-3 flex items-start gap-2 text-sm text-destructive"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5" />
                    <span>{activeBuilderError}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={isGenerating}
                  className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-60 disabled:cursor-not-allowed text-foreground transition-all duration-300 ease-in-out text-sm shadow-sm flex items-center gap-2"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                  Generate
                </button>
                <button
                  type="button"
                  onClick={handleRunPreview}
                  disabled={!generatedDefinition || isRunning}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 ease-in-out text-sm shadow-sm flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Run
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm text-foreground">Preview</p>
                <div className="flex items-center gap-3">
                  <p className="text-xs text-muted-foreground">
                    {generatedDefinition ? `Saved as ${generatedDefinition.id}` : 'Generated SKILL.md'}
                  </p>
                  {generatedDefinition ? (
                    <button
                      type="button"
                      onClick={() => setDrawerWorkflowId(generatedDefinition.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 py-1 text-[11px] text-foreground transition-all duration-200 hover:bg-card"
                    >
                      <PanelRight className="h-3 w-3" />
                      Open menu
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="p-4">
                {builderPreview ? (
                  <pre className="text-xs sm:text-sm font-mono text-foreground whitespace-pre-wrap break-words">
                    {builderPreview}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground">Generate a preview to see what would run.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading workflows...</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm animate-pulse"
                >
                  <div className="w-14 h-14 rounded-xl bg-muted/50 mb-4" />
                  <div className="h-4 w-2/3 bg-muted/50 rounded mb-2" />
                  <div className="h-3 w-full bg-muted/40 rounded mb-2" />
                  <div className="h-3 w-4/5 bg-muted/40 rounded" />
                  <div className="mt-5 flex gap-2">
                    <div className="h-9 flex-1 bg-muted/40 rounded-lg" />
                    <div className="h-9 w-12 bg-muted/40 rounded-lg" />
                    <div className="h-9 w-12 bg-muted/40 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="text-lg text-foreground mb-1">Failed to load workflows</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <button
                onClick={() => reload()}
                className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-300 ease-in-out text-sm shadow-sm flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && workflowCards.length === 0 && (
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-10 shadow-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 mx-auto mb-4 flex items-center justify-center">
              <Star className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-xl text-foreground mb-2">No workflows yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create your first workflow to automate recurring tasks across your tools.
            </p>
            <button className="mt-6 px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out shadow-md hover:scale-105 active:scale-95">
              + Create New Workflow
            </button>
          </div>
        )}

        {!isLoading && !error && workflowCards.length > 0 && pinnedWorkflows.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 fill-current text-[#A5B574]" />
              <h3 className="text-xl text-foreground">Pinned Workflows</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pinnedWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onTogglePin={(id) => void handleTogglePin(id)}
                  onRun={(id) => void handleRun(id)}
                  onOpenDetails={(id) => setDrawerWorkflowId(id)}
                  onDelete={(id) => void handleDeleteWorkflow(id)}
                  lastRun={(runsByWorkflowId[workflow.id]?.[0] as WorkflowRun | undefined) ?? null}
                  isStarting={startingWorkflowId === workflow.id}
                  isDeleting={deletingWorkflowId === workflow.id}
                  deletePending={pendingDeleteId === workflow.id}
                />
              ))}
            </div>
          </div>
        )}

        {!isLoading && !error && workflowCards.length > 0 && (
          <div>
            <h3 className="text-xl text-foreground mb-4">All Workflows</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {unpinnedWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onTogglePin={(id) => void handleTogglePin(id)}
                  onRun={(id) => void handleRun(id)}
                  onOpenDetails={(id) => setDrawerWorkflowId(id)}
                  onDelete={(id) => void handleDeleteWorkflow(id)}
                  lastRun={(runsByWorkflowId[workflow.id]?.[0] as WorkflowRun | undefined) ?? null}
                  isStarting={startingWorkflowId === workflow.id}
                  isDeleting={deletingWorkflowId === workflow.id}
                  deletePending={pendingDeleteId === workflow.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {drawerWorkflow ? (
        <WorkflowDetailsDrawer
          workflow={drawerWorkflow}
          pinned={pinnedSet.has(drawerWorkflow.id)}
          pinsError={pinsError}
          alwaysApprove={approvalOptIn}
          alwaysApproveStatus={approvalOptInStatus}
          alwaysApproveError={approvalOptInError}
          runs={(runsByWorkflowId[drawerWorkflow.id] ?? []) as WorkflowRun[]}
          isRunning={isRunning}
          deletePending={pendingDeleteId === drawerWorkflow.id}
          isDeleting={deletingWorkflowId === drawerWorkflow.id}
          deleteError={deleteError}
          skillDraft={skillDraft}
          skillStatus={skillStatus}
          skillSource={skillSource}
          skillError={skillError}
          isSkillDirty={isSkillDirty}
          onClose={() => setDrawerWorkflowId(null)}
          onTogglePin={() => void handleTogglePin(drawerWorkflow.id)}
          onToggleAlwaysApprove={() => void handleToggleAlwaysApprove()}
          onRun={() => void handleRun(drawerWorkflow.id)}
          onDelete={() => void handleDeleteWorkflow(drawerWorkflow.id)}
          onSkillChange={(next) => {
            setSkillDraft(next);
            if (skillStatus === 'error' || skillStatus === 'saved') setSkillStatus('idle');
          }}
          onSaveSkill={() => void handleSaveSkill()}
          onOpenTaskRun={(taskRunId) => onOpenTaskRun?.(taskRunId)}
        />
      ) : null}

      {startToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div
            className={
              startToast.variant === 'success'
                ? 'flex items-center gap-2 rounded-full border border-[#4A7C59]/30 bg-[#4A7C59]/10 px-4 py-2 text-xs text-[#4A7C59] shadow-lg backdrop-blur'
                : startToast.variant === 'error'
                  ? 'flex items-center gap-2 rounded-full border border-destructive/25 bg-destructive/5 px-4 py-2 text-xs text-destructive shadow-lg backdrop-blur'
                  : 'flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur'
            }
            role="status"
            aria-live="polite"
          >
            {startToast.variant === 'success' ? (
              <Check className="h-4 w-4" />
            ) : startToast.variant === 'error' ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {startToast.message}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowsMode;

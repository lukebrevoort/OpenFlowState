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
} from 'lucide-react';
import { useWorkflowsStore } from '../stores/workflowsStore';
import type { WorkflowDefinition, WorkflowRun } from '../types/electron';

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
  lastRun,
}: {
  workflow: Workflow;
  onTogglePin: (id: string) => void;
  onRun: (id: string) => void;
  onOpenDetails: (id: string) => void;
  lastRun: WorkflowRun | null;
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
          className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out text-sm flex items-center justify-center gap-2 shadow-sm"
        >
          <Play className="w-4 h-4" />
          Run
        </button>
      </div>
    </div>
  );
}

function WorkflowDetailsDrawer({
  workflow,
  pinned,
  pinsError,
  runs,
  isRunning,
  onClose,
  onTogglePin,
  onRun,
  onOpenTaskRun,
}: {
  workflow: WorkflowDefinition;
  pinned: boolean;
  pinsError: string | null;
  runs: WorkflowRun[];
  isRunning: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  onRun: () => void;
  onOpenTaskRun: (taskRunId: string) => void;
}) {
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
  const pinnedIds = useWorkflowsStore((state) => state.pinnedIds);
  const loadPins = useWorkflowsStore((state) => state.loadPins);
  const setPinned = useWorkflowsStore((state) => state.setPinned);
  const pinsError = useWorkflowsStore((state) => state.pinsError);
  const runsByWorkflowId = useWorkflowsStore((state) => state.runsByWorkflowId);
  const ensureRunsLoaded = useWorkflowsStore((state) => state.ensureRunsLoaded);
  const [drawerWorkflowId, setDrawerWorkflowId] = useState<string | null>(null);

  const [builderIntent, setBuilderIntent] = useState('');
  const [builderPreview, setBuilderPreview] = useState<string | null>(null);
  const [builderError, setBuilderError] = useState<string | null>(null);
  const [generatedDefinition, setGeneratedDefinition] = useState<WorkflowDefinition | null>(null);
  const builderIntentRef = useRef<HTMLTextAreaElement | null>(null);

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

  const handleRun = async (id: string) => {
    const result = await runWorkflow(id);
    void ensureRunsLoaded(id, 5);

    if (result?.taskRunId && onOpenTaskRun) {
      onOpenTaskRun(result.taskRunId);
    }

    if (drawerWorkflowId === id) {
      setDrawerWorkflowId(null);
    }
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
                <p className="text-xs text-muted-foreground">
                  {generatedDefinition ? `Saved as ${generatedDefinition.id}` : 'Generated SKILL.md'}
                </p>
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
                  lastRun={(runsByWorkflowId[workflow.id]?.[0] as WorkflowRun | undefined) ?? null}
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
                  lastRun={(runsByWorkflowId[workflow.id]?.[0] as WorkflowRun | undefined) ?? null}
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
          runs={(runsByWorkflowId[drawerWorkflow.id] ?? []) as WorkflowRun[]}
          isRunning={isRunning}
          onClose={() => setDrawerWorkflowId(null)}
          onTogglePin={() => void handleTogglePin(drawerWorkflow.id)}
          onRun={() => void handleRun(drawerWorkflow.id)}
          onOpenTaskRun={(taskRunId) => onOpenTaskRun?.(taskRunId)}
        />
      ) : null}
    </div>
  );
}

export default WorkflowsMode;

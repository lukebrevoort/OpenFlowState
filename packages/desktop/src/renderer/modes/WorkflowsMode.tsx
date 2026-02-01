import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Star,
  Edit2,
  Play,
  MoreVertical,
  Copy,
  Trash2,
  Newspaper,
  PenLine,
  BarChart3,
  Mic,
  Search,
  Mail,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useWorkflowsStore } from '../stores/workflowsStore';
import type { WorkflowDefinition } from '../types/electron';

interface Workflow {
  id: string;
  name: string;
  description: string;
  icon: typeof Newspaper;
  isPinned: boolean;
  lastRun?: Date;
  runCount: number;
  color: string;
}

const DEFAULT_PINNED_IDS = new Set(['daily-briefing', 'content-generator', 'research-helper']);
const CARD_ICONS = [Newspaper, PenLine, BarChart3, Mic, Search, Mail];
const CARD_COLORS = ['#C87137', '#A5B574', '#3E2F27', '#E8BFA0'];
const MOCK_BASE_DATE = new Date('2026-01-01T00:00:00.000Z');

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
  pinnedOverrides: Record<string, boolean>,
): Workflow {
  const safeDescription = workflow.description ?? 'No description provided.';
  const hash = hashString(workflow.id);
  const pinnedDefault = DEFAULT_PINNED_IDS.has(workflow.id);
  const isPinned = pinnedOverrides[workflow.id] ?? pinnedDefault;
  const icon = CARD_ICONS[hash % CARD_ICONS.length] ?? Newspaper;
  const color = CARD_COLORS[hash % CARD_COLORS.length] ?? '#A5B574';
  const runCount = 8 + (hash % 240);
  const daysAgo = hash % 21;
  const lastRun = new Date(MOCK_BASE_DATE.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  return {
    id: workflow.id,
    name: workflow.title,
    description: safeDescription,
    icon,
    isPinned,
    lastRun,
    runCount,
    color,
  };
}

function WorkflowCard({
  workflow,
  onTogglePin,
  onEdit,
  onRun,
}: {
  workflow: Workflow;
  onTogglePin: (id: string) => void;
  onEdit: (id: string) => void;
  onRun: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="group relative bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 ease-in-out hover:scale-[1.02]">
      {workflow.isPinned && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#A5B574] shadow-sm" />
      )}

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

      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Play className="w-3 h-3" />
          <span>{workflow.runCount} runs</span>
        </div>
        {workflow.lastRun && <div>Last: {workflow.lastRun.toLocaleDateString()}</div>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onRun(workflow.id)}
          className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out text-sm flex items-center justify-center gap-2 shadow-sm"
        >
          <Play className="w-4 h-4" />
          Run
        </button>
        <button
          onClick={() => onEdit(workflow.id)}
          className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-300 ease-in-out text-sm shadow-sm"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-300 ease-in-out text-sm shadow-sm"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-12 z-20 w-40 bg-card border border-border rounded-lg shadow-lg overflow-hidden backdrop-blur-xl">
                <button
                  onClick={() => {
                    onTogglePin(workflow.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 text-foreground"
                >
                  <Star className={`w-4 h-4 ${workflow.isPinned ? 'fill-current text-[#A5B574]' : ''}`} />
                  {workflow.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={() => {
                    console.log('Duplicate workflow');
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-secondary flex items-center gap-2 text-foreground"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    console.log('Delete workflow');
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-destructive/10 flex items-center gap-2 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowsMode() {
  const workflows = useWorkflowsStore((state) => state.workflows);
  const isLoading = useWorkflowsStore((state) => state.isLoading);
  const error = useWorkflowsStore((state) => state.error);
  const reload = useWorkflowsStore((state) => state.reload);
  const runWorkflow = useWorkflowsStore((state) => state.run);
  const isRunning = useWorkflowsStore((state) => state.isRunning);
  const generateFromIntent = useWorkflowsStore((state) => state.generateFromIntent);
  const isGenerating = useWorkflowsStore((state) => state.isGenerating);
  const generateError = useWorkflowsStore((state) => state.generateError);
  const [pinnedOverrides, setPinnedOverrides] = useState<Record<string, boolean>>({});

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
  }, [reload]);

  const handleTogglePin = (id: string) => {
    setPinnedOverrides((current) => {
      const pinnedDefault = DEFAULT_PINNED_IDS.has(id);
      const currentPinned = current[id] ?? pinnedDefault;
      return { ...current, [id]: !currentPinned };
    });
  };

  const handleEdit = (id: string) => {
    console.log('Editing workflow:', id);
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
    runWorkflow(generatedDefinition.id);
  };

  const activeBuilderError = builderError ?? generateError;

  const workflowCards = useMemo(
    () => workflows.map((workflow) => workflowToCardModel(workflow, pinnedOverrides)),
    [workflows, pinnedOverrides],
  );

  const pinnedWorkflows = workflowCards.filter((workflow) => workflow.isPinned);
  const unpinnedWorkflows = workflowCards.filter((workflow) => !workflow.isPinned);

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
                  onTogglePin={handleTogglePin}
                  onEdit={handleEdit}
                  onRun={(id) => runWorkflow(id)}
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
                  onTogglePin={handleTogglePin}
                  onEdit={handleEdit}
                  onRun={(id) => runWorkflow(id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkflowsMode;

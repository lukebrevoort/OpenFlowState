import { useEffect, useMemo, useState } from 'react';
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
}: {
  workflow: Workflow;
  onTogglePin: (id: string) => void;
  onEdit: (id: string) => void;
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
          onClick={() => console.log('Run workflow', workflow.id)}
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
  const [pinnedOverrides, setPinnedOverrides] = useState<Record<string, boolean>>({});

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

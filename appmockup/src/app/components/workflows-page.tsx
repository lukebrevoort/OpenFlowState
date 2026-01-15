import { useState } from 'react';
import { Star, Edit2, Play, MoreVertical, Copy, Trash2 } from 'lucide-react';

interface Workflow {
  id: number;
  name: string;
  description: string;
  icon: string;
  isPinned: boolean;
  lastRun?: Date;
  runCount: number;
  color: string;
}

function WorkflowCard({ workflow, onTogglePin, onEdit }: { 
  workflow: Workflow; 
  onTogglePin: (id: number) => void;
  onEdit: (id: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="group relative bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
      {/* Pin indicator */}
      {workflow.isPinned && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#A5B574] shadow-sm" />
      )}

      {/* Workflow icon */}
      <div className="mb-4">
        <div 
          className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md text-2xl"
          style={{ backgroundColor: workflow.color }}
        >
          {workflow.icon}
        </div>
      </div>

      {/* Workflow info */}
      <div className="mb-4">
        <h3 className="text-lg text-foreground mb-1 pr-6">{workflow.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{workflow.description}</p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Play className="w-3 h-3" />
          <span>{workflow.runCount} runs</span>
        </div>
        {workflow.lastRun && (
          <div>
            Last: {workflow.lastRun.toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => console.log('Run workflow', workflow.id)}
          className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-sm"
        >
          <Play className="w-4 h-4" />
          Run
        </button>
        <button
          onClick={() => onEdit(workflow.id)}
          className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-200 text-sm shadow-sm"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-200 text-sm shadow-sm"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          
          {/* Dropdown menu */}
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)}
              />
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

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: 1,
      name: 'Daily Briefing',
      description: 'Summarize emails, calendar events, and top news each morning',
      icon: '📰',
      isPinned: true,
      lastRun: new Date(Date.now() - 86400000),
      runCount: 147,
      color: '#C87137',
    },
    {
      id: 2,
      name: 'Content Generator',
      description: 'Create blog posts, social media content, and marketing copy',
      icon: '✍️',
      isPinned: true,
      lastRun: new Date(Date.now() - 3600000),
      runCount: 89,
      color: '#A5B574',
    },
    {
      id: 3,
      name: 'Data Analyzer',
      description: 'Process spreadsheets, generate reports, and identify trends',
      icon: '📊',
      isPinned: false,
      lastRun: new Date(Date.now() - 7200000),
      runCount: 63,
      color: '#3E2F27',
    },
    {
      id: 4,
      name: 'Meeting Assistant',
      description: 'Transcribe meetings, create action items, and send summaries',
      icon: '🎙️',
      isPinned: false,
      lastRun: new Date(Date.now() - 172800000),
      runCount: 34,
      color: '#E8BFA0',
    },
    {
      id: 5,
      name: 'Research Helper',
      description: 'Gather information, summarize articles, and compile references',
      icon: '🔍',
      isPinned: true,
      lastRun: new Date(Date.now() - 259200000),
      runCount: 128,
      color: '#A5B574',
    },
    {
      id: 6,
      name: 'Email Composer',
      description: 'Draft professional emails, responses, and follow-ups',
      icon: '✉️',
      isPinned: false,
      lastRun: new Date(Date.now() - 432000000),
      runCount: 201,
      color: '#C87137',
    },
  ]);

  const [editingWorkflowId, setEditingWorkflowId] = useState<number | null>(null);

  const handleTogglePin = (id: number) => {
    setWorkflows(workflows.map(w => 
      w.id === id ? { ...w, isPinned: !w.isPinned } : w
    ));
  };

  const handleEdit = (id: number) => {
    setEditingWorkflowId(id);
    // In a real app, this would open an edit modal or navigate to edit page
    console.log('Editing workflow:', id);
  };

  const pinnedWorkflows = workflows.filter(w => w.isPinned);
  const unpinnedWorkflows = workflows.filter(w => !w.isPinned);

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl text-foreground mb-2">Workflows</h2>
          <p className="text-muted-foreground mb-6">
            Create, customize, and manage your AI automation workflows
          </p>
          
          <button className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-md hover:scale-105 active:scale-95">
            + Create New Workflow
          </button>
        </div>

        {/* Pinned Workflows */}
        {pinnedWorkflows.length > 0 && (
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

        {/* All Workflows */}
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
      </div>
    </div>
  );
}

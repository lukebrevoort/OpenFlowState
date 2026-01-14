import { Play, Edit3, Pin, Plus, Zap } from 'lucide-react';

interface Workflow {
  id: string;
  name: string;
  description: string;
  emoji: string;
  isBuiltIn: boolean;
  isPinned: boolean;
}

/**
 * WorkflowsMode - Browse, create, and manage reusable workflows
 */
function WorkflowsMode() {
  // Mock data - will be replaced with real state
  const builtInWorkflows: Workflow[] = [
    {
      id: '1',
      name: 'Inbox Review',
      description: 'Summarize and organize unread emails',
      emoji: '📧',
      isBuiltIn: true,
      isPinned: true,
    },
    {
      id: '2',
      name: 'Meeting Prep',
      description: 'Prepare notes for your next meeting',
      emoji: '📅',
      isBuiltIn: true,
      isPinned: true,
    },
    {
      id: '3',
      name: 'Daily Standup',
      description: 'Prepare your standup notes',
      emoji: '☀️',
      isBuiltIn: true,
      isPinned: false,
    },
    {
      id: '4',
      name: 'Desktop Cleanup',
      description: 'Organize files on your desktop',
      emoji: '🧹',
      isBuiltIn: true,
      isPinned: true,
    },
  ];

  const userWorkflows: Workflow[] = [
    {
      id: '5',
      name: 'Weekly Report',
      description: 'Generate weekly progress report',
      emoji: '📊',
      isBuiltIn: false,
      isPinned: false,
    },
  ];

  const WorkflowCard = ({ workflow }: { workflow: Workflow }) => (
    <div className="fs-card hover:shadow-flowstate-lg transition-shadow group">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{workflow.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-flowstate-text truncate">
              {workflow.name}
            </h3>
            {workflow.isPinned && (
              <Pin className="w-3 h-3 text-flowstate-warning fill-flowstate-warning" />
            )}
          </div>
          <p className="text-sm text-flowstate-text-muted mt-1">
            {workflow.description}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-flowstate-border">
        <button className="fs-button-primary text-sm py-1.5 flex-1 flex items-center justify-center gap-1">
          <Play className="w-3 h-3" />
          Run
        </button>
        <button className="fs-button-ghost text-sm py-1.5 px-3" title="Edit">
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          className={`fs-button-ghost text-sm py-1.5 px-3 ${workflow.isPinned ? 'text-flowstate-warning' : ''}`}
          title={workflow.isPinned ? 'Unpin' : 'Pin to sidebar'}
        >
          <Pin className={`w-4 h-4 ${workflow.isPinned ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-flowstate-text">Workflows</h1>
          <p className="text-flowstate-text-muted mt-1">
            Pre-built automations and your custom workflows
          </p>
        </div>
        <button className="fs-button-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
      </div>

      {/* Pre-built Workflows */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-flowstate-text mb-4">
          <Zap className="w-5 h-5 text-flowstate-warning" />
          Pre-built
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {builtInWorkflows.map((workflow) => (
            <WorkflowCard key={workflow.id} workflow={workflow} />
          ))}
        </div>
      </section>

      {/* User Workflows */}
      <section>
        <h2 className="text-lg font-semibold text-flowstate-text mb-4">
          Your Workflows
        </h2>
        {userWorkflows.length === 0 ? (
          <div className="fs-card text-center py-12">
            <div className="text-4xl mb-4">✨</div>
            <h3 className="font-medium text-flowstate-text mb-2">
              Create your first workflow
            </h3>
            <p className="text-sm text-flowstate-text-muted mb-4 max-w-md mx-auto">
              Workflows are reusable automations that you can run with one click.
              They're defined using simple markdown files.
            </p>
            <button className="fs-button-primary">
              <Plus className="w-4 h-4 mr-2 inline" />
              Create Workflow
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userWorkflows.map((workflow) => (
              <WorkflowCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default WorkflowsMode;

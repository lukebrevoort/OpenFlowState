import { MessageSquare, Zap, Loader2, Clock, Pin } from 'lucide-react';

/**
 * Sidebar - Shows recent convos, pinned workflows, and running tasks
 */
function Sidebar() {
  // Mock data - will be replaced with real state
  const recentConversations = [
    { id: '1', title: 'Organize my inbox', time: '2 min ago' },
    { id: '2', title: 'Meeting prep for tomorrow', time: '1 hour ago' },
    { id: '3', title: 'Create weekly report', time: 'Yesterday' },
  ];

  const pinnedWorkflows = [
    { id: '1', name: 'Inbox Review', emoji: '📧' },
    { id: '2', name: 'Meeting Prep', emoji: '📅' },
    { id: '3', name: 'Desktop Cleanup', emoji: '🧹' },
  ];

  const runningTasks = [
    { id: '1', name: 'Organizing Gmail...', progress: 58 },
  ];

  return (
    <aside className="w-64 bg-flowstate-surface/30 border-r border-flowstate-border flex flex-col overflow-hidden">
      {/* Logo area */}
      <div className="p-4 border-b border-flowstate-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-flowstate-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="font-semibold text-flowstate-text">FlowState</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-6">
        {/* Recent Conversations */}
        <section className="px-3">
          <h3 className="flex items-center gap-2 px-2 mb-2 text-xs font-semibold text-flowstate-text-muted uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            Recent
          </h3>
          <nav className="space-y-1">
            {recentConversations.map((convo) => (
              <button
                key={convo.id}
                className="fs-sidebar-item w-full text-left"
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">{convo.title}</p>
                  <p className="text-xs text-flowstate-text-muted">{convo.time}</p>
                </div>
              </button>
            ))}
          </nav>
        </section>

        {/* Pinned Workflows */}
        <section className="px-3">
          <h3 className="flex items-center gap-2 px-2 mb-2 text-xs font-semibold text-flowstate-text-muted uppercase tracking-wider">
            <Pin className="w-3 h-3" />
            Pinned Workflows
          </h3>
          <nav className="space-y-1">
            {pinnedWorkflows.map((workflow) => (
              <button
                key={workflow.id}
                className="fs-sidebar-item w-full text-left"
              >
                <span className="text-lg">{workflow.emoji}</span>
                <span className="truncate">{workflow.name}</span>
                <Zap className="w-3 h-3 text-flowstate-warning ml-auto" />
              </button>
            ))}
          </nav>
        </section>

        {/* Running Tasks */}
        {runningTasks.length > 0 && (
          <section className="px-3">
            <h3 className="flex items-center gap-2 px-2 mb-2 text-xs font-semibold text-flowstate-text-muted uppercase tracking-wider">
              <Loader2 className="w-3 h-3 animate-spin" />
              Running
            </h3>
            <nav className="space-y-1">
              {runningTasks.map((task) => (
                <div
                  key={task.id}
                  className="fs-sidebar-item"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">{task.name}</p>
                    <div className="mt-1 h-1.5 bg-flowstate-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-flowstate-primary rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </nav>
          </section>
        )}
      </div>

      {/* Bottom section */}
      <div className="p-3 border-t border-flowstate-border">
        <div className="fs-card text-center">
          <p className="text-xs text-flowstate-text-muted">
            Connected to OpenCode Zen
          </p>
          <p className="text-xs text-semantic-connected font-medium mt-1">
            ● Ready
          </p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

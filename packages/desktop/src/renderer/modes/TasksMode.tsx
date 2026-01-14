import { Loader2, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';

interface Task {
  id: string;
  name: string;
  status: 'running' | 'waiting' | 'completed' | 'failed';
  progress?: number;
  description?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * TasksMode - View and manage long-running background tasks
 */
function TasksMode() {
  // Mock data - will be replaced with real state
  const activeTasks: Task[] = [
    {
      id: '1',
      name: 'Organizing Gmail inbox',
      status: 'running',
      progress: 58,
      description: 'Processing 847 emails • Currently: Categorizing newsletters',
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
    {
      id: '2',
      name: 'Desktop organization ready',
      status: 'waiting',
      description: 'Will move 34 files to organized folders',
      startedAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  ];

  const completedTasks: Task[] = [
    {
      id: '3',
      name: 'Morning inbox review',
      status: 'completed',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000),
    },
    {
      id: '4',
      name: 'Calendar conflict resolution',
      status: 'completed',
      startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 4 * 60 * 60 * 1000 + 2 * 60 * 1000),
    },
  ];

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 text-flowstate-primary animate-spin" />;
      case 'waiting':
        return <Clock className="w-5 h-5 text-semantic-pending" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-semantic-approval" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-semantic-denied" />;
    }
  };

  const getStatusBadge = (status: Task['status']) => {
    switch (status) {
      case 'running':
        return <span className="fs-badge bg-flowstate-primary/10 text-flowstate-primary">Running</span>;
      case 'waiting':
        return <span className="fs-badge-warning">Waiting for approval</span>;
      case 'completed':
        return <span className="fs-badge-success">Completed</span>;
      case 'failed':
        return <span className="fs-badge-error">Failed</span>;
    }
  };

  const formatTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} min ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-8">
      {/* Active Tasks */}
      <section>
        <h2 className="text-lg font-semibold text-flowstate-text mb-4">
          Active Tasks
        </h2>
        
        {activeTasks.length === 0 ? (
          <div className="fs-card text-center py-8">
            <p className="text-flowstate-text-muted">No active tasks</p>
            <p className="text-sm text-flowstate-text-muted mt-1">
              Start a conversation to create tasks
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map((task) => (
              <div key={task.id} className="fs-card">
                <div className="flex items-start gap-4">
                  {getStatusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium text-flowstate-text truncate">
                        {task.name}
                      </h3>
                      {getStatusBadge(task.status)}
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-flowstate-text-muted mt-1">
                        {task.description}
                      </p>
                    )}
                    
                    {task.progress !== undefined && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-flowstate-text-muted mb-1">
                          <span>Progress</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div className="h-2 bg-flowstate-border rounded-full overflow-hidden">
                          <div
                            className="h-full bg-flowstate-primary rounded-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs text-flowstate-text-muted">
                        Started {formatTime(task.startedAt)}
                      </span>
                      {task.status === 'waiting' && (
                        <button className="fs-button-primary text-xs py-1 px-3">
                          <Eye className="w-3 h-3 mr-1 inline" />
                          Review Changes
                        </button>
                      )}
                      {task.status === 'running' && (
                        <button className="fs-button-secondary text-xs py-1 px-3">
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Completed Tasks */}
      <section>
        <h2 className="text-lg font-semibold text-flowstate-text mb-4">
          Completed Today
        </h2>
        
        {completedTasks.length === 0 ? (
          <div className="fs-card text-center py-8">
            <p className="text-flowstate-text-muted">No completed tasks today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {completedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-4 py-3 bg-flowstate-surface/50 rounded-lg"
              >
                {getStatusIcon(task.status)}
                <span className="flex-1 text-flowstate-text">{task.name}</span>
                <span className="text-sm text-flowstate-text-muted">
                  {formatTime(task.completedAt || task.startedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default TasksMode;

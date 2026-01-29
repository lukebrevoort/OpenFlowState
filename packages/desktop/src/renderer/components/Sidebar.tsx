import { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Workflow,
  Loader2,
  Clock,
  Star,
  Search,
  Mail,
  FileText,
  Smartphone,
  X,
} from 'lucide-react';
import { useChatStore } from '../stores/chatStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (sessionId: string) => void;
}

function Sidebar({ isOpen, onClose, onSelectConversation }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { sessions, currentSessionId, setSessions } = useChatStore();

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessionList = await window.flowstate.opencode.listSessions();
        setSessions(sessionList);
      } catch (error) {
        console.error('Failed to list sessions', error);
      }
    };

    fetchSessions();
  }, [setSessions]);

  const filteredSessions = useMemo(() => {
    if (!searchTerm.trim()) return sessions;
    const query = searchTerm.toLowerCase();
    return sessions.filter((session) => session.title?.toLowerCase().includes(query));
  }, [sessions, searchTerm]);

  const recentSessions = filteredSessions.slice(0, 3);

  const pinnedWorkflows = [
    { id: '1', title: 'Email Inbox Organizer', icon: Mail },
    { id: '2', title: 'Weekly Report Generator', icon: FileText },
    { id: '3', title: 'Social Media Scheduler', icon: Smartphone },
  ];

  const runningTasks = [
    { id: '1', title: 'Analyzing market trends', isRunning: true },
    { id: '2', title: 'Generating content outline', isRunning: true },
  ];

  return (
    <div
      role="navigation"
      aria-label="Sidebar"
      aria-hidden={!isOpen}
      className={`fixed top-0 left-0 h-full w-80 max-w-[calc(100vw-3rem)] bg-sidebar/90 backdrop-blur-2xl border-r border-sidebar-border shadow-[0_24px_60px_rgba(62,47,39,0.18)] transition-transform duration-300 ease-in-out z-50 lg:top-3 lg:left-3 lg:h-[calc(100%-1.5rem)] lg:w-72 lg:border lg:border-sidebar-border lg:rounded-3xl ${
        isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl border flex items-center justify-center"
                style={{
                  borderColor: 'var(--fs-line)',
                  backgroundColor: 'color-mix(in srgb, var(--fs-surface-1) 55%, transparent)',
                  boxShadow: 'var(--fs-shadow-sm)',
                }}
                aria-hidden="true"
              >
                <span
                  className="text-base text-foreground"
                  style={{ fontFamily: 'var(--fs-font-display)' }}
                >
                  F
                </span>
              </div>
              <div>
                <h2 className="text-base text-foreground">FlowState</h2>
                <p className="text-xs text-muted-foreground">Your AI workspace</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="fs-icon-button lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          <div className="mt-4 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search conversations"
              className="fs-input pl-10"
              aria-label="Search conversations"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4">
          <div className="mb-6">
            <div className="flex items-center gap-2 px-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Recent Chats</span>
            </div>
            <div className="space-y-0.5">
              {recentSessions.length > 0 ? (
                recentSessions.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => {
                      onSelectConversation(chat.id);
                      onClose();
                    }}
                    className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 ease-in-out text-left ${
                      currentSessionId === chat.id
                        ? 'bg-sidebar-accent text-foreground shadow-sm'
                        : 'hover:bg-sidebar-accent hover:translate-x-1'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground/90 truncate">{chat.title || 'Untitled'}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">No conversations yet</div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 px-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Star className="w-3 h-3" />
              <span>Pinned Workflows</span>
            </div>
            <div className="space-y-0.5">
                {pinnedWorkflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-all duration-300 ease-in-out text-left hover:translate-x-1"
                  >
                    <workflow.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground/90 truncate">{workflow.title}</div>
                    </div>
                  </button>
                ))}

            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 px-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Workflow className="w-3 h-3" />
              <span>Running Tasks</span>
            </div>
            <div className="space-y-0.5">
              {runningTasks.length > 0 ? (
                runningTasks.map((task) => (
                  <div
                    key={task.id}
                  className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-all duration-300 ease-in-out text-left hover:translate-x-1"

                  >
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground/90 truncate">{task.title}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">No active tasks</div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-sidebar-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500/80 shadow-sm" />
              <span>Connected</span>
            </div>
            <span>v1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  Workflow,
  Loader2,
  Clock,
  Star,
  Search,
  X,
} from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useWorkflowsStore } from '../stores/workflowsStore';
import { isTaskRunActiveStatus, useTasksStore } from '../stores/tasksStore';

const flowstateLogo = new URL(
  '../../../assets/flowstate-main-logo.png',
  import.meta.url,
).toString();

const TASK_RETENTION_DAYS = 10;
const TASK_RETENTION_MS = TASK_RETENTION_DAYS * 24 * 60 * 60 * 1000;

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleSidebar: () => void;
  onNavigateHome: () => void;
  onSelectTaskRun: (taskRunId: string) => void;
  onSelectConversation: (sessionId: string) => void;
}

function Sidebar({
  isOpen,
  onClose,
  onToggleSidebar,
  onNavigateHome,
  onSelectTaskRun,
  onSelectConversation,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const { sessions, currentSessionId, setSessions } = useChatStore();
  const workflows = useWorkflowsStore((state) => state.workflows);
  const pinnedIds = useWorkflowsStore((state) => state.pinnedIds);
  const reloadWorkflows = useWorkflowsStore((state) => state.reload);
  const loadPins = useWorkflowsStore((state) => state.loadPins);
  const runs = useTasksStore((state) => state.runs);
  const reloadRuns = useTasksStore((state) => state.reloadRuns);
  const loadActiveRun = useTasksStore((state) => state.loadActiveRun);

  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  const refreshSessions = useCallback(async () => {
    try {
      const sessionList = await window.flowstate.opencode.listSessions();
      setSessions(sessionList);
    } catch (error) {
      console.error('Failed to list sessions', error);
    }
  }, [setSessions]);

  const refreshSidebarData = useCallback(async () => {
    await Promise.all([
      reloadWorkflows({ silent: true }),
      loadPins({ silent: true }),
      loadActiveRun({ silent: true }),
      reloadRuns({ silent: true }),
    ]);
  }, [loadActiveRun, loadPins, reloadRuns, reloadWorkflows]);

  useEffect(() => {
    void refreshSessions();
    void refreshSidebarData();

    if (!isOpen) return;

    const interval = window.setInterval(() => {
      void refreshSessions();
      void refreshSidebarData();
    }, 10_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [currentSessionId, isOpen, refreshSessions, refreshSidebarData]);

  useEffect(() => {
    const sidebarEl = sidebarRef.current;
    if (!sidebarEl) return;

    if (!isOpen) {
      sidebarEl.setAttribute('inert', '');
      return;
    }

    sidebarEl.removeAttribute('inert');

    const active = document.activeElement;
    lastActiveElementRef.current = active instanceof HTMLElement ? active : null;

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => {
      sidebarEl.setAttribute('inert', '');
      const lastActive = lastActiveElementRef.current;
      if (!lastActive) return;
      if (!document.contains(lastActive)) return;
      if (sidebarEl.contains(lastActive)) return;
      requestAnimationFrame(() => {
        lastActive.focus();
      });
    };
  }, [isOpen]);

  const getFocusableElements = (container: HTMLElement) => {
    const candidates = container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    return Array.from(candidates).filter((el) => {
      const style = window.getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      return true;
    });
  };

  const filteredSessions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) => {
      const title = (session.title ?? '').toLowerCase();
      return title.includes(query);
    });
  }, [sessions, searchTerm]);

  const visibleSessions = useMemo(() => {
    if (searchTerm.trim()) return filteredSessions;
    return filteredSessions.slice(0, 3);
  }, [filteredSessions, searchTerm]);

  const pinnedWorkflows = useMemo(() => {
    const pinnedSet = new Set(pinnedIds);
    return workflows.filter((workflow) => pinnedSet.has(workflow.id));
  }, [pinnedIds, workflows]);

  const runningTasks = useMemo(() => {
    const cutoff = Date.now() - TASK_RETENTION_MS;
    return [...runs]
      .filter((run) => isTaskRunActiveStatus(run.status))
      .filter((run) => {
        const timestamp = run.updatedAt ?? run.startedAt ?? 0;
        return timestamp >= cutoff;
      })
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }, [runs]);

  return (
    <div
      ref={sidebarRef}
      role="navigation"
      aria-labelledby="fs-sidebar-title"
      aria-hidden={!isOpen}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (!isOpen) return;
        if (e.key !== 'Tab') return;
        const sidebarEl = sidebarRef.current;
        if (!sidebarEl) return;
        const focusable = getFocusableElements(sidebarEl);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || active === sidebarEl) {
            e.preventDefault();
            last.focus();
          }
          return;
        }

        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      className={`fixed top-0 left-0 h-full w-80 max-w-[calc(100vw-3rem)] bg-sidebar/90 backdrop-blur-2xl border-r border-sidebar-border shadow-[0_24px_60px_rgba(62,47,39,0.18)] transition-transform duration-300 ease-in-out z-50 lg:top-3 lg:left-3 lg:h-[calc(100%-1.5rem)] lg:w-72 lg:border lg:border-sidebar-border lg:rounded-3xl ${
        isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="fs-icon-button"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>

            <button
              type="button"
              onClick={onNavigateHome}
              className="flex items-center gap-3 text-left transition-opacity duration-300 ease-in-out hover:opacity-80"
              aria-label="Go to Home"
            >
              <div
                className="w-10 h-10 rounded-2xl border flex items-center justify-center"
                style={{
                  borderColor: 'var(--fs-line)',
                  backgroundColor: 'color-mix(in srgb, var(--fs-surface-1) 55%, transparent)',
                  boxShadow: 'var(--fs-shadow-sm)',
                }}
                aria-hidden="true"
              >
                <img
                  src={flowstateLogo}
                  alt="FlowState Logo"
                  className="w-7 h-7 object-contain"
                  style={{ fontFamily: 'var(--fs-font-display)' }}
                />
              </div>
              <div>
                <h2 id="fs-sidebar-title" className="text-base text-foreground">
                  FlowState
                </h2>
                <p className="text-xs text-muted-foreground">Your AI workspace</p>
              </div>
            </button>
          </div>

          <div className="mt-4 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
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
              {visibleSessions.length > 0 ? (
                visibleSessions.map((chat) => (
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
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {searchTerm.trim() ? 'No matching conversations' : 'No conversations yet'}
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 px-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Star className="w-3 h-3" />
              <span>Pinned Workflows</span>
            </div>
            <div className="space-y-0.5">
                {pinnedWorkflows.length > 0 ? (
                  pinnedWorkflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-all duration-300 ease-in-out text-left hover:translate-x-1"
                    >
                      <Star className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground/90 truncate">{workflow.title}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No pinned workflows</div>
                )}

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
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelectTaskRun(task.id)}
                    className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-all duration-300 ease-in-out text-left hover:translate-x-1"
                  >
                      {task.status === 'running' ? (
                        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      ) : (
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground/90 truncate">{task.title}</div>
                    </div>
                  </button>
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

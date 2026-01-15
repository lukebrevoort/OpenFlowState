import { MessageSquare, Workflow, Loader2, Clock, Star } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  isRunning?: boolean;
}

function SidebarItem({ icon, title, subtitle, isRunning }: SidebarItemProps) {
  return (
    <button className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-sidebar-accent transition-all duration-200 text-left">
      <div className="flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground/90 truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
        )}
      </div>
      {isRunning && (
        <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin flex-shrink-0" />
      )}
    </button>
  );
}

interface SidebarSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function SidebarSection({ title, icon, children }: SidebarSectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 px-3 mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}

export function Sidebar({ isOpen }: SidebarProps) {
  // Mock data
  const recentChats = [
    { id: 1, title: 'Product roadmap planning', time: '2 min ago' },
    { id: 2, title: 'Customer feedback analysis', time: '1 hour ago' },
    { id: 3, title: 'Meeting prep: Q1 review', time: 'Yesterday' },
  ];

  const pinnedWorkflows = [
    { id: 1, title: 'Email Inbox Organizer', icon: '📧' },
    { id: 2, title: 'Weekly Report Generator', icon: '📊' },
    { id: 3, title: 'Social Media Scheduler', icon: '📱' },
  ];

  const runningTasks = [
    { id: 1, title: 'Analyzing market trends', isRunning: true },
    { id: 2, title: 'Generating content outline', isRunning: true },
  ];

  return (
    <div
      className={`fixed top-0 left-0 h-full bg-sidebar/80 backdrop-blur-2xl border-r border-sidebar-border transition-all duration-300 ease-out z-50 ${
        isOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Sidebar Header */}
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#C87137] to-[#3E2F27] flex items-center justify-center shadow-md">
              <div className="w-6 h-6 text-white">✦</div>
            </div>
            <div>
              <h2 className="text-base text-foreground">FlowState</h2>
              <p className="text-xs text-muted-foreground">Your AI workspace</p>
            </div>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto px-2 py-4">
          {/* Recent Chats Section */}
          <SidebarSection 
            title="Recent Chats" 
            icon={<Clock className="w-3 h-3" />}
          >
            {recentChats.map((chat) => (
              <SidebarItem
                key={chat.id}
                icon={<MessageSquare className="w-4 h-4" />}
                title={chat.title}
                subtitle={chat.time}
              />
            ))}
          </SidebarSection>

          {/* Pinned Workflows Section */}
          <SidebarSection 
            title="Pinned Workflows" 
            icon={<Star className="w-3 h-3" />}
          >
            {pinnedWorkflows.map((workflow) => (
              <SidebarItem
                key={workflow.id}
                icon={<span className="text-base">{workflow.icon}</span>}
                title={workflow.title}
              />
            ))}
          </SidebarSection>

          {/* Running Tasks Section */}
          <SidebarSection 
            title="Running Tasks" 
            icon={<Workflow className="w-3 h-3" />}
          >
            {runningTasks.length > 0 ? (
              runningTasks.map((task) => (
                <SidebarItem
                  key={task.id}
                  icon={<Loader2 className="w-4 h-4" />}
                  title={task.title}
                  isRunning={task.isRunning}
                />
              ))
            ) : (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                No active tasks
              </div>
            )}
          </SidebarSection>
        </div>

        {/* Sidebar Footer */}
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
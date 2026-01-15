import { MessageSquare, ListTodo, Workflow, Plug } from 'lucide-react';

interface PageNavigationProps {
  currentPage: 'chat' | 'tasks' | 'workflows' | 'integrations';
  onNavigate: (page: 'chat' | 'tasks' | 'workflows' | 'integrations') => void;
}

export function PageNavigation({ currentPage, onNavigate }: PageNavigationProps) {
  const pages = [
    { id: 'chat' as const, icon: MessageSquare, label: 'Chat' },
    { id: 'tasks' as const, icon: ListTodo, label: 'Tasks' },
    { id: 'workflows' as const, icon: Workflow, label: 'Workflows' },
    { id: 'integrations' as const, icon: Plug, label: 'Integrations' },
  ];

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card/70 backdrop-blur-xl border border-border rounded-xl shadow-lg">
      {pages.map((page) => {
        const Icon = page.icon;
        const isActive = currentPage === page.id;
        
        return (
          <button
            key={page.id}
            onClick={() => onNavigate(page.id)}
            className={`
              relative px-4 py-2 rounded-lg text-sm transition-all duration-300 flex items-center gap-2
              ${isActive 
                ? 'bg-primary text-primary-foreground shadow-md' 
                : 'text-foreground/70 hover:text-foreground hover:bg-secondary'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="font-medium">{page.label}</span>
            
            {/* Active indicator */}
            {isActive && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[rgb(255,137,0)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

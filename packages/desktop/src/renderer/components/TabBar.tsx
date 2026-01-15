import type { ElementType } from 'react';
import { MessageSquare, ListTodo, Workflow, Plug } from 'lucide-react';

type TabMode = 'chat' | 'tasks' | 'workflows' | 'integrations';

interface TabBarProps {
  activeMode: TabMode;
  onModeChange: (mode: TabMode) => void;
}

const tabs: { id: TabMode; label: string; icon: ElementType }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'integrations', label: 'Integrations', icon: Plug },
];

/**
 * TabBar - Mode selector with four tabs
 */
function TabBar({ activeMode, onModeChange }: TabBarProps) {
  return (
    <div className="flex items-center border-b border-border bg-card/50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeMode === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onModeChange(tab.id)}
            className={`
              flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors duration-300 ease-in-out
              border-b-2 -mb-px
              ${isActive
                ? 'text-primary border-primary'
                : 'text-foreground/70 border-transparent hover:text-foreground hover:border-border'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default TabBar;

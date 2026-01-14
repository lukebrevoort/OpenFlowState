import { MessageSquare, ListTodo, Workflow, Plug } from 'lucide-react';
import type { AppMode } from '../App';

interface TabBarProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const tabs: { id: AppMode; label: string; icon: React.ElementType }[] = [
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
    <div className="flex items-center border-b border-flowstate-border bg-flowstate-surface/50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeMode === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onModeChange(tab.id)}
            className={`
              flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors duration-200
              border-b-2 -mb-px
              ${isActive
                ? 'text-flowstate-primary border-flowstate-primary'
                : 'text-flowstate-text-muted border-transparent hover:text-flowstate-text hover:border-flowstate-border'
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

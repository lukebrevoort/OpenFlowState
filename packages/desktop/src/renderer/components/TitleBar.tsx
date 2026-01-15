import { Settings, HelpCircle } from 'lucide-react';

/**
 * TitleBar - macOS-style title bar with traffic light spacing
 */
function TitleBar() {
  return (
    <div className="titlebar-drag h-12 bg-card border-b border-border flex items-center justify-between px-4">
      <div className="w-20" />

      <h1 className="text-sm font-semibold text-foreground">FlowState</h1>

      <div className="titlebar-no-drag flex items-center gap-2">
        <button
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          title="Help"
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

export default TitleBar;

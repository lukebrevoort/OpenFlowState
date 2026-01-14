import { Settings, HelpCircle } from 'lucide-react';

/**
 * TitleBar - macOS-style title bar with traffic light spacing
 */
function TitleBar() {
  return (
    <div className="titlebar-drag h-12 bg-flowstate-surface border-b border-flowstate-border flex items-center justify-between px-4">
      {/* Left side - Space for traffic lights on macOS */}
      <div className="w-20" />
      
      {/* Center - App title */}
      <h1 className="text-sm font-semibold text-flowstate-text">
        FlowState
      </h1>
      
      {/* Right side - Actions */}
      <div className="titlebar-no-drag flex items-center gap-2">
        <button
          className="p-2 rounded-lg hover:bg-flowstate-highlight transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4 text-flowstate-text-muted" />
        </button>
        <button
          className="p-2 rounded-lg hover:bg-flowstate-highlight transition-colors"
          title="Help"
        >
          <HelpCircle className="w-4 h-4 text-flowstate-text-muted" />
        </button>
      </div>
    </div>
  );
}

export default TitleBar;

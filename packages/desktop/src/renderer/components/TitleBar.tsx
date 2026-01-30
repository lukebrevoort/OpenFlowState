import type { ReactNode } from 'react';
import { Menu, X } from 'lucide-react';
import type { TimelineEvent } from '../types/electron';
import { ActivityTimeline } from './ActivityTimeline';
import StatusPill, { type ZenStatus } from './StatusPill';

interface TitleBarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  showHomeButton: boolean;
  onNavigateHome: () => void;
  onNavigateSettings: () => void;
  navigation?: ReactNode;
  zenStatus: ZenStatus;
  activityEvents: TimelineEvent[];
}

function TitleBar({
  isSidebarOpen,
  onToggleSidebar,
  showHomeButton,
  onNavigateHome,
  onNavigateSettings,
  navigation,
  zenStatus,
  activityEvents,
}: TitleBarProps) {
  return (
    <header className="fs-titlebar" role="banner">
      <div className="titlebar-no-drag flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="fs-icon-button"
          aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isSidebarOpen ? (
            <X className="w-5 h-5 text-foreground" />
          ) : (
            <Menu className="w-5 h-5 text-foreground" />
          )}
        </button>

        <button
          type="button"
          onClick={onNavigateHome}
          className="titlebar-no-drag flex items-center gap-3 transition-opacity duration-300 ease-in-out hover:opacity-80"
          aria-label="Go to Home"
        >
          <div
            className="w-8 h-8 rounded-xl border flex items-center justify-center"
            style={{
              borderColor: 'var(--fs-line)',
              backgroundColor: 'color-mix(in srgb, var(--fs-surface-1) 55%, transparent)',
              boxShadow: 'var(--fs-shadow-sm)',
            }}
            aria-hidden="true"
          >
            <span
              className="text-sm text-foreground"
              style={{ fontFamily: 'var(--fs-font-display)' }}
            >
              F
            </span>
          </div>
          <h1 className="text-lg text-foreground" style={{ fontFamily: 'var(--fs-font-display)' }}>
            FlowState
          </h1>
        </button>
      </div>

      <div className="titlebar-no-drag flex items-center justify-center">
        {navigation}
      </div>

      <div className="titlebar-no-drag flex items-center gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={zenStatus} />
          <div className="hidden md:block max-w-[420px]">
            <ActivityTimeline
              events={activityEvents}
              collapsed
              maxItems={1}
              variant="compact"
              emptyMessage="No activity"
              showTimestamp={false}
              animateIcons={false}
            />
          </div>
        </div>
        {showHomeButton && (
          <button type="button" onClick={onNavigateHome} className="fs-pill-button">
            Home
          </button>
        )}
        <button type="button" onClick={onNavigateSettings} className="fs-pill-button">
          Settings
        </button>
      </div>
    </header>
  );
}

export default TitleBar;

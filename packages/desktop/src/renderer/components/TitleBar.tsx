import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import type { TimelineEvent } from "../types/electron";
import { ActivityTimeline } from "./ActivityTimeline";
import StatusPill, { type ZenStatus } from "./StatusPill";
const flowstateLogo = new URL(
  "../../../assets/flowstate-main-logo.png",
  import.meta.url
).toString();

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
    <header className="fs-titlebar relative" role="banner">
      <div className="titlebar-no-drag flex items-center gap-4 min-w-[220px]">
        {!isSidebarOpen && (
          <>
            <button
              type="button"
              onClick={onToggleSidebar}
              className="fs-icon-button"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5 text-foreground" />
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
                  borderColor: "var(--fs-line)",
                  backgroundColor:
                    "color-mix(in srgb, var(--fs-surface-1) 55%, transparent)",
                  boxShadow: "var(--fs-shadow-sm)",
                }}
                aria-hidden="true"
              >
                <img
                  src={flowstateLogo}
                  alt="FlowState Logo"
                  className="w-6 h-6 object-contain"
                  style={{ fontFamily: "var(--fs-font-display)" }}
                />
              </div>
              <h1
                className="text-lg text-foreground"
                style={{ fontFamily: "var(--fs-font-display)" }}
              >
                FlowState
              </h1>
            </button>
          </>
        )}
      </div>

      <div className="titlebar-no-drag absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
        {navigation}
      </div>

      <div className="titlebar-no-drag flex items-center gap-2">
        <div className="flex items-center gap-2">
          <StatusPill status={zenStatus} className="h-6 px-2 text-[10px]" />
          <div className="hidden md:block max-w-[260px]">
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
          <button
            type="button"
            onClick={onNavigateHome}
            className="fs-pill-button"
          >
            Home
          </button>
        )}
        <button
          type="button"
          onClick={onNavigateSettings}
          className="fs-pill-button"
        >
          Settings
        </button>
      </div>
    </header>
  );
}

export default TitleBar;

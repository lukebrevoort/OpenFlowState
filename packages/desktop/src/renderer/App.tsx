import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatMode from './modes/ChatMode';
import TasksMode from './modes/TasksMode';
import WorkflowsMode from './modes/WorkflowsMode';
import IntegrationsMode from './modes/IntegrationsMode';
import { HomeScreen } from './components/HomeScreen';
import { PageNavigation } from './components/PageNavigation';
import TitleBar from './components/TitleBar';
import { ZenGarden } from './components/ZenGarden';
import { SettingsPage } from './components/SettingsPage';
import { OnboardingFlow } from './components/OnboardingFlow';
import type { ZenStatus } from './components/StatusPill';
import { useChatStore } from './stores/chatStore';
import { useConfigStore } from './stores/configStore';
import { useIntegrationsStore } from './stores/integrationsStore';
import { useOnboardingStore } from './stores/onboardingStore';
import { useProviderStore } from './stores/providerStore';
import { useTasksStore } from './stores/tasksStore';
import { useWorkflowsStore } from './stores/workflowsStore';
import { providerDefinitions } from './data/providerData';
import type { ProviderDefinition } from './data/providerData';
import { getProviderAuthCommand, getProviderAuthUrl } from './lib/providerAuth';
import type { AuthStatus } from './types/electron';

export type AppPage = 'home' | 'chat' | 'tasks' | 'workflows' | 'integrations' | 'settings';

const formatProviderName = (providerId: string): string =>
  providerId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const buildProviderOptionsFromModels = (models: string[]): ProviderDefinition[] => {
  const groupedByProvider = new Map<string, string[]>();

  for (const value of models) {
    const modelId = value.trim();
    const separatorIndex = modelId.indexOf('/');
    if (separatorIndex <= 0 || separatorIndex === modelId.length - 1) {
      continue;
    }

    const providerId = modelId.slice(0, separatorIndex);
    const existingModels = groupedByProvider.get(providerId) ?? [];
    if (!existingModels.includes(modelId)) {
      existingModels.push(modelId);
      groupedByProvider.set(providerId, existingModels);
    }
  }

  const fallbackById = new Map(providerDefinitions.map((provider) => [provider.id, provider]));

  return Array.from(groupedByProvider.entries()).map(([providerId, providerModels]) => {
    const fallback = fallbackById.get(providerId);
    const providerName = fallback?.name ?? formatProviderName(providerId);

    return {
      id: providerId,
      name: providerName,
      description:
        fallback?.description ?? `Models discovered from OpenCode for ${providerName}.`,
      models: providerModels,
      badge: fallback?.badge,
    };
  });
};

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>('home');
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const setCurrentSessionId = useChatStore((state) => state.setCurrentSessionId);
  const loadMessages = useChatStore((state) => state.loadMessages);
  const chatStatus = useChatStore((state) => state.status);
  const timeline = useChatStore((state) => state.timeline);
  const reloadTaskRuns = useTasksStore((state) => state.reloadRuns);
  const loadActiveTaskRun = useTasksStore((state) => state.loadActiveRun);
  const reloadWorkflows = useWorkflowsStore((state) => state.reload);
  const loadWorkflowPins = useWorkflowsStore((state) => state.loadPins);

  const config = useConfigStore((state) => state.config);
  const updateConfig = useConfigStore((state) => state.updateConfig);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const openCodeStatus = useConfigStore((state) => state.openCodeStatus);
  const loadIntegrations = useIntegrationsStore((state) => state.loadIntegrations);
  const {
    currentStep,
    selectedApps,
    setStep,
    toggleApp,
    reset: resetOnboarding,
  } = useOnboardingStore();
  const {
    selectedProviderId,
    selectedModel,
    setProvider,
    setModel,
    reset: resetProvider,
  } = useProviderStore();
  const { setOnboardingConnect } = useIntegrationsStore();

  const isOnboarding = !config?.onboardingComplete;
  const isOnMainPage =
    currentPage === 'chat' ||
    currentPage === 'tasks' ||
    currentPage === 'workflows' ||
    currentPage === 'integrations';

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemPrefersReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isOnboarding) {
      resetProvider();
    }
  }, [isOnboarding, resetProvider]);

  useEffect(() => {
    if (!isOnboarding) {
      setOnboardingConnect(null);
    }
  }, [isOnboarding, setOnboardingConnect]);

  const [providerOptions, setProviderOptions] = useState<ProviderDefinition[]>(providerDefinitions);

  useEffect(() => {
    if (!isOnboarding) {
      setProviderOptions(providerDefinitions);
      return;
    }

    let cancelled = false;

    const loadProviderOptions = async () => {
      try {
        const models = await window.flowstate.opencode.listModels();
        if (cancelled) return;
        const dynamicProviderOptions = buildProviderOptionsFromModels(models);
        setProviderOptions(
          dynamicProviderOptions.length > 0 ? dynamicProviderOptions : providerDefinitions,
        );
      } catch (error) {
        console.error('Failed to load OpenCode provider models for onboarding:', error);
        if (!cancelled) {
          setProviderOptions(providerDefinitions);
        }
      }
    };

    loadProviderOptions().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOnboarding]);

  const selectedProvider =
    providerOptions.find((provider) => provider.id === selectedProviderId) ??
    providerOptions[0];

  useEffect(() => {
    if (providerOptions.length === 0) return;

    const matchingProvider = providerOptions.find(
      (provider) => provider.id === selectedProviderId,
    );
    const activeProvider = matchingProvider ?? providerOptions[0];

    if (!matchingProvider) {
      setProvider(activeProvider.id, activeProvider.models[0]);
      return;
    }

    if (!activeProvider.models.includes(selectedModel)) {
      setModel(activeProvider.models[0]);
    }
  }, [providerOptions, selectedModel, selectedProviderId, setModel, setProvider]);

  const [integrations, setIntegrations] = useState(
    useIntegrationsStore.getState().integrations,
  );
  const [authStatuses, setAuthStatuses] = useState<
    Record<string, AuthStatus | undefined>
  >({});
  const previousAuthStatusesRef = useRef<Record<string, AuthStatus | undefined>>({});
  const [onboardingPendingIntegrationId, setOnboardingPendingIntegrationId] = useState<string | null>(null);
  const [recentlyConnectedAt, setRecentlyConnectedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = useIntegrationsStore.subscribe((state) => {
      setIntegrations(state.integrations);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!config) {
      loadConfig().catch((error) =>
        console.error('Failed to load config:', error),
      );
    }
  }, [config, loadConfig]);

  useEffect(() => {
    if (isOnboarding) {
      loadIntegrations().catch((error) =>
        console.error('Failed to load integrations:', error),
      );
    }
  }, [isOnboarding, loadIntegrations]);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const statuses = await window.flowstate.auth.getAllStatuses();
        const map: Record<string, AuthStatus> = {};
        statuses.forEach((status) => {
          map[status.service] = status;
        });
        setAuthStatuses(map);
      } catch (error) {
        console.error("Failed to load auth status", error);
      }
    };

    fetchStatuses();
  }, [integrations, isOnboarding]);

  useEffect(() => {
    if (!isOnboarding) {
      setRecentlyConnectedAt({});
      return;
    }

    const previousStatuses = previousAuthStatusesRef.current;
    const updates: Record<string, number> = {};

    for (const [service, status] of Object.entries(authStatuses)) {
      const wasConnected = Boolean(previousStatuses[service]?.connected);
      const isConnected = Boolean(status?.connected);
      if (!wasConnected && isConnected) {
        updates[service] = Date.now();
      }
    }

    previousAuthStatusesRef.current = authStatuses;
    if (Object.keys(updates).length > 0) {
      setRecentlyConnectedAt((current) => ({ ...current, ...updates }));
    }
  }, [authStatuses, isOnboarding]);

  useEffect(() => {
    if (!isOnboarding) {
      setOnboardingPendingIntegrationId(null);
      return;
    }
    if (currentPage !== 'integrations') return;
    if (!onboardingPendingIntegrationId) return;

    const connected = Boolean(authStatuses[onboardingPendingIntegrationId]?.connected);
    if (!connected) return;

    setStep('connect');
    setCurrentPage('home');
    setOnboardingPendingIntegrationId(null);
  }, [
    authStatuses,
    currentPage,
    isOnboarding,
    onboardingPendingIntegrationId,
    setStep,
  ]);

  const recentConnectedIds = useMemo(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    return Object.entries(recentlyConnectedAt)
      .filter(([, ts]) => ts >= cutoff)
      .map(([id]) => id);
  }, [recentlyConnectedAt]);

  const handleSelectTaskRun = useCallback(
    (taskRunId: string) => {
      setCurrentPage('tasks');
      if (!isDesktop) {
        setIsSidebarOpen(false);
      }

      const tasks = useTasksStore.getState();
      const sleep = (ms: number) =>
        new Promise<void>((resolve) => window.setTimeout(resolve, ms));

      const focus = async () => {
        for (let attempt = 0; attempt < 8; attempt += 1) {
          await tasks.loadActiveRun({ silent: true });
          await tasks.reloadRuns({ silent: true });
          await tasks.selectRun(taskRunId);

          const latest = useTasksStore.getState().runs;
          if (latest.some((run) => run.id === taskRunId)) {
            return;
          }

          await sleep(250);
        }
      };

      void focus();
    },
    [isDesktop],
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatMode onViewTask={() => setCurrentPage('tasks')} />;
      case 'tasks':
        return <TasksMode onOpenChat={() => setCurrentPage('chat')} />;
      case 'workflows':
        return (
          <WorkflowsMode
            onOpenTaskRun={handleSelectTaskRun}
          />
        );
      case 'integrations':
        return <IntegrationsMode onOpenSettings={() => setCurrentPage('settings')} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomeScreen onNavigate={(page) => setCurrentPage(page)} />;
    }
  };

  const handleOnboardingFinish = async () => {
    try {
      await updateConfig({
        onboardingComplete: true,
        provider: {
          default: selectedModel,
          apiKeys: config?.provider.apiKeys ?? {},
        },
      });
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }

    try {
      await window.flowstate.opencode.restart();
    } catch (error) {
      console.error('Failed to restart OpenCode after onboarding:', error);
    }

    setCurrentPage('home');

    resetOnboarding();
    resetProvider();
  };

  const showMainShell = !isOnboarding;

  const userReduceMotion = config?.preferences?.reduceMotion;
  const userBackgroundMotion = config?.preferences?.backgroundMotion;

  const effectiveReduceMotion = userReduceMotion ?? systemPrefersReducedMotion;
  const effectiveBackgroundMotion = effectiveReduceMotion
    ? 'static'
    : (userBackgroundMotion ?? 'animated');
  const effectiveBlurMode =
    effectiveReduceMotion || effectiveBackgroundMotion === 'animated' ? 'reduced' : 'full';

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fsMotion = effectiveReduceMotion ? 'reduced' : 'full';
    root.dataset.fsBg = effectiveBackgroundMotion;
    root.dataset.fsBlur = effectiveBlurMode;
  }, [effectiveBackgroundMotion, effectiveBlurMode, effectiveReduceMotion]);

  const zenStatus = useMemo<ZenStatus>(() => {
    if (chatStatus === 'error') return 'error';
    if (openCodeStatus && (!openCodeStatus.running || !openCodeStatus.healthy)) return 'error';
    if (chatStatus === 'thinking') return 'thinking';
    return 'ready';
  }, [chatStatus, openCodeStatus]);

  const navigation = useMemo(() => {
    if (!isOnMainPage) return null;
    return (
      <PageNavigation
        currentPage={currentPage as 'chat' | 'tasks' | 'workflows' | 'integrations'}
        onNavigate={(page) => {
          setCurrentPage(page);
          if (!isDesktop) setIsSidebarOpen(false);
        }}
      />
    );
  }, [currentPage, isDesktop, isOnMainPage]);

  const mainContent = isOnboarding ? (
    currentPage === 'integrations' ? (
      <main className="flex-1 overflow-auto">
        <IntegrationsMode
          onboardingMode
          onReturnToOnboarding={() => {
            setCurrentPage('home');
          }}
        />
      </main>
    ) : (
      <main className="flex-1 overflow-auto">
        <OnboardingFlow
          currentStep={currentStep}
          onStepChange={setStep}
          selectedApps={selectedApps}
          onToggleApp={toggleApp}
          integrations={integrations}
          authStatuses={authStatuses}
          recentlyConnectedIds={recentConnectedIds}
          providerOptions={providerOptions}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onSelectProvider={(providerId) => {
            const provider = providerOptions.find((item) => item.id === providerId);
            if (!provider) return;
            setProvider(providerId, provider.models[0]);
          }}
          onSelectModel={setModel}
          onStartProviderSetup={() => {
            const command = getProviderAuthCommand(selectedProvider);
            if (typeof window.flowstate.app.openTerminal === 'function') {
              window.flowstate.app.openTerminal(command);
            } else {
              window.flowstate.app.openExternal(
                `terminal://${encodeURIComponent(command)}`,
              );
            }
            const authUrl = getProviderAuthUrl(selectedProvider);
            if (authUrl) {
              window.flowstate.app.openExternal(authUrl);
            }
          }}
          onFinish={handleOnboardingFinish}
          onConnectIntegration={(integrationId) => {
            setOnboardingPendingIntegrationId(integrationId);
            setOnboardingConnect(integrationId);
            setCurrentPage('integrations');
          }}
        />
      </main>
    )
  ) : (
    <main className="flex-1 overflow-auto">
      <div key={currentPage} className="h-full page-fade-up">
        {renderPage()}
      </div>
    </main>
  );

  const handleSelectConversation = useCallback(
    async (sessionId: string) => {
      await window.flowstate.opencode.switchSession(sessionId);
      setCurrentSessionId(sessionId);
      const messages = await window.flowstate.opencode.getMessages();
      loadMessages(messages);
      setCurrentPage('chat');
    },
    [loadMessages, setCurrentSessionId],
  );

  useEffect(() => {
    if (isOnboarding) return;
    if (!window.flowstate?.notifications?.onApprovalClick) return;

    return window.flowstate.notifications.onApprovalClick((event) => {
      const sessionId = typeof event?.sessionId === 'string' ? event.sessionId : '';
      const taskRunId = typeof event?.taskRunId === 'string' ? event.taskRunId : '';

      if (taskRunId) {
        handleSelectTaskRun(taskRunId);
        return;
      }

      if (sessionId) {
        void handleSelectConversation(sessionId);
        return;
      }

      setCurrentPage('tasks');
    });
  }, [handleSelectConversation, handleSelectTaskRun, isOnboarding]);

  useEffect(() => {
    if (isOnboarding) return;

    const TIMELINE_REFRESH_DEBOUNCE_MS = 250;
    let timelineDebounceTimer: number | null = null;
    let refreshInFlight = false;
    let refreshQueued = false;

    const runSidebarRefresh = async () => {
      if (refreshInFlight) {
        refreshQueued = true;
        return;
      }

      refreshInFlight = true;
      try {
        await Promise.all([
          loadActiveTaskRun({ silent: true }),
          reloadTaskRuns({ silent: true }),
          reloadWorkflows({ silent: true }),
          loadWorkflowPins({ silent: true }),
        ]);
      } finally {
        refreshInFlight = false;
        if (refreshQueued) {
          refreshQueued = false;
          void runSidebarRefresh();
        }
      }
    };

    const queueTimelineRefresh = () => {
      if (timelineDebounceTimer !== null) {
        window.clearTimeout(timelineDebounceTimer);
      }
      timelineDebounceTimer = window.setTimeout(() => {
        timelineDebounceTimer = null;
        void runSidebarRefresh();
      }, TIMELINE_REFRESH_DEBOUNCE_MS);
    };

    void runSidebarRefresh();

    const interval = window.setInterval(() => {
      void runSidebarRefresh();
    }, 10_000);
    const removeTimelineListener = window.flowstate.opencode.onTimelineEvent(() => {
      queueTimelineRefresh();
    });

    return () => {
      window.clearInterval(interval);
      if (timelineDebounceTimer !== null) {
        window.clearTimeout(timelineDebounceTimer);
      }
      removeTimelineListener();
    };
  }, [isOnboarding, loadActiveTaskRun, loadWorkflowPins, reloadTaskRuns, reloadWorkflows]);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((open) => !open);
  }, []);

  const handleNavigateHome = useCallback(() => {
    setCurrentPage('home');
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  }, [isDesktop]);

  return (
    <div className="size-full relative overflow-hidden">
      <div className="absolute inset-0 bg-background pointer-events-none" />
      <div className="absolute inset-0 ambient-gradient pointer-events-none" />

      {effectiveBackgroundMotion === 'animated' && !effectiveReduceMotion ? <ZenGarden /> : null}

      {showMainShell && (
        <>
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={handleCloseSidebar}
            onToggleSidebar={handleToggleSidebar}
            onNavigateHome={handleNavigateHome}
            onSelectTaskRun={handleSelectTaskRun}
            onSelectConversation={handleSelectConversation}
          />

          {isSidebarOpen && !isDesktop && (
            <div
              className="fixed inset-0 fs-overlay z-40 transition-opacity duration-300 ease-in-out"
              onClick={handleCloseSidebar}
            />
          )}
        </>
      )}

      <div
        className={`relative h-full flex flex-col transition-all duration-300 ease-out ${
          showMainShell && isSidebarOpen && isDesktop ? 'pl-80' : 'pl-0'
        }`}
      >
        {showMainShell && (
          <TitleBar
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={handleToggleSidebar}
            showHomeButton={currentPage !== 'home'}
            onNavigateHome={handleNavigateHome}
            onNavigateSettings={() => {
              setCurrentPage('settings');
              if (!isDesktop) setIsSidebarOpen(false);
            }}
            navigation={navigation}
            zenStatus={zenStatus}
            activityEvents={timeline}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">{mainContent}</div>
      </div>
    </div>
  );
}

export default App;

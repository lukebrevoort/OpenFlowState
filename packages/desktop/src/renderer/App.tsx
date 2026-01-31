import { useEffect, useMemo, useState } from 'react';
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
import { providerDefinitions } from './data/providerData';
import { onboardingWowPrompts } from './data/onboardingData';
import { getProviderAuthCommand, getProviderAuthUrl } from './lib/providerAuth';
import type { AuthStatus } from './types/electron';

export type AppPage = 'home' | 'chat' | 'tasks' | 'workflows' | 'integrations' | 'settings';

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

  const config = useConfigStore((state) => state.config);
  const updateConfig = useConfigStore((state) => state.updateConfig);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const openCodeStatus = useConfigStore((state) => state.openCodeStatus);
  const loadIntegrations = useIntegrationsStore((state) => state.loadIntegrations);
  const {
    currentStep,
    selectedApps,
    selectedWowPrompt,
    setStep,
    toggleApp,
    setSelectedWowPrompt,
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

  const providerOptions = providerDefinitions;
  const selectedProvider =
    providerOptions.find((provider) => provider.id === selectedProviderId) ??
    providerOptions[0];

  const [integrations, setIntegrations] = useState(
    useIntegrationsStore.getState().integrations,
  );
  const [authStatuses, setAuthStatuses] = useState<
    Record<string, AuthStatus | undefined>
  >({});

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

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatMode onViewTask={() => setCurrentPage('tasks')} />;
      case 'tasks':
        return <TasksMode />;
      case 'workflows':
        return <WorkflowsMode />;
      case 'integrations':
        return <IntegrationsMode />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomeScreen onNavigate={(page) => setCurrentPage(page)} />;
    }
  };

  const handleOnboardingFinish = async (promptOverride?: string | null) => {
    const promptToSend = promptOverride ?? selectedWowPrompt;

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

    if (promptToSend) {
      setCurrentPage('chat');
      const result = await window.flowstate.opencode.send(promptToSend);
      if (result.error) {
        console.error('Failed to send wow prompt:', result.error);
      }
    } else {
      setCurrentPage('home');
    }

    resetOnboarding();
    resetProvider();
  };

  const handleOnboardingSkipWow = async () => {
    await handleOnboardingFinish(null);
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
    <main className="flex-1 overflow-auto">
      <OnboardingFlow
        currentStep={currentStep}
        onStepChange={setStep}
        selectedApps={selectedApps}
        onToggleApp={toggleApp}
        integrations={integrations}
        authStatuses={authStatuses}
        providerOptions={providerOptions}
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        onSelectProvider={setProvider}
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
        wowPrompts={onboardingWowPrompts}
        selectedWowPrompt={selectedWowPrompt}
        onSelectWowPrompt={setSelectedWowPrompt}
        onFinish={handleOnboardingFinish}
        onSkipWow={handleOnboardingSkipWow}
        onConnectIntegration={(integrationId) => {
          setOnboardingConnect(integrationId);
        }}
      />
    </main>
  ) : (
    <main className="flex-1 overflow-auto">
      <div key={currentPage} className="h-full page-fade-up">
        {renderPage()}
      </div>
    </main>
  );

  const handleSelectConversation = async (sessionId: string) => {
    await window.flowstate.opencode.switchSession(sessionId);
    setCurrentSessionId(sessionId);
    const messages = await window.flowstate.opencode.getMessages();
    loadMessages(messages);
    setCurrentPage('chat');
  };

  return (
    <div className="size-full relative overflow-hidden">
      <div className="absolute inset-0 bg-background pointer-events-none" />
      <div className="absolute inset-0 ambient-gradient pointer-events-none" />

      {effectiveBackgroundMotion === 'animated' && !effectiveReduceMotion ? <ZenGarden /> : null}

      {showMainShell && (
        <>
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onSelectConversation={handleSelectConversation}
          />

          {isSidebarOpen && !isDesktop && (
            <div
              className="fixed inset-0 fs-overlay z-40 transition-opacity duration-300 ease-in-out"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
        </>
      )}

      <div
        className={`relative z-10 h-full flex flex-col transition-all duration-300 ease-out ${
          showMainShell && isSidebarOpen && isDesktop ? 'pl-80' : 'pl-0'
        }`}
      >
        {showMainShell && (
          <TitleBar
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
            showHomeButton={currentPage !== 'home'}
            onNavigateHome={() => {
              setCurrentPage('home');
              if (!isDesktop) setIsSidebarOpen(false);
            }}
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

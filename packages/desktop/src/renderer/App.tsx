import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import ChatMode from './modes/ChatMode';
import TasksMode from './modes/TasksMode';
import WorkflowsMode from './modes/WorkflowsMode';
import IntegrationsMode from './modes/IntegrationsMode';
import { HomeScreen } from './components/HomeScreen';
import { PageNavigation } from './components/PageNavigation';
import { ZenGarden } from './components/ZenGarden';
import { SettingsPage } from './components/SettingsPage';
import { OnboardingFlow } from './components/OnboardingFlow';
import { useChatStore } from './stores/chatStore';
import { useConfigStore } from './stores/configStore';
import { useIntegrationsStore } from './stores/integrationsStore';
import { useOnboardingStore } from './stores/onboardingStore';
import { useProviderStore } from './stores/providerStore';
import { providerDefinitions } from './data/providerData';
import { onboardingWowPrompts } from './data/onboardingData';
import { getProviderAuthCommand, getProviderAuthUrl } from './lib/providerAuth';
import type { AuthStatus } from './types/electron';
import flowstateLogo from '../../assets/flowstate-main-logo.png';

export type AppPage = 'home' | 'chat' | 'tasks' | 'workflows' | 'integrations' | 'settings';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>('home');
  const { setCurrentSessionId, loadMessages } = useChatStore();
  const { config, updateConfig, loadConfig } = useConfigStore();
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

  const mainContent = isOnboarding ? (
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
  ) : (
    <div
      className={`h-full flex flex-col ${
        isSidebarOpen ? 'translate-x-2' : 'translate-x-0'
      } transition-transform duration-300 ease-in-out`}
    >
       <main className="flex-1 overflow-auto">

        <div key={currentPage} className="h-full page-fade-up">
          {renderPage()}
        </div>
      </main>
    </div>
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
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 ambient-gradient" />

      <ZenGarden />

      {showMainShell && (
        <>
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onSelectConversation={handleSelectConversation}
          />

          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40 transition-opacity duration-300 ease-in-out"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
        </>
      )}

      <div className="relative z-10 h-full flex flex-col">
        {showMainShell && (
          <header className="titlebar-drag flex items-center justify-between px-6 pt-6 pb-4 border-b border-border bg-card/60 backdrop-blur-xl min-h-[72px]">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="titlebar-no-drag w-10 h-10 rounded-lg bg-card hover:bg-secondary border border-border flex items-center justify-center transition-all duration-300 ease-in-out hover:scale-[1.06] active:scale-95 shadow-sm"
                aria-label="Toggle sidebar"
              >
                {isSidebarOpen ? (
                  <X className="w-5 h-5 text-foreground" />
                ) : (
                  <Menu className="w-5 h-5 text-foreground" />
                )}
              </button>

              <button
                onClick={() => setCurrentPage('home')}
                className="titlebar-no-drag flex items-center gap-3 transition-opacity duration-300 ease-in-out hover:opacity-80"
              >
                <img src={flowstateLogo} alt="FlowState" className="w-8 h-8" />
                <h1 className="text-lg text-foreground">FlowState</h1>
              </button>
            </div>

            {isOnMainPage && (
              <div className="titlebar-no-drag flex items-center justify-center">
                <PageNavigation
                  currentPage={currentPage as 'chat' | 'tasks' | 'workflows' | 'integrations'}
                  onNavigate={(page) => setCurrentPage(page)}
                />
              </div>
            )}

            <div className="titlebar-no-drag flex items-center gap-2">
              {currentPage !== 'home' && (
                <button
                  onClick={() => setCurrentPage('home')}
                  className="px-3 py-2 rounded-lg bg-card hover:bg-secondary border border-border text-sm text-foreground/80 hover:text-foreground transition-all duration-300 ease-in-out shadow-sm hover:shadow-md"
                >
                  Home
                </button>
              )}
              <button
                onClick={() => setCurrentPage('settings')}
                className="px-3 py-2 rounded-lg bg-card hover:bg-secondary border border-border text-sm text-foreground/80 hover:text-foreground transition-all duration-300 ease-in-out shadow-sm hover:shadow-md"
              >
                Settings
              </button>
            </div>
          </header>
        )}

        <div className="flex-1 flex flex-col overflow-auto">{mainContent}</div>
      </div>
    </div>
  );
}

export default App;

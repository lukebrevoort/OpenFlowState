import { useState } from 'react';
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
import { useChatStore } from './stores/chatStore';
import flowstateLogo from '../../assets/flowstate-main-logo.png';

export type AppPage = 'home' | 'chat' | 'tasks' | 'workflows' | 'integrations' | 'settings';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>('home');
  const { setCurrentSessionId, loadMessages } = useChatStore();

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatMode />;
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

  const isOnMainPage = currentPage === 'chat' || currentPage === 'tasks' || currentPage === 'workflows' || currentPage === 'integrations';

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

      <div className="relative z-10 h-full flex flex-col">
        <header className="titlebar-drag flex items-start justify-between px-8 pt-9 pb-5 border-b border-border bg-card/60 backdrop-blur-xl min-h-[78px]">
          <div className="flex items-center gap-4 mt-1">
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
              <img src={flowstateLogo} alt="FlowState" className="w-9 h-9" />
              <h1 className="text-xl text-foreground">FlowState</h1>
            </button>
          </div>

          <div className="titlebar-no-drag flex items-center gap-2 mt-3">
            {currentPage !== 'home' && (
              <button
                onClick={() => setCurrentPage('home')}
                className="px-4 py-2 rounded-lg bg-card hover:bg-secondary border border-border text-sm text-foreground/80 hover:text-foreground transition-all duration-300 ease-in-out shadow-sm hover:shadow-md"
              >
                Home
              </button>
            )}
            <button
              onClick={() => setCurrentPage('settings')}
              className="px-4 py-2 rounded-lg bg-card hover:bg-secondary border border-border text-sm text-foreground/80 hover:text-foreground transition-all duration-300 ease-in-out shadow-sm hover:shadow-md"
            >
              Settings
            </button>
          </div>
        </header>

        <div
          className={`flex-1 flex flex-col overflow-auto transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? 'translate-x-2' : 'translate-x-0'
          }`}
        >
          {isOnMainPage && (
            <div className="flex justify-center px-6 pt-5">
              <PageNavigation
                currentPage={currentPage as 'chat' | 'tasks' | 'workflows' | 'integrations'}
                onNavigate={(page) => setCurrentPage(page)}
              />
            </div>
          )}

          <main className="flex-1 overflow-auto">
            <div key={currentPage} className="h-full page-fade-up">
              {renderPage()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;

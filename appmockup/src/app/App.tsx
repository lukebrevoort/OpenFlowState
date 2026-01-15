import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HomeScreen } from '@/app/components/home-screen';
import { ChatPage } from '@/app/components/chat-page';
import { TasksPage } from '@/app/components/tasks-page';
import { WorkflowsPage } from '@/app/components/workflows-page';
import { IntegrationsPage } from '@/app/components/integrations-page';
import { SettingsPage } from '@/app/components/settings-page';
import { PageNavigation } from '@/app/components/page-navigation';
import { ZenGarden } from '@/app/components/zen-garden';
import { Sidebar } from '@/app/components/sidebar';
import logoImage from 'figma:asset/a5a5f6da17027740f86abd3f8abfb8597e1f0af8.png';

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'chat' | 'tasks' | 'workflows' | 'integrations' | 'settings'>('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatPage />;
      case 'tasks':
        return <TasksPage />;
      case 'workflows':
        return <WorkflowsPage />;
      case 'integrations':
        return <IntegrationsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomeScreen onNavigate={(page) => setCurrentPage(page)} />;
    }
  };

  const isOnMainPage = currentPage !== 'home' && currentPage !== 'settings';

  return (
    <div className="size-full relative overflow-hidden">
      {/* Tan background with subtle glossy gradient */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFFDFB]/50 via-transparent to-[#E8BFA0]/30" />
      
      {/* Zen Garden animated elements */}
      <ZenGarden />
      
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} />
      
      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-primary/20 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Main content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header with logo and sidebar toggle */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60 backdrop-blur-xl bg-[rgba(214,181,88,0.421176)]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 rounded-lg bg-card hover:bg-secondary border border-border flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
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
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <img 
                src={logoImage} 
                alt="FlowState Logo" 
                className="w-8 h-8 rounded-lg shadow-sm"
              />
              <h1 className="text-xl text-foreground">FlowState</h1>
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {currentPage !== 'home' && (
              <button 
                onClick={() => setCurrentPage('home')}
                className="px-4 py-2 rounded-lg bg-card hover:bg-secondary border border-border text-sm text-foreground/80 hover:text-foreground transition-all duration-200 shadow-sm"
              >
                Home
              </button>
            )}
            <button 
              onClick={() => setCurrentPage('settings')}
              className="px-4 py-2 rounded-lg bg-card hover:bg-secondary border border-border text-sm text-foreground/80 hover:text-foreground transition-all duration-200 shadow-sm"
            >
              Settings
            </button>
          </div>
        </header>
        
        {/* Page Navigation - Only show on main pages (not home or settings) */}
        {isOnMainPage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex justify-center px-6 pt-4"
          >
            <PageNavigation 
              currentPage={currentPage as 'chat' | 'tasks' | 'workflows' | 'integrations'} 
              onNavigate={(page) => setCurrentPage(page)}
            />
          </motion.div>
        )}
        
        {/* Main content area with transitions */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="h-full"
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
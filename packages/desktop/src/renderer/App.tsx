import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import ChatMode from './modes/ChatMode';
import TasksMode from './modes/TasksMode';
import WorkflowsMode from './modes/WorkflowsMode';
import IntegrationsMode from './modes/IntegrationsMode';
import TitleBar from './components/TitleBar';

export type AppMode = 'chat' | 'tasks' | 'workflows' | 'integrations';

function App() {
  const [activeMode, setActiveMode] = useState<AppMode>('chat');

  const renderMode = () => {
    switch (activeMode) {
      case 'chat':
        return <ChatMode />;
      case 'tasks':
        return <TasksMode />;
      case 'workflows':
        return <WorkflowsMode />;
      case 'integrations':
        return <IntegrationsMode />;
      default:
        return <ChatMode />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-flowstate-background overflow-hidden">
      {/* Title Bar (macOS style) */}
      <TitleBar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <TabBar activeMode={activeMode} onModeChange={setActiveMode} />
          
          {/* Mode Content */}
          <div className="flex-1 overflow-auto p-6">
            {renderMode()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

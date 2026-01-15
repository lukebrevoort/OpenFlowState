import { useState } from 'react';
import { Plus, CheckCircle2, Settings, ExternalLink, Plug } from 'lucide-react';

interface MCPService {
  id: number;
  name: string;
  description: string;
  icon: string;
  isConnected: boolean;
  category: 'productivity' | 'data' | 'communication' | 'custom';
  requiresAuth: boolean;
}

function MCPServiceCard({ 
  service, 
  onConnect, 
  onConfigure 
}: { 
  service: MCPService; 
  onConnect: (id: number) => void;
  onConfigure: (id: number) => void;
}) {
  return (
    <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300">
      {/* Connected badge */}
      {service.isConnected && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#A5B574]/10 border border-[#A5B574]/30">
            <CheckCircle2 className="w-3 h-3 text-[#A5B574]" />
            <span className="text-xs text-[#A5B574]">Connected</span>
          </div>
        </div>
      )}

      {/* Service icon and info */}
      <div className="mb-4">
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#A5B574] to-[#C87137] flex items-center justify-center shadow-md text-3xl mb-4">
          {service.icon}
        </div>
        <h3 className="text-lg text-foreground mb-1">{service.name}</h3>
        <p className="text-sm text-muted-foreground">{service.description}</p>
      </div>

      {/* Category badge */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 rounded-full bg-muted text-xs text-foreground capitalize">
          {service.category}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {service.isConnected ? (
          <>
            <button
              onClick={() => onConfigure(service.id)}
              className="flex-1 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <Settings className="w-4 h-4" />
              Configure
            </button>
            <button
              onClick={() => onConnect(service.id)}
              className="px-4 py-2 rounded-lg border border-border hover:bg-secondary text-foreground transition-all duration-200 text-sm"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => onConnect(service.id)}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 text-sm flex items-center justify-center gap-2 shadow-md"
          >
            <Plug className="w-4 h-4" />
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

function AddCustomMCPModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [mcpUrl, setMcpUrl] = useState('');
  const [mcpName, setMcpName] = useState('');
  const [apiKey, setApiKey] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl backdrop-blur-xl">
        <h3 className="text-2xl text-foreground mb-2">Add Custom MCP</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Connect your own Model Context Protocol service
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-foreground mb-2">Service Name</label>
            <input
              type="text"
              value={mcpName}
              onChange={(e) => setMcpName(e.target.value)}
              placeholder="My Custom MCP"
              className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm text-foreground mb-2">MCP Server URL</label>
            <input
              type="text"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="https://api.example.com/mcp"
              className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm text-foreground mb-2">API Key (Optional)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••••••••••••••"
              className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-secondary text-foreground transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              console.log('Adding custom MCP:', { mcpName, mcpUrl, apiKey });
              onClose();
            }}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-md"
          >
            Add Service
          </button>
        </div>
      </div>
    </div>
  );
}

export function IntegrationsPage() {
  const [services, setServices] = useState<MCPService[]>([
    {
      id: 1,
      name: 'Slack MCP',
      description: 'Send messages, read channels, and manage workspace communication',
      icon: '💬',
      isConnected: true,
      category: 'communication',
      requiresAuth: true,
    },
    {
      id: 2,
      name: 'Google Drive MCP',
      description: 'Access files, create documents, and manage cloud storage',
      icon: '📁',
      isConnected: true,
      category: 'productivity',
      requiresAuth: true,
    },
    {
      id: 3,
      name: 'GitHub MCP',
      description: 'Manage repositories, issues, pull requests, and code reviews',
      icon: '🐙',
      isConnected: false,
      category: 'productivity',
      requiresAuth: true,
    },
    {
      id: 4,
      name: 'PostgreSQL MCP',
      description: 'Query databases, run analytics, and manage data',
      icon: '🗄️',
      isConnected: true,
      category: 'data',
      requiresAuth: true,
    },
    {
      id: 5,
      name: 'Notion MCP',
      description: 'Create pages, update databases, and organize knowledge',
      icon: '📝',
      isConnected: false,
      category: 'productivity',
      requiresAuth: true,
    },
    {
      id: 6,
      name: 'Stripe MCP',
      description: 'Process payments, manage subscriptions, and track revenue',
      icon: '💳',
      isConnected: false,
      category: 'data',
      requiresAuth: true,
    },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'productivity' | 'data' | 'communication' | 'custom'>('all');

  const handleConnect = (id: number) => {
    setServices(services.map(s => 
      s.id === id ? { ...s, isConnected: !s.isConnected } : s
    ));
  };

  const handleConfigure = (id: number) => {
    console.log('Configuring service:', id);
    // In a real app, this would open a configuration modal
  };

  const filteredServices = selectedCategory === 'all' 
    ? services 
    : services.filter(s => s.category === selectedCategory);

  const connectedCount = services.filter(s => s.isConnected).length;

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl text-foreground mb-2">Integrations</h2>
          <p className="text-muted-foreground mb-6">
            Connect Model Context Protocol (MCP) services to extend FlowState's capabilities
          </p>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-md hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Custom MCP
            </button>
            
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
              <CheckCircle2 className="w-4 h-4 text-[#A5B574]" />
              <span className="text-sm text-foreground">{connectedCount} Connected</span>
            </div>
          </div>
        </div>

        {/* Category filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['all', 'productivity', 'data', 'communication', 'custom'] as const).map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 whitespace-nowrap ${
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>

        {/* MCP Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <MCPServiceCard
              key={service.id}
              service={service}
              onConnect={handleConnect}
              onConfigure={handleConfigure}
            />
          ))}
        </div>

        {/* Help section */}
        <div className="mt-12 bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-6">
          <h3 className="text-lg text-foreground mb-2 flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            What are MCP Services?
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Model Context Protocol (MCP) enables AI agents to securely connect with external tools and data sources. 
            Each MCP service extends FlowState's capabilities with specific integrations.
          </p>
          <a 
            href="#"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Learn more about MCP
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Add Custom MCP Modal */}
      <AddCustomMCPModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}

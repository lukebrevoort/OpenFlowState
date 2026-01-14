import { Check, X, ExternalLink, Plus, Settings, RefreshCw } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  email?: string;
  lastSync?: Date;
  isOfficial: boolean;
}

/**
 * IntegrationsMode - Connect and manage external services
 */
function IntegrationsMode() {
  // Mock data - will be replaced with real state
  const officialIntegrations: Integration[] = [
    {
      id: 'notion',
      name: 'Notion',
      description: 'Pages, databases, and task management',
      icon: '📓',
      status: 'connected',
      email: 'luke@email.com',
      lastSync: new Date(Date.now() - 2 * 60 * 1000),
      isOfficial: true,
    },
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Email reading, drafting, and organizing',
      icon: '📧',
      status: 'connected',
      email: 'luke@gmail.com',
      lastSync: new Date(Date.now() - 5 * 60 * 1000),
      isOfficial: true,
    },
    {
      id: 'gcal',
      name: 'Google Calendar',
      description: 'Events, scheduling, and availability',
      icon: '📅',
      status: 'disconnected',
      isOfficial: true,
    },
  ];

  const availableIntegrations: Integration[] = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Team communication and messaging',
      icon: '💬',
      status: 'disconnected',
      isOfficial: false,
    },
    {
      id: 'obsidian',
      name: 'Obsidian',
      description: 'Local notes vault access',
      icon: '📝',
      status: 'disconnected',
      isOfficial: false,
    },
    {
      id: 'linear',
      name: 'Linear',
      description: 'Issue tracking and project management',
      icon: '🎯',
      status: 'disconnected',
      isOfficial: false,
    },
  ];

  const customMCPs: Integration[] = [];

  const formatLastSync = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    return `${minutes}m ago`;
  };

  const IntegrationCard = ({ integration }: { integration: Integration }) => {
    const isConnected = integration.status === 'connected';
    
    return (
      <div className="fs-card">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{integration.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-flowstate-text">{integration.name}</h3>
              {isConnected ? (
                <span className="fs-badge-success">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </span>
              ) : (
                <span className="fs-badge bg-flowstate-surface text-flowstate-text-muted">
                  Not connected
                </span>
              )}
            </div>
            
            {isConnected ? (
              <div className="mt-2 space-y-1">
                {integration.email && (
                  <p className="text-sm text-flowstate-text-muted">{integration.email}</p>
                )}
                {integration.lastSync && (
                  <p className="text-xs text-flowstate-text-muted">
                    Last sync: {formatLastSync(integration.lastSync)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-flowstate-text-muted mt-1">
                {integration.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-flowstate-border">
          {isConnected ? (
            <>
              <button className="fs-button-ghost text-sm py-1.5 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                Sync
              </button>
              <button className="fs-button-ghost text-sm py-1.5 flex items-center gap-1 text-semantic-denied hover:text-semantic-denied">
                <X className="w-3 h-3" />
                Disconnect
              </button>
            </>
          ) : (
            <button className="fs-button-primary text-sm py-1.5 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Connect
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-flowstate-text">Integrations</h1>
        <p className="text-flowstate-text-muted mt-1">
          Connect your apps to FlowState
        </p>
      </div>

      {/* Official Integrations */}
      <section>
        <h2 className="text-lg font-semibold text-flowstate-text mb-4">
          Connected
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {officialIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      </section>

      {/* Available Integrations */}
      <section>
        <h2 className="text-lg font-semibold text-flowstate-text mb-4">
          Available
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      </section>

      {/* Custom MCPs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-flowstate-text">
            Custom MCPs
          </h2>
          <button className="fs-button-secondary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add MCP
          </button>
        </div>
        
        {customMCPs.length === 0 ? (
          <div className="fs-card text-center py-8">
            <div className="text-3xl mb-3">🔧</div>
            <h3 className="font-medium text-flowstate-text mb-2">
              No custom MCPs configured
            </h3>
            <p className="text-sm text-flowstate-text-muted max-w-md mx-auto">
              Add your own MCP servers to extend FlowState with custom integrations.
              MCPs can connect to any API or local service.
            </p>
            <button className="fs-button-ghost text-sm mt-4 flex items-center gap-1 mx-auto">
              <ExternalLink className="w-3 h-3" />
              Learn about MCPs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customMCPs.map((mcp) => (
              <IntegrationCard key={mcp.id} integration={mcp} />
            ))}
          </div>
        )}
      </section>

      {/* Settings Link */}
      <div className="fs-card bg-flowstate-highlight/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-flowstate-text-muted" />
          <div>
            <p className="font-medium text-flowstate-text">Integration Settings</p>
            <p className="text-sm text-flowstate-text-muted">
              Configure sync intervals, permissions, and more
            </p>
          </div>
        </div>
        <button className="fs-button-secondary text-sm">
          Open Settings
        </button>
      </div>
    </div>
  );
}

export default IntegrationsMode;

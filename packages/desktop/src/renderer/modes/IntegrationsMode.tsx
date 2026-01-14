import { useState, useEffect } from 'react';
import {
  Check,
  X,
  ExternalLink,
  Plus,
  Settings,
  RefreshCw,
  Loader2,
  AlertCircle,
  Key,
  Shield,
} from 'lucide-react';
import { useIntegrationsStore, Integration, AuthMethod, AuthOption } from '../stores/integrationsStore';
import type { OAuthSuccessEvent, OAuthErrorEvent, ApiTokenSuccessEvent } from '../types/electron';

/**
 * Auth Method Selector - Choose between OAuth and API Token
 */
function AuthMethodSelector({
  options,
  selected,
  onSelect,
}: {
  options: AuthOption[];
  selected: AuthMethod | null;
  onSelect: (method: AuthMethod) => void;
}) {
  if (options.length === 1) {
    // Auto-select if only one option
    if (!selected) onSelect(options[0].method);
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      <label className="block text-sm font-medium text-flowstate-text">
        Choose connection method
      </label>
      <div className="grid grid-cols-1 gap-2">
        {options.map((option) => (
          <button
            key={option.method}
            type="button"
            onClick={() => onSelect(option.method)}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
              selected === option.method
                ? 'border-flowstate-primary bg-flowstate-primary/5'
                : 'border-flowstate-border hover:border-flowstate-primary/50'
            }`}
          >
            {option.method === 'api_token' ? (
              <Key className="w-5 h-5 text-flowstate-primary mt-0.5" />
            ) : (
              <Shield className="w-5 h-5 text-flowstate-primary mt-0.5" />
            )}
            <div>
              <p className="font-medium text-flowstate-text">{option.label}</p>
              <p className="text-xs text-flowstate-text-muted">{option.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * OAuth Credentials Form
 */
function OAuthForm({
  service,
  onSubmit,
  isLoading,
}: {
  service: string;
  onSubmit: (clientId: string, clientSecret: string) => void;
  isLoading: boolean;
}) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clientId && clientSecret) {
      onSubmit(clientId, clientSecret);
    }
  };

  // Get setup instructions based on service
  const getSetupInstructions = () => {
    switch (service) {
      case 'gmail':
      case 'gcal':
        return {
          title: 'Google Cloud Console Setup',
          steps: [
            'Go to console.cloud.google.com',
            'Create a new project or select existing',
            `Enable the ${service === 'gmail' ? 'Gmail' : 'Calendar'} API`,
            'Go to Credentials → Create Credentials → OAuth Client ID',
            'Set Application Type to "Desktop App"',
            'Add http://localhost:3847/callback to redirect URIs',
            'Copy the Client ID and Client Secret',
          ],
          link: 'https://console.cloud.google.com/apis/credentials',
        };
      case 'notion':
        return {
          title: 'Notion Public OAuth Setup',
          steps: [
            'Go to notion.so/my-integrations',
            'Create a new integration',
            'Enable "Public integration" in Distribution',
            'Set redirect URI to http://localhost:3847/callback',
            'Copy the OAuth Client ID and Secret',
          ],
          link: 'https://www.notion.so/my-integrations',
        };
      default:
        return null;
    }
  };

  const instructions = getSetupInstructions();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-flowstate-highlight/50 rounded-lg border border-flowstate-border">
          <h3 className="text-sm font-medium text-flowstate-text mb-2">
            {instructions.title}
          </h3>
          <ol className="text-xs text-flowstate-text-muted space-y-1 list-decimal list-inside">
            {instructions.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-flowstate-primary hover:underline mt-2"
            onClick={() => window.flowstate.app.openExternal(instructions.link)}
          >
            <ExternalLink className="w-3 h-3" />
            Open {service === 'notion' ? 'Notion' : 'Google Cloud'} Console
          </button>
        </div>
      )}

      <div>
        <label htmlFor="clientId" className="block text-sm font-medium text-flowstate-text mb-1">
          Client ID
        </label>
        <input
          id="clientId"
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Enter your Client ID"
          className="fs-input"
          required
        />
      </div>

      <div>
        <label htmlFor="clientSecret" className="block text-sm font-medium text-flowstate-text mb-1">
          Client Secret
        </label>
        <input
          id="clientSecret"
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="Enter your Client Secret"
          className="fs-input"
          required
        />
      </div>

      <button
        type="submit"
        className="w-full fs-button-primary flex items-center justify-center gap-2"
        disabled={isLoading || !clientId || !clientSecret}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <ExternalLink className="w-4 h-4" />
            Connect with OAuth
          </>
        )}
      </button>
    </form>
  );
}

/**
 * API Token Form (for Notion Internal Integration)
 */
function ApiTokenForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (apiToken: string) => void;
  isLoading: boolean;
}) {
  const [apiToken, setApiToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiToken) {
      onSubmit(apiToken);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Instructions for Notion Internal Integration */}
      <div className="p-4 bg-flowstate-highlight/50 rounded-lg border border-flowstate-border">
        <h3 className="text-sm font-medium text-flowstate-text mb-2">
          Notion Internal Integration Setup
        </h3>
        <ol className="text-xs text-flowstate-text-muted space-y-1 list-decimal list-inside">
          <li>Go to notion.so/my-integrations</li>
          <li>Click "New integration"</li>
          <li>Give it a name (e.g., "FlowState")</li>
          <li>Select the workspace to connect</li>
          <li>Copy the "Internal Integration Secret"</li>
          <li>Share pages/databases with your integration in Notion</li>
        </ol>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-flowstate-primary hover:underline mt-2"
          onClick={() => window.flowstate.app.openExternal('https://www.notion.so/my-integrations')}
        >
          <ExternalLink className="w-3 h-3" />
          Open Notion Integrations
        </button>
      </div>

      <div>
        <label htmlFor="apiToken" className="block text-sm font-medium text-flowstate-text mb-1">
          Internal Integration Secret
        </label>
        <input
          id="apiToken"
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxx"
          className="fs-input font-mono text-sm"
          required
        />
        <p className="text-xs text-flowstate-text-muted mt-1">
          Starts with "secret_" - found in your integration settings
        </p>
      </div>

      <button
        type="submit"
        className="w-full fs-button-primary flex items-center justify-center gap-2"
        disabled={isLoading || !apiToken}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Key className="w-4 h-4" />
            Connect with Token
          </>
        )}
      </button>
    </form>
  );
}

/**
 * Connection Modal - Handles both OAuth and API Token flows
 */
function ConnectionModal({
  integration,
  onClose,
  onOAuthSubmit,
  onApiTokenSubmit,
  isLoading,
}: {
  integration: Integration;
  onClose: () => void;
  onOAuthSubmit: (clientId: string, clientSecret: string) => void;
  onApiTokenSubmit: (apiToken: string) => void;
  isLoading: boolean;
}) {
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod | null>(
    integration.authOptions.length === 1 ? integration.authOptions[0].method : null
  );

  return (
    <div className="fs-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fs-modal">
        {/* Header */}
        <div className="fs-modal-header">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{integration.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-flowstate-text">
                Connect {integration.name}
              </h2>
              <p className="text-sm text-flowstate-text-muted">
                {integration.description}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="fs-modal-body">
          {/* Auth Method Selector */}
          <AuthMethodSelector
            options={integration.authOptions}
            selected={selectedMethod}
            onSelect={setSelectedMethod}
          />

          {/* Form based on selected method */}
          {selectedMethod === 'oauth' && (
            <OAuthForm
              service={integration.id}
              onSubmit={onOAuthSubmit}
              isLoading={isLoading}
            />
          )}

            {selectedMethod === 'api_token' && (
              <ApiTokenForm
                onSubmit={onApiTokenSubmit}
                isLoading={isLoading}
              />
            )}

        </div>

        {/* Footer */}
        <div className="fs-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="fs-button-ghost"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * IntegrationsMode - Connect and manage external services
 */
function IntegrationsMode() {
  const {
    integrations,
    isLoading,
    connectingService,
    loadIntegrations,
    updateIntegration,
    setConnecting,
  } = useIntegrationsStore();

  const [showModal, setShowModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Load integrations on mount
  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  // Set up event listeners
  useEffect(() => {
    // OAuth success
    const cleanupOAuthSuccess = window.flowstate.oauth.onSuccess((event: unknown) => {
      const { service } = event as OAuthSuccessEvent;
      console.log(`[Integrations] OAuth success for ${service}`);
      loadIntegrations();
      setConnecting(null);
      setShowModal(false);
    });

    // OAuth error
    const cleanupOAuthError = window.flowstate.oauth.onError((event: unknown) => {
      const { service, error } = event as OAuthErrorEvent;
      console.error(`[Integrations] OAuth error for ${service}:`, error);
      updateIntegration(service, { status: 'error', error });
      setConnecting(null);
    });

    // API token success
    const cleanupApiTokenSuccess = window.flowstate.auth.onApiTokenSuccess((event: unknown) => {
      const { service } = event as ApiTokenSuccessEvent;
      console.log(`[Integrations] API token success for ${service}`);
      loadIntegrations();
      setConnecting(null);
      setShowModal(false);
    });

    return () => {
      cleanupOAuthSuccess();
      cleanupOAuthError();
      cleanupApiTokenSuccess();
    };
  }, [loadIntegrations, updateIntegration, setConnecting]);

  // Handlers
  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration);
    setShowModal(true);
  };

  const handleOAuthSubmit = async (clientId: string, clientSecret: string) => {
    if (!selectedIntegration) return;
    
    setConnecting(selectedIntegration.id);
    try {
      await window.flowstate.oauth.start(selectedIntegration.id, clientId, clientSecret);
    } catch (error) {
      console.error('OAuth error:', error);
      updateIntegration(selectedIntegration.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      setConnecting(null);
    }
  };

  const handleApiTokenSubmit = async (apiToken: string) => {
    if (!selectedIntegration) return;
    
    setConnecting(selectedIntegration.id);
    try {
      await window.flowstate.auth.storeApiToken(selectedIntegration.id, apiToken);
    } catch (error) {
      console.error('API token error:', error);
      updateIntegration(selectedIntegration.id, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      setConnecting(null);
    }
  };

  const handleDisconnect = async (service: string) => {
    try {
      await window.flowstate.oauth.disconnect(service);
      updateIntegration(service, {
        status: 'disconnected',
        email: undefined,
        lastSync: undefined,
        error: undefined,
        activeAuthMethod: undefined,
      });
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const handleRefresh = () => {
    loadIntegrations();
  };

  // Separate integrations
  const officialIntegrations = integrations.filter((i) => i.isOfficial);

  // Coming soon integrations
  const comingSoonIntegrations = [
    { id: 'slack', name: 'Slack', description: 'Team communication', icon: '💬' },
    { id: 'linear', name: 'Linear', description: 'Issue tracking', icon: '🎯' },
    { id: 'obsidian', name: 'Obsidian', description: 'Local notes', icon: '📝' },
  ];

  const formatLastSync = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const IntegrationCard = ({ integration }: { integration: Integration }) => {
    const isConnected = integration.status === 'connected';
    const isConnecting = integration.status === 'connecting' || connectingService === integration.id;
    const hasError = integration.status === 'error';

    return (
      <div className="fs-card">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{integration.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-flowstate-text">{integration.name}</h3>
              {isConnecting ? (
                <span className="fs-badge bg-flowstate-primary/10 text-flowstate-primary">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Connecting
                </span>
              ) : isConnected ? (
                <span className="fs-badge-success">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </span>
              ) : hasError ? (
                <span className="fs-badge-error">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Error
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
                {integration.activeAuthMethod && (
                  <p className="text-xs text-flowstate-text-muted">
                    via {integration.activeAuthMethod === 'api_token' ? 'API Token' : 'OAuth'}
                  </p>
                )}
                {integration.lastSync && (
                  <p className="text-xs text-flowstate-text-muted">
                    Last sync: {formatLastSync(integration.lastSync)}
                  </p>
                )}
              </div>
            ) : hasError && integration.error ? (
              <p className="text-sm text-semantic-denied mt-1">{integration.error}</p>
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
              <button
                className="fs-button-ghost text-sm py-1.5 flex items-center gap-1"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Sync
              </button>
              <button
                className="fs-button-ghost text-sm py-1.5 flex items-center gap-1 text-semantic-denied hover:text-semantic-denied"
                onClick={() => handleDisconnect(integration.id)}
              >
                <X className="w-3 h-3" />
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="fs-button-primary text-sm py-1.5 flex items-center gap-1"
              onClick={() => handleConnect(integration)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ExternalLink className="w-3 h-3" />
              )}
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-flowstate-text">Integrations</h1>
          <p className="text-flowstate-text-muted mt-1">
            Connect your apps to FlowState
          </p>
        </div>
        <button
          className="fs-button-ghost flex items-center gap-2"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Official Integrations */}
      <section>
        <h2 className="text-lg font-semibold text-flowstate-text mb-4">
          Official Integrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {officialIntegrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      </section>

      {/* Coming Soon */}
      <section>
        <h2 className="text-lg font-semibold text-flowstate-text mb-4">
          Coming Soon
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comingSoonIntegrations.map((item) => (
            <div key={item.id} className="fs-card opacity-60">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h3 className="font-medium text-flowstate-text">{item.name}</h3>
                  <p className="text-sm text-flowstate-text-muted mt-1">{item.description}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-flowstate-border">
                <span className="text-xs text-flowstate-text-muted">Coming soon</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Custom MCPs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-flowstate-text">Custom MCPs</h2>
          <button className="fs-button-secondary text-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add MCP
          </button>
        </div>

        <div className="fs-card text-center py-8">
          <div className="text-3xl mb-3">🔧</div>
          <h3 className="font-medium text-flowstate-text mb-2">
            No custom MCPs configured
          </h3>
          <p className="text-sm text-flowstate-text-muted max-w-md mx-auto">
            Add your own MCP servers to extend FlowState with custom integrations.
          </p>
          <button
            className="fs-button-ghost text-sm mt-4 flex items-center gap-1 mx-auto"
            onClick={() => window.flowstate.app.openExternal('https://modelcontextprotocol.io/introduction')}
          >
            <ExternalLink className="w-3 h-3" />
            Learn about MCPs
          </button>
        </div>
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
        <button className="fs-button-secondary text-sm">Open Settings</button>
      </div>

      {/* Connection Modal */}
      {showModal && selectedIntegration && (
        <ConnectionModal
          integration={selectedIntegration}
          onClose={() => {
            setShowModal(false);
            setSelectedIntegration(null);
          }}
          onOAuthSubmit={handleOAuthSubmit}
          onApiTokenSubmit={handleApiTokenSubmit}
          isLoading={connectingService === selectedIntegration.id}
        />
      )}
    </div>
  );
}

export default IntegrationsMode;

import { useState, useEffect } from 'react';
import { getAuthStatus, connectIntegration, disconnectIntegration } from '../api/index';

interface Integration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  lastSync?: Date;
  error?: string;
}

const OFFICIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'notion',
    name: 'Notion',
    description: 'Pages, databases, and task management',
    connected: false,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email reading, drafting, and sending',
    connected: false,
  },
  {
    id: 'gcal',
    name: 'Google Calendar',
    description: 'Events and scheduling',
    connected: false,
  },
  {
    id: 'system',
    name: 'System',
    description: 'Notifications, apps, and automation',
    connected: true, // Always "connected" for local system
  },
];

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>(OFFICIAL_INTEGRATIONS);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [authMode, setAuthMode] = useState<'manual' | 'oauth'>('manual');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  
  // State from API
  const [loading, setLoading] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const statuses = await getAuthStatus();
      setIntegrations(prev => prev.map(int => {
        const status = statuses.find(s => s.service === int.id);
        if (status) {
          return { ...int, connected: status.connected, error: status.error };
        }
        return int;
      }));
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const openConnectModal = (integration: Integration) => {
    setSelectedIntegration(integration);
    setTokenInput('');
    setClientId('');
    setClientSecret('');
    setAuthMode('manual'); // Default to manual for now
    setError(null);
  };

  const closeConnectModal = () => {
    setSelectedIntegration(null);
    setTokenInput('');
  };

  const handleOAuthLogin = () => {
    if (!clientId || !clientSecret) {
      setError('Please enter Client ID and Secret');
      return;
    }

    const redirectUri = window.location.origin + '/callback/google';
    
    // Store credentials for the callback to use
    localStorage.setItem('flowstate_oauth_pending', JSON.stringify({
      clientId,
      clientSecret,
      redirectUri
    }));

    // Construct Google Auth URL
    const scope = selectedIntegration?.id === 'gmail' 
      ? 'https://www.googleapis.com/auth/gmail.modify'
      : 'https://www.googleapis.com/auth/calendar'; // for gcal

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${encodeURIComponent(clientId)}` + 
      `&redirect_uri=${encodeURIComponent(redirectUri)}` + 
      `&response_type=code` + 
      `&scope=${encodeURIComponent(scope)}` + 
      `&access_type=offline` + 
      `&prompt=consent`;

    window.location.href = authUrl;
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIntegration || !tokenInput) return;

    setLoading(true);
    setError(null);
    
    try {
      let token;
      try {
        token = JSON.parse(tokenInput);
      } catch {
        // Fallback for simple string token (e.g. Notion API key directly)
        token = { accessToken: tokenInput };
      }

      await connectIntegration(selectedIntegration.id, token);
      await fetchStatus();
      closeConnectModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm(`Disconnect ${id}?`)) return;

    setLoading(true);
    try {
      await disconnectIntegration(id);
      await fetchStatus();
    } catch (err: any) {
      alert(`Disconnect failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Integrations</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--fs-text-muted)' }}>
        Connect your apps to FlowState. OAuth tokens are stored locally and encrypted.
      </p>

      {/* Connection Modal */}
      {selectedIntegration && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'var(--fs-surface)', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0 }}>Connect {selectedIntegration.name}</h2>
            
            {(selectedIntegration.id === 'gmail' || selectedIntegration.id === 'gcal') && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #ccc' }}>
                <button
                  className="btn"
                  style={{ 
                    background: 'none', 
                    borderBottom: authMode === 'manual' ? '2px solid var(--fs-primary)' : 'none',
                    borderRadius: 0,
                    fontWeight: authMode === 'manual' ? 'bold' : 'normal'
                  }}
                  onClick={() => setAuthMode('manual')}
                >
                  Manual Token
                </button>
                <button
                  className="btn"
                  style={{ 
                    background: 'none', 
                    borderBottom: authMode === 'oauth' ? '2px solid var(--fs-primary)' : 'none',
                    borderRadius: 0,
                    fontWeight: authMode === 'oauth' ? 'bold' : 'normal'
                  }}
                  onClick={() => setAuthMode('oauth')}
                >
                  OAuth Setup
                </button>
              </div>
            )}

            {authMode === 'manual' ? (
              <>
                <p style={{ color: 'var(--fs-text-muted)', fontSize: '0.9rem' }}>
                  Please paste your authentication token JSON below.
                </p>
                
                <form onSubmit={handleConnectSubmit}>
                  <textarea
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder={`Paste ${selectedIntegration.name} token JSON here...`}
                    style={{
                      width: '100%', height: '150px', marginBottom: '1rem',
                      padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc',
                      fontFamily: 'monospace', fontSize: '0.85rem'
                    }}
                    required
                  />
                  
                  {_error && (
                    <div style={{ color: 'var(--fs-error)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                      Error: {_error}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={closeConnectModal}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      disabled={loading || !tokenInput}
                    >
                      {loading ? 'Connecting...' : 'Save & Connect'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--fs-text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Enter your Google Cloud Credentials to sign in.
                </p>
                
                <div className="form-group">
                  <label>Client ID</label>
                  <input 
                    type="text" 
                    value={clientId} 
                    onChange={e => setClientId(e.target.value)}
                    placeholder="xxx.apps.googleusercontent.com"
                  />
                </div>
                
                <div className="form-group">
                  <label>Client Secret</label>
                  <input 
                    type="password" 
                    value={clientSecret} 
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder="Client Secret"
                  />
                </div>

                {_error && (
                  <div style={{ color: 'var(--fs-error)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    Error: {_error}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={closeConnectModal}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    className="btn btn-primary"
                    onClick={handleOAuthLogin}
                    disabled={!clientId || !clientSecret}
                  >
                    Sign in with Google
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h2>Official Integrations</h2>
        <div className="integration-grid">
          {integrations.map(integration => (
            <div key={integration.id} className="integration-card">
              <h3>{integration.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--fs-text-muted)', marginBottom: '1rem' }}>
                {integration.description}
              </p>
              {integration.connected ? (
                <>
                  <p className="status-connected" style={{ marginBottom: '0.5rem' }}>
                    ✓ Connected
                  </p>
                  {integration.id !== 'system' && (
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleDisconnect(integration.id)}
                      disabled={loading}
                    >
                      Disconnect
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="status-disconnected" style={{ marginBottom: '0.5rem' }}>
                    ○ Not connected
                  </p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => openConnectModal(integration)}
                    disabled={loading}
                  >
                    Connect
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>Custom MCPs</h2>
        <p style={{ color: 'var(--fs-text-muted)', marginBottom: '1rem' }}>
          Add your own MCP servers by editing <code>opencode.json</code>.
        </p>
        <button className="btn btn-secondary">
          + Add Custom MCP
        </button>
      </div>
    </div>
  );
}

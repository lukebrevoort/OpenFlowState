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

  const handleConnect = async (id: string) => {
    // DEV MODE: Prompt for token JSON
    const tokenStr = prompt(`[DEV MODE] Paste JSON token for ${id}:`, '{"accessToken": "test-token"}');
    if (!tokenStr) return;

    setLoading(true);
    setError(null);
    
    try {
      let token;
      try {
        token = JSON.parse(tokenStr);
      } catch {
        // Fallback for simple string token
        token = { accessToken: tokenStr };
      }

      await connectIntegration(id, token);
      await fetchStatus();
    } catch (err: any) {
      setError(err.message);
      alert(`Connection failed: ${err.message}`);
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
                    onClick={() => handleConnect(integration.id)}
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

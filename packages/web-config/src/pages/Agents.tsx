interface Agent {
  id: string;
  name: string;
  description: string;
  type: 'primary' | 'subagent';
  enabled: boolean;
}

const AGENTS: Agent[] = [
  {
    id: 'flowstate',
    name: 'FlowState',
    description: 'Primary orchestrator - routes to specialists and handles cross-app tasks',
    type: 'primary',
    enabled: true,
  },
  {
    id: 'scheduler',
    name: 'Scheduler',
    description: 'Calendar optimization, meeting scheduling, conflict resolution',
    type: 'subagent',
    enabled: true,
  },
  {
    id: 'organizer',
    name: 'Organizer',
    description: 'Task management, project organization, Notion specialist',
    type: 'subagent',
    enabled: true,
  },
  {
    id: 'communicator',
    name: 'Communicator',
    description: 'Email drafting, inbox organization, messaging',
    type: 'subagent',
    enabled: true,
  },
  {
    id: 'executor',
    name: 'Executor',
    description: 'System automation, shell commands, desktop control',
    type: 'subagent',
    enabled: true,
  },
];

export default function Agents() {
  return (
    <div>
      <h1>Agents</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--fs-text-muted)' }}>
        FlowState uses specialized agents for different tasks. The primary agent orchestrates, 
        while subagents handle domain-specific work.
      </p>

      <div className="card">
        <h2>Primary Agent</h2>
        {AGENTS.filter(a => a.type === 'primary').map(agent => (
          <div key={agent.id} style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '1rem',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid var(--fs-border)',
          }}>
            <div>
              <h3 style={{ marginBottom: '0.25rem' }}>{agent.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--fs-text-muted)' }}>
                {agent.description}
              </p>
            </div>
            <span className="status-connected">Active</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Subagents</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {AGENTS.filter(a => a.type === 'subagent').map(agent => (
            <div key={agent.id} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '1rem',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid var(--fs-border)',
            }}>
              <div>
                <h3 style={{ marginBottom: '0.25rem' }}>@{agent.id}</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--fs-text-muted)' }}>
                  {agent.description}
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  checked={agent.enabled} 
                  onChange={() => {}}
                />
                Enabled
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h2>Custom Agents</h2>
        <p style={{ color: 'var(--fs-text-muted)', marginBottom: '1rem' }}>
          Create custom agents by adding markdown files to <code>agents/subagents/</code>.
        </p>
        <button className="btn btn-secondary">
          + Create Custom Agent
        </button>
      </div>
    </div>
  );
}

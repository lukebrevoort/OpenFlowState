import { useState, useEffect } from 'react';
import { getPreferences, updatePreferences, type UserPreferences } from '../api/index';

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const LLM_PROVIDERS = [
  { id: 'opencode/zen', name: 'OpenCode Zen (Default)' },
  { id: 'anthropic/claude-sonnet', name: 'Anthropic Claude Sonnet' },
  { id: 'openai/gpt-4', name: 'OpenAI GPT-4' },
  { id: 'google/gemini-pro', name: 'Google Gemini Pro' },
];

export default function Preferences() {
  const [form, setForm] = useState<UserPreferences>({
    timezone: 'America/New_York',
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    defaultLLMProvider: 'opencode/zen',
    notificationsEnabled: true,
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const prefs = await getPreferences();
      if (prefs) {
        setForm(prefs);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (field: keyof UserPreferences, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      await updatePreferences(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert('Failed to save preferences');
    }
  };

  if (loading) return <div>Loading preferences...</div>;

  return (
    <div>
      <h1>Preferences</h1>
      <p style={{ marginBottom: '2rem', color: 'var(--fs-text-muted)' }}>
        Configure your FlowState experience.
      </p>

      <div className="card">
        <h2>Time & Scheduling</h2>
        
        <div className="form-group">
          <label htmlFor="timezone">Timezone</label>
          <select
            id="timezone"
            value={form.timezone}
            onChange={e => handleChange('timezone', e.target.value)}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="workingHoursStart">Working Hours Start</label>
            <input
              id="workingHoursStart"
              type="time"
              value={form.workingHoursStart}
              onChange={e => handleChange('workingHoursStart', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="workingHoursEnd">Working Hours End</label>
            <input
              id="workingHoursEnd"
              type="time"
              value={form.workingHoursEnd}
              onChange={e => handleChange('workingHoursEnd', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>AI Provider</h2>
        
        <div className="form-group">
          <label htmlFor="defaultProvider">Default LLM Provider</label>
          <select
            id="defaultProvider"
            value={form.defaultLLMProvider}
            onChange={e => handleChange('defaultLLMProvider', e.target.value)}
          >
            {LLM_PROVIDERS.map(provider => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
          <p style={{ fontSize: '0.85rem', color: 'var(--fs-text-muted)', marginTop: '0.5rem' }}>
            OpenCode Zen is recommended to support the platform.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Notifications</h2>
        
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={form.notificationsEnabled}
              onChange={e => handleChange('notificationsEnabled', e.target.checked)}
            />
            Enable desktop notifications
          </label>
          <p style={{ fontSize: '0.85rem', color: 'var(--fs-text-muted)', marginTop: '0.5rem' }}>
            Get notified about task completions, approval requests, and errors.
          </p>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? '✓ Saved' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

/**
 * Dashboard API Client
 * 
 * Communicates with the FlowState API server.
 */

const API_URL = 'http://127.0.0.1:3001/api';

export interface IntegrationStatus {
  service: string;
  connected: boolean;
  lastRefresh?: string;
  error?: string;
}

export interface UserPreferences {
  timezone: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  defaultLLMProvider: string;
  notificationsEnabled: boolean;
}

/**
 * Get connection status for all integrations
 */
export async function getAuthStatus(): Promise<IntegrationStatus[]> {
  try {
    const response = await fetch(`${API_URL}/auth/status`);
    if (!response.ok) throw new Error('Failed to fetch status');
    return response.json();
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

/**
 * Connect an integration (Manual Token Flow)
 */
export async function connectIntegration(service: string, token: any): Promise<void> {
  const response = await fetch(`${API_URL}/auth/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service, token }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to connect ${service}`);
  }
}

/**
 * Disconnect an integration
 */
export async function disconnectIntegration(service: string): Promise<void> {
  const response = await fetch(`${API_URL}/auth/disconnect`, {
    method: 'POST', // Using POST for RPC-style action
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to disconnect ${service}`);
  }
}

/**
 * Exchange Google OAuth code for tokens
 */
export async function exchangeGoogleCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<void> {
  const response = await fetch(`${API_URL}/auth/google/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to exchange code');
  }
}

/**
 * Get user preferences
 */
export async function getPreferences(): Promise<UserPreferences | null> {
  try {
    const response = await fetch(`${API_URL}/preferences`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Update user preferences
 */
export async function updatePreferences(
  preferences: Partial<UserPreferences>
): Promise<void> {
  const response = await fetch(`${API_URL}/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update preferences');
  }
}

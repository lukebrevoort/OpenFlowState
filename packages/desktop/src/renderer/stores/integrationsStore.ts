/**
 * Integrations Store - Manages integration state using Zustand
 *
 * Handles:
 * - Integration connection status
 * - OAuth flow state
 * - MCP server status
 */

import { create } from 'zustand';

export type AuthMethod = 'oauth' | 'api_token';

export interface AuthOption {
  method: AuthMethod;
  label: string;
  description: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  email?: string;
  lastSync?: Date;
  error?: string;
  isOfficial: boolean;
  authOptions: AuthOption[]; // Available auth methods for this integration
  activeAuthMethod?: AuthMethod; // Currently used auth method
  mcpEnabled?: boolean;
}

interface IntegrationsState {
  // Integrations
  integrations: Integration[];
  
  // Loading state
  isLoading: boolean;
  
  // OAuth flow
  connectingService: string | null;
  onboardingConnectId: string | null;
  
  // Actions
  setIntegrations: (integrations: Integration[]) => void;
  updateIntegration: (id: string, updates: Partial<Integration>) => void;
  setConnecting: (service: string | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingConnect: (service: string | null) => void;
  loadIntegrations: () => Promise<void>;
  connect: (service: string) => Promise<void>;
  disconnect: (service: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// Default integrations configuration
const DEFAULT_INTEGRATIONS: Integration[] = [
  {
    id: 'notion',
    name: 'Notion',
    description: 'Pages, databases, and task management',
    icon: '📓',
    status: 'disconnected',
    isOfficial: true,
    authOptions: [
      {
        method: 'api_token',
        label: 'Internal Integration',
        description: 'Simple setup - paste your integration token',
      },
      {
        method: 'oauth',
        label: 'Public OAuth',
        description: 'For public integrations - requires OAuth app setup',
      },
    ],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email reading, drafting, and organizing',
    icon: '📧',
    status: 'disconnected',
    isOfficial: true,
    authOptions: [
      {
        method: 'oauth',
        label: 'Google OAuth',
        description: 'Connect via Google Cloud Console',
      },
    ],
  },
  {
    id: 'gcal',
    name: 'Google Calendar',
    description: 'Events, scheduling, and availability',
    icon: '📅',
    status: 'disconnected',
    isOfficial: true,
    authOptions: [
      {
        method: 'oauth',
        label: 'Google OAuth',
        description: 'Connect via Google Cloud Console',
      },
    ],
  },
  {
    id: 'canvas',
    name: 'Canvas LMS',
    description: 'Assignments, grades, and course materials for students',
    icon: '📚',
    status: 'disconnected',
    isOfficial: true,
    authOptions: [
      {
        method: 'api_token',
        label: 'Canvas API Token',
        description: 'Generate a token from Canvas Settings > Approved Integrations',
      },
    ],
  },
];

export const useIntegrationsStore = create<IntegrationsState>((set, get) => ({
  // Initial state
  integrations: DEFAULT_INTEGRATIONS,
  isLoading: false,
  connectingService: null,
  onboardingConnectId: null,

  // Actions
  setIntegrations: (integrations) => {
    set({ integrations });
  },

  updateIntegration: (id, updates) => {
    set((state) => ({
      integrations: state.integrations.map((i) =>
        i.id === id ? { ...i, ...updates } : i
      ),
    }));
  },

  setConnecting: (service) => {
    set({ connectingService: service });
    if (service) {
      get().updateIntegration(service, { status: 'connecting' });
    }
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setOnboardingConnect: (service) => {
    set({ onboardingConnectId: service });
  },

  loadIntegrations: async () => {
    set({ isLoading: true });
    
    try {
      // Get status from main process
      const statuses = await window.flowstate.auth.getAllStatuses();
      
      // Update integrations with status
      set((state) => ({
        integrations: state.integrations.map((integration) => {
          const status = statuses.find((s: { service: string }) => s.service === integration.id);
          if (status) {
            return {
              ...integration,
              status: status.connected ? 'connected' : 'disconnected',
              email: status.email,
              lastSync: status.lastRefresh ? new Date(status.lastRefresh) : undefined,
              error: status.error,
              activeAuthMethod: status.authMethod,
            };
          }
          return integration;
        }),
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load integrations:', error);
      set({ isLoading: false });
    }
  },

  // Note: connect is now handled by useIntegrations hook which has the credentials
  // This method is kept for backwards compatibility but should use the hook instead
  connect: async (_service) => {
    // OAuth flow requires credentials, use useIntegrations.connect() instead
    console.warn('Use useIntegrations.connect() with credentials instead');
  },

  disconnect: async (service) => {
    const { updateIntegration } = get();
    
    try {
      await window.flowstate.oauth.disconnect(service);
      updateIntegration(service, {
        status: 'disconnected',
        email: undefined,
        lastSync: undefined,
        error: undefined,
      });
    } catch (error) {
      console.error(`Failed to disconnect ${service}:`, error);
      updateIntegration(service, {
        error: error instanceof Error ? error.message : 'Disconnect failed',
      });
    }
  },

  refresh: async () => {
    await get().loadIntegrations();
  },
}));

export default useIntegrationsStore;

/**
 * Integrations Store - Manages integration state using Zustand
 *
 * Handles:
 * - Integration connection status
 * - OAuth flow state
 * - MCP server status
 */

import { create } from 'zustand';
import type { McpDiagnostics } from '../types/electron';

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
  healthStatus?: 'unverified' | 'verified' | 'needs_reconnect';
  isCheckingHealth?: boolean;
  email?: string;
  lastSync?: Date;
  lastCheckedAt?: Date;
  healthMessage?: string;
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
  onboardingConnectNonce: number;
  
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
    id: 'outlook',
    name: 'Outlook',
    description: 'Microsoft 365 inbox and calendar (OAuth or browser session)',
    icon: '📨',
    status: 'disconnected',
    isOfficial: true,
    authOptions: [
      {
        method: 'oauth',
        label: 'Microsoft OAuth (Recommended)',
        description: 'Official Entra app flow for mail and calendar access',
      },
      {
        method: 'api_token',
        label: 'Browser Session (Manual Login)',
        description: 'Manual sign-in with Playwright session storage (read-only by default, optional draft/send)',
      },
    ],
  },
  {
    id: 'canvas',
    name: 'Canvas LMS',
    description: 'Assignments, grades, and course materials (token or browser login)',
    icon: '📚',
    status: 'disconnected',
    isOfficial: true,
    authOptions: [
      {
        method: 'api_token',
        label: 'Canvas Connection',
        description: 'Connect with an API token or a browser session (no token) using a storage state file',
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
  onboardingConnectNonce: 0,

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
    set((state) => ({
      onboardingConnectId: service,
      onboardingConnectNonce:
        service === null
          ? state.onboardingConnectNonce
          : state.onboardingConnectNonce + 1,
    }));
  },

  loadIntegrations: async () => {
    set({ isLoading: true });
    
    try {
      // Get auth and MCP status from main process
      const [statuses, mcpStatuses, mcpDiagnostics] = await Promise.all([
        window.flowstate.auth.getAllStatuses(),
        window.flowstate.integrations.getMcpStatus().catch(() => null),
        window.flowstate.integrations.getMcpDiagnostics().catch((): McpDiagnostics => ({
          updatedAt: Date.now(),
          errors: {},
          skipped: {},
        })),
      ]);

      const mcpNameByService: Record<string, string> = {
        gmail: 'flowstate-gmail',
        gcal: 'flowstate-gcal',
        notion: 'notion',
        outlook: 'flowstate-outlook',
        canvas: 'flowstate-canvas',
      };
      
      // Update integrations with status
      set((state) => ({
        integrations: state.integrations.map((integration) => {
          const status = statuses.find((s: { service: string }) => s.service === integration.id);
          const previouslyConnected = integration.status === 'connected';
          const mcpName = mcpNameByService[integration.id];
          const mcpStatus = mcpName && mcpStatuses ? mcpStatuses[mcpName] : undefined;
          const mcpState = typeof mcpStatus?.status === 'string' ? mcpStatus.status : undefined;
          const mcpError =
            typeof mcpStatus?.error === 'string' && mcpStatus.error.trim().length > 0
              ? mcpStatus.error.trim()
              : undefined;
          const mcpDiagnosticsMessage =
            (mcpName ? mcpDiagnostics.errors[mcpName] : undefined) ??
            (mcpName ? mcpDiagnostics.skipped[mcpName] : undefined);

          if (status) {
            const isConnected = Boolean(status.connected);
            const mcpMissing = isConnected && Boolean(mcpName) && !mcpStatus;
            const mcpFailed = mcpState === 'failed' || mcpState === 'disabled' || mcpMissing;
            const statusLastRefresh = status.lastRefresh
              ? new Date(status.lastRefresh)
              : undefined;
            const nextLastSync =
              integration.lastSync && statusLastRefresh
                ? integration.lastSync > statusLastRefresh
                  ? integration.lastSync
                  : statusLastRefresh
                : integration.lastSync ?? statusLastRefresh;

            return {
              ...integration,
              status: isConnected ? 'connected' : 'disconnected',
              healthStatus: isConnected
                ? mcpFailed
                  ? 'needs_reconnect'
                  : previouslyConnected
                    ? integration.healthStatus ?? 'unverified'
                    : 'unverified'
                : undefined,
              isCheckingHealth: integration.isCheckingHealth ?? false,
              email: status.email ?? integration.email,
              lastSync: nextLastSync,
              lastCheckedAt: isConnected ? integration.lastCheckedAt : undefined,
              healthMessage: isConnected ? integration.healthMessage : undefined,
              error:
                isConnected && mcpFailed
                  ? `MCP unavailable${mcpError ? `: ${mcpError}` : mcpDiagnosticsMessage ? `: ${mcpDiagnosticsMessage}` : mcpMissing ? ': MCP did not register in this session.' : ''}`
                  : isConnected && integration.healthStatus === 'needs_reconnect'
                  ? integration.error
                  : status.error,
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
        healthStatus: undefined,
        isCheckingHealth: false,
        email: undefined,
        lastSync: undefined,
        lastCheckedAt: undefined,
        healthMessage: undefined,
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

/**
 * Config Store - Manages application configuration using Zustand
 *
 * Handles:
 * - Loading config from main process
 * - Updating config
 * - Provider settings
 * - MCP server status
 */

import { create } from 'zustand';
import type { FlowstateConfig, MCPServerConfig, OpenCodeStatus } from '../types/electron';

interface ConfigState {
  // Config
  config: FlowstateConfig | null;
  isLoaded: boolean;
  
  // OpenCode status
  openCodeStatus: OpenCodeStatus | null;
  
  // Actions
  setConfig: (config: FlowstateConfig) => void;
  updateConfig: (partial: Partial<FlowstateConfig>) => Promise<void>;
  setOpenCodeStatus: (status: OpenCodeStatus) => void;
  loadConfig: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  // Initial state
  config: null,
  isLoaded: false,
  openCodeStatus: null,

  // Actions
  setConfig: (config) => {
    set({ config, isLoaded: true });
  },

  updateConfig: async (partial) => {
    try {
      const newConfig = await window.flowstate.config.set(partial);
      set({ config: newConfig });
    } catch (error) {
      console.error('Failed to update config:', error);
      throw error;
    }
  },

  setOpenCodeStatus: (status) => {
    set({ openCodeStatus: status });
  },

  loadConfig: async () => {
    try {
      const config = await window.flowstate.config.get();
      set({ config, isLoaded: true });
    } catch (error) {
      console.error('Failed to load config:', error);
      throw error;
    }
  },

  refreshStatus: async () => {
    try {
      const status = await window.flowstate.opencode.status();
      set({ openCodeStatus: status });
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  },
}));

export default useConfigStore;

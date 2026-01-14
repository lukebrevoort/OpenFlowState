/**
 * useConfig Hook - Manages application configuration
 *
 * Provides:
 * - Load and access config
 * - Update config
 * - Provider settings
 */

import { useEffect, useCallback } from 'react';
import { useConfigStore } from '../stores/configStore';
import type { FlowstateConfig } from '../types/electron';

export function useConfig() {
  const {
    config,
    isLoaded,
    openCodeStatus,
    loadConfig,
    updateConfig,
    refreshStatus,
  } = useConfigStore();

  /**
   * Load config on mount
   */
  useEffect(() => {
    if (!isLoaded) {
      loadConfig().catch(console.error);
    }
  }, [isLoaded, loadConfig]);

  /**
   * Update provider settings
   */
  const setProvider = useCallback(async (provider: string, apiKey?: string) => {
    const update: Partial<FlowstateConfig> = {
      provider: {
        default: provider,
        apiKeys: apiKey 
          ? { ...config?.provider.apiKeys, [provider.split('/')[0]]: apiKey }
          : config?.provider.apiKeys || {},
      },
    };
    await updateConfig(update);
  }, [config, updateConfig]);

  /**
   * Update preferences
   */
  const updatePreferences = useCallback(async (preferences: Partial<FlowstateConfig['preferences']>) => {
    if (!config) return;
    
    await updateConfig({
      preferences: {
        ...config.preferences,
        ...preferences,
      },
    });
  }, [config, updateConfig]);

  /**
   * Check if onboarding is complete
   */
  const isOnboardingComplete = config?.onboardingComplete ?? false;

  /**
   * Mark onboarding as complete
   */
  const completeOnboarding = useCallback(async () => {
    await updateConfig({ onboardingComplete: true });
  }, [updateConfig]);

  return {
    // State
    config,
    isLoaded,
    openCodeStatus,
    isOnboardingComplete,

    // Actions
    loadConfig,
    updateConfig,
    setProvider,
    updatePreferences,
    completeOnboarding,
    refreshStatus,
  };
}

export default useConfig;

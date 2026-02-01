import { useCallback, useEffect, useRef } from "react";
import { useIntegrationsStore } from "../stores/integrationsStore";
import type {
  OAuthSuccessEvent,
  OAuthErrorEvent,
  ApiTokenSuccessEvent,
} from "../types/electron";

interface UseIntegrationsOptions {
  onError?: (message: string) => void;
}

export function useIntegrations(options: UseIntegrationsOptions = {}) {
  const {
    integrations,
    isLoading,
    connectingService,
    setConnecting,
    loadIntegrations,
    updateIntegration,
  } = useIntegrationsStore();

  const cleanupRef = useRef<(() => void)[]>([]);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  useEffect(() => {
    loadIntegrations().catch((error) => {
      onErrorRef.current?.(
        error instanceof Error ? error.message : "Failed to load integrations",
      );
    });
  }, [loadIntegrations]);

  useEffect(() => {
    const removeOAuthSuccess = window.flowstate.oauth.onSuccess(
      (event: OAuthSuccessEvent) => {
        updateIntegration(event.service, {
          status: "connected",
          error: undefined,
        });
        setConnecting(null);
        loadIntegrations();
      },
    );

    const removeOAuthError = window.flowstate.oauth.onError(
      (event: OAuthErrorEvent) => {
        updateIntegration(event.service, {
          status: "error",
          error: event.error,
        });
        setConnecting(null);
      },
    );

    const removeApiTokenSuccess = window.flowstate.auth.onApiTokenSuccess(
      (event: ApiTokenSuccessEvent) => {
        updateIntegration(event.service, {
          status: "connected",
          error: undefined,
        });
        setConnecting(null);
        loadIntegrations();
      },
    );

    cleanupRef.current = [
      removeOAuthSuccess,
      removeOAuthError,
      removeApiTokenSuccess,
    ];

    return () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    };
  }, [loadIntegrations, setConnecting, updateIntegration]);

  const connectOAuth = useCallback(
    async (service: string, clientId: string, clientSecret: string) => {
      setConnecting(service);
      updateIntegration(service, { status: "connecting", error: undefined });

      try {
        await window.flowstate.auth.setCredentials(service, {
          clientId,
          clientSecret,
        });
        await window.flowstate.oauth.start(service, clientId, clientSecret);
      } catch (error) {
        updateIntegration(service, {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to start OAuth",
        });
        setConnecting(null);
        options.onError?.(
          error instanceof Error ? error.message : "Failed to start OAuth",
        );
      }
    },
    [options, setConnecting, updateIntegration],
  );

  const connectApiToken = useCallback(
    async (service: string, apiToken: string, additionalData?: Record<string, string>) => {
      setConnecting(service);
      updateIntegration(service, { status: "connecting", error: undefined });

      try {
        // For Canvas, pass additional data (like API URL)
        if (service === 'canvas' && additionalData) {
          await window.flowstate.auth.storeApiToken(service, apiToken, additionalData);
        } else {
          await window.flowstate.auth.storeApiToken(service, apiToken);
        }
      } catch (error) {
        updateIntegration(service, {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to store token",
        });
        setConnecting(null);
        options.onError?.(
          error instanceof Error ? error.message : "Failed to store token",
        );
      }
    },
    [options, setConnecting, updateIntegration],
  );

  const disconnect = useCallback(
    async (service: string) => {
      try {
        await window.flowstate.oauth.disconnect(service);
        updateIntegration(service, {
          status: "disconnected",
          error: undefined,
          email: undefined,
          lastSync: undefined,
          activeAuthMethod: undefined,
        });
      } catch (error) {
        updateIntegration(service, {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to disconnect",
        });
      }
    },
    [updateIntegration],
  );

  const refresh = useCallback(async () => {
    await loadIntegrations();
  }, [loadIntegrations]);

  return {
    integrations,
    isLoading,
    connectingService,
    connectOAuth,
    connectApiToken,
    disconnect,
    refresh,
  };
}

export default useIntegrations;

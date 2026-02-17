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
          healthStatus: "unverified",
          isCheckingHealth: false,
          lastCheckedAt: undefined,
          healthMessage: undefined,
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
          healthStatus: "unverified",
          isCheckingHealth: false,
          lastCheckedAt: undefined,
          healthMessage: undefined,
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
      updateIntegration(service, {
        status: "connecting",
        healthStatus: undefined,
        isCheckingHealth: false,
        lastCheckedAt: undefined,
        healthMessage: undefined,
        error: undefined,
      });

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
      updateIntegration(service, {
        status: "connecting",
        healthStatus: undefined,
        isCheckingHealth: false,
        lastCheckedAt: undefined,
        healthMessage: undefined,
        error: undefined,
      });

      try {
        if (additionalData) {
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
          healthStatus: undefined,
          isCheckingHealth: false,
          error: undefined,
          email: undefined,
          lastSync: undefined,
          lastCheckedAt: undefined,
          healthMessage: undefined,
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

  const healthCheck = useCallback(
    async (service: string) => {
      const integration = integrations.find((item) => item.id === service);
      if (!integration || integration.status !== "connected") {
        return;
      }

      updateIntegration(service, {
        isCheckingHealth: true,
        error: undefined,
      });

      try {
        const result = await window.flowstate.integrations.healthCheck(service);
        const checkedAtCandidate = result.checkedAt
          ? new Date(result.checkedAt)
          : new Date();
        const checkedAtDate = Number.isNaN(checkedAtCandidate.getTime())
          ? new Date()
          : checkedAtCandidate;

        if (result.ok) {
          updateIntegration(service, {
            status: "connected",
            healthStatus: "verified",
            isCheckingHealth: false,
            email: result.email ?? integration.email,
            lastSync: checkedAtDate,
            lastCheckedAt: checkedAtDate,
            healthMessage: result.message,
            error: undefined,
          });
          return;
        }

        const message = result.message ?? "Health check failed. Reconnect this integration.";
        updateIntegration(service, {
          status: "connected",
          healthStatus: "needs_reconnect",
          isCheckingHealth: false,
          lastCheckedAt: checkedAtDate,
          healthMessage: message,
          error: message,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Health check failed. Reconnect this integration.";
        updateIntegration(service, {
          status: "connected",
          healthStatus: "needs_reconnect",
          isCheckingHealth: false,
          lastCheckedAt: new Date(),
          healthMessage: message,
          error: message,
        });
        options.onError?.(message);
      }
    },
    [integrations, options, updateIntegration],
  );

  return {
    integrations,
    isLoading,
    connectingService,
    connectOAuth,
    connectApiToken,
    disconnect,
    refresh,
    healthCheck,
  };
}

export default useIntegrations;

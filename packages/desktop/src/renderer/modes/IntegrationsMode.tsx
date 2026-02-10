import { useState, useEffect } from "react";
import {
  Check,
  X,
  ExternalLink,
  Plus,
  Settings,
  RefreshCw,
  Loader2,
  AlertCircle,
  Key,
  Shield,
} from "lucide-react";
import { useIntegrations } from "../hooks";
import {
  useIntegrationsStore,
  Integration,
  AuthMethod,
  AuthOption,
} from "../stores/integrationsStore";
import type { MCPServerConfig } from "../types/electron";

type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
  timeZone?: string;
  backgroundColor?: string;
};

/**
 * Auth Method Selector - Choose between OAuth and API Token
 */
function AuthMethodSelector({
  options,
  selected,
  onSelect,
}: {
  options: AuthOption[];
  selected: AuthMethod | null;
  onSelect: (method: AuthMethod) => void;
}) {
  if (options.length === 1) {
    // Auto-select if only one option
    if (!selected) onSelect(options[0].method);
    return null;
  }

  return (
    <div className="space-y-2 mb-4">
      <label className="block text-sm font-medium text-foreground">
        Choose connection method
      </label>
      <div className="grid grid-cols-1 gap-2">
        {options.map((option) => (
          <button
            key={option.method}
            type="button"
            onClick={() => onSelect(option.method)}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
              selected === option.method
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            {option.method === "api_token" ? (
              <Key className="w-5 h-5 text-primary mt-0.5" />
            ) : (
              <Shield className="w-5 h-5 text-primary mt-0.5" />
            )}
            <div>
              <p className="font-medium text-foreground">{option.label}</p>
              <p className="text-xs text-muted-foreground">
                {option.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * OAuth Credentials Form
 */
function OAuthForm({
  service,
  onSubmit,
  isLoading,
}: {
  service: string;
  onSubmit: (clientId: string, clientSecret: string) => void;
  isLoading: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clientId && clientSecret) {
      onSubmit(clientId, clientSecret);
    }
  };

  // Get setup instructions based on service
  const getSetupInstructions = () => {
    switch (service) {
      case "gmail":
      case "gcal":
        return {
          title: "Google Cloud Console Setup",
          steps: [
            "Go to console.cloud.google.com",
            "Create a new project or select existing",
            `Enable the ${service === "gmail" ? "Gmail" : "Calendar"} API`,
            "Go to Credentials → Create Credentials → OAuth Client ID",
            'Set Application Type to "Desktop App"',
            "Add http://localhost:3847/callback to redirect URIs",
            "Copy the Client ID and Client Secret",
          ],
          link: "https://console.cloud.google.com/apis/credentials",
        };
      case "notion":
        return {
          title: "Notion Public OAuth Setup",
          steps: [
            "Go to notion.so/my-integrations",
            "Create a new integration",
            'Enable "Public integration" in Distribution',
            "Set redirect URI to http://localhost:3847/callback",
            "Copy the OAuth Client ID and Secret",
          ],
          link: "https://www.notion.so/my-integrations",
        };
      default:
        return null;
    }
  };

  const instructions = getSetupInstructions();

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Instructions */}
      {instructions && (
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-foreground mb-2">
            {instructions.title}
          </h3>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            {instructions.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
            onClick={() => window.flowstate.app.openExternal(instructions.link)}
          >
            <ExternalLink className="w-3 h-3" />
            Open {service === "notion" ? "Notion" : "Google Cloud"} Console
          </button>
        </div>
      )}

      <div>
        <label
          htmlFor="clientId"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Client ID
        </label>
        <input
          id="clientId"
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Enter your Client ID"
          className="fs-input"
          required
        />
      </div>

      <div>
        <label
          htmlFor="clientSecret"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Client Secret
        </label>
        <input
          id="clientSecret"
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="Enter your Client Secret"
          className="fs-input"
          required
        />
      </div>

      <button
        type="submit"
        className="w-full fs-button-primary flex items-center justify-center gap-2"
        disabled={isLoading || !clientId || !clientSecret}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <ExternalLink className="w-4 h-4" />
            Connect with OAuth
          </>
        )}
      </button>
    </form>
  );
}

/**
 * API Token Form (for Notion Internal Integration)
 */
function ApiTokenForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (apiToken: string) => void;
  isLoading: boolean;
}) {
  const [apiToken, setApiToken] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiToken) {
      onSubmit(apiToken);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Instructions for Notion Internal Integration */}
      <div className="p-4 bg-muted/50 rounded-lg border border-border">
        <h3 className="text-sm font-medium text-foreground mb-2">
          Notion Internal Integration Setup
        </h3>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Go to notion.so/my-integrations</li>
          <li>Click "New integration"</li>
          <li>Give it a name (e.g., "FlowState")</li>
          <li>Select the workspace to connect</li>
          <li>Copy the "Internal Integration Secret"</li>
          <li>Share pages/databases with your integration in Notion</li>
        </ol>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
          onClick={() =>
            window.flowstate.app.openExternal(
              "https://www.notion.so/my-integrations",
            )
          }
        >
          <ExternalLink className="w-3 h-3" />
          Open Notion Integrations
        </button>
      </div>

      <div>
        <label
          htmlFor="apiToken"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Internal Integration Secret
        </label>
        <input
          id="apiToken"
          type="password"
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder="secret_xxxxxxxxxxxxxxxxxxxxxxxx"
          className="fs-input font-mono text-sm"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          Starts with "secret_" - found in your integration settings
        </p>
      </div>

      <button
        type="submit"
        className="w-full fs-button-primary flex items-center justify-center gap-2"
        disabled={isLoading || !apiToken}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Key className="w-4 h-4" />
            Connect with Token
          </>
        )}
      </button>
    </form>
  );
}

/**
 * Canvas Connection Form
 *
 * Supports:
 * - API Token auth
 * - Browser Login auth (no token) via Playwright storage state
 */
function CanvasConnectionForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (apiToken: string, additionalData: Record<string, string>) => void;
  isLoading: boolean;
}) {
  const [authMode, setAuthMode] = useState<"token" | "browser">("token");
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [storageStatePath, setStorageStatePath] = useState("");
  const [browserLoginRunning, setBrowserLoginRunning] = useState(false);
  const [browserLoginError, setBrowserLoginError] = useState<string | null>(null);
  const [browserLoginConfirmPath, setBrowserLoginConfirmPath] = useState<string | null>(null);
  const [browserLoginAwaitingConfirm, setBrowserLoginAwaitingConfirm] = useState(false);

  const handlePickStoragePath = async () => {
    const defaultPath = `canvas.json`;
    const picked = await window.flowstate.app.showSaveDialog({
      title: "Choose Canvas session file",
      defaultPath,
    });
    if (picked) {
      setStorageStatePath(picked);
    }
  };

  const handlePickStorageFolder = async () => {
    const picked = await window.flowstate.app.showOpenDialog({
      title: "Choose folder for Canvas session file",
    });
    if (picked) {
      const normalized = picked.replace(/\/+$/g, "");
      setStorageStatePath(`${normalized}/canvas.json`);
    }
  };

  const canSubmit =
    apiUrl.trim().length > 0 &&
    (authMode === "token"
      ? apiToken.trim().length > 0
      : storageStatePath.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    if (authMode === "browser") {
      setBrowserLoginRunning(true);
      setBrowserLoginError(null);
      const trimmedUrl = apiUrl.trim();
      let trimmedPath = storageStatePath.trim();
      if (trimmedPath && !trimmedPath.endsWith(".json")) {
        trimmedPath = `${trimmedPath.replace(/\/+$/g, "")}/canvas.json`;
      }

      const ensureResult = await window.flowstate.app.ensureFile(trimmedPath);
      if (!ensureResult.success) {
        setBrowserLoginRunning(false);
        setBrowserLoginError(ensureResult.error ?? "Failed to create storage file");
        return;
      }

      const confirmPath = `${trimmedPath}.ready-${Date.now()}`;
      setBrowserLoginConfirmPath(confirmPath);
      setBrowserLoginAwaitingConfirm(true);

      const result = await window.flowstate.canvas.browserLogin({
        canvasApiUrl: trimmedUrl,
        storageStatePath: trimmedPath,
        confirmationFilePath: confirmPath,
      });

      setBrowserLoginRunning(false);
      setBrowserLoginAwaitingConfirm(false);

      if (!result.success) {
        setBrowserLoginError(result.error ?? "Canvas login failed");
        return;
      }

      onSubmit("", {
        canvasApiUrl: trimmedUrl,
        canvasAuthMode: "browser",
        canvasStorageStatePath: trimmedPath,
      });
      return;
    }

    onSubmit(apiToken.trim(), {
      canvasApiUrl: apiUrl.trim(),
      canvasAuthMode: "token",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Inline auth mode selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Canvas authentication
        </label>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => setAuthMode("token")}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
              authMode === "token"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <Key className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">API Token</p>
              <p className="text-xs text-muted-foreground">
                Paste a Canvas access token from Account Settings.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAuthMode("browser")}
            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
              authMode === "browser"
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            }`}
          >
            <Shield className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-foreground">
                Browser Login (No token)
              </p>
              <p className="text-xs text-muted-foreground">
                Use a Playwright storage state file created by the Canvas MCP tool
                <span className="font-mono"> canvas_auth_browser_login</span>.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Instructions */}
      {authMode === "token" ? (
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-foreground mb-2">
            Canvas API Token Setup
          </h3>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Log in to your Canvas LMS instance</li>
            <li>Go to Account → Settings</li>
            <li>Scroll to "Approved Integrations"</li>
            <li>Click "New Access Token"</li>
            <li>Copy the generated token</li>
          </ol>
        </div>
      ) : (
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <h3 className="text-sm font-medium text-foreground mb-2">
            Browser Login Setup
          </h3>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Enter your Canvas URL and choose a storage state path below</li>
            <li>Click "Start Browser Login" to open a Canvas login window</li>
            <li>Complete login (including MFA if needed)</li>
            <li>FlowState will save the session to the storage state path</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-2">
            This avoids storing a token and uses your browser session instead.
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="canvasApiUrl"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Canvas Instance URL
        </label>
        <input
          id="canvasApiUrl"
          type="url"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://your-school.instructure.com"
          className="fs-input"
          required
        />
        <p className="text-xs text-muted-foreground mt-1">
          The URL of your Canvas LMS instance
        </p>
      </div>

      {authMode === "token" ? (
        <div>
          <label
            htmlFor="canvasApiToken"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Canvas API Token
          </label>
          <input
            id="canvasApiToken"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Enter your Canvas API token"
            className="fs-input font-mono text-sm"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Generated from Canvas Settings → Approved Integrations
          </p>
        </div>
      ) : (
        <div>
          <label
            htmlFor="canvasStorageStatePath"
            className="block text-sm font-medium text-foreground mb-1"
          >
            Storage State Path
          </label>
          <input
            id="canvasStorageStatePath"
            type="text"
            value={storageStatePath}
            onChange={(e) => setStorageStatePath(e.target.value)}
            placeholder="/Users/you/Library/Application Support/FlowState/canvas.json"
            className="fs-input font-mono text-sm"
            required
          />
          <button
            type="button"
            onClick={handlePickStoragePath}
            className="mt-2 fs-button-secondary text-xs"
          >
            Pick file location
          </button>
          <button
            type="button"
            onClick={handlePickStorageFolder}
            className="mt-2 fs-button-secondary text-xs"
          >
            Pick folder
          </button>
          <p className="text-xs text-muted-foreground mt-1">
            Absolute path where FlowState will save canvas.json
          </p>
        </div>
      )}

      {authMode === "browser" && browserLoginAwaitingConfirm && browserLoginConfirmPath && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
          <p>
            When you are fully logged in and on your Canvas dashboard, click the button below.
          </p>
          <button
            type="button"
            onClick={async () => {
              const result = await window.flowstate.app.ensureFile(browserLoginConfirmPath);
              if (!result.success) {
                setBrowserLoginError(result.error ?? "Failed to confirm login");
              }
            }}
            className="fs-button-secondary text-xs"
          >
            I am on the dashboard
          </button>
        </div>
      )}

      {browserLoginError && (
        <div className="text-xs text-destructive">
          {browserLoginError}
        </div>
      )}

      <button
        type="submit"
        className="w-full fs-button-primary flex items-center justify-center gap-2"
        disabled={isLoading || browserLoginRunning || !canSubmit}
      >
        {isLoading || browserLoginRunning ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {authMode === "browser" ? "Opening browser..." : "Connecting..."}
          </>
        ) : (
          <>
            {authMode === "token" ? (
              <Key className="w-4 h-4" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            {authMode === "browser" ? "Start Browser Login" : "Connect Canvas LMS"}
          </>
        )}
      </button>
    </form>
  );
}

/**
 * Connection Modal - Handles both OAuth and API Token flows
 */
function ConnectionModal({
  integration,
  onClose,
  onOAuthSubmit,
  onApiTokenSubmit,
  isLoading,
}: {
  integration: Integration;
  onClose: () => void;
  onOAuthSubmit: (service: string, clientId: string, clientSecret: string) => void;
  onApiTokenSubmit: (service: string, apiToken: string, additionalData?: Record<string, string>) => void;
  isLoading: boolean;
}) {
  const [selectedMethod, setSelectedMethod] = useState<AuthMethod | null>(
    integration.authOptions.length === 1
      ? integration.authOptions[0].method
      : null,
  );

  return (
    <div
      className="fs-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fs-modal">
        {/* Header */}
        <div className="fs-modal-header">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{integration.icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Connect {integration.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {integration.description}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="fs-modal-body">
          {/* Auth Method Selector */}
          <AuthMethodSelector
            options={integration.authOptions}
            selected={selectedMethod}
            onSelect={setSelectedMethod}
          />

          {/* Form based on selected method */}
          {selectedMethod === "oauth" && (
            <OAuthForm
              service={integration.id}
              onSubmit={(clientId, clientSecret) => {
                onOAuthSubmit(integration.id, clientId, clientSecret);
                onClose();
              }}
              isLoading={isLoading}
            />
          )}

          {selectedMethod === "api_token" && integration.id === "canvas" && (
            <CanvasConnectionForm
              onSubmit={(apiToken, additionalData) => {
                onApiTokenSubmit(integration.id, apiToken, additionalData);
                onClose();
              }}
              isLoading={isLoading}
            />
          )}

          {selectedMethod === "api_token" && integration.id !== "canvas" && (
            <ApiTokenForm
              onSubmit={(apiToken) => {
                onApiTokenSubmit(integration.id, apiToken);
                onClose();
              }}
              isLoading={isLoading}
            />
          )}
        </div>

        {/* Footer */}
        <div className="fs-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="fs-button-ghost"
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function GcalCalendarsModal({ onClose }: { onClose: () => void }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarListEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedReadIds, setSelectedReadIds] = useState<Set<string>>(new Set());
  const [writeCalendarId, setWriteCalendarId] = useState<string>("primary");
  const [isSaving, setIsSaving] = useState(false);
  const [configPath, setConfigPath] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (!window.flowstate.gcal?.listCalendars) {
          throw new Error(
            "Calendar listing is not available. Restart FlowState after updating."
          );
        }

        const [config, list, path] = await Promise.all([
          window.flowstate.config.get(),
          window.flowstate.gcal.listCalendars(),
          window.flowstate.config.getPath(),
        ]);

        if (!mounted) return;

        const configuredRead = config.integrations?.gcal?.readCalendarIds ?? [];
        const configuredWrite = config.integrations?.gcal?.writeCalendarId;

        setCalendars(list);
        setConfigPath(path);

        const primaryId = list.find((c) => c.primary)?.id ?? "primary";
        const initialReadIds =
          configuredRead.length > 0
            ? configuredRead
            : [primaryId];
        setSelectedReadIds(new Set(initialReadIds));

        const write =
          typeof configuredWrite === "string" && configuredWrite.trim().length > 0
            ? configuredWrite
            : initialReadIds.length === 1
              ? initialReadIds[0]
              : primaryId;
        setWriteCalendarId(write);
      } catch (e) {
        if (!mounted) return;
        const message = e instanceof Error ? e.message : "Failed to load calendars";
        setError(
          message.includes("No handler registered for 'gcal:listCalendars'")
            ? "Calendar listing is not available yet. Restart FlowState after updating."
            : message
        );
      } finally {
        if (!mounted) return;
        setIsLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredCalendars = calendars.filter((c) => {
    const label = (c.summary ?? c.id).toLowerCase();
    return label.includes(query.trim().toLowerCase());
  });

  const primaryId = calendars.find((c) => c.primary)?.id ?? "primary";

  const selectAll = () => {
    setSelectedReadIds(new Set(calendars.map((c) => c.id)));
  };

  const selectPrimaryOnly = () => {
    setSelectedReadIds(new Set([primaryId]));
  };

  const clearSelection = () => {
    setSelectedReadIds(new Set());
  };

  const toggleRead = (id: string) => {
    setSelectedReadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const current = await window.flowstate.config.get();
      const readIds = Array.from(selectedReadIds).filter((id) => id.trim().length > 0);
      const primaryId = calendars.find((c) => c.primary)?.id ?? "primary";

      const normalizedReadIds = readIds.length > 0 ? readIds : undefined;
      const normalizedWriteId =
        writeCalendarId.trim().length > 0 ? writeCalendarId.trim() : primaryId;

      await window.flowstate.config.set({
        integrations: {
          ...(current.integrations ?? {}),
          gcal: {
            readCalendarIds: normalizedReadIds,
            writeCalendarId: normalizedWriteId,
          },
        },
      });

      await window.flowstate.mcp.reload();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save calendar settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fs-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fs-modal">
        <div className="fs-modal-header">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Calendar Selection
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose which calendars FlowState should read for conflicts
              </p>
            </div>
          </div>
        </div>

        <div className="fs-modal-body space-y-4">
          {error && (
            <div className="text-sm text-semantic-denied">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Search calendars
            </label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Schedule, Meetings, ..."
              className="fs-input"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Read calendars
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="fs-button-ghost text-xs"
                disabled={isLoading || isSaving || calendars.length === 0}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={selectPrimaryOnly}
                className="fs-button-ghost text-xs"
                disabled={isLoading || isSaving || calendars.length === 0}
              >
                Primary only
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="fs-button-ghost text-xs"
                disabled={isLoading || isSaving}
              >
                Clear
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedReadIds.size === 0
                  ? "All calendars"
                  : `${selectedReadIds.size} selected`}
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading calendars...
                </div>
              ) : filteredCalendars.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No calendars found
                </div>
              ) : (
                filteredCalendars.map((c) => {
                  const checked = selectedReadIds.has(c.id);
                  const label = c.summary ?? c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleRead(c.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40"
                      disabled={isSaving}
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-foreground truncate">
                          {label}
                          {c.primary ? " (Primary)" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {c.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {checked ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <div className="w-4 h-4 rounded border border-border" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              FlowState uses these calendars for availability checks and conflict detection.
              Clear selection to include all calendars.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Create events in
            </label>
            <select
              className="fs-input"
              value={writeCalendarId}
              onChange={(e) => setWriteCalendarId(e.target.value)}
              disabled={isLoading || isSaving}
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary ?? c.id}{c.primary ? " (Primary)" : ""}
                </option>
              ))}
              {calendars.length === 0 && (
                <option value="primary">Primary</option>
              )}
            </select>
          </div>

          {configPath && (
            <p className="text-xs text-muted-foreground">
              Preferences saved to {configPath}
            </p>
          )}
        </div>

        <div className="fs-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="fs-button-ghost"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="fs-button-primary"
            disabled={isSaving || isLoading}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * IntegrationsMode - Connect and manage external services
 */
interface IntegrationsModeProps {
  onboardingMode?: boolean;
  onReturnToOnboarding?: () => void;
  onOpenSettings?: () => void;
}

interface AddCustomMcpModalProps {
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    commandInput: string;
    envInput: string;
  }) => void;
}

function AddCustomMcpModal({
  isSaving,
  error,
  onClose,
  onSubmit,
}: AddCustomMcpModalProps) {
  const [name, setName] = useState("");
  const [commandInput, setCommandInput] = useState("");
  const [envInput, setEnvInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      commandInput,
      envInput,
    });
  };

  return (
    <div
      className="fs-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="fs-modal">
        <div className="fs-modal-header">
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Add Custom MCP
              </h2>
              <p className="text-sm text-muted-foreground">
                Add a local MCP server command.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="fs-modal-body space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Server name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-custom-mcp"
              className="fs-input"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use letters, numbers, dots, underscores, or hyphens.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Command
            </label>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder='npx -y @modelcontextprotocol/server-filesystem "/Users/you/Documents"'
              className="fs-input font-mono text-sm"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Include the executable and any arguments.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Environment (optional JSON)
            </label>
            <textarea
              value={envInput}
              onChange={(e) => setEnvInput(e.target.value)}
              placeholder='{"API_KEY":"..."}'
              className="fs-input font-mono text-xs min-h-24"
            />
          </div>

          {error ? <p className="text-sm text-semantic-denied">{error}</p> : null}

          <div className="fs-modal-footer">
            <button
              type="button"
              className="fs-button-ghost"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="submit" className="fs-button-primary" disabled={isSaving}>
              {isSaving ? "Adding..." : "Add MCP"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function isBuiltInMcpServer(name: string) {
  return name.startsWith("flowstate-");
}

function parseCommandInput(input: string): string[] {
  const matches = input
    .trim()
    .match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);

  if (!matches) {
    return [];
  }

  return matches
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      if (
        (segment.startsWith('"') && segment.endsWith('"')) ||
        (segment.startsWith("'") && segment.endsWith("'"))
      ) {
        return segment.slice(1, -1);
      }
      return segment;
    });
}

function parseEnvInput(input: string): Record<string, string> | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Environment must be a JSON object");
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error("Environment values must be strings");
    }
    normalized[key] = value;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function IntegrationsMode({
  onboardingMode = false,
  onReturnToOnboarding,
  onOpenSettings,
}: IntegrationsModeProps) {
  const {
    integrations,
    isLoading,
    connectingService,
    onboardingConnectId,
    onboardingConnectNonce,
    setOnboardingConnect,
  } = useIntegrationsStore();

  const {
    connectOAuth,
    connectApiToken,
    disconnect,
    refresh,
  } = useIntegrations({
    onError: (message) => console.error("Integration error:", message),
  });

  const [showModal, setShowModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(null);
  const [showGcalCalendarsModal, setShowGcalCalendarsModal] = useState(false);
  const [customMcps, setCustomMcps] = useState<
    Array<{ name: string; config: MCPServerConfig }>
  >([]);
  const [customMcpLoading, setCustomMcpLoading] = useState(false);
  const [showAddCustomMcpModal, setShowAddCustomMcpModal] = useState(false);
  const [addCustomMcpError, setAddCustomMcpError] = useState<string | null>(null);
  const [addCustomMcpSaving, setAddCustomMcpSaving] = useState(false);

  const loadCustomMcps = async () => {
    if (onboardingMode) return;
    setCustomMcpLoading(true);
    try {
      const config = await window.flowstate.config.get();
      const entries = Object.entries(config.mcpServers ?? {})
        .filter(([name]) => !isBuiltInMcpServer(name))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, mcpConfig]) => ({
          name,
          config: mcpConfig,
        }));
      setCustomMcps(entries);
    } finally {
      setCustomMcpLoading(false);
    }
  };

  useEffect(() => {
    if (!showModal) {
      setSelectedIntegration(null);
    }
  }, [showModal]);

  useEffect(() => {
    if (!onboardingConnectId) return;
    const integration = integrations.find(
      (item) => item.id === onboardingConnectId,
    );
    if (integration) {
      setSelectedIntegration(integration);
      setShowModal(true);
    }
    setOnboardingConnect(null);
  }, [
    integrations,
    onboardingConnectId,
    onboardingConnectNonce,
    setOnboardingConnect,
  ]);

  useEffect(() => {
    loadCustomMcps().catch(() => {
      setCustomMcps([]);
      setCustomMcpLoading(false);
    });
  }, [onboardingMode]);

  // Handlers
  const handleConnect = (integration: Integration) => {
    setSelectedIntegration(integration);
    setShowModal(true);
  };

  const handleOAuthSubmit = async (
    service: string,
    clientId: string,
    clientSecret: string,
  ) => {
    await connectOAuth(service, clientId, clientSecret);
  };

  const handleApiTokenSubmit = async (service: string, apiToken: string, additionalData?: Record<string, string>) => {
    await connectApiToken(service, apiToken, additionalData);
  };

  const handleDisconnect = async (service: string) => {
    await disconnect(service);
  };

  const handleRefresh = () => {
    refresh();
    loadCustomMcps().catch(() => {
      setCustomMcps([]);
      setCustomMcpLoading(false);
    });
  };

  const handleAddCustomMcp = async ({
    name,
    commandInput,
    envInput,
  }: {
    name: string;
    commandInput: string;
    envInput: string;
  }) => {
    const normalizedName = name.trim();

    if (!normalizedName) {
      setAddCustomMcpError("Server name is required");
      return;
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(normalizedName)) {
      setAddCustomMcpError(
        "Server name can only include letters, numbers, dots, underscores, and hyphens",
      );
      return;
    }

    if (isBuiltInMcpServer(normalizedName)) {
      setAddCustomMcpError("Names starting with 'flowstate-' are reserved");
      return;
    }

    const command = parseCommandInput(commandInput);
    if (command.length === 0) {
      setAddCustomMcpError("Command is required");
      return;
    }

    let env: Record<string, string> | undefined;
    try {
      env = parseEnvInput(envInput);
    } catch (error) {
      setAddCustomMcpError(
        error instanceof Error ? error.message : "Invalid environment JSON",
      );
      return;
    }

    setAddCustomMcpError(null);
    setAddCustomMcpSaving(true);

    try {
      const currentConfig = await window.flowstate.config.get();
      if (currentConfig.mcpServers[normalizedName]) {
        setAddCustomMcpError("An MCP with this name already exists");
        return;
      }

      const nextMcpServers: Record<string, MCPServerConfig> = {
        ...currentConfig.mcpServers,
        [normalizedName]: {
          enabled: true,
          command,
          ...(env ? { env } : {}),
        },
      };

      await window.flowstate.config.set({
        mcpServers: nextMcpServers,
      });
      await window.flowstate.mcp.reload();
      await loadCustomMcps();
      setShowAddCustomMcpModal(false);
    } catch (error) {
      setAddCustomMcpError(
        error instanceof Error ? error.message : "Failed to add custom MCP",
      );
    } finally {
      setAddCustomMcpSaving(false);
    }
  };

  // Separate integrations
  const officialIntegrations = integrations.filter((i) => i.isOfficial);

  // Coming soon integrations
  const comingSoonIntegrations = [
    {
      id: "slack",
      name: "Slack",
      description: "Team communication",
      icon: "💬",
    },
    { id: "linear", name: "Linear", description: "Issue tracking", icon: "🎯" },
    {
      id: "obsidian",
      name: "Obsidian",
      description: "Local notes",
      icon: "📝",
    },
  ];

  const formatLastSync = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const IntegrationCard = ({ integration }: { integration: Integration }) => {
    const isConnected = integration.status === "connected";
    const isConnecting =
      integration.status === "connecting" ||
      connectingService === integration.id;
    const hasError = integration.status === "error";

    return (
      <div className="fs-card">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{integration.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground">
                {integration.name}
              </h3>
              {isConnecting ? (
                <span className="fs-badge bg-primary/10 text-primary">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Connecting
                </span>
              ) : isConnected ? (
                <span className="fs-badge-success">
                  <Check className="w-3 h-3 mr-1" />
                  Connected
                </span>
              ) : hasError ? (
                <span className="fs-badge-error">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Error
                </span>
              ) : (
                <span className="fs-badge bg-card text-muted-foreground">
                  Not connected
                </span>
              )}
            </div>

            {isConnected ? (
              <div className="mt-2 space-y-1">
                {integration.email && (
                  <p className="text-sm text-muted-foreground">
                    {integration.email}
                  </p>
                )}
                {integration.activeAuthMethod && (
                  <p className="text-xs text-muted-foreground">
                    via{" "}
                    {integration.activeAuthMethod === "api_token"
                      ? "API Token"
                      : "OAuth"}
                  </p>
                )}
                {integration.lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {formatLastSync(integration.lastSync)}
                  </p>
                )}
              </div>
            ) : hasError && integration.error ? (
              <p className="text-sm text-semantic-denied mt-1">
                {integration.error}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                {integration.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border">
          {isConnected ? (
            <>
              <button
                className="fs-button-ghost text-sm py-1.5 flex items-center gap-1 w-full sm:w-auto"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`}
                />
                Sync
              </button>

              {integration.id === "gcal" && (
                <button
                  className="fs-button-ghost text-sm py-1.5 flex items-center gap-1 w-full sm:w-auto"
                  onClick={() => setShowGcalCalendarsModal(true)}
                  disabled={isLoading}
                >
                  <Settings className="w-3 h-3" />
                  Calendars
                </button>
              )}

              <button
                className="fs-button-ghost text-sm py-1.5 flex items-center gap-1 text-semantic-denied hover:text-semantic-denied w-full sm:w-auto"
                onClick={() => handleDisconnect(integration.id)}
              >
                <X className="w-3 h-3" />
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="fs-button-primary text-sm py-1.5 flex items-center gap-1 w-full sm:w-auto"
              onClick={() => handleConnect(integration)}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ExternalLink className="w-3 h-3" />
              )}
              {isConnecting ? "Connecting..." : "Connect"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto px-10 py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Integrations
            </h1>
            <p className="text-muted-foreground mt-1">
              {onboardingMode
                ? "Connect your apps, then return to continue onboarding"
                : "Connect your apps to FlowState"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="fs-button-ghost flex items-center gap-2"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            {onboardingMode && onReturnToOnboarding && (
              <button
                className="fs-button-primary"
                onClick={onReturnToOnboarding}
              >
                Back to onboarding
              </button>
            )}
          </div>
        </div>

        {/* Official Integrations */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Official Integrations
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {officialIntegrations.map((integration) => (
              <IntegrationCard key={integration.id} integration={integration} />
            ))}
          </div>
        </section>

        {!onboardingMode && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Coming Soon
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingSoonIntegrations.map((item) => (
                <div key={item.id} className="fs-card opacity-60">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h3 className="font-medium text-foreground">{item.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Coming soon
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!onboardingMode && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Custom MCPs
              </h2>
              <button
                className="fs-button-primary text-sm flex items-center gap-1"
                onClick={() => {
                  setAddCustomMcpError(null);
                  setShowAddCustomMcpModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Add MCP
              </button>
            </div>

            {customMcpLoading ? (
              <div className="fs-card text-center py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                Loading custom MCPs...
              </div>
            ) : customMcps.length === 0 ? (
              <div className="fs-card text-center py-8">
                <div className="text-3xl mb-3">🔧</div>
                <h3 className="font-medium text-foreground mb-2">
                  No custom MCPs configured
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Add your own MCP servers to extend FlowState with custom
                  integrations.
                </p>
                <button
                  className="fs-button-ghost text-sm mt-4 flex items-center gap-1 mx-auto"
                  onClick={() =>
                    window.flowstate.app.openExternal(
                      "https://modelcontextprotocol.io/introduction",
                    )
                  }
                >
                  <ExternalLink className="w-3 h-3" />
                  Learn about MCPs
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customMcps.map(({ name, config }) => (
                  <div key={name} className="fs-card">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium text-foreground truncate">
                        {name}
                      </h3>
                      <span
                        className={
                          config.enabled
                            ? "fs-badge-success"
                            : "fs-badge bg-card text-muted-foreground"
                        }
                      >
                        {config.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Command</p>
                    <p className="text-xs font-mono text-foreground break-all mt-1">
                      {config.command?.join(" ") ?? "-"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!onboardingMode && (
          <div className="fs-card bg-muted/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  Integration Settings
                </p>
                <p className="text-sm text-muted-foreground">
                  Configure sync intervals, permissions, and more
                </p>
              </div>
            </div>
            <button
              className="fs-button-ghost text-sm"
              onClick={() => onOpenSettings?.()}
            >
              Open Settings
            </button>
          </div>
        )}

        {/* Connection Modal */}
        {showModal && selectedIntegration && (
          <ConnectionModal
            integration={selectedIntegration}
            onClose={() => {
              setShowModal(false);
              setSelectedIntegration(null);
            }}
            onOAuthSubmit={handleOAuthSubmit}
            onApiTokenSubmit={handleApiTokenSubmit}
            isLoading={connectingService === selectedIntegration.id}
          />
        )}

        {showGcalCalendarsModal && (
          <GcalCalendarsModal
            onClose={() => setShowGcalCalendarsModal(false)}
          />
        )}

        {showAddCustomMcpModal && (
          <AddCustomMcpModal
            isSaving={addCustomMcpSaving}
            error={addCustomMcpError}
            onClose={() => {
              if (addCustomMcpSaving) return;
              setShowAddCustomMcpModal(false);
            }}
            onSubmit={handleAddCustomMcp}
          />
        )}
      </div>
    </div>
  );
}

export default IntegrationsMode;

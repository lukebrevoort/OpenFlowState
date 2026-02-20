import { useEffect, useState } from "react";
import { Clock, Palette, Cpu, Globe, Shield, Bell, RotateCcw, BookOpen, BarChart3, Download } from "lucide-react";
import { useConfig } from "../hooks/useConfig";
import type { FlowstateConfig, WorkflowDefinition } from "../types/electron";

const STUDY_METRICS_RECENT_LIMIT = 12;

interface StudyMaterialMetrics {
  citationCoverage: number;
  rerunFrequency: number;
  acceptanceRate: number;
  totalRuns: number;
  completedRuns: number;
  uniqueCourseCount: number;
  recentRunSampleSize: number;
  calculatedAtIso: string;
}

export function SettingsPage() {
  const { config, isLoaded, loadConfig, updateConfig } = useConfig();
  const [timezone, setTimezone] = useState("America/New_York");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [modelInput, setModelInput] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(false);
  const [resetStatus, setResetStatus] = useState<"idle" | "done">("idle");
  const resetLabel = resetStatus === "done" ? "Reset" : "Reset now";

  const [approvalGrants, setApprovalGrants] = useState<
    Array<{ workflowId: string; title?: string }>
  >([]);
  const [approvalGrantsLoading, setApprovalGrantsLoading] = useState(false);
  const [approvalGrantsError, setApprovalGrantsError] = useState<string | null>(null);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [studyMetrics, setStudyMetrics] = useState<StudyMaterialMetrics | null>(null);
  const [studyMetricsLoading, setStudyMetricsLoading] = useState(false);
  const [studyMetricsError, setStudyMetricsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      loadConfig().catch((error) => {
        console.error("Failed to load config", error);
      });
    }
  }, [isLoaded, loadConfig]);

  useEffect(() => {
    if (!config) return;

    setTimezone(config.preferences.timezone ?? "America/New_York");
    setModelInput(config.provider.default ?? "");
  }, [config]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const loadApprovalGrants = async () => {
    const listFn = window.flowstate?.workflows?.listApprovalOptIns;
    if (!listFn) return;

    setApprovalGrantsLoading(true);
    setApprovalGrantsError(null);
    try {
      const [optInsResult, workflowsResult] = await Promise.all([
        listFn(),
        window.flowstate?.workflows?.list?.(),
      ]);

      if (!optInsResult.ok) {
        setApprovalGrants([]);
        setApprovalGrantsError(optInsResult.error.message);
        return;
      }

      const titleById = new Map<string, string>();
      if (workflowsResult && "ok" in workflowsResult && workflowsResult.ok) {
        (workflowsResult.data as WorkflowDefinition[]).forEach((workflow) => {
          titleById.set(workflow.id, workflow.title);
        });
      }

      const grantedIds = Object.entries(optInsResult.data)
        .filter(([, optedIn]) => Boolean(optedIn))
        .map(([workflowId]) => workflowId);

      const next = grantedIds
        .map((workflowId) => ({
          workflowId,
          title: titleById.get(workflowId),
        }))
        .sort((a, b) => (a.title ?? a.workflowId).localeCompare(b.title ?? b.workflowId));

      setApprovalGrants(next);
    } catch (error) {
      console.error("Failed to load approval grants", error);
      setApprovalGrants([]);
      setApprovalGrantsError("Failed to load approval grants.");
    } finally {
      setApprovalGrantsLoading(false);
    }
  };

  useEffect(() => {
    loadApprovalGrants().catch(() => {});
  }, []);

  const handleRevokeApprovalGrant = async (workflowId: string) => {
    const setFn = window.flowstate?.workflows?.setApprovalOptIn;
    if (!setFn) return;

    setRevokingGrantId(workflowId);
    setApprovalGrantsError(null);
    try {
      const result = await setFn(workflowId, false);
      if (!result.ok) {
        setApprovalGrantsError(result.error.message);
        return;
      }
      await loadApprovalGrants();
    } catch (error) {
      console.error("Failed to revoke approval grant", error);
      setApprovalGrantsError("Failed to revoke approval grant.");
    } finally {
      setRevokingGrantId(null);
    }
  };

  const handleResetOnboarding = async () => {
    try {
      await window.flowstate.config.set({ onboardingComplete: false });
      setResetStatus("done");
      window.setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      console.error("Failed to reset onboarding", error);
    }
  };

  const timezones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ];
  const normalizedModelInput = modelInput.trim();
  const hasModelOptions = availableModels.length > 0;
  const isModelValid = !hasModelOptions || availableModels.includes(normalizedModelInput);

  const handleTimezoneChange = async (nextTimezone: string) => {
    setTimezone(nextTimezone);
    if (!config) return;
    try {
      await updateConfig({
        preferences: {
          ...config.preferences,
          timezone: nextTimezone,
        },
      });
    } catch (error) {
      console.error("Failed to update timezone", error);
    }
  };

  const reduceMotionPreference = config?.preferences.reduceMotion;
  const effectiveReduceMotion = reduceMotionPreference ?? systemPrefersReducedMotion;
  const backgroundMotionPreference = config?.preferences.backgroundMotion ?? "animated";
  const notificationPreferences = config?.preferences.notifications;
  const approvalsNotificationsEnabled = notificationPreferences?.approvals ?? true;
  const taskCompletionNotificationsEnabled = notificationPreferences?.taskComplete ?? true;
  const studyMaterialPreferences = config?.preferences.studyMaterials;
  const externalKnowledgeAllowlistEnabled =
    studyMaterialPreferences?.externalKnowledgeAllowlistEnabled ?? false;
  const defaultGenerationMode =
    studyMaterialPreferences?.defaultGenerationMode ?? "conservative";
  const maxConcurrentRuns = Math.min(
    3,
    Math.max(1, studyMaterialPreferences?.maxConcurrentRuns ?? 2)
  );
  const globalRetentionDays = Math.max(
    1,
    studyMaterialPreferences?.retention?.globalRetentionDays ?? 30
  );
  const perCourseRetentionEnabled =
    studyMaterialPreferences?.retention?.perCourseRetentionEnabled ?? true;

  const updateStudyMaterialPreferences = async (
    patch: Partial<
      NonNullable<FlowstateConfig["preferences"]["studyMaterials"]>
    >
  ) => {
    if (!config) return;

    const current = config.preferences.studyMaterials;
    const nextRetention = {
      globalRetentionDays:
        patch.retention?.globalRetentionDays ??
        current?.retention?.globalRetentionDays ??
        30,
      perCourseRetentionEnabled:
        patch.retention?.perCourseRetentionEnabled ??
        current?.retention?.perCourseRetentionEnabled ??
        true,
    };

    try {
      await updateConfig({
        preferences: {
          ...config.preferences,
          studyMaterials: {
            externalKnowledgeAllowlistEnabled:
              patch.externalKnowledgeAllowlistEnabled ??
              current?.externalKnowledgeAllowlistEnabled ??
              false,
            defaultGenerationMode:
              patch.defaultGenerationMode ??
              current?.defaultGenerationMode ??
              "conservative",
            maxConcurrentRuns:
              patch.maxConcurrentRuns ?? current?.maxConcurrentRuns ?? 2,
            retention: nextRetention,
          },
        },
      });
    } catch (error) {
      console.error("Failed to update study material preferences", error);
    }
  };

  const handleToggleReducedMotion = async () => {
    if (!config) return;

    const current = reduceMotionPreference ?? systemPrefersReducedMotion;
    const next = !current;

    try {
      await updateConfig({
        preferences: {
          ...config.preferences,
          reduceMotion: next,
        },
      });
    } catch (error) {
      console.error("Failed to update reduced motion", error);
    }
  };

  const handleUseSystemReducedMotion = async () => {
    if (!config) return;
    try {
      await updateConfig({
        preferences: {
          ...config.preferences,
          reduceMotion: undefined,
        },
      });
    } catch (error) {
      console.error("Failed to reset reduced motion preference", error);
    }
  };

  const handleToggleBackgroundMotion = async () => {
    if (!config) return;
    const next = backgroundMotionPreference === "animated" ? "static" : "animated";
    try {
      await updateConfig({
        preferences: {
          ...config.preferences,
          backgroundMotion: next,
        },
      });
    } catch (error) {
      console.error("Failed to update background motion", error);
    }
  };

  const handleResetBackgroundMotion = async () => {
    if (!config) return;
    try {
      await updateConfig({
        preferences: {
          ...config.preferences,
          backgroundMotion: undefined,
        },
      });
    } catch (error) {
      console.error("Failed to reset background motion preference", error);
    }
  };

  const handleToggleTaskCompletionNotifications = async () => {
    if (!config) return;
    try {
      await updateConfig({
        preferences: {
          ...config.preferences,
          notifications: {
            ...config.preferences.notifications,
            taskComplete: !taskCompletionNotificationsEnabled,
          },
        },
      });
    } catch (error) {
      console.error("Failed to update task completion notifications", error);
    }
  };

  const handleToggleApprovalNotifications = async () => {
    if (!config) return;
    try {
      await updateConfig({
        preferences: {
          ...config.preferences,
          notifications: {
            ...config.preferences.notifications,
            approvals: !approvalsNotificationsEnabled,
          },
        },
      });
    } catch (error) {
      console.error("Failed to update approval notifications", error);
    }
  };

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
  const formatDecimal = (value: number) => value.toFixed(2);

  const downloadBlob = (fileName: string, mimeType: string, content: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const loadStudyMaterialMetrics = async () => {
    const studyMaterialsApi = window.flowstate?.studyMaterials;
    if (!studyMaterialsApi) {
      setStudyMetrics(null);
      setStudyMetricsError("Study materials API is unavailable.");
      return;
    }

    setStudyMetricsLoading(true);
    setStudyMetricsError(null);
    try {
      const runsResult = await studyMaterialsApi.listRuns({
        limit: 100,
        offset: 0,
      });

      if (!runsResult.ok) {
        setStudyMetrics(null);
        setStudyMetricsError(runsResult.error.message);
        return;
      }

      const runs = runsResult.data;
      const completedRuns = runs.filter((run) => run.status === "completed");
      const recentRuns = completedRuns.slice(0, STUDY_METRICS_RECENT_LIMIT);

      const citationResults = await Promise.all(
        recentRuns.map((run) => studyMaterialsApi.listCitations({ studyRunId: run.id }))
      );

      const citationPresenceRatios = citationResults.map((result) => {
        if (!result.ok) {
          throw new Error(result.error.message);
        }
        return Number(result.data.length > 0);
      });

      const citationCoverage =
        citationPresenceRatios.length > 0
          ? citationPresenceRatios.reduce((sum, value) => sum + value, 0) /
            citationPresenceRatios.length
          : 0;

      const uniqueCourseCount = new Set(runs.map((run) => run.courseId)).size;
      const rerunFrequency = uniqueCourseCount > 0 ? runs.length / uniqueCourseCount : 0;
      const acceptanceRate = runs.length > 0 ? completedRuns.length / runs.length : 0;

      setStudyMetrics({
        citationCoverage,
        rerunFrequency,
        acceptanceRate,
        totalRuns: runs.length,
        completedRuns: completedRuns.length,
        uniqueCourseCount,
        recentRunSampleSize: recentRuns.length,
        calculatedAtIso: new Date().toISOString(),
      });
    } catch (error) {
      setStudyMetrics(null);
      setStudyMetricsError(
        error instanceof Error ? error.message : "Failed to compute study material metrics."
      );
    } finally {
      setStudyMetricsLoading(false);
    }
  };

  useEffect(() => {
    loadStudyMaterialMetrics().catch(() => {});
  }, []);

  const exportStudyMetricsJson = () => {
    if (!studyMetrics) return;

    downloadBlob(
      "study-material-metrics.json",
      "application/json;charset=utf-8",
      `${JSON.stringify(studyMetrics, null, 2)}\n`
    );
  };

  const exportStudyMetricsCsv = () => {
    if (!studyMetrics) return;

    const headers = [
      "citationCoverage",
      "rerunFrequency",
      "acceptanceRate",
      "recentRunSampleSize",
      "totalRuns",
      "completedRuns",
      "uniqueCourseCount",
      "calculatedAtIso",
    ];
    const row = [
      studyMetrics.citationCoverage.toFixed(4),
      studyMetrics.rerunFrequency.toFixed(4),
      studyMetrics.acceptanceRate.toFixed(4),
      String(studyMetrics.recentRunSampleSize),
      String(studyMetrics.totalRuns),
      String(studyMetrics.completedRuns),
      String(studyMetrics.uniqueCourseCount),
      studyMetrics.calculatedAtIso,
    ];

    const csv = `${headers.join(",")}\n${row.join(",")}\n`;
    downloadBlob("study-material-metrics.csv", "text/csv;charset=utf-8", csv);
  };

  const ToggleSwitch = ({
    checked,
    onToggle,
    disabled,
    label,
  }: {
    checked: boolean;
    onToggle: () => void;
    disabled?: boolean;
    label: string;
  }) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        disabled={disabled}
        className={`relative w-12 h-6 border border-border rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-switch-background"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-0"
          }`}
        />
      </button>
    );
  };
  const loadModelOptions = async () => {
    if (!window.flowstate?.opencode?.listModels) return;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const models = await window.flowstate.opencode.listModels();
      setAvailableModels(models);
    } catch (error) {
      console.error("Failed to load OpenCode models", error);
      setModelsError("Unable to load models. Try refreshing.");
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    loadModelOptions().catch(() => {});
  }, []);

  const handleModelSave = async () => {
    if (!config) return;
    const nextModel = normalizedModelInput;
    if (!nextModel || !isModelValid) return;
    if (config.provider.default === nextModel) return;

    try {
      await updateConfig({
        provider: {
          default: nextModel,
          apiKeys: config.provider.apiKeys ?? {},
        },
      });
      await window.flowstate.opencode.restart();
    } catch (error) {
      console.error("Failed to update model selection", error);
    }
  };

  const handleProviderSetup = async () => {
    try {
      if (typeof window.flowstate.app.openTerminal === "function") {
        await window.flowstate.app.openTerminal("opencode auth login");
      } else {
        await window.flowstate.app.openExternal(
          `terminal://${encodeURIComponent("opencode auth login")}`
        );
      }
    } catch (error) {
      console.error("Failed to open provider setup", error);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl text-foreground mb-2">Settings</h2>
          <p className="text-muted-foreground">
            Customize your FlowState experience
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-5 h-5 text-primary" />
              <h3 className="text-xl text-foreground">General</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm text-foreground mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => handleTimezoneChange(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-foreground mb-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <BookOpen className="w-5 h-5 text-primary" />
              <h3 className="text-xl text-foreground">Study Materials</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm text-foreground">External knowledge mode</p>
                  <p className="text-xs text-muted-foreground">
                    When enabled, external knowledge usage follows your allowlist policy.
                  </p>
                </div>
                <ToggleSwitch
                  checked={externalKnowledgeAllowlistEnabled}
                  onToggle={() => {
                    void updateStudyMaterialPreferences({
                      externalKnowledgeAllowlistEnabled: !externalKnowledgeAllowlistEnabled,
                    });
                  }}
                  disabled={!config}
                  label="External knowledge mode"
                />
              </div>

              <div>
                <label className="text-sm text-foreground mb-2 block">Default generation mode</label>
                <select
                  value={defaultGenerationMode}
                  onChange={(event) => {
                    void updateStudyMaterialPreferences({
                      defaultGenerationMode: event.target.value as "conservative" | "coaching",
                    });
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={!config}
                >
                  <option value="conservative">Conservative</option>
                  <option value="coaching">Coaching</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-foreground mb-2 block">Max concurrent study runs</label>
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={maxConcurrentRuns}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    if (!Number.isFinite(parsed)) return;
                    const clamped = Math.min(3, Math.max(1, Math.trunc(parsed)));
                    updateStudyMaterialPreferences({ maxConcurrentRuns: clamped }).catch(() => {});
                  }}
                  className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={!config}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm text-foreground mb-2 block">Global retention days</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={globalRetentionDays}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      if (!Number.isFinite(parsed)) return;
                      const clamped = Math.max(1, Math.trunc(parsed));
                      updateStudyMaterialPreferences({
                        retention: { globalRetentionDays: clamped },
                      }).catch(() => {});
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={!config}
                  />
                </div>

                <div className="flex items-start justify-between rounded-lg border border-border bg-muted/10 p-3">
                  <div className="pr-4">
                    <p className="text-sm text-foreground">Per-course retention</p>
                    <p className="text-xs text-muted-foreground">
                      Allow per-course retention rules in addition to global retention.
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={perCourseRetentionEnabled}
                    onToggle={() => {
                      void updateStudyMaterialPreferences({
                        retention: {
                          perCourseRetentionEnabled: !perCourseRetentionEnabled,
                        },
                      });
                    }}
                    disabled={!config}
                    label="Per-course retention"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="text-xl text-foreground">Study Materials Metrics</h3>
              </div>
              <button
                type="button"
                onClick={() => loadStudyMaterialMetrics()}
                className="fs-button-secondary text-xs px-3 py-1.5"
                disabled={studyMetricsLoading}
              >
                {studyMetricsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {studyMetricsError ? (
              <p className="text-xs text-destructive">{studyMetricsError}</p>
            ) : null}

            {studyMetrics ? (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/10 p-4">
                    <p className="text-xs text-muted-foreground">Citation coverage (recent)</p>
                    <p className="mt-1 text-2xl text-foreground font-semibold">
                      {formatPercent(studyMetrics.citationCoverage)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Based on {studyMetrics.recentRunSampleSize} recent completed runs.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/10 p-4">
                    <p className="text-xs text-muted-foreground">Rerun frequency</p>
                    <p className="mt-1 text-2xl text-foreground font-semibold">
                      {formatDecimal(studyMetrics.rerunFrequency)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Runs per active course.</p>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/10 p-4">
                    <p className="text-xs text-muted-foreground">User acceptance rate</p>
                    <p className="mt-1 text-2xl text-foreground font-semibold">
                      {formatPercent(studyMetrics.acceptanceRate)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {studyMetrics.completedRuns} completed of {studyMetrics.totalRuns} total runs.
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={exportStudyMetricsJson}
                    className="fs-button-secondary flex items-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={exportStudyMetricsCsv}
                    className="fs-button-secondary flex items-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <p className="text-xs text-muted-foreground">
                    Local-only export. Last updated {new Date(studyMetrics.calculatedAtIso).toLocaleString()}.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {studyMetricsLoading ? "Calculating study material metrics..." : "No study material run data available yet."}
              </p>
            )}
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Palette className="w-5 h-5 text-primary" />
              <h3 className="text-xl text-foreground">Appearance</h3>
            </div>

            <div>
              <label className="text-sm text-foreground mb-3 block">
                Theme
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all duration-300 ease-in-out ${
                    theme === "light"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border/60"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#FFFDFB] to-[#F5F1EB] border border-border shadow-sm" />
                    <span className="text-sm text-foreground">Light</span>
                    {theme === "light" && (
                      <span className="text-xs text-muted-foreground">
                        (Current)
                      </span>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setTheme("dark")}
                  className={`flex-1 px-6 py-4 rounded-lg border-2 transition-all duration-300 ease-in-out ${
                    theme === "dark"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border/60"
                  }`}
                  disabled
                >
                  <div className="flex flex-col items-center gap-2 opacity-50">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] border border-border shadow-sm" />
                    <span className="text-sm text-foreground">Dark</span>
                    <span className="text-xs text-muted-foreground">
                      (Coming Soon)
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Cpu className="w-5 h-5 text-primary" />
              <h3 className="text-xl text-foreground">Motion & Performance</h3>
            </div>

            <div className="space-y-5">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm text-foreground">Reduced motion / Low power</p>
                  <p className="text-xs text-muted-foreground">
                    Disables decorative animations and reduces blur effects.
                    {reduceMotionPreference === undefined
                      ? ` Following system (${systemPrefersReducedMotion ? "On" : "Off"}).`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch
                    checked={effectiveReduceMotion}
                    onToggle={handleToggleReducedMotion}
                    disabled={!config}
                    label="Reduced motion / Low power"
                  />
                  {reduceMotionPreference !== undefined && (
                    <button
                      type="button"
                      onClick={handleUseSystemReducedMotion}
                      className="fs-button-secondary text-xs px-3 py-1.5"
                    >
                      Use system
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm text-foreground">Background motion</p>
                  <p className="text-xs text-muted-foreground">
                    Animate the ambient background. Turn off for a static background.
                    {effectiveReduceMotion ? " Disabled while Reduced motion is on." : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch
                    checked={!effectiveReduceMotion && backgroundMotionPreference === "animated"}
                    onToggle={handleToggleBackgroundMotion}
                    disabled={!config || effectiveReduceMotion}
                    label="Background motion"
                  />
                  {config?.preferences.backgroundMotion !== undefined && (
                    <button
                      type="button"
                      onClick={handleResetBackgroundMotion}
                      className="fs-button-secondary text-xs px-3 py-1.5"
                      disabled={!config}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Cpu className="w-5 h-5 text-primary" />
              <h3 className="text-xl text-foreground">AI Model</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm text-foreground mb-2 block">
                  Model ID
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    placeholder="opencode/gpt-5-nano"
                    list="opencode-model-options"
                    className="flex-1 min-w-[240px] px-4 py-2 rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={handleModelSave}
                    className="px-4 py-2 rounded-lg border border-border bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out text-sm shadow-sm"
                    disabled={!config || !normalizedModelInput || !isModelValid}
                  >
                    Save
                  </button>
                  <button
                    onClick={loadModelOptions}
                    className="px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-all duration-300 ease-in-out text-sm shadow-sm"
                    disabled={modelsLoading}
                  >
                    {modelsLoading ? "Refreshing..." : "Refresh models"}
                  </button>
                </div>
                <datalist id="opencode-model-options">
                  {availableModels.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
                <div className="mt-2 text-xs text-muted-foreground">
                  {modelsError ??
                    (hasModelOptions
                      ? `${availableModels.length} models available from OpenCode.`
                      : "Run 'opencode models' to register providers and models.")}
                </div>
                {!isModelValid && (
                  <p className="mt-2 text-xs text-destructive">
                    That model isn't configured. Choose one from your OpenCode models list.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleProviderSetup}
                  className="px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-all duration-300 ease-in-out text-sm shadow-sm"
                >
                  Reconnect providers
                </button>
                <p className="text-xs text-muted-foreground">
                  Runs <span className="font-mono">opencode auth login</span> so you can add providers again.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="text-xl text-foreground">Privacy & Security</h3>
            </div>

            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-foreground">Approval grants</p>
                    <p className="text-xs text-muted-foreground">
                      Workflows you set to Always Approve can skip permission prompts. Revoke any time.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadApprovalGrants()}
                    className="fs-button-secondary text-xs px-3 py-1.5"
                    disabled={approvalGrantsLoading}
                  >
                    {approvalGrantsLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {approvalGrantsError ? (
                  <p className="mt-2 text-xs text-destructive">{approvalGrantsError}</p>
                ) : null}

                {approvalGrantsLoading ? (
                  <p className="mt-3 text-xs text-muted-foreground">Loading...</p>
                ) : approvalGrants.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">No stored approval grants.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {approvalGrants.map((grant) => (
                      <div
                        key={grant.workflowId}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card/60 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {grant.title ?? grant.workflowId}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate font-mono">
                            {grant.workflowId}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeApprovalGrant(grant.workflowId)}
                          disabled={revokingGrantId === grant.workflowId}
                          className="fs-button-secondary text-xs px-3 py-1.5 flex-shrink-0"
                        >
                          {revokingGrantId === grant.workflowId ? "Revoking..." : "Revoke"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">
                    Auto-save conversations
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Automatically save chat history locally
                  </p>
                </div>
                <button className="relative w-12 h-6 border border-border rounded-full bg-primary transition-colors">
                  <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white transition-transform" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <RotateCcw className="w-5 h-5 text-primary" />
              <h3 className="text-xl text-foreground">Debugging</h3>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground">Reset onboarding</p>
                <p className="text-xs text-muted-foreground">
                  Re-run the onboarding flow for testing.
                </p>
              </div>
              <button
                onClick={handleResetOnboarding}
                className="fs-button-secondary flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {resetLabel}
              </button>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="text-xl text-foreground">Notifications</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Approval requests</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified when an action needs your approval
                  </p>
                </div>
                <ToggleSwitch
                  checked={approvalsNotificationsEnabled}
                  onToggle={handleToggleApprovalNotifications}
                  disabled={!config}
                  label="Approval requests"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Task completion alerts</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified when tasks finish
                  </p>
                </div>
                <ToggleSwitch
                  checked={taskCompletionNotificationsEnabled}
                  onToggle={handleToggleTaskCompletionNotifications}
                  disabled={!config}
                  label="Task completion alerts"
                />
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl text-foreground mb-4">About FlowState</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Version 1.0.0</p>
              <p>© 2026 FlowState. All rights reserved.</p>
              <div className="flex gap-4 mt-4">
                <a href="#" className="text-primary hover:underline">
                  Documentation
                </a>
                <a href="#" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                <a href="#" className="text-primary hover:underline">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

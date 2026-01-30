import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Zap,
  Shield,
  Brain,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Integration } from "../stores/integrationsStore";
import type { AuthStatus } from "../types/electron";

type OnboardingStep = "welcome" | "apps" | "connect" | "provider" | "wow";

interface OnboardingFlowProps {
  currentStep: OnboardingStep;
  onStepChange: (step: OnboardingStep) => void;
  selectedApps: string[];
  onToggleApp: (appId: string) => void;
  integrations: Integration[];
  authStatuses: Record<string, AuthStatus | undefined>;
  providerOptions: ProviderOption[];
  selectedProvider: ProviderOption;
  selectedModel: string;
  onSelectProvider: (providerId: string) => void;
  onSelectModel: (model: string) => void;
  onStartProviderSetup: () => void;
  wowPrompts: string[];
  selectedWowPrompt: string | null;
  onSelectWowPrompt: (prompt: string) => void;
  onFinish: () => void;
  onSkipWow: () => void;
  onConnectIntegration: (integrationId: string) => void;
}

interface ProviderOption {
  id: string;
  name: string;
  description: string;
  models: string[];
  badge?: string;
}

const stepOrder: OnboardingStep[] = [
  "welcome",
  "apps",
  "connect",
  "provider",
  "wow",
];

const stepLabels: Record<OnboardingStep, string> = {
  welcome: "Welcome",
  apps: "Your Apps",
  connect: "Connect",
  provider: "Provider",
  wow: "Wow Moment",
};

const appHighlights: Record<string, string> = {
  notion: "Projects, tasks, and docs",
  gmail: "Email triage + drafts",
  gcal: "Scheduling and conflicts",
  canvas: "Assignments and course deadlines",
};

const appColors: Record<string, string> = {
  notion: "#C87137",
  gmail: "#3E2F27",
  gcal: "#A5B574",
  canvas: "#C45B4A",
};

const onboardingSplashHighlights = [
  { label: "Progressive autonomy", value: "Approvals built in" },
  { label: "Local-first", value: "Your data stays here" },
  { label: "Model agnostic", value: "OpenCode compatible" },
];

const welcomeHighlights = [
  {
    title: "Connect your tools",
    detail: "Bring email, docs, and calendar into one view.",
    icon: <Zap className="h-5 w-5 text-white" />,
    color: "#C87137",
  },
  {
    title: "Stay in control",
    detail: "Approve anything risky before it happens.",
    icon: <Shield className="h-5 w-5 text-white" />,
    color: "#3E2F27",
  },
  {
    title: "See the magic",
    detail: "Get an instant wow moment with guided prompts.",
    icon: <Sparkles className="h-5 w-5 text-white" />,
    color: "#A5B574",
  },
];

function StepIndicator({
  currentStep,
  onStepChange,
}: {
  currentStep: OnboardingStep;
  onStepChange: (step: OnboardingStep) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {stepOrder.map((step, index) => {
        const isActive = step === currentStep;
        const isComplete = stepOrder.indexOf(currentStep) > index;

        return (
          <button
            key={step}
            type="button"
            onClick={() => onStepChange(step)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all duration-300 ease-in-out ${
              isActive
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                isComplete
                  ? "bg-[#A5B574] text-white"
                  : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
            </span>
            {stepLabels[step]}
          </button>
        );
      })}
    </div>
  );
}

function StepCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-card/85 backdrop-blur-xl border border-border rounded-3xl p-8 shadow-flowstate-lg">
      <div className="mb-6">
        <h2 className="text-3xl text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground text-base">{description}</p>
      </div>
      <div className="space-y-6">{children}</div>
      {footer && <div className="mt-8">{footer}</div>}
    </div>
  );
}

export function OnboardingFlow({
  currentStep,
  onStepChange,
  selectedApps,
  onToggleApp,
  integrations,
  authStatuses,
  providerOptions,
  selectedProvider,
  selectedModel,
  onSelectProvider,
  onSelectModel,
  onStartProviderSetup,
  wowPrompts,
  selectedWowPrompt,
  onSelectWowPrompt,
  onFinish,
  onSkipWow,
  onConnectIntegration,
}: OnboardingFlowProps) {
  const currentIndex = stepOrder.indexOf(currentStep);
  const goNext = () => {
    if (currentIndex < stepOrder.length - 1) {
      onStepChange(stepOrder[currentIndex + 1]);
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      onStepChange(stepOrder[currentIndex - 1]);
    }
  };

  const connectedCount = integrations.filter(
    (integration) => authStatuses[integration.id]?.connected,
  ).length;

  const selectedIntegrations = integrations.filter((integration) =>
    selectedApps.includes(integration.id),
  );

  return (
    <div className="h-full overflow-y-auto px-6 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground mb-3">
            FlowState Setup
          </p>
          <StepIndicator currentStep={currentStep} onStepChange={onStepChange} />
        </div>

        {currentStep === "welcome" && (
          <StepCard
            title="Welcome to FlowState"
            description="Your calm command center for everything you do online."
            footer={
              <div className="flex flex-wrap gap-3 justify-center">
                <button type="button" className="fs-button-ghost">
                  Watch 30s tour
                </button>
                <button
                  type="button"
                  className="fs-button-primary inline-flex items-center gap-2"
                  onClick={goNext}
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              {welcomeHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border bg-card/80 p-5 shadow-sm"
                >
                  <div
                    className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.icon}
                  </div>
                  <h3 className="text-lg text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {onboardingSplashHighlights.map((highlight) => (
                <div
                  key={highlight.label}
                  className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {highlight.label}
                  </p>
                  <p className="text-foreground mt-1">{highlight.value}</p>
                </div>
              ))}
            </div>
          </StepCard>
        )}

        {currentStep === "apps" && (
          <StepCard
            title="What apps do you use?"
            description="Select the tools you want FlowState to connect."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="fs-button-ghost" onClick={goBack}>
                  Back
                </button>
                <button
                  type="button"
                  className="fs-button-primary inline-flex items-center gap-2"
                  onClick={goNext}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-3">
              {integrations.map((integration) => {
                const isSelected = selectedApps.includes(integration.id);
                const highlight = appHighlights[integration.id] ?? integration.description;

                return (
                  <button
                    key={integration.id}
                    type="button"
                    onClick={() => onToggleApp(integration.id)}
                    className={`rounded-2xl border px-5 py-4 text-left transition-all duration-300 ease-in-out ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/70 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg text-foreground">
                        {integration.icon} {integration.name}
                      </span>
                      <span
                        className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {highlight}
                    </p>
                  </button>
                );
              })}
            </div>
          </StepCard>
        )}

        {currentStep === "connect" && (
          <StepCard
            title="Connect your apps"
            description="FlowState can guide you through each connection."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="fs-button-ghost" onClick={goBack}>
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" className="fs-button-ghost" onClick={goNext}>
                    Skip for now
                  </button>
                  <button
                    type="button"
                    className="fs-button-primary inline-flex items-center gap-2"
                    onClick={goNext}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            }
          >
            {selectedIntegrations.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
                No apps selected yet. Go back to choose at least one integration.
              </div>
            ) : (
              <div className="space-y-4">
                {selectedIntegrations.map((integration) => {
                  const status = authStatuses[integration.id];
                  const isConnected = status?.connected;
                  const color = appColors[integration.id] ?? "#C87137";

                  return (
                    <div
                      key={integration.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/80 px-5 py-4"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                          style={{ backgroundColor: color }}
                        >
                          {integration.icon}
                        </div>
                        <div>
                          <p className="text-base text-foreground">
                            {integration.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {integration.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isConnected ? (
                          <span className="fs-badge-success">Connected</span>
                        ) : (
                          <span className="fs-badge-warning">Not connected</span>
                        )}
                        <button
                          type="button"
                          className={
                            isConnected
                              ? "fs-button-ghost"
                              : "fs-button-primary"
                          }
                          onClick={() => onConnectIntegration(integration.id)}
                        >
                          {isConnected ? "Manage" : "Connect"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              {connectedCount === 0
                ? "No connections yet. You can continue and connect later."
                : `${connectedCount} integration${
                    connectedCount === 1 ? "" : "s"
                  } ready to go.`}
            </div>
            <div className="rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
              You can manage each connection later in the Integrations tab.
            </div>
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              To connect right now, open the Integrations tab after onboarding.
            </div>
          </StepCard>
        )}

        {currentStep === "provider" && (
          <StepCard
            title="Choose your AI provider"
            description="Pick the model you want FlowState to use by default."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="fs-button-ghost" onClick={goBack}>
                  Back
                </button>
                <button
                  type="button"
                  className="fs-button-primary inline-flex items-center gap-2"
                  onClick={goNext}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              {providerOptions.map((provider) => {
                const isSelected = provider.id === selectedProvider.id;

                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => onSelectProvider(provider.id)}
                    className={`rounded-2xl border px-5 py-4 text-left transition-all duration-300 ease-in-out ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/70 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base text-foreground flex items-center gap-2">
                          {provider.name}
                          {provider.badge && (
                            <span className="fs-badge-success">{provider.badge}</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {provider.description}
                        </p>
                      </div>
                      <span
                        className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      Default model: <span className="text-foreground">{provider.models[0]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-4">
              <div>
                <label className="text-sm text-foreground block mb-2">Model</label>
                <select
                  value={selectedModel}
                  onChange={(event) => onSelectModel(event.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {selectedProvider.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-2">
                  These IDs match the output of `opencode models`.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <p className="text-foreground font-medium mb-1">Provider setup</p>
                <p>
                  We’ll open OpenCode’s provider setup so you can sign in or paste
                  API keys.
                </p>
                <button
                  type="button"
                  className="fs-button-secondary mt-3"
                  onClick={onStartProviderSetup}
                >
                  Open provider setup in Terminal
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <Brain className="h-4 w-4 text-primary" />
              You can update provider settings any time in Settings.
            </div>
          </StepCard>
        )}

        {currentStep === "wow" && (
          <StepCard
            title="Pick your first wow moment"
            description="Try a guided prompt to see FlowState in action."
            footer={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="fs-button-ghost" onClick={goBack}>
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button type="button" className="fs-button-ghost" onClick={onSkipWow}>
                    Skip and explore
                  </button>
                  <button
                    type="button"
                    className="fs-button-primary inline-flex items-center gap-2"
                    onClick={onFinish}
                  >
                    Start FlowState
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            }
          >
            <div className="grid gap-4">
              {wowPrompts.map((prompt) => {
                const isSelected = prompt === selectedWowPrompt;

                return (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onSelectWowPrompt(prompt)}
                    className={`flex items-start gap-3 rounded-2xl border px-5 py-4 text-left transition-all duration-300 ease-in-out ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/70 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C87137]/15 text-[#C87137]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-foreground">{prompt}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        We’ll run this right after onboarding.
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </StepCard>
        )}
      </div>
    </div>
  );
}

export type { ProviderOption, OnboardingStep };

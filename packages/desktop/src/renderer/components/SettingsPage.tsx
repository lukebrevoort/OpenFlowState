import { useState } from "react";
import { Clock, Palette, Cpu, Globe, Shield, Bell, RotateCcw } from "lucide-react";

export function SettingsPage() {
  const [timezone, setTimezone] = useState("America/New_York");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [modelProvider, setModelProvider] = useState("openai");
  const [modelName, setModelName] = useState("gpt-4");
  const [language, setLanguage] = useState("en");
  const [resetStatus, setResetStatus] = useState<"idle" | "done">("idle");
  const resetLabel = resetStatus === "done" ? "Reset" : "Reset now";

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

  const modelProviders = [
    {
      id: "openai",
      name: "OpenAI",
      models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
    },
    {
      id: "anthropic",
      name: "Anthropic",
      models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
    },
    { id: "google", name: "Google", models: ["gemini-pro", "gemini-ultra"] },
    { id: "local", name: "Local Model", models: ["llama-2", "mistral"] },
  ];

  const selectedProvider = modelProviders.find((p) => p.id === modelProvider);

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
                  onChange={(e) => setTimezone(e.target.value)}
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
              <h3 className="text-xl text-foreground">AI Model</h3>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-sm text-foreground mb-2 block">
                  Model Provider
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {modelProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setModelProvider(provider.id);
                        setModelName(provider.models[0]);
                      }}
                      className={`px-4 py-3 rounded-lg border-2 transition-all duration-300 ease-in-out text-sm ${
                        modelProvider === provider.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-foreground/70 hover:border-border/60 hover:text-foreground"
                      }`}
                    >
                      {provider.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-foreground mb-2 block">
                  Model
                </label>
                <select
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-input-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {selectedProvider?.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-foreground mb-2 block">
                  API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="flex-1 px-4 py-2 rounded-lg bg-input-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button className="px-4 py-2 rounded-lg border border-border bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 ease-in-out text-sm shadow-sm">
                    Save
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Your API key is stored securely and never shared
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="text-xl text-foreground">Privacy & Security</h3>
            </div>

            <div className="space-y-4">
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
                  <p className="text-sm text-foreground">
                    Task completion alerts
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Get notified when tasks finish
                  </p>
                </div>
                <button className="relative w-12 h-6 border border-border rounded-full bg-primary transition-colors">
                  <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white transition-transform" />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Workflow updates</p>
                  <p className="text-xs text-muted-foreground">
                    Notify about workflow status changes
                  </p>
                </div>
                <button className="relative w-12 h-6 border border-border rounded-full bg-switch-background transition-colors">
                  <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform" />
                </button>
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

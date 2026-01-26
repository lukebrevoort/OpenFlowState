export interface ProviderDefinition {
  id: string;
  name: string;
  description: string;
  models: string[];
  badge?: string;
}

export const providerDefinitions: ProviderDefinition[] = [
  {
    id: "opencode",
    name: "OpenCode Zen",
    description: "Quick setup with OpenCode-hosted models.",
    models: ["opencode/big-pickle", "opencode/gpt-5-nano"],
    badge: "Recommended",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "Bring your OpenAI API key.",
    models: [
      "openai/gpt-5.2",
      "openai/gpt-5.2-codex",
      "openai/gpt-5.1-codex-max",
      "openai/gpt-5.1-codex-mini",
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models via GitHub Copilot providers.",
    models: [
      "github-copilot/claude-sonnet-4.5",
      "github-copilot/claude-sonnet-4",
      "github-copilot/claude-haiku-4.5",
      "github-copilot/claude-opus-4.5",
    ],
  },
  {
    id: "google",
    name: "Google",
    description: "Gemini models for multi-modal workflows.",
    models: [
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "google/gemini-2.0-flash",
      "google/gemini-1.5-pro",
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Local models running on your machine.",
    models: ["ollama/llama3", "ollama/mistral", "ollama/qwen2"],
  },
];

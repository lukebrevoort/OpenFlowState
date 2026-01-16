import type { ProviderDefinition } from "../data/providerData";

export const getProviderAuthUrl = (provider: ProviderDefinition): string | null => {
  switch (provider.id) {
    case "opencode":
      return "https://opencode.ai";
    case "openai":
      return "https://platform.openai.com/account/api-keys";
    case "anthropic":
      return "https://console.anthropic.com/settings/keys";
    case "google":
      return "https://aistudio.google.com/app/apikey";
    case "ollama":
      return "https://ollama.com/library";
    default:
      return null;
  }
};

export const getProviderAuthCommand = (provider: ProviderDefinition): string => {
  if (provider.id === "opencode") {
    return "opencode auth login";
  }

  const url = getProviderAuthUrl(provider);
  if (!url) {
    return "opencode auth login";
  }

  return `opencode auth login ${url}`;
};

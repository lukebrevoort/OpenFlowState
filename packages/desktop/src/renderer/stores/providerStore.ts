import { create } from "zustand";
import { providerDefinitions } from "../data/providerData";

interface ProviderState {
  selectedProviderId: string;
  selectedModel: string;
  setProvider: (providerId: string) => void;
  setModel: (model: string) => void;
  reset: () => void;
}

const defaultProvider = providerDefinitions[0];

export const useProviderStore = create<ProviderState>((set) => ({
  selectedProviderId: defaultProvider.id,
  selectedModel: defaultProvider.models[0],
  setProvider: (providerId) => {
    const provider = providerDefinitions.find((item) => item.id === providerId);
    if (!provider) return;
    set({
      selectedProviderId: providerId,
      selectedModel: provider.models[0],
    });
  },
  setModel: (model) => set({ selectedModel: model }),
  reset: () =>
    set({
      selectedProviderId: defaultProvider.id,
      selectedModel: defaultProvider.models[0],
    }),
}));

export default useProviderStore;

import { create } from "zustand";
import { providerDefinitions } from "../data/providerData";

interface ProviderState {
  selectedProviderId: string;
  selectedModel: string;
  setProvider: (providerId: string, model?: string) => void;
  setModel: (model: string) => void;
  reset: () => void;
}

const defaultProvider = providerDefinitions[0];

export const useProviderStore = create<ProviderState>((set) => ({
  selectedProviderId: defaultProvider.id,
  selectedModel: defaultProvider.models[0],
  setProvider: (providerId, model) => {
    set((state) => ({
      selectedProviderId: providerId,
      selectedModel: model ?? state.selectedModel,
    }));
  },
  setModel: (model) => set({ selectedModel: model }),
  reset: () =>
    set({
      selectedProviderId: defaultProvider.id,
      selectedModel: defaultProvider.models[0],
    }),
}));

export default useProviderStore;

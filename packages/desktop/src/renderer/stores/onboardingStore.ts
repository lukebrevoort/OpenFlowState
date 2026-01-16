import { create } from "zustand";
import type { OnboardingStep } from "../components/OnboardingFlow";

interface OnboardingState {
  currentStep: OnboardingStep;
  selectedApps: string[];
  selectedWowPrompt: string | null;
  setStep: (step: OnboardingStep) => void;
  toggleApp: (appId: string) => void;
  setSelectedWowPrompt: (prompt: string | null) => void;
  reset: () => void;
}

const defaultApps = ["notion", "gmail", "gcal"];

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: "welcome",
  selectedApps: defaultApps,
  selectedWowPrompt: null,
  setStep: (step) => set({ currentStep: step }),
  toggleApp: (appId) =>
    set((state) => ({
      selectedApps: state.selectedApps.includes(appId)
        ? state.selectedApps.filter((id) => id !== appId)
        : [...state.selectedApps, appId],
    })),
  setSelectedWowPrompt: (prompt) => set({ selectedWowPrompt: prompt }),
  reset: () =>
    set({
      currentStep: "welcome",
      selectedApps: defaultApps,
      selectedWowPrompt: null,
    }),
}));

export default useOnboardingStore;

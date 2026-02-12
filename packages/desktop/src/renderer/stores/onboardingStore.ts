import { create } from "zustand";
import type { OnboardingStep } from "../components/OnboardingFlow";

interface OnboardingState {
  currentStep: OnboardingStep;
  selectedApps: string[];
  setStep: (step: OnboardingStep) => void;
  toggleApp: (appId: string) => void;
  reset: () => void;
}

const defaultApps = ["notion", "gmail", "gcal"];

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: "welcome",
  selectedApps: defaultApps,
  setStep: (step) => set({ currentStep: step }),
  toggleApp: (appId) =>
    set((state) => ({
      selectedApps: state.selectedApps.includes(appId)
        ? state.selectedApps.filter((id) => id !== appId)
        : [...state.selectedApps, appId],
    })),
  reset: () =>
    set({
      currentStep: "welcome",
      selectedApps: defaultApps,
    }),
}));

export default useOnboardingStore;

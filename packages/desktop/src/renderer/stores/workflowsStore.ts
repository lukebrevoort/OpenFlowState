import { create } from 'zustand';
import type { WorkflowDefinition, WorkflowGenerationResult, WorkflowRun } from '../types/electron';
import { workflowsAdapter } from '../lib/workflowsAdapter';

interface WorkflowsState {
  workflows: WorkflowDefinition[];
  isLoading: boolean;
  error: string | null;
  lastRun: WorkflowRun | null;
  isRunning: boolean;
  isGenerating: boolean;
  generateError: string | null;
  lastGenerated: WorkflowGenerationResult | null;
  reload: () => Promise<void>;
  run: (workflowId: string, input?: unknown) => Promise<WorkflowRun | null>;
  generateFromIntent: (intent: string) => Promise<WorkflowGenerationResult | null>;
}

const upsertWorkflow = (current: WorkflowDefinition[], next: WorkflowDefinition): WorkflowDefinition[] => {
  const merged = new Map(current.map((w) => [w.id, w]));
  merged.set(next.id, next);
  return Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title));
};

export const useWorkflowsStore = create<WorkflowsState>((set) => ({
  workflows: [],
  isLoading: false,
  error: null,
  lastRun: null,
  isRunning: false,
  isGenerating: false,
  generateError: null,
  lastGenerated: null,
  reload: async () => {
    set({ isLoading: true, error: null });
    const result = await workflowsAdapter.list();
    if (result.ok) {
      set({ workflows: result.data, isLoading: false, error: null });
      return;
    }
    set({ isLoading: false, error: result.error.message });
  },

  run: async (workflowId: string, input?: unknown) => {
    set({ isRunning: true, error: null });
    const result = await workflowsAdapter.run(workflowId, input);
    if (result.ok) {
      set({ isRunning: false, lastRun: result.data });
      return result.data;
    }
    set({ isRunning: false, error: result.error.message });
    return null;
  },

  generateFromIntent: async (intent: string) => {
    set({ isGenerating: true, generateError: null });
    const result = await workflowsAdapter.generateFromIntent(intent);
    if (result.ok) {
      set((state) => ({
        isGenerating: false,
        lastGenerated: result.data,
        workflows: upsertWorkflow(state.workflows, result.data.definition),
      }));
      return result.data;
    }

    set({ isGenerating: false, generateError: result.error.message });
    return null;
  },
}));

export default useWorkflowsStore;

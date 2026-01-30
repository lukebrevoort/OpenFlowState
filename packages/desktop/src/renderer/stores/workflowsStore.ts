import { create } from 'zustand';
import type { WorkflowDefinition, WorkflowRun } from '../types/electron';
import { workflowsAdapter } from '../lib/workflowsAdapter';

interface WorkflowsState {
  workflows: WorkflowDefinition[];
  isLoading: boolean;
  error: string | null;
  lastRun: WorkflowRun | null;
  isRunning: boolean;
  reload: () => Promise<void>;
  run: (workflowId: string, input?: unknown) => Promise<WorkflowRun | null>;
}

export const useWorkflowsStore = create<WorkflowsState>((set) => ({
  workflows: [],
  isLoading: false,
  error: null,
  lastRun: null,
  isRunning: false,
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
}));

export default useWorkflowsStore;

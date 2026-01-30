import { create } from 'zustand';
import type { WorkflowDefinition } from '../types/electron';
import { workflowsAdapter } from '../lib/workflowsAdapter';

interface WorkflowsState {
  workflows: WorkflowDefinition[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export const useWorkflowsStore = create<WorkflowsState>((set) => ({
  workflows: [],
  isLoading: false,
  error: null,
  reload: async () => {
    set({ isLoading: true, error: null });
    const result = await workflowsAdapter.list();
    if (result.ok) {
      set({ workflows: result.data, isLoading: false, error: null });
      return;
    }
    set({ isLoading: false, error: result.error.message });
  },
}));

export default useWorkflowsStore;

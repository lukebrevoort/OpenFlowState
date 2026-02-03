import { create } from 'zustand';
import type { WorkflowDefinition, WorkflowGenerationResult, WorkflowRun } from '../types/electron';
import { workflowsAdapter } from '../lib/workflowsAdapter';

interface WorkflowsState {
  workflows: WorkflowDefinition[];
  isLoading: boolean;
  error: string | null;
  lastRun: WorkflowRun | null;
  isRunning: boolean;

  pinnedIds: string[];
  isLoadingPins: boolean;
  pinsError: string | null;

  runsByWorkflowId: Record<string, WorkflowRun[]>;
  runsMetaByWorkflowId: Record<string, { fetchedAt: number; limit: number }>;
  runsErrorByWorkflowId: Record<string, string | null>;

  isGenerating: boolean;
  generateError: string | null;
  lastGenerated: WorkflowGenerationResult | null;
  reload: () => Promise<void>;
  loadPins: () => Promise<void>;
  setPinned: (workflowId: string, pinned: boolean) => Promise<boolean>;
  ensureRunsLoaded: (workflowId: string, limit: number) => Promise<void>;
  run: (workflowId: string, input?: unknown) => Promise<WorkflowRun | null>;
  generateFromIntent: (intent: string) => Promise<WorkflowGenerationResult | null>;
}

const upsertWorkflow = (current: WorkflowDefinition[], next: WorkflowDefinition): WorkflowDefinition[] => {
  const merged = new Map(current.map((w) => [w.id, w]));
  merged.set(next.id, next);
  return Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title));
};

const RUNS_CACHE_TTL_MS = 30_000;
const inFlightRuns = new Map<string, Promise<void>>();

export const useWorkflowsStore = create<WorkflowsState>((set) => ({
  workflows: [],
  isLoading: false,
  error: null,
  lastRun: null,
  isRunning: false,

  pinnedIds: [],
  isLoadingPins: false,
  pinsError: null,

  runsByWorkflowId: {},
  runsMetaByWorkflowId: {},
  runsErrorByWorkflowId: {},

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

  loadPins: async () => {
    set({ isLoadingPins: true, pinsError: null });
    const result = await workflowsAdapter.getPins();
    if (result.ok) {
      set({ pinnedIds: result.data, isLoadingPins: false, pinsError: null });
      return;
    }
    set({ isLoadingPins: false, pinsError: result.error.message });
  },

  setPinned: async (workflowId: string, pinned: boolean) => {
    set({ pinsError: null });
    const result = await workflowsAdapter.setPinned(workflowId, pinned);
    if (result.ok) {
      set({ pinnedIds: result.data.pinnedIds });
      return true;
    }
    set({ pinsError: result.error.message });
    return false;
  },

  ensureRunsLoaded: async (workflowId: string, limit: number) => {
    const key = `${workflowId}:${limit}`;
    const existing = inFlightRuns.get(key);
    if (existing) {
      await existing;
      return;
    }

    const promise = (async () => {
      const state = useWorkflowsStore.getState();
      const meta = state.runsMetaByWorkflowId[workflowId];
      const cachedLimitOk = meta?.limit != null && meta.limit >= limit;
      const freshOk = meta?.fetchedAt != null && Date.now() - meta.fetchedAt < RUNS_CACHE_TTL_MS;

      if (cachedLimitOk && freshOk) return;

      set((current) => ({
        runsErrorByWorkflowId: { ...current.runsErrorByWorkflowId, [workflowId]: null },
      }));

      const result = await workflowsAdapter.listRuns(workflowId, limit, 0);
      if (result.ok) {
        set((current) => ({
          runsByWorkflowId: { ...current.runsByWorkflowId, [workflowId]: result.data },
          runsMetaByWorkflowId: {
            ...current.runsMetaByWorkflowId,
            [workflowId]: { fetchedAt: Date.now(), limit },
          },
          runsErrorByWorkflowId: { ...current.runsErrorByWorkflowId, [workflowId]: null },
        }));
        return;
      }

      set((current) => ({
        runsErrorByWorkflowId: {
          ...current.runsErrorByWorkflowId,
          [workflowId]: result.error.message,
        },
      }));
    })();

    inFlightRuns.set(key, promise);
    try {
      await promise;
    } finally {
      inFlightRuns.delete(key);
    }
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

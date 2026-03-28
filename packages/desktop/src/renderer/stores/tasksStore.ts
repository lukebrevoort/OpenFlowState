import { create } from 'zustand';

import { tasksAdapter } from '../lib/tasksAdapter';
import type { TaskRun, TimelineEvent, WorkflowArtifact } from '../types/electron';

type WorkflowRunMetadata = {
  workflowId: string;
  workflowRunId: string;
};

const isWorkflowRunMetadata = (value: unknown): value is WorkflowRunMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const maybe = value as Record<string, unknown>;
  return typeof maybe.workflowId === 'string' && typeof maybe.workflowRunId === 'string';
};

type TasksState = {
  runs: TaskRun[];
  activeRun: TaskRun | null;
  selectedRunId: string | null;
  focusedApprovalRequestId: string | null;
  selectedTimeline: TimelineEvent[];
  selectedWorkflow: WorkflowRunMetadata | null;
  selectedArtifacts: WorkflowArtifact[] | null;
  isLoadingRuns: boolean;
  isLoadingTimeline: boolean;
  isLoadingArtifacts: boolean;
  error: string | null;
  artifactsError: string | null;

  reloadRuns: (opts?: { silent?: boolean }) => Promise<void>;
  loadActiveRun: (opts?: { silent?: boolean }) => Promise<void>;
  selectRun: (id: string) => Promise<void>;
  setFocusedApprovalRequestId: (requestId: string | null) => void;
  reloadSelectedTimeline: (opts?: { silent?: boolean }) => Promise<void>;
  reloadSelectedArtifacts: (opts?: { silent?: boolean }) => Promise<void>;
  cancelRun: (id: string) => Promise<boolean>;
  removeRun: (id: string) => Promise<boolean>;
  markRunning: (id: string) => Promise<boolean>;
  markComplete: (id: string) => Promise<boolean>;
  updateRunLocal: (id: string, patch: Partial<TaskRun>) => void;
};

const statusPriority: Record<TaskRun['status'], number> = {
  running: 0,
  waiting_approval: 1,
  completed: 2,
  failed: 3,
  cancelled: 4,
};

export const isTaskRunActiveStatus = (status: TaskRun['status']) =>
  status === 'running' || status === 'waiting_approval';

const sortRuns = (runs: TaskRun[]) => {
  return [...runs].sort((a, b) => {
    const byStatus = statusPriority[a.status] - statusPriority[b.status];
    if (byStatus !== 0) return byStatus;
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
};

const pickDefaultSelectedRunId = (runs: TaskRun[], activeRun: TaskRun | null) => {
  if (activeRun && runs.some((run) => run.id === activeRun.id)) {
    return activeRun.id;
  }
  const sorted = sortRuns(runs);
  return sorted[0]?.id ?? null;
};

export const useTasksStore = create<TasksState>((set, get) => ({
  runs: [],
  activeRun: null,
  selectedRunId: null,
  focusedApprovalRequestId: null,
  selectedTimeline: [],
  selectedWorkflow: null,
  selectedArtifacts: null,
  isLoadingRuns: false,
  isLoadingTimeline: false,
  isLoadingArtifacts: false,
  error: null,
  artifactsError: null,

  reloadRuns: async (opts) => {
    if (!opts?.silent) {
      set({ isLoadingRuns: true, error: null });
    }

    const result = await tasksAdapter.listRuns();
    if (!result.ok) {
      set({ isLoadingRuns: false, error: result.error.message, runs: [] });
      return;
    }

    set({ runs: result.data, isLoadingRuns: false });

    const { selectedRunId, activeRun } = get();
    const nextSelected =
      selectedRunId && result.data.some((run) => run.id === selectedRunId)
        ? selectedRunId
        : pickDefaultSelectedRunId(result.data, activeRun);

    if (nextSelected !== selectedRunId) {
      set({
        selectedRunId: nextSelected,
        selectedTimeline: [],
        selectedWorkflow: null,
        selectedArtifacts: null,
        artifactsError: null,
      });
      if (nextSelected) {
        await get().reloadSelectedTimeline({ silent: opts?.silent });
        await get().reloadSelectedArtifacts({ silent: opts?.silent });
      }
    }
  },

  loadActiveRun: async (opts) => {
    if (!opts?.silent) {
      set({ isLoadingRuns: true, error: null });
    }

    const prevSelected = get().selectedRunId;
    const result = await tasksAdapter.getActiveRun();
    if (!result.ok) {
      set({ isLoadingRuns: false, error: result.error.message });
      return;
    }

    const activeRun = result.data;
    const nextSelected = prevSelected ?? activeRun?.id ?? null;

    set({ activeRun, selectedRunId: nextSelected, isLoadingRuns: false });

    if (nextSelected && nextSelected !== prevSelected) {
      set({ selectedTimeline: [], selectedWorkflow: null, selectedArtifacts: null, artifactsError: null });
      await get().reloadSelectedTimeline({ silent: opts?.silent });
      await get().reloadSelectedArtifacts({ silent: opts?.silent });
    }
  },

  selectRun: async (id) => {
    const current = get().selectedRunId;
    if (current === id) return;
    set({
      selectedRunId: id,
      selectedTimeline: [],
      selectedWorkflow: null,
      selectedArtifacts: null,
      error: null,
      artifactsError: null,
    });
    await get().reloadSelectedTimeline();
    await get().reloadSelectedArtifacts();
  },

  setFocusedApprovalRequestId: (requestId) => {
    const nextRequestId = requestId?.trim() || null;
    set({ focusedApprovalRequestId: nextRequestId });
  },

  reloadSelectedTimeline: async (opts) => {
    const { selectedRunId, runs } = get();
    const run = runs.find((candidate) => candidate.id === selectedRunId);

    if (!run) {
      set({ selectedTimeline: [] });
      return;
    }

    if (!opts?.silent) {
      set({ isLoadingTimeline: true, error: null });
    }

    try {
      const events = await window.flowstate.timeline.list(run.sessionId, 200, 0);

      const resolved = await Promise.all(
        events.map(async (event) => {
          const isApproval = event.kind === 'approval_request' || event.kind === 'approval_response';
          if (!isApproval || event.payloadInline || !event.payloadRef) {
            return event;
          }

          try {
            const payload = await window.flowstate.timeline.resolvePayload(event.payloadRef);
            return payload ? { ...event, payloadInline: payload } : event;
          } catch {
            return event;
          }
        })
      );

      set({ selectedTimeline: resolved, isLoadingTimeline: false });
    } catch (err) {
      set({
        isLoadingTimeline: false,
        error: err instanceof Error ? err.message : 'Failed to load timeline.',
      });
    }
  },

  reloadSelectedArtifacts: async (opts) => {
    const { selectedRunId, runs } = get();
    const run = runs.find((candidate) => candidate.id === selectedRunId);

    if (!run) {
      set({ selectedWorkflow: null, selectedArtifacts: null, artifactsError: null, isLoadingArtifacts: false });
      return;
    }

    const workflow = isWorkflowRunMetadata(run.metadata) ? run.metadata : null;
    if (!workflow) {
      set({ selectedWorkflow: null, selectedArtifacts: null, artifactsError: null, isLoadingArtifacts: false });
      return;
    }

    set({ selectedWorkflow: workflow });

    if (!opts?.silent) {
      set({ isLoadingArtifacts: true, artifactsError: null });
    }

    const result = await window.flowstate.workflows.listArtifacts(workflow.workflowRunId);
    if (!result.ok) {
      set({ isLoadingArtifacts: false, artifactsError: result.error.message, selectedArtifacts: [] });
      return;
    }

    set({ selectedArtifacts: result.data, isLoadingArtifacts: false, artifactsError: null });
  },

  cancelRun: async (id) => {
    const result = await tasksAdapter.cancelRun(id);
    if (!result.ok) {
      set({ error: result.error.message });
      return false;
    }

    set((state) => ({
      runs: state.runs.map((run) => (run.id === id ? result.data : run)),
    }));
    return true;
  },

  removeRun: async (id) => {
    const result = await tasksAdapter.removeRun(id);
    if (!result.ok) {
      set({ error: result.error.message });
      return false;
    }

    set((state) => {
      const nextRuns = state.runs.filter((run) => run.id !== id);
      const nextSelected =
        state.selectedRunId === id
          ? pickDefaultSelectedRunId(nextRuns, state.activeRun && state.activeRun.id === id ? null : state.activeRun)
          : state.selectedRunId;
      return {
        runs: nextRuns,
        selectedRunId: nextSelected,
        selectedTimeline: nextSelected ? state.selectedTimeline : [],
        selectedWorkflow: nextSelected ? state.selectedWorkflow : null,
        selectedArtifacts: nextSelected ? state.selectedArtifacts : null,
      };
    });

    if (get().selectedRunId) {
      await get().reloadSelectedTimeline({ silent: true });
      await get().reloadSelectedArtifacts({ silent: true });
    }

    return true;
  },

  markRunning: async (id) => {
    const result = await tasksAdapter.markRunning(id);
    if (!result.ok) {
      set({ error: result.error.message });
      return false;
    }

    set((state) => ({
      runs: state.runs.map((run) => (run.id === id ? result.data : run)),
    }));
    return true;
  },

  markComplete: async (id) => {
    const result = await tasksAdapter.markComplete(id);
    if (!result.ok) {
      set({ error: result.error.message });
      return false;
    }

    set((state) => ({
      runs: state.runs.map((run) => (run.id === id ? result.data : run)),
    }));
    return true;
  },

  updateRunLocal: (id, patch) => {
    if (!id) return;
    set((state) => {
      const runs = state.runs.map((run) => (run.id === id ? { ...run, ...patch } : run));
      const activeRun = state.activeRun?.id === id ? { ...state.activeRun, ...patch } : state.activeRun;
      return { runs, activeRun };
    });
  },
}));

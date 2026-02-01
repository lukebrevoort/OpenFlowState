import { create } from 'zustand';

import { tasksAdapter } from '../lib/tasksAdapter';
import type { TaskRun, TimelineEvent } from '../types/electron';

type TasksState = {
  runs: TaskRun[];
  activeRun: TaskRun | null;
  selectedRunId: string | null;
  selectedTimeline: TimelineEvent[];
  isLoadingRuns: boolean;
  isLoadingTimeline: boolean;
  error: string | null;

  reloadRuns: (opts?: { silent?: boolean }) => Promise<void>;
  loadActiveRun: (opts?: { silent?: boolean }) => Promise<void>;
  selectRun: (id: string) => Promise<void>;
  reloadSelectedTimeline: (opts?: { silent?: boolean }) => Promise<void>;
};

const statusPriority: Record<TaskRun['status'], number> = {
  running: 0,
  waiting_approval: 1,
  completed: 2,
  failed: 3,
};

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
  selectedTimeline: [],
  isLoadingRuns: false,
  isLoadingTimeline: false,
  error: null,

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
      set({ selectedRunId: nextSelected, selectedTimeline: [] });
      if (nextSelected) {
        await get().reloadSelectedTimeline({ silent: opts?.silent });
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
      await get().reloadSelectedTimeline({ silent: opts?.silent });
    }
  },

  selectRun: async (id) => {
    const current = get().selectedRunId;
    if (current === id) return;
    set({ selectedRunId: id, selectedTimeline: [], error: null });
    await get().reloadSelectedTimeline();
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
      set({ selectedTimeline: events, isLoadingTimeline: false });
    } catch (err) {
      set({
        isLoadingTimeline: false,
        error: err instanceof Error ? err.message : 'Failed to load timeline.',
      });
    }
  },
}));

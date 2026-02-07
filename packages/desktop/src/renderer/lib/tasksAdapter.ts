import type { IpcError, IpcResult, TaskRun } from '../types/electron';

function unavailable<T>(message: string): IpcResult<T> {
  const error: IpcError = { code: 'UNAVAILABLE', message };
  return { ok: false, error };
}

export const tasksAdapter = {
  async listRuns(): Promise<IpcResult<TaskRun[]>> {
    const listFn = window.flowstate?.tasks?.listRuns;
    if (!listFn) {
      return unavailable('Tasks are not available in this build.');
    }

    try {
      return await listFn();
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to load tasks.');
    }
  },

  async getActiveRun(): Promise<IpcResult<TaskRun | null>> {
    const getFn = window.flowstate?.tasks?.getActiveRun;
    if (!getFn) {
      return unavailable('Tasks are not available in this build.');
    }

    try {
      return await getFn();
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to load active task.');
    }
  },

  async cancelRun(taskRunId: string): Promise<IpcResult<TaskRun>> {
    const cancelFn = window.flowstate?.tasks?.cancelRun;
    if (!cancelFn) {
      return unavailable('Tasks are not available in this build.');
    }

    try {
      return await cancelFn(taskRunId);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to cancel task.');
    }
  },

  async removeRun(taskRunId: string): Promise<IpcResult<{ removed: boolean }>> {
    const removeFn = window.flowstate?.tasks?.removeRun;
    if (!removeFn) {
      return unavailable('Tasks are not available in this build.');
    }

    try {
      return await removeFn(taskRunId);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to remove task.');
    }
  },

  async markRunning(taskRunId: string): Promise<IpcResult<TaskRun>> {
    const markFn = window.flowstate?.tasks?.markRunning;
    if (!markFn) {
      return unavailable('Tasks are not available in this build.');
    }

    try {
      return await markFn(taskRunId);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to update task.');
    }
  },

  async markComplete(taskRunId: string): Promise<IpcResult<TaskRun>> {
    const markFn = window.flowstate?.tasks?.markComplete;
    if (!markFn) {
      return unavailable('Tasks are not available in this build.');
    }

    try {
      return await markFn(taskRunId);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to complete task.');
    }
  },
};

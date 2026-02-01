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
};

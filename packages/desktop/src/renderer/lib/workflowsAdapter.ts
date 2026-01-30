import type { IpcError, IpcResult, WorkflowDefinition, WorkflowGenerationResult, WorkflowRun } from '../types/electron';

function unavailable<T>(message: string): IpcResult<T> {
  const error: IpcError = { code: 'UNAVAILABLE', message };
  return { ok: false, error };
}

export const workflowsAdapter = {
  async list(): Promise<IpcResult<WorkflowDefinition[]>> {
    const listFn = window.flowstate?.workflows?.list;
    if (!listFn) {
      return unavailable('Workflows are not available in this build.');
    }

    try {
      return await listFn();
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to load workflows.');
    }
  },

  async run(workflowId: string, input?: unknown): Promise<IpcResult<WorkflowRun>> {
    const runFn = window.flowstate?.workflows?.run;
    if (!runFn) {
      return unavailable('Workflows are not available in this build.');
    }

    try {
      return await runFn(workflowId, input);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to run workflow.');
    }
  },

  async generateFromIntent(intent: string): Promise<IpcResult<WorkflowGenerationResult>> {
    const genFn = window.flowstate?.workflows?.generateFromIntent;
    if (!genFn) {
      return unavailable('Workflow generation is not available in this build.');
    }

    try {
      return await genFn(intent);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to generate workflow.');
    }
  },
};

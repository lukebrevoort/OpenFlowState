import type {
  IpcError,
  IpcResult,
  WorkflowDefinition,
  WorkflowGenerationResult,
  WorkflowRun,
  WorkflowSkillFile,
  WorkflowSkillSaveResult,
} from '../types/electron';

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

  async listRuns(
    workflowId: string,
    limit?: number,
    offset?: number,
  ): Promise<IpcResult<WorkflowRun[]>> {
    const listRunsFn = window.flowstate?.workflows?.listRuns;
    if (!listRunsFn) {
      return unavailable('Workflows are not available in this build.');
    }

    try {
      return await listRunsFn(workflowId, limit, offset);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to load workflow runs.');
    }
  },

  async getPins(): Promise<IpcResult<string[]>> {
    const getPinsFn = window.flowstate?.workflows?.getPins;
    if (!getPinsFn) {
      return unavailable('Workflows are not available in this build.');
    }

    try {
      return await getPinsFn();
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to load pinned workflows.');
    }
  },

  async setPinned(
    workflowId: string,
    pinned: boolean,
  ): Promise<IpcResult<{ pinnedIds: string[] }>> {
    const setPinnedFn = window.flowstate?.workflows?.setPinned;
    if (!setPinnedFn) {
      return unavailable('Workflows are not available in this build.');
    }

    try {
      return await setPinnedFn(workflowId, pinned);
    } catch (err) {
      return unavailable(
        err instanceof Error ? err.message : 'Failed to update pinned workflows.',
      );
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

  async getSkillMarkdown(workflowId: string): Promise<IpcResult<WorkflowSkillFile>> {
    const getFn = window.flowstate?.workflows?.getSkillMarkdown;
    if (!getFn) {
      return unavailable('Workflow editor is not available in this build.');
    }

    try {
      return await getFn(workflowId);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to load workflow file.');
    }
  },

  async saveSkillMarkdown(
    workflowId: string,
    skillMarkdown: string,
  ): Promise<IpcResult<WorkflowSkillSaveResult>> {
    const saveFn = window.flowstate?.workflows?.saveSkillMarkdown;
    if (!saveFn) {
      return unavailable('Workflow editor is not available in this build.');
    }

    try {
      return await saveFn(workflowId, skillMarkdown);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to save workflow file.');
    }
  },

  async deleteWorkflow(workflowId: string): Promise<IpcResult<{ removed: boolean }>> {
    const deleteFn = window.flowstate?.workflows?.deleteWorkflow;
    if (!deleteFn) {
      return unavailable('Workflow deletion is not available in this build.');
    }

    try {
      return await deleteFn(workflowId);
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to delete workflow.');
    }
  },
};

import type { IpcError, IpcResult, WorkflowDefinition } from '../types/electron';

const mockWorkflows: WorkflowDefinition[] = [
  {
    id: 'daily-briefing',
    title: 'Daily Briefing',
    description: 'Summarize emails, calendar events, and top news each morning',
  },
  {
    id: 'content-generator',
    title: 'Content Generator',
    description: 'Create blog posts, social media content, and marketing copy',
  },
  {
    id: 'data-analyzer',
    title: 'Data Analyzer',
    description: 'Process spreadsheets, generate reports, and identify trends',
  },
  {
    id: 'meeting-assistant',
    title: 'Meeting Assistant',
    description: 'Transcribe meetings, create action items, and send summaries',
  },
  {
    id: 'research-helper',
    title: 'Research Helper',
    description: 'Gather information, summarize articles, and compile references',
  },
  {
    id: 'email-composer',
    title: 'Email Composer',
    description: 'Draft professional emails, responses, and follow-ups',
  },
];

function unavailable(message: string): IpcResult<WorkflowDefinition[]> {
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
      const result = await listFn();
      if (!result.ok && result.error.code === 'NOT_IMPLEMENTED') {
        return { ok: true, data: mockWorkflows };
      }

      return result;
    } catch (err) {
      return unavailable(err instanceof Error ? err.message : 'Failed to load workflows.');
    }
  },
};

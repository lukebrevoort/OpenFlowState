import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRandomUUID = vi.fn<() => string>();
const mockDateNow = vi.spyOn(Date, 'now');

const mockGetProjectDirectory = vi.fn<() => string | undefined>();
const mockGetDataDir = vi.fn<() => string>();

const mockCreateDetachedSession = vi.fn<(title: string) => Promise<string>>();
const mockPromptSession = vi.fn<(sessionId: string, prompt: string) => Promise<{ assistantMessageId?: string; content: string; parts?: unknown }>>();
const mockNotifyWorkflowRunStatus = vi.fn();
const mockRegisterTaskSession = vi.fn();

const mockGetWorkflowOptIn = vi.fn<(workflowId: string) => Promise<boolean>>();
const mockSetSessionAlwaysApprove = vi.fn<(sessionId: string, enabled: boolean) => void>();

const mockTaskConfigure = vi.fn();
const mockTaskUpsertRun = vi.fn();
const mockTaskUpdateRun = vi.fn();

const mockWorkflowRunConfigure = vi.fn();
const mockWorkflowCreateRun = vi.fn();
const mockWorkflowUpdateRun = vi.fn();
const mockWorkflowCreateArtifact = vi.fn();

type WorkflowDefinition = { id: string; title: string; description?: string };
type WorkflowRunLike = { id: string; workflowId: string; taskRunId?: string; sessionId?: string; status: string; startedAt: number; finishedAt?: number };

const definitions = new Map<string, WorkflowDefinition>();
const templates = new Map<string, string>();
const workflowRuns = new Map<string, WorkflowRunLike>();

vi.mock('crypto', () => ({
  randomUUID: mockRandomUUID,
}));

vi.mock('./process-manager.js', () => ({
  processManager: {
    running: true,
    client: {},
    getProjectDirectory: mockGetProjectDirectory,
    createDetachedSession: mockCreateDetachedSession,
    promptSession: mockPromptSession,
    notifyWorkflowRunStatus: mockNotifyWorkflowRunStatus,
    registerTaskSession: mockRegisterTaskSession,
  },
}));

vi.mock('./config-store.js', () => ({
  configStore: {
    getDataDir: mockGetDataDir,
  },
}));

vi.mock('./approval-policy-store.js', () => ({
  approvalPolicyStore: {
    getWorkflowOptIn: mockGetWorkflowOptIn,
    setSessionAlwaysApprove: mockSetSessionAlwaysApprove,
  },
}));

vi.mock('./task-store.js', () => ({
  taskStore: {
    configure: mockTaskConfigure,
    upsertRun: mockTaskUpsertRun,
    updateRun: mockTaskUpdateRun,
  },
}));

vi.mock('./workflow-run-store.js', () => ({
  workflowRunStore: {
    configure: mockWorkflowRunConfigure,
    createRun: mockWorkflowCreateRun,
    updateRun: mockWorkflowUpdateRun,
    createArtifact: mockWorkflowCreateArtifact,
  },
}));

vi.mock('./workflow-response-utils.js', () => ({
  clampText: (value: string) => value,
  requiresUserInput: () => false,
  parseResponseHeader: () => ({ hasHeader: true, status: 'complete' }),
  isTaskBlocked: () => false,
  getCleanContent: () => 'Workflow completed successfully with persisted output.',
}));

vi.mock('./workflows-store.js', () => ({
  workflowsStore: {
    setDefinitions: (next: WorkflowDefinition[]) => {
      definitions.clear();
      for (const item of next) definitions.set(item.id, item);
    },
    upsertDefinition: (next: WorkflowDefinition) => {
      definitions.set(next.id, next);
    },
    upsertTemplate: ({ id, template }: { id: string; template: string }) => {
      templates.set(id, template);
    },
    getDefinition: (id: string) => definitions.get(id) ?? null,
    listDefinitions: () => Array.from(definitions.values()),
    removeDefinition: (id: string) => definitions.delete(id),
    removeTemplate: (id: string) => templates.delete(id),
    hasTemplate: (id: string) => templates.has(id),
    getTemplate: (id: string) => templates.get(id) ?? null,
    createRun: (run: WorkflowRunLike) => {
      workflowRuns.set(run.id, run);
    },
    updateRun: (id: string, patch: Partial<WorkflowRunLike> & { output?: unknown }) => {
      const existing = workflowRuns.get(id);
      if (!existing) return null;
      const next = { ...existing, ...patch } as WorkflowRunLike;
      workflowRuns.set(id, next);
      return next;
    },
    getRun: () => null,
  },
}));

const { workflowsRunner } = await import('./workflows-runner.js');

describe('Phase 7 deterministic happy path', () => {
  beforeEach(() => {
    definitions.clear();
    templates.clear();
    workflowRuns.clear();
    vi.clearAllMocks();

    mockRandomUUID
      .mockReturnValueOnce('workflow-run-1')
      .mockReturnValueOnce('task-run-1')
      .mockReturnValueOnce('artifact-1');

    const nowValues = [1_700_000_000_000, 1_700_000_001_000];
    mockDateNow.mockImplementation(() => nowValues.shift() ?? 1_700_000_001_000);

    mockGetProjectDirectory.mockReturnValue(undefined);
    mockGetDataDir.mockReturnValue('/tmp/flowstate-phase7-tests');
    mockCreateDetachedSession.mockResolvedValue('session-workflow-1');
    mockPromptSession.mockResolvedValue({
      assistantMessageId: 'assistant-msg-1',
      content: '## COMPLETE\nWorkflow completed successfully with persisted output.',
      parts: [{ type: 'text', text: 'Workflow completed successfully with persisted output.' }],
    });
    mockGetWorkflowOptIn.mockResolvedValue(true);

    definitions.set('launch-checklist', {
      id: 'launch-checklist',
      title: 'Launch Checklist',
      description: 'Phase 7 launch prep workflow',
    });
    templates.set('launch-checklist', '# Execute launch workflow');
  });

  afterEach(() => {
    mockDateNow.mockReset();
  });

  it('covers onboarding approval context through workflow completion and persistence', async () => {
    const result = await workflowsRunner.run('launch-checklist', {
      userContext: {
        connectedIntegrations: ['notion'],
      },
      launchDay: '2026-02-20',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toMatchObject({
      id: 'workflow-run-1',
      workflowId: 'launch-checklist',
      taskRunId: 'task-run-1',
      sessionId: 'session-workflow-1',
      status: 'completed',
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_000_001_000,
    });

    expect(mockGetWorkflowOptIn).toHaveBeenCalledWith('launch-checklist');
    expect(mockSetSessionAlwaysApprove).toHaveBeenCalledWith('session-workflow-1', true);

    expect(mockWorkflowCreateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'workflow-run-1',
        workflowId: 'launch-checklist',
        status: 'running',
        inputJson: JSON.stringify({
          userContext: {
            connectedIntegrations: ['notion'],
          },
          launchDay: '2026-02-20',
        }),
      })
    );

    expect(mockTaskUpsertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-run-1',
        sessionId: 'session-workflow-1',
        status: 'running',
        progress: 0,
        metadata: {
          workflowId: 'launch-checklist',
          workflowRunId: 'workflow-run-1',
        },
      })
    );

    expect(mockWorkflowUpdateRun).toHaveBeenCalledWith(
      'workflow-run-1',
      expect.objectContaining({
        status: 'completed',
        finishedAt: 1_700_000_001_000,
        assistantMessageId: 'assistant-msg-1',
        outputPreview: 'Workflow completed successfully with persisted output.',
      })
    );

    expect(mockWorkflowCreateArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: 'artifact-1',
        workflowRunId: 'workflow-run-1',
        kind: 'final_output',
        payloadText: 'Workflow completed successfully with persisted output.',
      })
    );

    expect(mockTaskUpdateRun).toHaveBeenCalledWith(
      'task-run-1',
      expect.objectContaining({
        status: 'completed',
        progress: 100,
        description: 'Task completed',
      })
    );

    expect(mockNotifyWorkflowRunStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-workflow-1',
        taskRunId: 'task-run-1',
        summary: 'Task complete ✅',
        detail: 'Task completed',
        needsResponse: false,
        completed: true,
      })
    );
  });
});

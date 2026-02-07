import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetProjectDirectory = vi.fn<() => string | undefined>();
const mockGetDataDir = vi.fn<() => string>();

type WorkflowDefinition = { id: string; title: string; description?: string };
const definitions = new Map<string, WorkflowDefinition>();
const templates = new Map<string, string>();

vi.mock('./process-manager.js', () => ({
  processManager: {
    getProjectDirectory: mockGetProjectDirectory,
  },
}));

vi.mock('./config-store.js', () => ({
  configStore: {
    getDataDir: mockGetDataDir,
  },
}));

vi.mock('./approval-policy-store.js', () => ({
  approvalPolicyStore: {},
}));

vi.mock('./task-store.js', () => ({
  taskStore: {},
}));

vi.mock('./workflow-run-store.js', () => ({
  workflowRunStore: {},
}));

vi.mock('./workflow-response-utils.js', () => ({
  clampText: (value: string) => value,
  requiresUserInput: () => false,
  parseResponseHeader: () => ({ hasHeader: false }),
  isTaskBlocked: () => false,
  getCleanContent: (value: string) => value,
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
    createRun: () => undefined,
    updateRun: () => null,
    getRun: () => null,
  },
}));

const { workflowsRunner } = await import('./workflows-runner.js');

describe('workflowsRunner title editing', () => {
  let tmpDir = '';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowstate-workflows-runner-'));
    definitions.clear();
    templates.clear();
    mockGetDataDir.mockReturnValue(tmpDir);
    mockGetProjectDirectory.mockReturnValue(undefined);
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it('allows changing workflow title via frontmatter title while keeping name fixed', async () => {
    const result = await workflowsRunner.saveSkillMarkdown(
      'check-project-database-page-whic',
      [
        '---',
        'name: check-project-database-page-whic',
        'title: "Check project database page"',
        'description: "Checks the project DB page for updates."',
        '---',
        '',
        '# Workflow',
      ].join('\n')
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.definition.id).toBe('check-project-database-page-whic');
    expect(result.data.definition.title).toBe('Check project database page');
  });

  it('uses directory name as immutable workflow id when loading from disk', async () => {
    const workflowDir = path.join(tmpDir, 'workflows', 'folder-based-id');
    await fs.mkdir(workflowDir, { recursive: true });
    await fs.writeFile(
      path.join(workflowDir, 'SKILL.md'),
      [
        '---',
        'name: does-not-match-folder',
        'title: "Folder ID workflow"',
        'description: "Uses folder id as the canonical id."',
        '---',
        '',
        '# Workflow',
      ].join('\n'),
      'utf8'
    );

    const listed = await workflowsRunner.listDefinitions();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;

    const found = listed.data.find((entry) => entry.id === 'folder-based-id');
    expect(found).toBeTruthy();
    expect(found?.title).toBe('Folder ID workflow');
  });
});

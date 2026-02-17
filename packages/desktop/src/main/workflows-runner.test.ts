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

  it('rejects changing immutable workflow id via frontmatter name', async () => {
    const result = await workflowsRunner.saveSkillMarkdown(
      'immutable-workflow-id',
      [
        '---',
        'name: renamed-workflow-id',
        'title: "Renamed"',
        'description: "Attempted rename"',
        '---',
        '',
        '# Workflow',
      ].join('\n')
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INVALID_REQUEST');
    expect(result.message).toContain('Frontmatter name must remain "immutable-workflow-id"');
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

  it('duplicates a workflow into user data with copied template content', async () => {
    const sourceWorkflowDir = path.join(tmpDir, 'workflows', 'daily-plan');
    await fs.mkdir(sourceWorkflowDir, { recursive: true });
    await fs.writeFile(
      path.join(sourceWorkflowDir, 'SKILL.md'),
      [
        '---',
        'name: daily-plan',
        'title: "Daily Plan"',
        'description: "Plan my day."',
        '---',
        '',
        '# Daily Plan',
        '',
        '## What you do',
        '1. Build a plan.',
      ].join('\n'),
      'utf8'
    );

    await workflowsRunner.listDefinitions();
    const duplicated = await workflowsRunner.duplicateWorkflow('daily-plan');
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;

    expect(duplicated.data.definition.id).toBe('daily-plan-copy');
    expect(duplicated.data.definition.title).toBe('Daily Plan Copy');

    const duplicatedSkill = await fs.readFile(
      path.join(tmpDir, 'workflows', 'daily-plan-copy', 'SKILL.md'),
      'utf8'
    );
    expect(duplicatedSkill).toContain('name: daily-plan-copy');
    expect(duplicatedSkill).toContain('title: "Daily Plan Copy"');
    expect(duplicatedSkill).toContain('1. Build a plan.');
  });

  it('creates incremented id/title when duplicate already exists', async () => {
    const sourceWorkflowDir = path.join(tmpDir, 'workflows', 'nightly-review');
    const existingDuplicateDir = path.join(tmpDir, 'workflows', 'nightly-review-copy');
    await fs.mkdir(sourceWorkflowDir, { recursive: true });
    await fs.mkdir(existingDuplicateDir, { recursive: true });

    await fs.writeFile(
      path.join(sourceWorkflowDir, 'SKILL.md'),
      [
        '---',
        'name: nightly-review',
        'title: "Nightly Review"',
        'description: "Wrap up today."',
        '---',
        '',
        '# Nightly Review',
      ].join('\n'),
      'utf8'
    );

    await fs.writeFile(
      path.join(existingDuplicateDir, 'SKILL.md'),
      [
        '---',
        'name: nightly-review-copy',
        'title: "Nightly Review Copy"',
        'description: "Wrap up today."',
        '---',
        '',
        '# Existing duplicate',
      ].join('\n'),
      'utf8'
    );

    await workflowsRunner.listDefinitions();
    const duplicated = await workflowsRunner.duplicateWorkflow('nightly-review');
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) return;

    expect(duplicated.data.definition.id).toBe('nightly-review-copy-2');
    expect(duplicated.data.definition.title).toBe('Nightly Review Copy (2)');
  });
});

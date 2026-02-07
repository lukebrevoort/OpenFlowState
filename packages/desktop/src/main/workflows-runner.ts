import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { WorkflowDefinition, WorkflowRun } from '../renderer/types/electron';
import { approvalPolicyStore } from './approval-policy-store.js';
import { configStore } from './config-store.js';
import { processManager } from './process-manager.js';
import { taskStore } from './task-store.js';
import type { TaskRunRecord } from './task-types.js';
import { workflowRunStore } from './workflow-run-store.js';
import { clampText, requiresUserInput, parseResponseHeader, isTaskBlocked, getCleanContent } from './workflow-response-utils.js';
import { workflowsStore } from './workflows-store.js';

type IpcErrorCode = 'NOT_IMPLEMENTED' | 'INVALID_REQUEST' | 'UNAVAILABLE' | 'UNKNOWN';

const ensureString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const isSafeWorkflowId = (id: string): boolean => {
  if (!id) return false;
  return !id.includes('/') && !id.includes('\\') && !id.includes('..');
};

const humanizeId = (id: string): string => {
  if (!id) return id;
  const cleaned = id.replace(/[._]+/g, '-');
  return cleaned
    .split('-')
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
};

const serializeArguments = (input?: unknown): string => {
  if (input === undefined || input === null) {
    return '';
  }

  if (typeof input === 'string') {
    return input;
  }

  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
};

const extractTextFromParts = (parts: unknown): string => {
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .filter((p) => p && typeof p === 'object' && (p as { type?: string }).type === 'text')
    .map((p) => ((p as { text?: string }).text ?? ''))
    .join('');
};

const safeJsonStringify = (input: unknown): string | undefined => {
  if (input === undefined) return undefined;
  try {
    return JSON.stringify(input);
  } catch {
    return JSON.stringify(String(input));
  }
};

const parseFrontmatter = (
  raw: string
): { name?: string; title?: string; description?: string; template?: string } | null => {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('---')) {
    return null;
  }

  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) {
    return null;
  }

  const frontmatterBlock = trimmed.slice(3, end).trim();
  const template = trimmed.slice(end + '\n---'.length).trim();
  const record: Record<string, string> = {};

  for (const line of frontmatterBlock.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    if (key.length === 0) continue;
    record[key] = value;
  }

  const name = ensureString(record.name);
  const title = ensureString(record.title);
  const description = ensureString(record.description);

  return {
    name: name ?? undefined,
    title: title ?? undefined,
    description: description ?? undefined,
    template,
  };
};

class WorkflowsRunner {
  private async resolveWorkflowSkillPath(
    workflowId: string
  ): Promise<{ filePath: string; source: 'user' | 'project' } | null> {
    const directory = processManager.getProjectDirectory?.() ?? undefined;
    const userDataDir = configStore.getDataDir();
    const candidates: Array<{ filePath: string; source: 'user' | 'project' }> = [];

    if (userDataDir) {
      candidates.push({
        filePath: path.join(userDataDir, 'workflows', workflowId, 'SKILL.md'),
        source: 'user',
      });
    }
    if (directory) {
      candidates.push({
        filePath: path.join(directory, 'workflows', workflowId, 'SKILL.md'),
        source: 'project',
      });
    }

    for (const candidate of candidates) {
      try {
        await fs.access(candidate.filePath);
        return candidate;
      } catch {
        continue;
      }
    }

    return null;
  }

  async getSkillMarkdown(
    workflowId: string
  ): Promise<
    | { ok: true; data: { workflowId: string; skillMarkdown: string; source: 'user' | 'project' } }
    | { ok: false; code: IpcErrorCode; message: string }
  > {
    const id = ensureString(workflowId);
    if (!id || !isSafeWorkflowId(id)) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'workflowId must be a safe, non-empty string.' };
    }

    const resolved = await this.resolveWorkflowSkillPath(id);
    if (!resolved) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Workflow file not found.' };
    }

    try {
      const skillMarkdown = await fs.readFile(resolved.filePath, 'utf8');
      return { ok: true, data: { workflowId: id, skillMarkdown, source: resolved.source } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, code: 'UNKNOWN', message: `Failed to read workflow: ${message}` };
    }
  }

  async saveSkillMarkdown(
    workflowId: string,
    skillMarkdown: string
  ): Promise<
    | { ok: true; data: { definition: WorkflowDefinition; skillMarkdown: string; source: 'user' | 'project' } }
    | { ok: false; code: IpcErrorCode; message: string }
  > {
    const id = ensureString(workflowId);
    if (!id || !isSafeWorkflowId(id)) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'workflowId must be a safe, non-empty string.' };
    }

    const content = ensureString(skillMarkdown);
    if (!content) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'skillMarkdown must be a non-empty string.' };
    }

    const parsed = parseFrontmatter(content);
    if (!parsed?.name) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'SKILL.md must include frontmatter with name.' };
    }
    if (parsed.name !== id) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: `Frontmatter name must remain "${id}". Use frontmatter title to rename the workflow.`,
      };
    }

    const resolved = await this.resolveWorkflowSkillPath(id);
    const userDataDir = configStore.getDataDir();
    const target = resolved ?? (userDataDir
      ? {
          filePath: path.join(userDataDir, 'workflows', id, 'SKILL.md'),
          source: 'user' as const,
        }
      : null);

    if (!target) {
      return { ok: false, code: 'UNAVAILABLE', message: 'No writable workflow directory available.' };
    }

    try {
      await fs.mkdir(path.dirname(target.filePath), { recursive: true });
      await fs.writeFile(target.filePath, content, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, code: 'UNKNOWN', message: `Failed to save workflow: ${message}` };
    }

    const existing = workflowsStore.getDefinition(id);
    const definition: WorkflowDefinition = {
      id,
      title: parsed.title ?? existing?.title ?? humanizeId(id),
      description: parsed.description ?? existing?.description,
    };
    workflowsStore.upsertTemplate({ id, template: parsed.template ?? '' });
    workflowsStore.upsertDefinition(definition);

    return { ok: true, data: { definition, skillMarkdown: content, source: target.source } };
  }

  async deleteWorkflow(
    workflowId: string
  ): Promise<
    | { ok: true; data: { removed: boolean } }
    | { ok: false; code: IpcErrorCode; message: string }
  > {
    const id = ensureString(workflowId);
    if (!id || !isSafeWorkflowId(id)) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'workflowId must be a safe, non-empty string.' };
    }

    const directory = processManager.getProjectDirectory?.() ?? undefined;
    const userDataDir = configStore.getDataDir();
    const candidates: string[] = [];
    if (userDataDir) {
      candidates.push(path.join(userDataDir, 'workflows', id));
    }
    if (directory) {
      candidates.push(path.join(directory, 'workflows', id));
    }

    let removed = false;
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        await fs.rm(candidate, { recursive: true, force: true });
        removed = true;
      } catch {
        continue;
      }
    }

    if (!removed) {
      return { ok: false, code: 'UNAVAILABLE', message: 'Workflow not found.' };
    }

    workflowsStore.removeDefinition(id);
    workflowsStore.removeTemplate(id);
    return { ok: true, data: { removed } };
  }

  private async loadWorkflowSkillsFromDir(baseDir: string): Promise<WorkflowDefinition[]> {
    const skillsDir = path.join(baseDir, 'workflows');
    const definitions: WorkflowDefinition[] = [];

    let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
    try {
      entries = (await fs.readdir(skillsDir, { withFileTypes: true })).filter((e) => e.isDirectory());
    } catch {
      return definitions;
    }

    for (const entry of entries) {
      const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
      try {
        const raw = await fs.readFile(skillPath, 'utf8');
        const parsed = parseFrontmatter(raw);
        const def: WorkflowDefinition = {
          id: entry.name,
          title: parsed?.title ?? humanizeId(entry.name),
          description: parsed?.description,
        };
        definitions.push(def);
        if (parsed?.template && parsed.template.length) {
          workflowsStore.upsertTemplate({ id: entry.name, template: parsed.template });
        }
      } catch {
        continue;
      }
    }

    return definitions;
  }

  async listDefinitions(): Promise<{ ok: true; data: WorkflowDefinition[] } | { ok: false; code: IpcErrorCode; message: string }>{
    const directory = processManager.getProjectDirectory?.() ?? undefined;
    const userDataDir = configStore.getDataDir();

    const fromDisk = directory ? await this.loadWorkflowSkillsFromDir(directory) : [];
    const fromUserData = userDataDir ? await this.loadWorkflowSkillsFromDir(userDataDir) : [];

    // Future hook: allow-list a small set of global (SDK) commands.
    // Default behavior must remain: zero global commands shown.
    const allowlistedGlobalCommands: string[] = [];
    const fromSdk: WorkflowDefinition[] = [];
    if (allowlistedGlobalCommands.length > 0) {
      const client = processManager.client;
      if (client) {
        try {
          const result = await client.command.list({
            query: {
              directory,
            },
          });

          if (!result.error && result.data) {
            for (const command of result.data as Array<{ name: string; description?: string }>) {
              if (!command?.name) continue;
              if (!allowlistedGlobalCommands.includes(command.name)) continue;
              fromSdk.push({
                id: command.name,
                title: humanizeId(command.name),
                description: command.description,
              });
            }
          }
        } catch (error) {
          console.warn('[WorkflowsRunner] Failed to list allowlisted SDK commands:', error);
        }
      }
    }

    const merged = new Map<string, WorkflowDefinition>();
    for (const def of [...fromDisk, ...fromUserData, ...fromSdk]) {
      merged.set(def.id, def);
    }

    const definitions = Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title));
    workflowsStore.setDefinitions(definitions);

    if (definitions.length === 0) {
      return {
        ok: false,
        code: 'UNAVAILABLE',
        message: 'No workflows found. Add workflows under workflows/*/SKILL.md (project) or workflows/*/SKILL.md (user data).',
      };
    }

    return { ok: true, data: definitions };
  }

  async run(workflowId: string, input?: unknown): Promise<{ ok: true; data: WorkflowRun } | { ok: false; code: IpcErrorCode; message: string; details?: unknown }>{
    const id = ensureString(workflowId);
    if (!id) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'workflowId must be a non-empty string.' };
    }

    const client = processManager.client;
    if (!client || !processManager.running) {
      return { ok: false, code: 'UNAVAILABLE', message: 'OpenCode is not running.' };
    }

    const directory = processManager.getProjectDirectory?.() ?? undefined;

    // Persist workflow runs + tasks alongside other local data (memory.db).
    const dataDir = configStore.getDataDir();
    taskStore.configure({ dataDir });
    workflowRunStore.configure({ dataDir });

    const workflowRunId = randomUUID();
    const taskRunId = randomUUID();
    const startedAt = Date.now();

    const workflowSessionTitle = `Workflow: ${humanizeId(id)}`;
    const workflowSessionId = await processManager.createDetachedSession(workflowSessionTitle);

    // Apply per-workflow approval opt-in to the workflow session.
    try {
      const optedIn = await approvalPolicyStore.getWorkflowOptIn(id);
      if (optedIn) {
        approvalPolicyStore.setSessionAlwaysApprove(workflowSessionId, true);
      }
    } catch (error) {
      // Never block a workflow run on policy state.
      console.warn('[WorkflowsRunner] Failed to apply per-workflow Always Approve:', error);
    }

    // Create TaskRun immediately so Tasks UI can load the timeline by sessionId.
    const taskRun: TaskRunRecord = {
      id: taskRunId,
      sessionId: workflowSessionId,
      kind: 'workflow',
      title: humanizeId(id),
      description: 'Running workflow...',
      status: 'running',
      startedAt,
      updatedAt: startedAt,
      progress: 0,
      metadata: {
        workflowId: id,
        workflowRunId,
      },
    };
    taskStore.upsertRun(taskRun);

    workflowRunStore.createRun({
      id: workflowRunId,
      workflowId: id,
      taskRunId,
      sessionId: workflowSessionId,
      status: 'running',
      startedAt,
      inputJson: safeJsonStringify(input),
    });

    const baseRun: WorkflowRun = {
      id: workflowRunId,
      workflowId: id,
      taskRunId,
      sessionId: workflowSessionId,
      status: 'running',
      startedAt,
    };

    workflowsStore.createRun(baseRun);

    const args = serializeArguments(input);
    try {
      if (workflowsStore.hasTemplate(id)) {
        const template = workflowsStore.getTemplate(id);
        const prompt = [
          `Run the workflow "${id}". Follow these instructions exactly:`,
          '',
          template ?? '',
          '',
          args.length ? `Input: ${args}` : 'Input: (none)',
        ].join('\n');

        const response = await processManager.promptSession(workflowSessionId, prompt);
        const finishedAt = Date.now();

        // Parse the response for status headers
        const parsed = parseResponseHeader(response.content);
        const blocked = isTaskBlocked(response.content);
        const needsInput = requiresUserInput(response.content);
        const cleanContent = getCleanContent(response.content);

        // Determine run status based on parsed header
        const runStatus = blocked ? 'failed' : needsInput ? 'needs_response' : 'completed';

        // Generate appropriate description based on header status
        const getTaskDescription = (): string => {
          if (parsed.hasHeader) {
            switch (parsed.status) {
              case 'needs_response': return 'Waiting for your response...';
              case 'blocked': return 'Task blocked - action required';
              case 'in_progress': return 'Working on task...';
              case 'complete': return 'Task completed';
              default: return 'Processing...';
            }
          }
          return needsInput ? 'Waiting for input...' : 'Task completed';
        };

        workflowRunStore.updateRun(workflowRunId, {
          status: runStatus,
          ...(needsInput || blocked ? {} : { finishedAt }),
          assistantMessageId: response.assistantMessageId,
          outputPreview: clampText(cleanContent, 280),
        });
        workflowRunStore.createArtifact({
          artifactId: randomUUID(),
          workflowRunId,
          kind: 'final_output',
          title: 'Final output',
          mime: 'text/plain',
          createdAt: finishedAt,
          payloadText: cleanContent,
        });

        taskStore.updateRun(taskRunId, {
          status: blocked ? 'failed' : needsInput ? 'running' : 'completed',
          ...(blocked ? { blockingReason: undefined } : needsInput ? { blockingReason: { kind: 'response' } } : { blockingReason: undefined }),
          progress: blocked || needsInput ? 50 : 100,
          updatedAt: finishedAt,
          description: getTaskDescription(),
        });

        const completed = workflowsStore.updateRun(workflowRunId, {
          status: runStatus,
          ...(needsInput || blocked ? {} : { finishedAt }),
          assistantMessageId: response.assistantMessageId,
          output: { content: cleanContent, parts: response.parts },
        });
        return { ok: true, data: completed ?? { ...baseRun, status: runStatus, ...(needsInput || blocked ? {} : { finishedAt }) } };
      }

      processManager.registerTaskSession(workflowSessionId, `command:${id}`);
      const result = await client.session.command({
        path: { id: workflowSessionId },
        query: { directory },
        body: {
          command: id,
          arguments: args,
        },
      });

      if (result.error) {
        const finishedAt = Date.now();
        const errorRecord = result.error as unknown as Record<string, unknown>;
        const messageFromError = typeof errorRecord.message === 'string' ? errorRecord.message : undefined;

        workflowRunStore.updateRun(workflowRunId, {
          status: 'failed',
          finishedAt,
          error: messageFromError ?? JSON.stringify(result.error),
        });
        taskStore.updateRun(taskRunId, {
          status: 'failed',
          updatedAt: finishedAt,
        });

        const failed = workflowsStore.updateRun(workflowRunId, {
          status: 'failed',
          finishedAt,
          error: messageFromError ?? JSON.stringify(result.error),
        });

        return { ok: true, data: failed ?? { ...baseRun, status: 'failed', finishedAt } };
      }

      const finishedAt = Date.now();
      const text = extractTextFromParts((result.data as { parts?: unknown })?.parts);

      // Parse the response for status headers
      const parsed = parseResponseHeader(text);
      const blocked = isTaskBlocked(text);
      const needsInput = requiresUserInput(text);
      const cleanContent = getCleanContent(text);

      // Determine run status based on parsed header
      const runStatus = blocked ? 'failed' : needsInput ? 'needs_response' : 'completed';

      // Generate appropriate description based on header status
      const getTaskDescription = (): string => {
        if (parsed.hasHeader) {
          switch (parsed.status) {
            case 'needs_response': return 'Waiting for your response...';
            case 'blocked': return 'Task blocked - action required';
            case 'in_progress': return 'Working on task...';
            case 'complete': return 'Task completed';
            default: return 'Processing...';
          }
        }
        return needsInput ? 'Waiting for input...' : 'Task completed';
      };

      const assistantMessageId = (result.data as { info?: { id?: string } })?.info?.id;
      workflowRunStore.updateRun(workflowRunId, {
        status: runStatus,
        ...(needsInput || blocked ? {} : { finishedAt }),
        assistantMessageId,
        outputPreview: clampText(cleanContent, 280),
      });
      workflowRunStore.createArtifact({
        artifactId: randomUUID(),
        workflowRunId,
        kind: 'final_output',
        title: 'Final output',
        mime: 'text/plain',
        createdAt: finishedAt,
        payloadText: cleanContent,
      });

      taskStore.updateRun(taskRunId, {
        status: blocked ? 'failed' : needsInput ? 'running' : 'completed',
        ...(blocked ? { blockingReason: undefined } : needsInput ? { blockingReason: { kind: 'response' } } : { blockingReason: undefined }),
        progress: blocked || needsInput ? 50 : 100,
        updatedAt: finishedAt,
        description: getTaskDescription(),
      });

      const completed = workflowsStore.updateRun(workflowRunId, {
        status: runStatus,
        ...(needsInput || blocked ? {} : { finishedAt }),
        ...(assistantMessageId ? { assistantMessageId } : {}),
        output: { content: cleanContent, raw: result.data },
      });

      return { ok: true, data: completed ?? { ...baseRun, status: runStatus, ...(needsInput || blocked ? {} : { finishedAt }) } };
    } catch (error) {
      const finishedAt = Date.now();
      const message = error instanceof Error ? error.message : String(error);

      workflowRunStore.updateRun(workflowRunId, {
        status: 'failed',
        finishedAt,
        error: message,
      });
      taskStore.updateRun(taskRunId, {
        status: 'failed',
        updatedAt: finishedAt,
      });

      const failed = workflowsStore.updateRun(workflowRunId, {
        status: 'failed',
        finishedAt,
        error: message,
      });

      return { ok: true, data: failed ?? { ...baseRun, status: 'failed', finishedAt, error: message } };
    }
  }
}

export const workflowsRunner = new WorkflowsRunner();

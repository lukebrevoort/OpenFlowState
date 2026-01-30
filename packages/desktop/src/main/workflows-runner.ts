import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { WorkflowDefinition, WorkflowRun } from '../renderer/types/electron';
import { processManager } from './process-manager.js';
import { workflowsStore } from './workflows-store.js';

type IpcErrorCode = 'NOT_IMPLEMENTED' | 'INVALID_REQUEST' | 'UNAVAILABLE' | 'UNKNOWN';

const ensureString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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

const parseFrontmatter = (raw: string): { name?: string; description?: string; template?: string } | null => {
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
    const value = line.slice(idx + 1).trim();
    if (key.length === 0) continue;
    record[key] = value;
  }

  const name = ensureString(record.name);
  const description = ensureString(record.description);

  return {
    name: name ?? undefined,
    description: description ?? undefined,
    template,
  };
};

class WorkflowsRunner {
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
        if (!parsed?.name) {
          continue;
        }

        const def: WorkflowDefinition = {
          id: parsed.name,
          title: humanizeId(parsed.name),
          description: parsed.description,
        };
        definitions.push(def);
        if (parsed.template && parsed.template.length) {
          workflowsStore.upsertTemplate({ id: parsed.name, template: parsed.template });
        }
      } catch {
        continue;
      }
    }

    return definitions;
  }

  async listDefinitions(): Promise<{ ok: true; data: WorkflowDefinition[] } | { ok: false; code: IpcErrorCode; message: string }>{
    const client = processManager.client;
    const directory = processManager.getProjectDirectory?.() ?? undefined;

    const fromSdk: WorkflowDefinition[] = [];
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
            // Heuristic: hide built-in dotted commands (session.list, prompt.clear, etc.)
            if (command.name.includes('.')) continue;
            fromSdk.push({
              id: command.name,
              title: humanizeId(command.name),
              description: command.description,
            });
          }
        }
      } catch (error) {
        console.warn('[WorkflowsRunner] Failed to list commands via SDK:', error);
      }
    }

    const fromDisk = directory ? await this.loadWorkflowSkillsFromDir(directory) : [];
    const merged = new Map<string, WorkflowDefinition>();
    for (const def of [...fromSdk, ...fromDisk]) {
      merged.set(def.id, def);
    }

    const definitions = Array.from(merged.values()).sort((a, b) => a.title.localeCompare(b.title));
    workflowsStore.setDefinitions(definitions);

    if (definitions.length === 0) {
      return {
        ok: false,
        code: 'UNAVAILABLE',
        message: 'No workflows found. Ensure OpenCode is running or add workflows under workflows/*/SKILL.md.',
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
    const sessionId = processManager.sessionId ?? (await processManager.createSession('FlowState Workflows'));
    const runId = randomUUID();
    const startedAt = Date.now();

    const baseRun: WorkflowRun = {
      id: runId,
      workflowId: id,
      status: 'queued',
      startedAt,
    };

    workflowsStore.createRun(baseRun);
    workflowsStore.updateRun(runId, { status: 'running' });

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
        const response = await processManager.sendMessage(prompt);
        const finishedAt = Date.now();
        const completed = workflowsStore.updateRun(runId, {
          status: 'completed',
          finishedAt,
          output: { content: response.content, parts: response.parts },
        });
        return { ok: true, data: completed ?? { ...baseRun, status: 'completed', finishedAt } };
      }

      const result = await client.session.command({
        path: { id: sessionId },
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
        const failed = workflowsStore.updateRun(runId, {
          status: 'failed',
          finishedAt,
          error: messageFromError ?? JSON.stringify(result.error),
        });

        return { ok: true, data: failed ?? { ...baseRun, status: 'failed', finishedAt } };
      }

      const finishedAt = Date.now();
      const text = extractTextFromParts((result.data as { parts?: unknown })?.parts);
      const completed = workflowsStore.updateRun(runId, {
        status: 'completed',
        finishedAt,
        output: { content: text, raw: result.data },
      });

      return { ok: true, data: completed ?? { ...baseRun, status: 'completed', finishedAt } };
    } catch (error) {
      const finishedAt = Date.now();
      const message = error instanceof Error ? error.message : String(error);
      const failed = workflowsStore.updateRun(runId, {
        status: 'failed',
        finishedAt,
        error: message,
      });

      return { ok: true, data: failed ?? { ...baseRun, status: 'failed', finishedAt, error: message } };
    }
  }
}

export const workflowsRunner = new WorkflowsRunner();

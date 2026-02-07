import fs from 'fs/promises';
import path from 'path';
import type { WorkflowDefinition } from '../renderer/types/electron';
import { configStore } from './config-store.js';
import { processManager } from './process-manager.js';
import { workflowsStore } from './workflows-store.js';

type IpcErrorCode = 'NOT_IMPLEMENTED' | 'INVALID_REQUEST' | 'UNAVAILABLE' | 'UNKNOWN';

export type WorkflowGenerationResult = {
  definition: WorkflowDefinition;
  skillMarkdown: string;
};

type GenerateOk = { ok: true; data: WorkflowGenerationResult };
type GenerateErr = { ok: false; code: IpcErrorCode; message: string; details?: unknown };
export type GenerateResult = GenerateOk | GenerateErr;

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

const slugify = (raw: string): string => {
  const lowered = raw
    .trim()
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
  return lowered;
};

const WORKFLOW_NAME_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'to',
  'for',
  'of',
  'on',
  'in',
  'at',
  'with',
  'and',
  'or',
  'my',
  'your',
  'our',
  'their',
  'me',
  'you',
  'we',
  'they',
  'add',
  'create',
  'make',
  'build',
  'workflow',
  'workflows',
  'please',
  'that',
  'this',
  'from',
  'into',
  'every',
  'each',
  'daily',
  'weekly',
  'monthly',
]);

const buildWorkflowSlug = (intent: string): string => {
  const tokens = intent
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const filtered = tokens.filter((token) => !WORKFLOW_NAME_STOPWORDS.has(token));
  const baseTokens = (filtered.length ? filtered : tokens).slice(0, 6);
  const base = baseTokens.join(' ');

  const slug = slugify(base).slice(0, 32);
  if (slug.length > 0) return slug;

  return slugify(intent).slice(0, 48);
};

const escapeYamlString = (value: string): string => {
  // Keep it single-line; YAML double-quoted string.
  const singleLine = value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const escaped = singleLine.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
};

const redactSecrets = (input: string): string => {
  const patterns: RegExp[] = [
    /\bsk-[A-Za-z0-9]{16,}\b/g,
    /\brk-[A-Za-z0-9]{16,}\b/g,
    /\bAIza[0-9A-Za-z\-_]{30,}\b/g,
    /\bghp_[A-Za-z0-9]{30,}\b/g,
    /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
    /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g,
    /\bBearer\s+[A-Za-z0-9_\-\.~=]{20,}\b/gi,
    /\bBasic\s+[A-Za-z0-9_\-\.~=]{20,}\b/gi,
  ];

  let redacted = input;
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }

  // Also scrub obvious KEY=... style secrets.
  redacted = redacted.replace(
    /(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s\n]{8,}/gi,
    (_m, key) => `${String(key)}=[REDACTED]`
  );

  // Keep prompt bounded.
  if (redacted.length > 2000) {
    redacted = `${redacted.slice(0, 2000)}...`;
  }

  return redacted;
};

const parseSkillMarkdown = (raw: string): { title?: string; description?: string; body: string } => {
  const trimmed = raw.replace(/\r\n/g, '\n').trim();
  if (!trimmed.startsWith('---')) {
    return { body: trimmed };
  }

  const end = trimmed.indexOf('\n---', 3);
  if (end === -1) {
    return { body: trimmed };
  }

  const fm = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + '\n---'.length).trim();
  const record: Record<string, string> = {};
  for (const line of fm.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    record[key] = value.replace(/^"|"$/g, '');
  }

  return {
    title: ensureString(record.title) ?? undefined,
    description: ensureString(record.description) ?? undefined,
    body,
  };
};

const ensureUniqueWorkflowId = async (baseWorkflowsDir: string, desired: string): Promise<string> => {
  const base = desired.length ? desired : `workflow-${Date.now().toString(36)}`;
  const exists = async (candidate: string): Promise<boolean> => {
    try {
      await fs.access(path.join(baseWorkflowsDir, candidate, 'SKILL.md'));
      return true;
    } catch {
      return false;
    }
  };

  if (!(await exists(base))) {
    return base;
  }

  for (let i = 2; i < 10_000; i += 1) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
};

const buildGeneratorPrompt = (intent: string, workflowId: string): string => {
  const intentLine = intent.replace(/[\r\n]+/g, ' ').trim();
  return [
    'You are an OpenCode workflow generator.',
    '',
    'Return ONLY the complete contents of a file named SKILL.md.',
    'No preamble, no explanations, no code fences.',
    '',
    'Strict format requirements:',
    '- The first line MUST be "---".',
    '- YAML frontmatter MUST contain ONLY these keys: name, title, description.',
    `- name MUST be exactly: ${workflowId}`,
    '- title MUST be a short, human-friendly workflow title.',
    '- description MUST be a single sentence (<= 140 chars) describing what the workflow does.',
    '- After YAML, include a markdown body with these sections:',
    '  - A title heading ("# ...")',
    '  - "## What you do" with numbered steps',
    '  - "## Safety" with explicit approval requirements (no destructive actions)',
    '  - "## Output format" describing the response structure',
    '',
    'Safety constraints:',
    '- Do NOT call tools. Do NOT run commands. Do NOT access the filesystem.',
    '- Do NOT include secrets/tokens/API keys/cookies. If the intent contains them, ignore them.',
    '',
    `User intent: ${escapeYamlString(intentLine)}`,
  ].join('\n');
};

class WorkflowsGenerator {
  async generateFromIntent(intent: string): Promise<GenerateResult> {
    const rawIntent = ensureString(intent);
    if (!rawIntent) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'intent must be a non-empty string.' };
    }

    if (!processManager.running) {
      return { ok: false, code: 'UNAVAILABLE', message: 'OpenCode is not running.' };
    }

    const intentRedacted = redactSecrets(rawIntent);
    const baseWorkflowsDir = path.join(configStore.getDataDir(), 'workflows');
    const slugBase = buildWorkflowSlug(intentRedacted);
    const workflowId = await ensureUniqueWorkflowId(baseWorkflowsDir, slugBase);

    const prompt = buildGeneratorPrompt(intentRedacted, workflowId);

    let generated = '';
    try {
      const response = await processManager.sendMessage(prompt, undefined, {
        skipTaskTracking: true,
        skipWorkflowSync: true,
      });
      generated = response.content ?? '';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, code: 'UNKNOWN', message: `Failed to generate workflow: ${message}` };
    }

    const parsed = parseSkillMarkdown(generated);
    const title = parsed.title ?? humanizeId(workflowId);
    const description =
      parsed.description ??
      ensureString(intentRedacted.replace(/\s+/g, ' ').trim().slice(0, 140)) ??
      'Generated workflow.';

    const normalized = [
      '---',
      `name: ${workflowId}`,
      `title: ${escapeYamlString(title)}`,
      `description: ${escapeYamlString(description)}`,
      '---',
      '',
      parsed.body.length
        ? parsed.body
        : '# Workflow\n\n## What you do\n\n1. Describe steps.\n\n## Safety\n\n- Ask for approval before any write operations.\n\n## Output format\n\n- Provide results as bullets.',
      '',
    ].join('\n');

    const targetDir = path.join(baseWorkflowsDir, workflowId);
    const targetPath = path.join(targetDir, 'SKILL.md');
    try {
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetPath, normalized, 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, code: 'UNKNOWN', message: `Failed to persist workflow: ${message}` };
    }

    const definition: WorkflowDefinition = {
      id: workflowId,
      title,
      description,
    };

    // Make the workflow runnable immediately without requiring a list() refresh.
    workflowsStore.upsertTemplate({ id: workflowId, template: parsed.body });
    workflowsStore.upsertDefinition(definition);

    return { ok: true, data: { definition, skillMarkdown: normalized } };
  }
}

export const workflowsGenerator = new WorkflowsGenerator();

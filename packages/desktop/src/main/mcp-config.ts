import type { McpLocalConfig, McpRemoteConfig } from '@opencode-ai/sdk';

export type OpencodeMcpConfig = Record<string, McpLocalConfig | McpRemoteConfig>;

export type CustomMcpNormalizeResult = {
  config: OpencodeMcpConfig;
  errors: Record<string, string>;
  skipped: Record<string, string>;
};

const RESERVED_MCP_NAMES = new Set(['notion']);

export function isReservedMcpName(name: string): boolean {
  return name.startsWith('flowstate-') || RESERVED_MCP_NAMES.has(name);
}

function coerceStringRecord(input: unknown): Record<string, string> | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const obj = input as Record<string, unknown>;

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function coerceStringArray(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const arr = input.filter((v) => typeof v === 'string') as string[];
  return arr.length ? arr : [];
}

export function normalizeCustomMcpServers(mcpServers: unknown): CustomMcpNormalizeResult {
  const result: CustomMcpNormalizeResult = {
    config: {},
    errors: {},
    skipped: {},
  };

  if (!mcpServers || typeof mcpServers !== 'object') {
    return result;
  }

  const servers = mcpServers as Record<string, any>;

  for (const [name, rawConfig] of Object.entries(servers)) {
    if (!name || typeof name !== 'string') continue;

    if (isReservedMcpName(name)) {
      result.skipped[name] = 'reserved';
      continue;
    }

    if (!rawConfig || typeof rawConfig !== 'object') {
      result.errors[name] = 'Invalid config shape (expected object)';
      continue;
    }

    const enabled = Boolean((rawConfig as any).enabled);
    if (!enabled) {
      result.skipped[name] = 'disabled';
      continue;
    }

    const timeout = typeof (rawConfig as any).timeout === 'number' ? (rawConfig as any).timeout : undefined;

    const url = typeof (rawConfig as any).url === 'string' ? (rawConfig as any).url.trim() : '';
    if (url) {
      const headers = coerceStringRecord((rawConfig as any).headers);
      result.config[name] = {
        type: 'remote',
        url,
        enabled: true,
        ...(headers ? { headers } : {}),
        ...(timeout !== undefined ? { timeout } : {}),
      } satisfies McpRemoteConfig;
      continue;
    }

    const command = coerceStringArray((rawConfig as any).command);
    if (command === null) {
      result.errors[name] = 'Invalid command (expected string[])';
      continue;
    }

    if (command.length === 0) {
      result.errors[name] = 'Missing command (provide a non-empty command array)';
      continue;
    }

    const environment = coerceStringRecord((rawConfig as any).env);

    result.config[name] = {
      type: 'local',
      command,
      enabled: true,
      ...(environment ? { environment } : {}),
      ...(timeout !== undefined ? { timeout } : {}),
    } satisfies McpLocalConfig;
  }

  return result;
}

import { describe, expect, it } from 'vitest';
import { normalizeCustomMcpServers } from './mcp-config.js';

describe('normalizeCustomMcpServers', () => {
  it('includes enabled local and remote servers and maps env->environment', () => {
    const { config, errors, skipped } = normalizeCustomMcpServers({
      'flowstate-gmail': { enabled: true, command: ['node', 'PLACEHOLDER_PATH'] },
      notion: { enabled: true, command: ['npx', '-y', '@notionhq/notion-mcp-server'] },
      myfs: {
        enabled: true,
        command: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        env: { FOO: 'bar', NUM: 123 },
      },
      remoteA: {
        enabled: true,
        url: 'http://localhost:3333',
        headers: { Authorization: 'Bearer abc', X: 1 },
      },
      disabledOne: {
        enabled: false,
        command: ['echo', 'nope'],
      },
      badOne: {
        enabled: true,
      },
    });

    expect(config.myfs).toEqual({
      type: 'local',
      command: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      enabled: true,
      environment: { FOO: 'bar' },
    });

    expect(config.remoteA).toEqual({
      type: 'remote',
      url: 'http://localhost:3333',
      enabled: true,
      headers: { Authorization: 'Bearer abc' },
    });

    expect(errors.badOne).toMatch(/Missing command|Invalid/);
    expect(skipped['flowstate-gmail']).toBe('reserved');
    expect(skipped['notion']).toBe('reserved');
    expect(skipped.disabledOne).toBe('disabled');
  });
});

import { describe, expect, it } from 'vitest';

import { normalizeOpenCodeEvent } from './timeline-normalizer.js';

describe('normalizeOpenCodeEvent approval payloads', () => {
  it('maps legacy permission.updated into an actionable approval request', () => {
    const normalized = normalizeOpenCodeEvent(
      {
        type: 'permission.updated',
        properties: {
          id: 'perm-123',
          type: 'bash',
          pattern: ['/Users/demo/Desktop/*'],
          metadata: {
            command: 'rm -rf /Users/demo/Desktop/tmp',
          },
        },
      },
      'session-1'
    );

    expect(normalized).not.toBeNull();
    expect(normalized?.event.kind).toBe('approval_request');
    expect(normalized?.payload).toMatchObject({
      requestId: 'perm-123',
    });

    const payload = (normalized?.payload ?? {}) as Record<string, unknown>;
    expect(String(payload.title ?? '')).toContain('Approval requested');
    expect(String(payload.summary ?? '')).toContain('requested');
    expect(String(payload.body ?? '')).toContain('Targets:');
    expect(String(payload.body ?? '')).toContain('/Users/demo/Desktop/*');
  });

  it('maps permission.replied with permissionID to approval_response', () => {
    const normalized = normalizeOpenCodeEvent(
      {
        type: 'permission.replied',
        properties: {
          sessionID: 'session-1',
          permissionID: 'perm-456',
          response: 'once',
        },
      },
      'session-1'
    );

    expect(normalized).not.toBeNull();
    expect(normalized?.event.kind).toBe('approval_response');
    expect(normalized?.payload).toMatchObject({
      requestId: 'perm-456',
    });
  });
});

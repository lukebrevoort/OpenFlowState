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

  it('does NOT truncate long approval payloads (Phase 5.5 Step 2)', () => {
    // Generate a body longer than the old MAX_APPROVAL_BODY_LENGTH (5000 chars)
    const longCommand = `echo "${'x'.repeat(6000)}"`;
    const longMetadata = { data: 'y'.repeat(3000) };

    const normalized = normalizeOpenCodeEvent(
      {
        type: 'permission.updated',
        properties: {
          id: 'perm-long',
          type: 'bash',
          body: longCommand,
          metadata: longMetadata,
        },
      },
      'session-1'
    );

    expect(normalized).not.toBeNull();
    expect(normalized?.event.kind).toBe('approval_request');

    const payload = normalized?.payload as Record<string, unknown>;
    // The body should be the exact long command, not truncated
    expect(payload.body).toBe(longCommand);
    expect((payload.body as string).length).toBeGreaterThan(5000);
    // Should not contain truncation marker
    expect(payload.body).not.toContain('…');
  });

  it('does NOT truncate long approval summary', () => {
    // Generate a summary longer than the old MAX_APPROVAL_SUMMARY_LENGTH (220 chars)
    const longSummary = 'A '.repeat(200).trim(); // trim to match pickText behavior

    const normalized = normalizeOpenCodeEvent(
      {
        type: 'permission.asked',
        properties: {
          requestId: 'perm-summary',
          summary: longSummary,
        },
      },
      'session-1'
    );

    expect(normalized).not.toBeNull();
    const payload = normalized?.payload as Record<string, unknown>;
    // The summary should be the exact long summary, not truncated
    expect(payload.summary).toBe(longSummary);
    expect((payload.summary as string).length).toBeGreaterThan(220);
    // Should not contain truncation marker
    expect(payload.summary).not.toContain('…');
  });
});

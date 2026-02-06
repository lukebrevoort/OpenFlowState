import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/flowstate-desktop-tests',
  },
}));

const { approvalPolicyStore } = await import('./approval-policy-store.js');

describe('approvalPolicyStore request tracking', () => {
  it('returns undefined for unknown requestIds', () => {
    const sessionId = approvalPolicyStore.getSessionIdForRequest('__unknown_request__');
    expect(sessionId).toBeUndefined();
  });

  it('tracks and untracks requestIds', () => {
    const requestId = `req_test_${Date.now()}`;
    const sessionId = `sess_test_${Date.now()}`;

    approvalPolicyStore.trackRequest(requestId, sessionId);
    expect(approvalPolicyStore.isTrackedRequest(requestId)).toBe(true);
    expect(approvalPolicyStore.getSessionIdForRequest(requestId)).toBe(sessionId);

    approvalPolicyStore.untrackRequest(requestId);
    expect(approvalPolicyStore.isTrackedRequest(requestId)).toBe(false);
    expect(approvalPolicyStore.getSessionIdForRequest(requestId)).toBeUndefined();
  });
});

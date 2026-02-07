import { describe, expect, it } from 'vitest';

import { deriveApprovalBlockingPatch } from './approval-blocking.js';

describe('deriveApprovalBlockingPatch', () => {
  it('blocks running tasks on permission.asked', () => {
    const patch = deriveApprovalBlockingPatch('permission.asked', {
      status: 'running',
      description: 'Running...',
    });

    expect(patch).toEqual({
      status: 'waiting_approval',
      blockingReason: { kind: 'permission' },
    });
  });

  it('blocks running tasks on legacy permission.updated', () => {
    const patch = deriveApprovalBlockingPatch('permission.updated', {
      status: 'running',
      description: 'Running...',
    });

    expect(patch).toEqual({
      status: 'waiting_approval',
      blockingReason: { kind: 'permission' },
    });
  });

  it('does not block if task is already waiting_approval', () => {
    const patch = deriveApprovalBlockingPatch('permission.asked', {
      status: 'waiting_approval',
      description: 'Waiting...',
    });

    expect(patch).toBeNull();
  });

  it('unblocks waiting tasks on non-request permission events', () => {
    const patch = deriveApprovalBlockingPatch('permission.replied', {
      status: 'waiting_approval',
      description: 'Waiting for input...',
    });

    expect(patch).toEqual({
      status: 'running',
      blockingReason: undefined,
      description: 'Running...',
    });
  });

  it('does not override terminal statuses', () => {
    expect(
      deriveApprovalBlockingPatch('permission.asked', {
        status: 'completed',
        description: 'Done',
      })
    ).toBeNull();

    expect(
      deriveApprovalBlockingPatch('permission.replied', {
        status: 'failed',
        description: 'Failed',
      })
    ).toBeNull();
  });
});

import type { TaskRunRecord } from './task-types.js';

type TaskRunStatus = TaskRunRecord['status'];
type BlockingReason = TaskRunRecord['blockingReason'];

export type ApprovalBlockingPatch = {
  status?: TaskRunStatus;
  blockingReason?: BlockingReason;
  description?: string;
};

export const isApprovalEventType = (rawType: string): boolean => {
  if (!rawType) return false;
  return rawType === 'permission.asked' || rawType.startsWith('approval.') || rawType.startsWith('permission.');
};

export const isApprovalRequestEventType = (rawType: string): boolean => {
  if (!rawType) return false;
  return (
    rawType === 'permission.updated' ||
    rawType.endsWith('.asked') ||
    rawType.includes('asked') ||
    rawType.includes('request')
  );
};

export const deriveApprovalBlockingPatch = (rawType: string, existing: Pick<TaskRunRecord, 'status' | 'description'>):
  | ApprovalBlockingPatch
  | null => {
  if (!isApprovalEventType(rawType)) return null;

  if (existing.status === 'cancelled' || existing.status === 'completed' || existing.status === 'failed') return null;

  const isRequest = isApprovalRequestEventType(rawType);
  if (isRequest) {
    if (existing.status !== 'running' && existing.status !== 'starting') return null;
    return {
      status: 'waiting_approval',
      blockingReason: { kind: 'permission' },
    };
  }

  if (existing.status !== 'waiting_approval') return null;

  return {
    status: 'running',
    blockingReason: undefined,
    ...(existing.description === 'Waiting for input...' ? { description: 'Running...' } : {}),
  };
};

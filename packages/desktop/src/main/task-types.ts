import type { TaskRun as RendererTaskRun } from '../renderer/types/electron';

export type TaskRunKind = string;

export type TaskRunStatus = RendererTaskRun['status'] | 'starting' | 'cancelled';

export type ActiveTaskRunStatus = 'running' | 'waiting_approval' | 'starting';

export interface TaskRunRecord {
  id: string;
  sessionId: string;
  kind: TaskRunKind;
  title: string;
  description: string;
  status: TaskRunStatus;
  startedAt: number;
  updatedAt: number;
  progress: number;
  summary?: string;
  metadata?: unknown;
}

export type TaskRunPatch = Partial<Omit<TaskRunRecord, 'id'>>;

export const toRendererTaskRun = (record: TaskRunRecord): RendererTaskRun => {
  const status: RendererTaskRun['status'] =
    record.status === 'starting'
      ? 'running'
      : record.status === 'cancelled'
        ? 'failed'
        : record.status;

  return {
    id: record.id,
    sessionId: record.sessionId,
    title: record.title,
    description: record.description,
    status,
    startedAt: record.startedAt,
    updatedAt: record.updatedAt,
    progress: record.progress,
    ...(record.summary === undefined ? {} : { summary: record.summary }),
    ...(record.metadata === undefined ? {} : { metadata: record.metadata }),
  };
};

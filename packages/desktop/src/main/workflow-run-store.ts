import fsSync from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

const DEFAULT_DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'FlowState');

export type WorkflowRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | (string & {});

export type WorkflowRunRecord = {
  id: string;
  workflowId: string;
  taskRunId?: string;
  sessionId?: string;
  assistantMessageId?: string;
  status: WorkflowRunStatus;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
  inputJson?: string;
  outputPreview?: string;
  error?: string;
};

export type WorkflowRunPatch = Partial<Omit<WorkflowRunRecord, 'id' | 'workflowId'>>;

export type WorkflowRunListQuery = {
  limit?: number;
  offset?: number;
};

export type WorkflowArtifactKind = 'final_output' | 'summary' | 'export' | (string & {});

export type WorkflowRunArtifactRecord = {
  artifactId: string;
  workflowRunId: string;
  kind: WorkflowArtifactKind;
  title?: string;
  mime?: string;
  createdAt: number;
  payloadText?: string;
};

type WorkflowRunRow = {
  id: string;
  workflow_id: string;
  task_run_id: string | null;
  session_id: string | null;
  assistant_message_id: string | null;
  status: string;
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
  input_json: string | null;
  output_preview: string | null;
  error: string | null;
};

type WorkflowArtifactRow = {
  artifact_id: string;
  workflow_run_id: string;
  kind: string;
  title: string | null;
  mime: string | null;
  created_at: number;
  payload_text: string | null;
};

const rowToRunRecord = (row: WorkflowRunRow): WorkflowRunRecord => {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    ...(row.task_run_id ? { taskRunId: row.task_run_id } : {}),
    ...(row.session_id ? { sessionId: row.session_id } : {}),
    ...(row.assistant_message_id ? { assistantMessageId: row.assistant_message_id } : {}),
    status: row.status as WorkflowRunStatus,
    startedAt: row.started_at,
    ...(row.finished_at === null ? {} : { finishedAt: row.finished_at }),
    ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
    ...(row.input_json === null ? {} : { inputJson: row.input_json }),
    ...(row.output_preview === null ? {} : { outputPreview: row.output_preview }),
    ...(row.error === null ? {} : { error: row.error }),
  };
};

const rowToArtifactRecord = (row: WorkflowArtifactRow): WorkflowRunArtifactRecord => {
  return {
    artifactId: row.artifact_id,
    workflowRunId: row.workflow_run_id,
    kind: row.kind as WorkflowArtifactKind,
    ...(row.title === null ? {} : { title: row.title }),
    ...(row.mime === null ? {} : { mime: row.mime }),
    createdAt: row.created_at,
    ...(row.payload_text === null ? {} : { payloadText: row.payload_text }),
  };
};

export type WorkflowRunStoreConfig = {
  dataDir?: string;
};

export class WorkflowRunStore {
  private db: Database.Database | null = null;
  private dataDir: string;
  private dbPath: string;

  constructor(config?: WorkflowRunStoreConfig) {
    this.dataDir = config?.dataDir ?? DEFAULT_DATA_DIR;
    this.dbPath = path.join(this.dataDir, 'memory.db');
  }

  configure(config: WorkflowRunStoreConfig): void {
    if (this.db) {
      return;
    }

    if (config.dataDir) {
      this.dataDir = config.dataDir;
      this.dbPath = path.join(this.dataDir, 'memory.db');
    }
  }

  initialize(): void {
    if (this.db) return;
    this.ensureDirsSync();
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private ensureDirsSync(): void {
    if (!this.dataDir) return;
    try {
      fsSync.mkdirSync(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('[WorkflowRunStore] Failed to create data dir:', error);
    }
  }

  private initSchema(): void {
    if (!this.db) throw new Error('WorkflowRunStore not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        task_run_id TEXT,
        session_id TEXT,
        assistant_message_id TEXT,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        duration_ms INTEGER,
        input_json TEXT,
        output_preview TEXT,
        error TEXT
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_started
      ON workflow_runs (workflow_id, started_at);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
      ON workflow_runs (status);
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_run_artifacts (
        artifact_id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT,
        mime TEXT,
        created_at INTEGER NOT NULL,
        payload_text TEXT,
        FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_run_created
      ON workflow_run_artifacts (workflow_run_id, created_at);
    `);
  }

  private upsertRun(run: WorkflowRunRecord): void {
    this.initialize();
    if (!this.db) return;

    const finishedAt = run.finishedAt ?? null;
    const durationMs =
      run.durationMs ?? (finishedAt === null ? null : Math.max(0, finishedAt - (run.startedAt ?? finishedAt)));

    this.db
      .prepare(
        `
        INSERT INTO workflow_runs (
          id,
          workflow_id,
          task_run_id,
          session_id,
          assistant_message_id,
          status,
          started_at,
          finished_at,
          duration_ms,
          input_json,
          output_preview,
          error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          workflow_id = excluded.workflow_id,
          task_run_id = excluded.task_run_id,
          session_id = excluded.session_id,
          assistant_message_id = excluded.assistant_message_id,
          status = excluded.status,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at,
          duration_ms = excluded.duration_ms,
          input_json = excluded.input_json,
          output_preview = excluded.output_preview,
          error = excluded.error
        `
      )
      .run(
        run.id,
        run.workflowId,
        run.taskRunId ?? null,
        run.sessionId ?? null,
        run.assistantMessageId ?? null,
        run.status,
        run.startedAt,
        finishedAt,
        durationMs,
        run.inputJson ?? null,
        run.outputPreview ?? null,
        run.error ?? null
      );
  }

  createRun(record: WorkflowRunRecord): void {
    this.upsertRun(record);
  }

  updateRun(id: string, patch: WorkflowRunPatch): WorkflowRunRecord | null {
    const existing = this.getRun(id);
    if (!existing) return null;

    const merged: WorkflowRunRecord = {
      ...existing,
      ...patch,
    };

    if (merged.finishedAt !== undefined && merged.durationMs === undefined) {
      merged.durationMs = Math.max(0, merged.finishedAt - merged.startedAt);
    }

    this.upsertRun(merged);
    return merged;
  }

  getRun(id: string): WorkflowRunRecord | null {
    this.initialize();
    if (!this.db) return null;

    const row = this.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(id) as WorkflowRunRow | undefined;
    if (!row) return null;
    return rowToRunRecord(row);
  }

  getRunBySessionId(sessionId: string): WorkflowRunRecord | null {
    this.initialize();
    if (!this.db) return null;

    const row = this.db
      .prepare('SELECT * FROM workflow_runs WHERE session_id = ? ORDER BY started_at DESC LIMIT 1')
      .get(sessionId) as WorkflowRunRow | undefined;

    return row ? rowToRunRecord(row) : null;
  }

  listRunsByWorkflow(workflowId: string, query: WorkflowRunListQuery = {}): WorkflowRunRecord[] {
    this.initialize();
    if (!this.db) return [];

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const rows = this.db
      .prepare(
        `
        SELECT * FROM workflow_runs
        WHERE workflow_id = ?
        ORDER BY started_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(workflowId, limit, offset) as WorkflowRunRow[];

    return rows.map(rowToRunRecord);
  }

  createArtifact(record: WorkflowRunArtifactRecord): void {
    this.initialize();
    if (!this.db) return;

    this.db
      .prepare(
        `
        INSERT INTO workflow_run_artifacts (
          artifact_id,
          workflow_run_id,
          kind,
          title,
          mime,
          created_at,
          payload_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(artifact_id) DO UPDATE SET
          workflow_run_id = excluded.workflow_run_id,
          kind = excluded.kind,
          title = excluded.title,
          mime = excluded.mime,
          created_at = excluded.created_at,
          payload_text = excluded.payload_text
        `
      )
      .run(
        record.artifactId,
        record.workflowRunId,
        record.kind,
        record.title ?? null,
        record.mime ?? null,
        record.createdAt,
        record.payloadText ?? null
      );
  }

  listArtifactsByRun(workflowRunId: string): WorkflowRunArtifactRecord[] {
    this.initialize();
    if (!this.db) return [];

    const rows = this.db
      .prepare(
        `
        SELECT * FROM workflow_run_artifacts
        WHERE workflow_run_id = ?
        ORDER BY created_at ASC
        `
      )
      .all(workflowRunId) as WorkflowArtifactRow[];

    return rows.map(rowToArtifactRecord);
  }
}

export const workflowRunStore = new WorkflowRunStore();

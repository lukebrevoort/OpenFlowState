import fsSync from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import type { TaskRunPatch, TaskRunRecord, TaskRunStatus } from './task-types.js';

const DEFAULT_DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'FlowState');

export type TaskRunListQuery = {
  limit?: number;
  offset?: number;
  status?: TaskRunStatus;
};

export type ActiveTaskRunQuery = {
  sessionId?: string;
};

type TaskRunRow = {
  id: string;
  session_id: string;
  kind: string;
  title: string;
  description: string;
  status: string;
  started_at: number;
  updated_at: number;
  progress: number;
  summary: string | null;
  metadata: string | null;
};

const clampProgress = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const parseMetadata = (raw: string | null): unknown | undefined => {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const stringifyMetadata = (value: unknown | undefined): string | null => {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const rowToRecord = (row: TaskRunRow): TaskRunRecord => {
  return {
    id: row.id,
    sessionId: row.session_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    status: row.status as TaskRunRecord['status'],
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    progress: clampProgress(row.progress),
    ...(row.summary === null ? {} : { summary: row.summary }),
    ...(row.metadata ? { metadata: parseMetadata(row.metadata) } : {}),
  };
};

export type TaskStoreConfig = {
  dataDir?: string;
};

export class TaskStore {
  private db: Database.Database | null = null;
  private dataDir: string;
  private dbPath: string;

  constructor(config?: TaskStoreConfig) {
    this.dataDir = config?.dataDir ?? DEFAULT_DATA_DIR;
    this.dbPath = path.join(this.dataDir, 'memory.db');
  }

  configure(config: TaskStoreConfig): void {
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
    this.initSchema();
  }

  private ensureDirsSync(): void {
    if (!this.dataDir) return;
    try {
      fsSync.mkdirSync(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('[TaskStore] Failed to create data dir:', error);
    }
  }

  private initSchema(): void {
    if (!this.db) throw new Error('TaskStore not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        progress INTEGER NOT NULL,
        summary TEXT,
        metadata TEXT
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_runs_session_id
      ON task_runs (session_id);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_runs_updated_at
      ON task_runs (updated_at);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_task_runs_status
      ON task_runs (status);
    `);
  }

  upsertRun(run: TaskRunRecord): void {
    this.initialize();
    if (!this.db) return;

    const stmt = this.db.prepare(`
      INSERT INTO task_runs (
        id, session_id, kind, title, description, status,
        started_at, updated_at, progress, summary, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        session_id = excluded.session_id,
        kind = excluded.kind,
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        started_at = excluded.started_at,
        updated_at = excluded.updated_at,
        progress = excluded.progress,
        summary = excluded.summary,
        metadata = excluded.metadata
    `);

    stmt.run(
      run.id,
      run.sessionId,
      run.kind,
      run.title,
      run.description,
      run.status,
      run.startedAt,
      run.updatedAt,
      clampProgress(run.progress),
      run.summary ?? null,
      stringifyMetadata(run.metadata)
    );
  }

  updateRun(id: string, patch: TaskRunPatch): TaskRunRecord | null {
    const existing = this.getRun(id);
    if (!existing) return null;

    const merged: TaskRunRecord = {
      ...existing,
      ...patch,
      progress: clampProgress(patch.progress ?? existing.progress),
      updatedAt: patch.updatedAt ?? Date.now(),
    };

    this.upsertRun(merged);
    return merged;
  }

  getRun(id: string): TaskRunRecord | null {
    this.initialize();
    if (!this.db) return null;

    const row = this.db
      .prepare('SELECT * FROM task_runs WHERE id = ?')
      .get(id) as TaskRunRow | undefined;

    if (!row) return null;
    return rowToRecord(row);
  }

  deleteRun(id: string): boolean {
    this.initialize();
    if (!this.db) return false;

    const result = this.db.prepare('DELETE FROM task_runs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  listRuns(query: TaskRunListQuery = {}): TaskRunRecord[] {
    this.initialize();
    if (!this.db) return [];

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const status = query.status ?? null;

    const rows = this.db
      .prepare(
        `
        SELECT * FROM task_runs
        WHERE (? IS NULL OR status = ?)
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(status, status, limit, offset) as TaskRunRow[];

    return rows.map(rowToRecord);
  }

  getActiveRun(query: ActiveTaskRunQuery = {}): TaskRunRecord | null {
    this.initialize();
    if (!this.db) return null;

    const sessionId = query.sessionId ?? null;

    const row = this.db
      .prepare(
        `
        SELECT * FROM task_runs
        WHERE status IN ('running', 'waiting_approval', 'starting')
        AND (? IS NULL OR session_id = ?)
        ORDER BY updated_at DESC
        LIMIT 1
        `
      )
      .get(sessionId, sessionId) as TaskRunRow | undefined;

    if (!row) return null;
    return rowToRecord(row);
  }
}

export const taskStore = new TaskStore();

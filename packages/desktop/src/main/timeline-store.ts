import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import type { TimelineEvent } from './timeline-types.js';

const DEFAULT_DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'FlowState');

const BLOB_DIR_NAME = 'blobs';
const INLINE_PAYLOAD_LIMIT = 10 * 1024; // 10 KB

export type TimelineStoreConfig = {
  dataDir?: string;
  retentionDays?: number;
};

export type TimelineQuery = {
  sessionId: string;
  taskId?: string;
  limit?: number;
  offset?: number;
};

export class TimelineStore {
  private db: Database.Database | null = null;
  private dataDir: string;
  private dbPath: string;
  private blobDir: string;
  private retentionDays: number;

  constructor(config?: TimelineStoreConfig) {
    this.dataDir = config?.dataDir ?? DEFAULT_DATA_DIR;
    this.dbPath = path.join(this.dataDir, 'memory.db');
    this.blobDir = path.join(this.dataDir, BLOB_DIR_NAME);
    this.retentionDays = config?.retentionDays ?? 90;
  }

  configure(config: TimelineStoreConfig): void {
    if (this.db) {
      return;
    }

    if (config.dataDir) {
      this.dataDir = config.dataDir;
      this.dbPath = path.join(this.dataDir, 'memory.db');
      this.blobDir = path.join(this.dataDir, BLOB_DIR_NAME);
    }

    if (config.retentionDays) {
      this.retentionDays = config.retentionDays;
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
      fsSync.mkdirSync(this.blobDir, { recursive: true });
    } catch (error) {
      console.error('[TimelineStore] Failed to create directories:', error);
    }
  }

  private initSchema(): void {
    if (!this.db) throw new Error('TimelineStore not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        task_id TEXT,
        timestamp INTEGER NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        detail TEXT,
        tool_name TEXT,
        payload_inline TEXT,
        payload_ref TEXT,
        redacted INTEGER DEFAULT 0
      );
    `);

    // Best-effort session metadata to support client-side retention filtering.
    // OpenCode's session.list does not currently expose timestamps here, so we
    // maintain local activity markers (created_at / last_seen) keyed by session_id.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_meta (
        session_id TEXT PRIMARY KEY,
        title TEXT,
        created_at INTEGER NOT NULL,
        last_seen INTEGER
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timeline_session_time
      ON timeline_events (session_id, timestamp);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_meta_last_seen
      ON session_meta (last_seen);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timeline_task_time
      ON timeline_events (task_id, timestamp);
    `);
  }

  getRetentionDays(): number {
    return this.retentionDays;
  }

  getRetentionCutoffMs(now: number = Date.now()): number {
    return now - this.retentionDays * 24 * 60 * 60 * 1000;
  }

  /**
   * Record session creation and/or update last seen time.
   * This does not delete anything; it's only used for list-time filtering.
   */
  upsertSessionMeta(sessionId: string, fields?: { title?: string; createdAt?: number; lastSeenAt?: number }): void {
    this.initialize();
    if (!this.db) return;

    const createdAt = fields?.createdAt ?? Date.now();
    const lastSeenAt = fields?.lastSeenAt ?? null;
    const title = fields?.title ?? null;

    this.db
      .prepare(
        `
        INSERT INTO session_meta (session_id, title, created_at, last_seen)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          title = COALESCE(excluded.title, session_meta.title),
          last_seen = CASE
            WHEN excluded.last_seen IS NULL THEN session_meta.last_seen
            WHEN session_meta.last_seen IS NULL THEN excluded.last_seen
            WHEN excluded.last_seen > session_meta.last_seen THEN excluded.last_seen
            ELSE session_meta.last_seen
          END
        `
      )
      .run(sessionId, title, createdAt, lastSeenAt);
  }

  touchSession(sessionId: string, at: number = Date.now()): void {
    this.upsertSessionMeta(sessionId, { createdAt: at, lastSeenAt: at });
  }

  async listKnownSessionIds(): Promise<Set<string>> {
    this.initialize();
    if (!this.db) return new Set();

    const rows = this.db
      .prepare(
        `
        SELECT DISTINCT session_id AS session_id FROM timeline_events
        UNION
        SELECT session_id AS session_id FROM session_meta
        `
      )
      .all() as Array<{ session_id: string }>;

    return new Set(rows.map((r) => r.session_id));
  }

  async listActiveSessionIdsSince(cutoffMs: number): Promise<Set<string>> {
    this.initialize();
    if (!this.db) return new Set();

    const rows = this.db
      .prepare(
        `
        SELECT session_id AS session_id
        FROM session_meta
        WHERE COALESCE(last_seen, created_at) >= ?
        UNION
        SELECT session_id AS session_id
        FROM (
          SELECT session_id, MAX(timestamp) AS last_ts
          FROM timeline_events
          GROUP BY session_id
        )
        WHERE last_ts >= ?
        `
      )
      .all(cutoffMs, cutoffMs) as Array<{ session_id: string }>;

    return new Set(rows.map((r) => r.session_id));
  }

  async append(event: TimelineEvent): Promise<void> {
    this.initialize();
    if (!this.db) return;

    const { payloadInline, payloadRef, ...rest } = event;
    const inlinePayload = payloadInline ? JSON.stringify(payloadInline) : null;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO timeline_events (
        id, session_id, task_id, timestamp, kind, title, detail, tool_name,
        payload_inline, payload_ref, redacted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      rest.id,
      rest.sessionId,
      rest.taskId ?? null,
      rest.timestamp,
      rest.kind,
      rest.title,
      rest.detail ?? null,
      rest.toolName ?? null,
      inlinePayload,
      payloadRef ?? null,
      rest.redacted ? 1 : 0
    );
  }

  async appendWithPayload(
    event: Omit<TimelineEvent, 'payloadInline' | 'payloadRef'> & { payload?: unknown }
  ): Promise<TimelineEvent> {
    const payload = event.payload;
    if (!payload) {
      const storedEvent: TimelineEvent = { ...event };
      await this.append(storedEvent);
      return storedEvent;
    }

    const payloadString = JSON.stringify(payload);
    if (Buffer.byteLength(payloadString, 'utf8') < INLINE_PAYLOAD_LIMIT) {
      const storedEvent: TimelineEvent = { ...event, payloadInline: payload };
      await this.append(storedEvent);
      return storedEvent;
    }

    const filename = `${event.id}.json`;
    const filePath = path.join(this.blobDir, filename);
    await fs.writeFile(filePath, payloadString);

    const storedEvent: TimelineEvent = { ...event, payloadRef: filePath };
    await this.append(storedEvent);
    return storedEvent;
  }

  async list(query: TimelineQuery): Promise<TimelineEvent[]> {
    this.initialize();
    if (!this.db) return [];

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const rows = this.db
      .prepare(
        `
        SELECT * FROM timeline_events
        WHERE session_id = ?
        AND (? IS NULL OR task_id = ?)
        ORDER BY timestamp ASC
        LIMIT ? OFFSET ?
        `
      )
      .all(query.sessionId, query.taskId ?? null, query.taskId ?? null, limit, offset) as Array<{
        id: string;
        session_id: string;
        task_id: string | null;
        timestamp: number;
        kind: string;
        title: string;
        detail: string | null;
        tool_name: string | null;
        payload_inline: string | null;
        payload_ref: string | null;
        redacted: number;
      }>;

    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      taskId: row.task_id ?? undefined,
      timestamp: row.timestamp,
      kind: row.kind as TimelineEvent['kind'],
      title: row.title,
      detail: row.detail ?? undefined,
      toolName: row.tool_name ?? undefined,
      payloadInline: row.payload_inline ? JSON.parse(row.payload_inline) : undefined,
      payloadRef: row.payload_ref ?? undefined,
      redacted: Boolean(row.redacted),
    }));
  }

  async pruneOldEvents(): Promise<void> {
    this.initialize();
    if (!this.db) return;

    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const rows = this.db
      .prepare('SELECT id, payload_ref FROM timeline_events WHERE timestamp < ?')
      .all(cutoff) as Array<{ id: string; payload_ref: string | null }>;

    this.db.prepare('DELETE FROM timeline_events WHERE timestamp < ?').run(cutoff);

    for (const row of rows) {
      if (row.payload_ref) {
        try {
          await fs.unlink(row.payload_ref);
        } catch (error) {
          console.warn('[TimelineStore] Failed to remove blob:', row.payload_ref, error);
        }
      }
    }
  }

  async resolvePayload(ref: string): Promise<unknown | null> {
    try {
      const data = await fs.readFile(ref, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('[TimelineStore] Failed to read blob:', ref, error);
      return null;
    }
  }
}

export const timelineStore = new TimelineStore();

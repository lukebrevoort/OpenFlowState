import fsSync from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

const DEFAULT_DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'FlowState');
const MAX_PINNED_WORKFLOWS = 3;

export type WorkflowsPinsStoreConfig = {
  dataDir?: string;
};

export class PinnedWorkflowsLimitError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(`You can pin up to ${limit} workflows.`);
    this.name = 'PinnedWorkflowsLimitError';
    this.limit = limit;
  }
}

export class WorkflowsPinsStore {
  private db: Database.Database | null = null;
  private dataDir: string;
  private dbPath: string;

  constructor(config?: WorkflowsPinsStoreConfig) {
    this.dataDir = config?.dataDir ?? DEFAULT_DATA_DIR;
    this.dbPath = path.join(this.dataDir, 'memory.db');
  }

  configure(config: WorkflowsPinsStoreConfig): void {
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
      console.error('[WorkflowsPinsStore] Failed to create data dir:', error);
    }
  }

  private initSchema(): void {
    if (!this.db) throw new Error('WorkflowsPinsStore not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_pins (
        workflow_id TEXT PRIMARY KEY,
        pinned_at INTEGER NOT NULL
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workflow_pins_pinned_at
      ON workflow_pins (pinned_at);
    `);
  }

  private isPinned(workflowId: string): boolean {
    this.initialize();
    if (!this.db) return false;
    const row = this.db
      .prepare('SELECT workflow_id FROM workflow_pins WHERE workflow_id = ?')
      .get(workflowId) as { workflow_id: string } | undefined;
    return Boolean(row?.workflow_id);
  }

  listPins(): string[] {
    this.initialize();
    if (!this.db) return [];

    const rows = this.db
      .prepare('SELECT workflow_id FROM workflow_pins ORDER BY pinned_at DESC, workflow_id ASC')
      .all() as Array<{ workflow_id: string }>;

    return rows.map((r) => r.workflow_id);
  }

  setPinned(workflowId: string, pinned: boolean): void {
    this.initialize();
    if (!this.db) return;

    const id = (workflowId ?? '').trim();
    if (!id) {
      return;
    }

    if (!pinned) {
      this.db.prepare('DELETE FROM workflow_pins WHERE workflow_id = ?').run(id);
      return;
    }

    if (this.isPinned(id)) {
      return;
    }

    const row = this.db.prepare('SELECT COUNT(1) as count FROM workflow_pins').get() as { count: number };
    if ((row?.count ?? 0) >= MAX_PINNED_WORKFLOWS) {
      throw new PinnedWorkflowsLimitError(MAX_PINNED_WORKFLOWS);
    }

    const now = Date.now();
    this.db
      .prepare(
        `
        INSERT INTO workflow_pins (workflow_id, pinned_at) VALUES (?, ?)
        ON CONFLICT(workflow_id) DO UPDATE SET pinned_at = excluded.pinned_at
        `
      )
      .run(id, now);
  }
}

export const workflowsPinsStore = new WorkflowsPinsStore();

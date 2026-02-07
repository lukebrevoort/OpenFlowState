import fsSync from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

const DEFAULT_DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'FlowState');

export type ApprovalAuditKind = 'request' | 'response' | 'user_reply';

export type ApprovalAuditEntry = {
  requestId: string;
  sessionId?: string;
  kind: ApprovalAuditKind;
  reply?: string;
  timestamp?: number;
  summary?: Record<string, unknown>;
  redacted?: boolean;
};

const clampText = (value: string, max: number): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
};

const redactSecrets = (input: string): string => {
  const patterns: RegExp[] = [
    /\bsk-[A-Za-z0-9]{16,}\b/g,
    /\brk-[A-Za-z0-9]{16,}\b/g,
    /\bAIza[0-9A-Za-z\-_]{30,}\b/g,
    /\bghp_[A-Za-z0-9]{30,}\b/g,
    /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
    /\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g,
    /\bBearer\s+[A-Za-z0-9_\-\.~=]{20,}\b/gi,
    /\bBasic\s+[A-Za-z0-9_\-\.~=]{20,}\b/gi,
  ];

  let redacted = input;
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }

  redacted = redacted.replace(
    /(api[_-]?key|token|secret|password)\s*[:=]\s*[^\s\n]{8,}/gi,
    (_m, key) => `${String(key)}=[REDACTED]`
  );

  return redacted;
};

const sanitizeSummary = (
  value: Record<string, unknown>
): { summary: Record<string, unknown>; redacted: boolean } => {
  let redacted = false;

  const walk = (input: unknown): unknown => {
    if (typeof input === 'string') {
      const cleaned = input.replace(/[\r\n]+/g, ' ').trim();
      const next = redactSecrets(cleaned);
      if (next !== cleaned) redacted = true;
      return clampText(next, 2000);
    }

    if (Array.isArray(input)) {
      return input.map((item) => walk(item));
    }

    if (input && typeof input === 'object') {
      const record = input as Record<string, unknown>;
      return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, walk(v)]));
    }

    return input;
  };

  return { summary: walk(value) as Record<string, unknown>, redacted };
};

export type ApprovalsAuditStoreConfig = {
  dataDir?: string;
};

export class ApprovalsAuditStore {
  private db: Database.Database | null = null;
  private dataDir: string;
  private dbPath: string;

  constructor(config?: ApprovalsAuditStoreConfig) {
    this.dataDir = config?.dataDir ?? DEFAULT_DATA_DIR;
    this.dbPath = path.join(this.dataDir, 'memory.db');
  }

  configure(config: ApprovalsAuditStoreConfig): void {
    if (this.db) return;
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
      console.error('[ApprovalsAuditStore] Failed to create data dir:', error);
    }
  }

  private initSchema(): void {
    if (!this.db) throw new Error('ApprovalsAuditStore not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approvals_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        session_id TEXT,
        request_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        reply TEXT,
        summary TEXT,
        redacted INTEGER DEFAULT 0
      );
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_approvals_audit_request_time
      ON approvals_audit (request_id, timestamp);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_approvals_audit_session_time
      ON approvals_audit (session_id, timestamp);
    `);
  }

  log(entry: ApprovalAuditEntry): void {
    if (!entry.requestId || typeof entry.requestId !== 'string') return;
    this.initialize();
    if (!this.db) return;

    const timestamp = entry.timestamp ?? Date.now();
    const sessionId = entry.sessionId ?? null;
    const reply = entry.reply ?? null;

    let summaryJson: string | null = null;
    let redacted = Boolean(entry.redacted);
    if (entry.summary) {
      const sanitized = sanitizeSummary(entry.summary);
      if (sanitized.redacted) redacted = true;
      try {
        summaryJson = JSON.stringify(sanitized.summary);
        if (summaryJson.length > 50_000) {
          summaryJson = JSON.stringify({ truncated: true });
          redacted = true;
        }
      } catch {
        summaryJson = null;
      }
    }

    this.db
      .prepare(
        `
        INSERT INTO approvals_audit (
          timestamp, session_id, request_id, kind, reply, summary, redacted
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        timestamp,
        sessionId,
        entry.requestId,
        entry.kind,
        reply,
        summaryJson,
        redacted ? 1 : 0
      );
  }
}

export const approvalsAuditStore = new ApprovalsAuditStore();

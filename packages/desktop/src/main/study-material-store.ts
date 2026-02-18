import fsSync from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

const DEFAULT_DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'FlowState');
const STUDY_MATERIAL_DEFAULT_LIMIT = 100;
const STUDY_MATERIAL_MAX_LIMIT = 200;

export type SourceDocumentRecord = {
  id: string;
  courseId: string;
  origin: 'canvas' | 'local' | (string & {});
  fileType: string;
  title: string;
  sourceRef: string;
  versionHash: string;
  ingestedAt: number;
};

export type StudyMaterialRunRecord = {
  id: string;
  courseId: string;
  taskRunId?: string;
  mode: 'conservative' | 'coaching' | (string & {});
  destinationType: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | (string & {});
  qualityScore?: number;
  createdAt: number;
  updatedAt: number;
};

export type StudyMaterialArtifactRecord = {
  id: string;
  studyRunId: string;
  kind: 'summary' | 'practice_exam' | 'flashcards' | 'report' | (string & {});
  pathOrBlobRef: string;
  mime?: string;
  createdAt: number;
};

export type StudyMaterialRunListQuery = {
  courseId?: string;
  limit?: number;
  offset?: number;
};

type StudyMaterialStoreMigration = {
  version: number;
  up: (db: Database.Database) => void;
};

const STUDY_MATERIAL_STORE_MIGRATIONS: StudyMaterialStoreMigration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS source_documents (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          origin TEXT NOT NULL,
          file_type TEXT NOT NULL,
          title TEXT NOT NULL,
          source_ref TEXT NOT NULL,
          version_hash TEXT NOT NULL,
          ingested_at INTEGER NOT NULL
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_source_documents_course_ingested
        ON source_documents (course_id, ingested_at DESC);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS study_material_runs (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          task_run_id TEXT,
          mode TEXT NOT NULL,
          destination_type TEXT NOT NULL,
          status TEXT NOT NULL,
          quality_score REAL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_study_material_runs_course_created
        ON study_material_runs (course_id, created_at DESC);
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_study_material_runs_status
        ON study_material_runs (status);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS study_material_artifacts (
          id TEXT PRIMARY KEY,
          study_run_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          path_or_blob_ref TEXT NOT NULL,
          mime TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (study_run_id) REFERENCES study_material_runs(id) ON DELETE CASCADE
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_study_material_artifacts_run_created
        ON study_material_artifacts (study_run_id, created_at ASC);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS citation_spans (
          id TEXT PRIMARY KEY,
          study_run_id TEXT NOT NULL,
          artifact_id TEXT NOT NULL,
          section_id TEXT NOT NULL,
          source_document_id TEXT NOT NULL,
          source_locator TEXT NOT NULL,
          confidence REAL,
          FOREIGN KEY (study_run_id) REFERENCES study_material_runs(id) ON DELETE CASCADE,
          FOREIGN KEY (artifact_id) REFERENCES study_material_artifacts(id) ON DELETE CASCADE,
          FOREIGN KEY (source_document_id) REFERENCES source_documents(id) ON DELETE CASCADE
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_citation_spans_run_artifact
        ON citation_spans (study_run_id, artifact_id);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS extraction_issues (
          id TEXT PRIMARY KEY,
          study_run_id TEXT NOT NULL,
          source_document_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          detail TEXT NOT NULL,
          severity TEXT NOT NULL,
          FOREIGN KEY (study_run_id) REFERENCES study_material_runs(id) ON DELETE CASCADE,
          FOREIGN KEY (source_document_id) REFERENCES source_documents(id) ON DELETE CASCADE
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_extraction_issues_run_source
        ON extraction_issues (study_run_id, source_document_id);
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS study_run_diffs (
          id TEXT PRIMARY KEY,
          study_run_id TEXT NOT NULL,
          previous_study_run_id TEXT NOT NULL,
          summary TEXT NOT NULL,
          FOREIGN KEY (study_run_id) REFERENCES study_material_runs(id) ON DELETE CASCADE,
          FOREIGN KEY (previous_study_run_id) REFERENCES study_material_runs(id) ON DELETE CASCADE
        );
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_study_run_diffs_run
        ON study_run_diffs (study_run_id);
      `);
    },
  },
];

const coercePaginationValue = (value: number | undefined, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.trunc(value as number);
};

type StudyMaterialRunRow = {
  id: string;
  course_id: string;
  task_run_id: string | null;
  mode: string;
  destination_type: string;
  status: string;
  quality_score: number | null;
  created_at: number;
  updated_at: number;
};

type SourceDocumentRow = {
  id: string;
  course_id: string;
  origin: string;
  file_type: string;
  title: string;
  source_ref: string;
  version_hash: string;
  ingested_at: number;
};

type StudyMaterialArtifactRow = {
  id: string;
  study_run_id: string;
  kind: string;
  path_or_blob_ref: string;
  mime: string | null;
  created_at: number;
};

const rowToRunRecord = (row: StudyMaterialRunRow): StudyMaterialRunRecord => ({
  id: row.id,
  courseId: row.course_id,
  ...(row.task_run_id === null ? {} : { taskRunId: row.task_run_id }),
  mode: row.mode as StudyMaterialRunRecord['mode'],
  destinationType: row.destination_type,
  status: row.status as StudyMaterialRunRecord['status'],
  ...(row.quality_score === null ? {} : { qualityScore: row.quality_score }),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const rowToSourceDocumentRecord = (row: SourceDocumentRow): SourceDocumentRecord => ({
  id: row.id,
  courseId: row.course_id,
  origin: row.origin as SourceDocumentRecord['origin'],
  fileType: row.file_type,
  title: row.title,
  sourceRef: row.source_ref,
  versionHash: row.version_hash,
  ingestedAt: row.ingested_at,
});

const rowToArtifactRecord = (row: StudyMaterialArtifactRow): StudyMaterialArtifactRecord => ({
  id: row.id,
  studyRunId: row.study_run_id,
  kind: row.kind as StudyMaterialArtifactRecord['kind'],
  pathOrBlobRef: row.path_or_blob_ref,
  ...(row.mime === null ? {} : { mime: row.mime }),
  createdAt: row.created_at,
});

export type StudyMaterialStoreConfig = {
  dataDir?: string;
};

export class StudyMaterialStore {
  private db: Database.Database | null = null;
  private dataDir: string;
  private dbPath: string;

  constructor(config?: StudyMaterialStoreConfig) {
    this.dataDir = config?.dataDir ?? DEFAULT_DATA_DIR;
    this.dbPath = path.join(this.dataDir, 'memory.db');
  }

  configure(config: StudyMaterialStoreConfig): void {
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
    this.runMigrations();
  }

  private ensureDirsSync(): void {
    if (!this.dataDir) return;
    try {
      fsSync.mkdirSync(this.dataDir, { recursive: true });
    } catch (error) {
      console.error('[StudyMaterialStore] Failed to create data dir:', error);
    }
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('StudyMaterialStore not initialized');

    const db = this.db;

    const currentVersion = Number(db.pragma('user_version', { simple: true }) ?? 0);
    const pendingMigrations = STUDY_MATERIAL_STORE_MIGRATIONS
      .filter((migration) => migration.version > currentVersion)
      .sort((a, b) => a.version - b.version);

    for (const migration of pendingMigrations) {
      const applyMigration = db.transaction(() => {
        migration.up(db);
        db.pragma(`user_version = ${migration.version}`);
      });

      applyMigration();
    }
  }

  createSourceDocument(record: SourceDocumentRecord): SourceDocumentRecord {
    this.initialize();
    if (!this.db) {
      return record;
    }

    this.db
      .prepare(
        `
        INSERT INTO source_documents (
          id,
          course_id,
          origin,
          file_type,
          title,
          source_ref,
          version_hash,
          ingested_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          course_id = excluded.course_id,
          origin = excluded.origin,
          file_type = excluded.file_type,
          title = excluded.title,
          source_ref = excluded.source_ref,
          version_hash = excluded.version_hash,
          ingested_at = excluded.ingested_at
        `,
      )
      .run(
        record.id,
        record.courseId,
        record.origin,
        record.fileType,
        record.title,
        record.sourceRef,
        record.versionHash,
        record.ingestedAt,
      );

    return record;
  }

  getSourceDocument(id: string): SourceDocumentRecord | null {
    this.initialize();
    if (!this.db) return null;

    const row = this.db.prepare('SELECT * FROM source_documents WHERE id = ?').get(id) as SourceDocumentRow | undefined;
    return row ? rowToSourceDocumentRecord(row) : null;
  }

  createRun(record: StudyMaterialRunRecord): StudyMaterialRunRecord {
    this.initialize();
    if (!this.db) {
      return record;
    }

    this.db
      .prepare(
        `
        INSERT INTO study_material_runs (
          id,
          course_id,
          task_run_id,
          mode,
          destination_type,
          status,
          quality_score,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          course_id = excluded.course_id,
          task_run_id = excluded.task_run_id,
          mode = excluded.mode,
          destination_type = excluded.destination_type,
          status = excluded.status,
          quality_score = excluded.quality_score,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
        `,
      )
      .run(
        record.id,
        record.courseId,
        record.taskRunId ?? null,
        record.mode,
        record.destinationType,
        record.status,
        record.qualityScore ?? null,
        record.createdAt,
        record.updatedAt,
      );

    return record;
  }

  getRun(id: string): StudyMaterialRunRecord | null {
    this.initialize();
    if (!this.db) return null;

    const row = this.db.prepare('SELECT * FROM study_material_runs WHERE id = ?').get(id) as StudyMaterialRunRow | undefined;
    return row ? rowToRunRecord(row) : null;
  }

  listRuns(query: StudyMaterialRunListQuery = {}): StudyMaterialRunRecord[] {
    this.initialize();
    if (!this.db) return [];

    const courseId = query.courseId ?? null;
    const limit = Math.min(
      STUDY_MATERIAL_MAX_LIMIT,
      Math.max(1, coercePaginationValue(query.limit, STUDY_MATERIAL_DEFAULT_LIMIT)),
    );
    const offset = Math.max(0, coercePaginationValue(query.offset, 0));

    const rows = this.db
      .prepare(
        `
        SELECT * FROM study_material_runs
        WHERE (? IS NULL OR course_id = ?)
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `,
      )
      .all(courseId, courseId, limit, offset) as StudyMaterialRunRow[];

    return rows.map(rowToRunRecord);
  }

  createArtifact(record: StudyMaterialArtifactRecord): StudyMaterialArtifactRecord {
    this.initialize();
    if (!this.db) {
      return record;
    }

    this.db
      .prepare(
        `
        INSERT INTO study_material_artifacts (
          id,
          study_run_id,
          kind,
          path_or_blob_ref,
          mime,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          study_run_id = excluded.study_run_id,
          kind = excluded.kind,
          path_or_blob_ref = excluded.path_or_blob_ref,
          mime = excluded.mime,
          created_at = excluded.created_at
        `,
      )
      .run(
        record.id,
        record.studyRunId,
        record.kind,
        record.pathOrBlobRef,
        record.mime ?? null,
        record.createdAt,
      );

    return record;
  }

  listArtifactsByRun(studyRunId: string): StudyMaterialArtifactRecord[] {
    this.initialize();
    if (!this.db) return [];

    const rows = this.db
      .prepare(
        `
        SELECT * FROM study_material_artifacts
        WHERE study_run_id = ?
        ORDER BY created_at ASC
        `,
      )
      .all(studyRunId) as StudyMaterialArtifactRow[];

    return rows.map(rowToArtifactRecord);
  }
}

export const studyMaterialStore = new StudyMaterialStore();

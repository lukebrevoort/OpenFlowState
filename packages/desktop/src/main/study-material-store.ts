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
  status:
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'awaiting_destination'
    | 'awaiting_quality_override'
    | (string & {});
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

export type CitationSpanRecord = {
  id: string;
  studyRunId: string;
  artifactId: string;
  sectionId: string;
  sourceDocumentId: string;
  sourceLocator: string;
  confidence?: number;
};

export type ExtractionIssueRecord = {
  id: string;
  studyRunId: string;
  sourceDocumentId: string;
  kind: string;
  detail: string;
  severity: string;
};

export type StudyRunDiffRecord = {
  id: string;
  studyRunId: string;
  previousStudyRunId: string;
  summary: string;
};

export type StudyMaterialRunListQuery = {
  courseId?: string;
  limit?: number;
  offset?: number;
};

export type SourceDocumentListQuery = {
  courseId?: string;
  origin?: string;
  limit?: number;
  offset?: number;
};

export type StudyMaterialRunPatch = {
  destinationType?: string;
  status?: StudyMaterialRunRecord['status'];
  updatedAt?: number;
  qualityScore?: number | null;
};

type StudyMaterialStoreMigration = {
  version: number;
  up: (db: Database.Database) => void;
};

const STUDY_MATERIAL_MIGRATIONS_TABLE = 'study_material_store_migrations';
const STUDY_MATERIAL_MIGRATION_SCOPE = 'study_material_store';

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

type CitationSpanRow = {
  id: string;
  study_run_id: string;
  artifact_id: string;
  section_id: string;
  source_document_id: string;
  source_locator: string;
  confidence: number | null;
};

type ExtractionIssueRow = {
  id: string;
  study_run_id: string;
  source_document_id: string;
  kind: string;
  detail: string;
  severity: string;
};

type StudyRunDiffRow = {
  id: string;
  study_run_id: string;
  previous_study_run_id: string;
  summary: string;
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

const rowToCitationSpanRecord = (row: CitationSpanRow): CitationSpanRecord => ({
  id: row.id,
  studyRunId: row.study_run_id,
  artifactId: row.artifact_id,
  sectionId: row.section_id,
  sourceDocumentId: row.source_document_id,
  sourceLocator: row.source_locator,
  ...(row.confidence === null ? {} : { confidence: row.confidence }),
});

const rowToExtractionIssueRecord = (row: ExtractionIssueRow): ExtractionIssueRecord => ({
  id: row.id,
  studyRunId: row.study_run_id,
  sourceDocumentId: row.source_document_id,
  kind: row.kind,
  detail: row.detail,
  severity: row.severity,
});

const rowToStudyRunDiffRecord = (row: StudyRunDiffRow): StudyRunDiffRecord => ({
  id: row.id,
  studyRunId: row.study_run_id,
  previousStudyRunId: row.previous_study_run_id,
  summary: row.summary,
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

    const applyMigrations = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ${STUDY_MATERIAL_MIGRATIONS_TABLE} (
          scope TEXT PRIMARY KEY,
          version INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      const versionRow = db
        .prepare(`
          SELECT version
          FROM ${STUDY_MATERIAL_MIGRATIONS_TABLE}
          WHERE scope = ?
          LIMIT 1
        `)
        .get(STUDY_MATERIAL_MIGRATION_SCOPE) as { version: number } | undefined;

      let currentVersion = Number(versionRow?.version ?? 0);
      const pendingMigrations = STUDY_MATERIAL_STORE_MIGRATIONS
        .filter((migration) => migration.version > currentVersion)
        .sort((a, b) => a.version - b.version);

      for (const migration of pendingMigrations) {
        migration.up(db);
        currentVersion = migration.version;

        db.prepare(
          `
          INSERT INTO ${STUDY_MATERIAL_MIGRATIONS_TABLE} (scope, version, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(scope) DO UPDATE SET
            version = excluded.version,
            updated_at = excluded.updated_at
          `,
        ).run(STUDY_MATERIAL_MIGRATION_SCOPE, currentVersion, Date.now());
      }
    });

    applyMigrations();
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

  listSourceDocuments(query: SourceDocumentListQuery = {}): SourceDocumentRecord[] {
    this.initialize();
    if (!this.db) return [];

    const courseId = query.courseId ?? null;
    const origin = query.origin ?? null;
    const limit = Math.min(
      STUDY_MATERIAL_MAX_LIMIT,
      Math.max(1, coercePaginationValue(query.limit, STUDY_MATERIAL_DEFAULT_LIMIT)),
    );
    const offset = Math.max(0, coercePaginationValue(query.offset, 0));

    const rows = this.db
      .prepare(
        `
        SELECT * FROM source_documents
        WHERE (? IS NULL OR course_id = ?)
          AND (? IS NULL OR origin = ?)
        ORDER BY ingested_at DESC
        LIMIT ? OFFSET ?
        `,
      )
      .all(courseId, courseId, origin, origin, limit, offset) as SourceDocumentRow[];

    return rows.map(rowToSourceDocumentRecord);
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

  updateRun(id: string, patch: StudyMaterialRunPatch): StudyMaterialRunRecord | null {
    const existing = this.getRun(id);
    if (!existing) {
      return null;
    }

    const merged: StudyMaterialRunRecord = {
      ...existing,
      ...(typeof patch.destinationType === 'string' ? { destinationType: patch.destinationType } : {}),
      ...(typeof patch.status === 'string' ? { status: patch.status } : {}),
      ...(patch.qualityScore === null
        ? { qualityScore: undefined }
        : typeof patch.qualityScore === 'number'
          ? { qualityScore: patch.qualityScore }
          : {}),
      updatedAt: patch.updatedAt ?? Date.now(),
    };

    this.createRun(merged);
    return merged;
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

  createCitationSpan(record: CitationSpanRecord): CitationSpanRecord {
    this.initialize();
    if (!this.db) {
      return record;
    }

    this.db
      .prepare(
        `
        INSERT INTO citation_spans (
          id,
          study_run_id,
          artifact_id,
          section_id,
          source_document_id,
          source_locator,
          confidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          study_run_id = excluded.study_run_id,
          artifact_id = excluded.artifact_id,
          section_id = excluded.section_id,
          source_document_id = excluded.source_document_id,
          source_locator = excluded.source_locator,
          confidence = excluded.confidence
        `,
      )
      .run(
        record.id,
        record.studyRunId,
        record.artifactId,
        record.sectionId,
        record.sourceDocumentId,
        record.sourceLocator,
        record.confidence ?? null,
      );

    return record;
  }

  listCitationSpansByRun(studyRunId: string, artifactId?: string): CitationSpanRecord[] {
    this.initialize();
    if (!this.db) return [];

    const rows = this.db
      .prepare(
        `
        SELECT * FROM citation_spans
        WHERE study_run_id = ?
          AND (? IS NULL OR artifact_id = ?)
        ORDER BY id ASC
        `,
      )
      .all(studyRunId, artifactId ?? null, artifactId ?? null) as CitationSpanRow[];

    return rows.map(rowToCitationSpanRecord);
  }

  createExtractionIssue(record: ExtractionIssueRecord): ExtractionIssueRecord {
    this.initialize();
    if (!this.db) {
      return record;
    }

    this.db
      .prepare(
        `
        INSERT INTO extraction_issues (
          id,
          study_run_id,
          source_document_id,
          kind,
          detail,
          severity
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          study_run_id = excluded.study_run_id,
          source_document_id = excluded.source_document_id,
          kind = excluded.kind,
          detail = excluded.detail,
          severity = excluded.severity
        `,
      )
      .run(record.id, record.studyRunId, record.sourceDocumentId, record.kind, record.detail, record.severity);

    return record;
  }

  listExtractionIssuesByRun(studyRunId: string, sourceDocumentId?: string): ExtractionIssueRecord[] {
    this.initialize();
    if (!this.db) return [];

    const rows = this.db
      .prepare(
        `
        SELECT * FROM extraction_issues
        WHERE study_run_id = ?
          AND (? IS NULL OR source_document_id = ?)
        ORDER BY id ASC
        `,
      )
      .all(studyRunId, sourceDocumentId ?? null, sourceDocumentId ?? null) as ExtractionIssueRow[];

    return rows.map(rowToExtractionIssueRecord);
  }

  createRunDiff(record: StudyRunDiffRecord): StudyRunDiffRecord {
    this.initialize();
    if (!this.db) {
      return record;
    }

    this.db
      .prepare(
        `
        INSERT INTO study_run_diffs (
          id,
          study_run_id,
          previous_study_run_id,
          summary
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          study_run_id = excluded.study_run_id,
          previous_study_run_id = excluded.previous_study_run_id,
          summary = excluded.summary
        `,
      )
      .run(record.id, record.studyRunId, record.previousStudyRunId, record.summary);

    return record;
  }

  getRunDiff(studyRunId: string): StudyRunDiffRecord | null {
    this.initialize();
    if (!this.db) return null;

    const row = this.db
      .prepare(
        `
        SELECT * FROM study_run_diffs
        WHERE study_run_id = ?
        ORDER BY rowid DESC
        LIMIT 1
        `,
      )
      .get(studyRunId) as StudyRunDiffRow | undefined;

    return row ? rowToStudyRunDiffRecord(row) : null;
  }
}

export const studyMaterialStore = new StudyMaterialStore();

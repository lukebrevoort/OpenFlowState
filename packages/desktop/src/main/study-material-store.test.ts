import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

type StudyMaterialArtifactRow = {
  id: string;
  study_run_id: string;
  kind: string;
  path_or_blob_ref: string;
  mime: string | null;
  created_at: number;
};

class MockDatabase {
  public tables = new Set<string>();
  public sourceDocuments = new Map<string, SourceDocumentRow>();
  public runs = new Map<string, StudyMaterialRunRow>();
  public artifacts = new Map<string, StudyMaterialArtifactRow>();
  public userVersion = 0;

  pragma(statement: string, options?: { simple?: boolean }): unknown {
    const normalized = statement.trim();

    const setVersionMatch = /^user_version\s*=\s*(\d+)$/i.exec(normalized);
    if (setVersionMatch?.[1]) {
      this.userVersion = Number(setVersionMatch[1]);
      return;
    }

    if (/^user_version$/i.test(normalized) && options?.simple) {
      return this.userVersion;
    }

    return;
  }

  transaction<T extends (...args: never[]) => unknown>(fn: T): T {
    return ((...args: never[]) => fn(...args)) as T;
  }

  exec(sql: string): void {
    const match = /CREATE TABLE IF NOT EXISTS\s+([a-z_]+)/i.exec(sql);
    if (match?.[1]) {
      this.tables.add(match[1]);
    }
  }

  prepare(sql: string): {
    run: (...args: unknown[]) => { changes: number };
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  } {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized.startsWith('INSERT INTO source_documents')) {
      return {
        run: (...args: unknown[]) => {
          const row: SourceDocumentRow = {
            id: String(args[0]),
            course_id: String(args[1]),
            origin: String(args[2]),
            file_type: String(args[3]),
            title: String(args[4]),
            source_ref: String(args[5]),
            version_hash: String(args[6]),
            ingested_at: Number(args[7]),
          };
          this.sourceDocuments.set(row.id, row);
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.startsWith('SELECT * FROM source_documents WHERE id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args: unknown[]) => this.sourceDocuments.get(String(args[0])) ?? undefined,
        all: () => [],
      };
    }

    if (normalized.startsWith('INSERT INTO study_material_runs')) {
      return {
        run: (...args: unknown[]) => {
          const row: StudyMaterialRunRow = {
            id: String(args[0]),
            course_id: String(args[1]),
            task_run_id: args[2] === null ? null : String(args[2]),
            mode: String(args[3]),
            destination_type: String(args[4]),
            status: String(args[5]),
            quality_score: args[6] === null ? null : Number(args[6]),
            created_at: Number(args[7]),
            updated_at: Number(args[8]),
          };
          this.runs.set(row.id, row);
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.startsWith('SELECT * FROM study_material_runs WHERE id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args: unknown[]) => this.runs.get(String(args[0])) ?? undefined,
        all: () => [],
      };
    }

    if (normalized.includes('SELECT * FROM study_material_runs WHERE (? IS NULL OR course_id = ?)')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args: unknown[]) => {
          const courseId = args[0] === null ? null : String(args[0]);
          const limit = Number(args[2] ?? 100);
          const offset = Number(args[3] ?? 0);
          const rows = Array.from(this.runs.values())
            .filter((row) => !courseId || row.course_id === courseId)
            .sort((a, b) => b.created_at - a.created_at);
          return rows.slice(offset, offset + limit);
        },
      };
    }

    if (normalized.startsWith('INSERT INTO study_material_artifacts')) {
      return {
        run: (...args: unknown[]) => {
          const row: StudyMaterialArtifactRow = {
            id: String(args[0]),
            study_run_id: String(args[1]),
            kind: String(args[2]),
            path_or_blob_ref: String(args[3]),
            mime: args[4] === null ? null : String(args[4]),
            created_at: Number(args[5]),
          };
          this.artifacts.set(row.id, row);
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('SELECT * FROM study_material_artifacts WHERE study_run_id = ?')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args: unknown[]) => {
          const runId = String(args[0]);
          return Array.from(this.artifacts.values())
            .filter((row) => row.study_run_id === runId)
            .sort((a, b) => a.created_at - b.created_at);
        },
      };
    }

    return {
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    };
  }
}

const mockDatabases: MockDatabase[] = [];
let nextInitialUserVersion = 0;

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn(() => {
      const db = new MockDatabase();
      db.userVersion = nextInitialUserVersion;
      mockDatabases.push(db);
      return db;
    }),
  };
});

const { StudyMaterialStore } = await import('./study-material-store.js');

describe('StudyMaterialStore', () => {
  beforeEach(() => {
    mockDatabases.length = 0;
    nextInitialUserVersion = 0;
  });

  afterEach(() => {
    mockDatabases.length = 0;
    nextInitialUserVersion = 0;
  });

  it('initializes all Phase 8 persistence tables', () => {
    const store = new StudyMaterialStore({ dataDir: '/tmp/flowstate-study-material-store-tests' });
    store.initialize();

    const db = mockDatabases[0];
    expect(db).toBeDefined();
    if (!db) return;

    expect(db.tables.has('source_documents')).toBe(true);
    expect(db.tables.has('study_material_runs')).toBe(true);
    expect(db.tables.has('study_material_artifacts')).toBe(true);
    expect(db.tables.has('citation_spans')).toBe(true);
    expect(db.tables.has('extraction_issues')).toBe(true);
    expect(db.tables.has('study_run_diffs')).toBe(true);
    expect(db.userVersion).toBe(1);
  });

  it('applies schema migrations from prior user_version', () => {
    nextInitialUserVersion = 0;
    const store = new StudyMaterialStore({ dataDir: '/tmp/flowstate-study-material-store-tests' });

    store.initialize();

    const db = mockDatabases[0];
    expect(db).toBeDefined();
    if (!db) return;
    expect(db.userVersion).toBe(1);
  });

  it('supports source doc/run/artifact creation and run readback', () => {
    const store = new StudyMaterialStore({ dataDir: '/tmp/flowstate-study-material-store-tests' });

    store.createSourceDocument({
      id: 'source_1',
      courseId: 'course_1',
      origin: 'local',
      fileType: 'pdf',
      title: 'Lecture 1',
      sourceRef: '/tmp/lecture-1.pdf',
      versionHash: 'hash-v1',
      ingestedAt: 1700000000000,
    });

    const createdRun = store.createRun({
      id: 'run_1',
      courseId: 'course_1',
      taskRunId: 'task_1',
      mode: 'conservative',
      destinationType: 'local_folder',
      status: 'queued',
      qualityScore: 0.85,
      createdAt: 1700000001000,
      updatedAt: 1700000001000,
    });

    expect(createdRun.id).toBe('run_1');

    const run = store.getRun('run_1');
    expect(run).toMatchObject({
      id: 'run_1',
      courseId: 'course_1',
      status: 'queued',
      mode: 'conservative',
    });

    const runs = store.listRuns({ courseId: 'course_1' });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe('run_1');

    store.createArtifact({
      id: 'artifact_1',
      studyRunId: 'run_1',
      kind: 'summary',
      pathOrBlobRef: '/tmp/run_1-summary.md',
      mime: 'text/markdown',
      createdAt: 1700000002000,
    });

    store.createArtifact({
      id: 'artifact_2',
      studyRunId: 'run_1',
      kind: 'report',
      pathOrBlobRef: '/tmp/run_1-report.json',
      mime: 'application/json',
      createdAt: 1700000003000,
    });

    const artifacts = store.listArtifactsByRun('run_1');
    expect(artifacts).toHaveLength(2);
    expect(artifacts.map((artifact) => artifact.id)).toEqual(['artifact_1', 'artifact_2']);
  });

  it('coerces and bounds run pagination values safely', () => {
    const store = new StudyMaterialStore({ dataDir: '/tmp/flowstate-study-material-store-tests' });

    store.createRun({
      id: 'run_1',
      courseId: 'course_1',
      mode: 'conservative',
      destinationType: 'local_folder',
      status: 'queued',
      createdAt: 1700000001000,
      updatedAt: 1700000001000,
    });
    store.createRun({
      id: 'run_2',
      courseId: 'course_1',
      mode: 'conservative',
      destinationType: 'local_folder',
      status: 'queued',
      createdAt: 1700000002000,
      updatedAt: 1700000002000,
    });

    const zeroLimit = store.listRuns({ limit: 0 });
    expect(zeroLimit).toHaveLength(1);

    const nanPagination = store.listRuns({ limit: Number.NaN, offset: Number.NaN });
    expect(nanPagination).toHaveLength(2);

    const negativeOffset = store.listRuns({ limit: 2, offset: -100 });
    expect(negativeOffset).toHaveLength(2);
    expect(negativeOffset.map((run) => run.id)).toEqual(['run_2', 'run_1']);
  });
});

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

class MockDatabase {
  public tables = new Set<string>();
  public sourceDocuments = new Map<string, SourceDocumentRow>();
  public runs = new Map<string, StudyMaterialRunRow>();
  public artifacts = new Map<string, StudyMaterialArtifactRow>();
  public citationSpans = new Map<string, CitationSpanRow>();
  public extractionIssues = new Map<string, ExtractionIssueRow>();
  public runDiffs = new Map<string, StudyRunDiffRow>();
  public userVersion = 0;
  public storeMigrationVersions = new Map<string, number>();

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

    if (normalized.includes('SELECT * FROM source_documents WHERE (? IS NULL OR course_id = ?) AND (? IS NULL OR origin = ?)')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args: unknown[]) => {
          const courseId = args[0] === null ? null : String(args[0]);
          const origin = args[2] === null ? null : String(args[2]);
          const limit = Number(args[4] ?? 100);
          const offset = Number(args[5] ?? 0);
          const rows = Array.from(this.sourceDocuments.values())
            .filter((row) => (!courseId || row.course_id === courseId) && (!origin || row.origin === origin))
            .sort((a, b) => b.ingested_at - a.ingested_at);
          return rows.slice(offset, offset + limit);
        },
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

    if (normalized.startsWith('INSERT INTO citation_spans')) {
      return {
        run: (...args: unknown[]) => {
          const row: CitationSpanRow = {
            id: String(args[0]),
            study_run_id: String(args[1]),
            artifact_id: String(args[2]),
            section_id: String(args[3]),
            source_document_id: String(args[4]),
            source_locator: String(args[5]),
            confidence: args[6] === null ? null : Number(args[6]),
          };
          this.citationSpans.set(row.id, row);
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('SELECT * FROM citation_spans WHERE study_run_id = ? AND (? IS NULL OR artifact_id = ?)')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args: unknown[]) => {
          const studyRunId = String(args[0]);
          const artifactId = args[1] === null ? null : String(args[1]);
          return Array.from(this.citationSpans.values())
            .filter((row) => row.study_run_id === studyRunId && (!artifactId || row.artifact_id === artifactId))
            .sort((a, b) => a.id.localeCompare(b.id));
        },
      };
    }

    if (normalized.startsWith('INSERT INTO extraction_issues')) {
      return {
        run: (...args: unknown[]) => {
          const row: ExtractionIssueRow = {
            id: String(args[0]),
            study_run_id: String(args[1]),
            source_document_id: String(args[2]),
            kind: String(args[3]),
            detail: String(args[4]),
            severity: String(args[5]),
          };
          this.extractionIssues.set(row.id, row);
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('SELECT * FROM extraction_issues WHERE study_run_id = ? AND (? IS NULL OR source_document_id = ?)')) {
      return {
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: (...args: unknown[]) => {
          const studyRunId = String(args[0]);
          const sourceDocumentId = args[1] === null ? null : String(args[1]);
          return Array.from(this.extractionIssues.values())
            .filter(
              (row) =>
                row.study_run_id === studyRunId &&
                (!sourceDocumentId || row.source_document_id === sourceDocumentId),
            )
            .sort((a, b) => a.id.localeCompare(b.id));
        },
      };
    }

    if (normalized.startsWith('INSERT INTO study_run_diffs')) {
      return {
        run: (...args: unknown[]) => {
          const row: StudyRunDiffRow = {
            id: String(args[0]),
            study_run_id: String(args[1]),
            previous_study_run_id: String(args[2]),
            summary: String(args[3]),
          };
          this.runDiffs.set(row.id, row);
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
      };
    }

    if (normalized.includes('SELECT * FROM study_run_diffs WHERE study_run_id = ? ORDER BY rowid DESC LIMIT 1')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args: unknown[]) => {
          const studyRunId = String(args[0]);
          const matching = Array.from(this.runDiffs.values()).filter((row) => row.study_run_id === studyRunId);
          return matching[matching.length - 1] ?? undefined;
        },
        all: () => [],
      };
    }

    if (normalized.includes('SELECT version FROM study_material_store_migrations WHERE scope = ? LIMIT 1')) {
      return {
        run: () => ({ changes: 0 }),
        get: (...args: unknown[]) => {
          const scope = String(args[0]);
          const version = this.storeMigrationVersions.get(scope);
          if (version === undefined) {
            return undefined;
          }

          return { version };
        },
        all: () => [],
      };
    }

    if (normalized.startsWith('INSERT INTO study_material_store_migrations')) {
      return {
        run: (...args: unknown[]) => {
          const scope = String(args[0]);
          const version = Number(args[1]);
          this.storeMigrationVersions.set(scope, version);
          return { changes: 1 };
        },
        get: () => undefined,
        all: () => [],
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
const mockDatabasesByPath = new Map<string, MockDatabase>();
let nextInitialUserVersion = 0;
let nextInitialStoreMigrationVersions = new Map<string, number>();

vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn((dbPath: string) => {
      const existing = mockDatabasesByPath.get(dbPath);
      if (existing) {
        return existing;
      }

      const db = new MockDatabase();
      db.userVersion = nextInitialUserVersion;
      db.storeMigrationVersions = new Map(nextInitialStoreMigrationVersions);
      mockDatabasesByPath.set(dbPath, db);
      mockDatabases.push(db);
      return db;
    }),
  };
});

const { StudyMaterialStore } = await import('./study-material-store.js');

describe('StudyMaterialStore', () => {
  beforeEach(() => {
    mockDatabases.length = 0;
    mockDatabasesByPath.clear();
    nextInitialUserVersion = 0;
    nextInitialStoreMigrationVersions = new Map();
  });

  afterEach(() => {
    mockDatabases.length = 0;
    mockDatabasesByPath.clear();
    nextInitialUserVersion = 0;
    nextInitialStoreMigrationVersions = new Map();
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
    expect(db.tables.has('study_material_store_migrations')).toBe(true);
    expect(db.storeMigrationVersions.get('study_material_store')).toBe(1);
  });

  it('tracks migration state independently from global user_version', () => {
    nextInitialUserVersion = 42;
    const store = new StudyMaterialStore({ dataDir: '/tmp/flowstate-study-material-store-tests' });

    store.initialize();

    const db = mockDatabases[0];
    expect(db).toBeDefined();
    if (!db) return;
    expect(db.userVersion).toBe(42);
    expect(db.storeMigrationVersions.get('study_material_store')).toBe(1);
  });

  it('coexists with other store migration metadata in shared memory db', () => {
    nextInitialStoreMigrationVersions = new Map([['task_store', 7]]);
    const sharedDataDir = '/tmp/flowstate-study-material-store-shared-tests';

    const firstStore = new StudyMaterialStore({ dataDir: sharedDataDir });
    firstStore.initialize();

    const secondStore = new StudyMaterialStore({ dataDir: sharedDataDir });
    secondStore.initialize();

    expect(mockDatabases).toHaveLength(1);

    const db = mockDatabases[0];
    expect(db).toBeDefined();
    if (!db) return;

    expect(db.storeMigrationVersions.get('task_store')).toBe(7);
    expect(db.storeMigrationVersions.get('study_material_store')).toBe(1);
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

  it('lists source documents in descending ingest order with filters and bounded pagination', () => {
    const store = new StudyMaterialStore({ dataDir: '/tmp/flowstate-study-material-store-tests' });

    store.createSourceDocument({
      id: 'source_1',
      courseId: 'course_1',
      origin: 'local',
      fileType: 'pdf',
      title: 'Local A',
      sourceRef: '/tmp/local-a.pdf',
      versionHash: 'hash-1',
      ingestedAt: 1700000001000,
    });
    store.createSourceDocument({
      id: 'source_2',
      courseId: 'course_1',
      origin: 'canvas',
      fileType: 'pdf',
      title: 'Canvas A',
      sourceRef: 'canvas://a',
      versionHash: 'hash-2',
      ingestedAt: 1700000003000,
    });
    store.createSourceDocument({
      id: 'source_3',
      courseId: 'course_2',
      origin: 'local',
      fileType: 'pptx',
      title: 'Local B',
      sourceRef: '/tmp/local-b.pptx',
      versionHash: 'hash-3',
      ingestedAt: 1700000002000,
    });
    store.createSourceDocument({
      id: 'source_4',
      courseId: 'course_1',
      origin: 'local',
      fileType: 'pdf',
      title: 'Local C',
      sourceRef: '/tmp/local-c.pdf',
      versionHash: 'hash-4',
      ingestedAt: 1700000004000,
    });

    const all = store.listSourceDocuments();
    expect(all.map((source) => source.id)).toEqual(['source_4', 'source_2', 'source_3', 'source_1']);

    const byCourse = store.listSourceDocuments({ courseId: 'course_1' });
    expect(byCourse.map((source) => source.id)).toEqual(['source_4', 'source_2', 'source_1']);

    const byOrigin = store.listSourceDocuments({ origin: 'local' });
    expect(byOrigin.map((source) => source.id)).toEqual(['source_4', 'source_3', 'source_1']);

    const byCourseAndOrigin = store.listSourceDocuments({ courseId: 'course_1', origin: 'local' });
    expect(byCourseAndOrigin.map((source) => source.id)).toEqual(['source_4', 'source_1']);

    const limitedToOne = store.listSourceDocuments({ limit: 0 });
    expect(limitedToOne).toHaveLength(1);
    expect(limitedToOne[0]?.id).toBe('source_4');

    const nanPagination = store.listSourceDocuments({ limit: Number.NaN, offset: Number.NaN });
    expect(nanPagination.map((source) => source.id)).toEqual(['source_4', 'source_2', 'source_3', 'source_1']);

    const negativeOffset = store.listSourceDocuments({ limit: 2, offset: -10 });
    expect(negativeOffset.map((source) => source.id)).toEqual(['source_4', 'source_2']);

    const offsetBeyond = store.listSourceDocuments({ limit: 2, offset: 10 });
    expect(offsetBeyond).toHaveLength(0);
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

  it('persists and queries provenance records for citations, issues, and run diffs', () => {
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
    store.createSourceDocument({
      id: 'source_2',
      courseId: 'course_1',
      origin: 'canvas',
      fileType: 'pdf',
      title: 'Lecture 2',
      sourceRef: 'canvas://lecture-2',
      versionHash: 'hash-v2',
      ingestedAt: 1700000000001,
    });

    store.createRun({
      id: 'run_1',
      courseId: 'course_1',
      mode: 'conservative',
      destinationType: 'local_folder',
      status: 'running',
      createdAt: 1700000001000,
      updatedAt: 1700000001000,
    });
    store.createRun({
      id: 'run_0',
      courseId: 'course_1',
      mode: 'conservative',
      destinationType: 'local_folder',
      status: 'completed',
      createdAt: 1699999999000,
      updatedAt: 1699999999000,
    });

    store.createArtifact({
      id: 'artifact_1',
      studyRunId: 'run_1',
      kind: 'summary',
      pathOrBlobRef: '/tmp/run_1-summary.md',
      createdAt: 1700000002000,
    });
    store.createArtifact({
      id: 'artifact_2',
      studyRunId: 'run_1',
      kind: 'report',
      pathOrBlobRef: '/tmp/run_1-report.json',
      createdAt: 1700000003000,
    });

    store.createCitationSpan({
      id: 'citation_1',
      studyRunId: 'run_1',
      artifactId: 'artifact_1',
      sectionId: 'sec_1',
      sourceDocumentId: 'source_1',
      sourceLocator: 'p.2',
      confidence: 0.92,
    });
    store.createCitationSpan({
      id: 'citation_2',
      studyRunId: 'run_1',
      artifactId: 'artifact_2',
      sectionId: 'sec_2',
      sourceDocumentId: 'source_2',
      sourceLocator: 'slide:4',
    });

    const allCitations = store.listCitationSpansByRun('run_1');
    expect(allCitations.map((citation) => citation.id)).toEqual(['citation_1', 'citation_2']);
    expect(allCitations[0]?.confidence).toBe(0.92);
    expect(allCitations[1]).not.toHaveProperty('confidence');

    const artifactScopedCitations = store.listCitationSpansByRun('run_1', 'artifact_1');
    expect(artifactScopedCitations).toHaveLength(1);
    expect(artifactScopedCitations[0]?.id).toBe('citation_1');

    store.createExtractionIssue({
      id: 'issue_1',
      studyRunId: 'run_1',
      sourceDocumentId: 'source_1',
      kind: 'ocr',
      detail: 'Could not parse table region',
      severity: 'warning',
    });
    store.createExtractionIssue({
      id: 'issue_2',
      studyRunId: 'run_1',
      sourceDocumentId: 'source_2',
      kind: 'truncation',
      detail: 'Page content ended unexpectedly',
      severity: 'error',
    });

    const allIssues = store.listExtractionIssuesByRun('run_1');
    expect(allIssues.map((issue) => issue.id)).toEqual(['issue_1', 'issue_2']);

    const sourceScopedIssues = store.listExtractionIssuesByRun('run_1', 'source_2');
    expect(sourceScopedIssues).toHaveLength(1);
    expect(sourceScopedIssues[0]?.id).toBe('issue_2');

    store.createRunDiff({
      id: 'diff_1',
      studyRunId: 'run_1',
      previousStudyRunId: 'run_0',
      summary: 'Initial delta',
    });
    store.createRunDiff({
      id: 'diff_2',
      studyRunId: 'run_1',
      previousStudyRunId: 'run_0',
      summary: 'Updated delta after second pass',
    });

    const latestDiff = store.getRunDiff('run_1');
    expect(latestDiff).toMatchObject({
      id: 'diff_2',
      studyRunId: 'run_1',
      previousStudyRunId: 'run_0',
      summary: 'Updated delta after second pass',
    });
    expect(store.getRunDiff('run_missing')).toBeNull();
  });
});

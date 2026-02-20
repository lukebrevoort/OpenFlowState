import { describe, expect, it } from 'vitest';

import type {
  CitationSpanRecord,
  ExtractionIssueRecord,
  SourceDocumentRecord,
  StudyMaterialArtifactRecord,
  StudyMaterialRunRecord,
} from './study-material-store';
import { runStudyMaterialOrchestrator } from './study-material-orchestrator';

type FakeStore = {
  runs: StudyMaterialRunRecord[];
  artifacts: StudyMaterialArtifactRecord[];
  issues: ExtractionIssueRecord[];
  citations: CitationSpanRecord[];
};

const makeFakeDependencies = (
  sources: SourceDocumentRecord[],
  generation: {
    citationCoverage: number;
    duplicateQuestionRatio: number;
    sourceCoverageRatio: number;
    citations: Array<{
      artifactKind: StudyMaterialArtifactRecord['kind'];
      sectionId: string;
      sourceDocumentId: string;
      sourceLocator: string;
    }>;
  },
  issueBySourceId: Record<string, Array<{ kind: string; detail: string; severity: string }>> = {},
) => {
  const store: FakeStore = {
    runs: [],
    artifacts: [],
    issues: [],
    citations: [],
  };

  return {
    store,
    deps: {
      listSources: () => sources,
      createRun: (record: StudyMaterialRunRecord) => {
        store.runs.push(record);
        return record;
      },
      updateRun: (id: string, patch: Partial<StudyMaterialRunRecord>) => {
        const existing = store.runs.find((run) => run.id === id);
        if (!existing) return null;
        const merged = { ...existing, ...patch };
        store.runs = store.runs.map((run) => (run.id === id ? merged : run));
        return merged;
      },
      createArtifact: (record: StudyMaterialArtifactRecord) => {
        store.artifacts.push(record);
        return record;
      },
      createIssue: (record: ExtractionIssueRecord) => {
        store.issues.push(record);
        return record;
      },
      createCitation: (record: CitationSpanRecord) => {
        store.citations.push(record);
        return record;
      },
      parsePdf: async (source: SourceDocumentRecord) => ({
        source,
        text: `Parsed ${source.title}`,
        issues: issueBySourceId[source.id] ?? [],
      }),
      parsePptx: async (source: SourceDocumentRecord) => ({
        source,
        text: `Parsed ${source.title}`,
        issues: issueBySourceId[source.id] ?? [],
      }),
      generate: async () => ({
        artifacts: {
          summary: '# Summary',
          practiceExam: '# Practice',
          flashcards: 'front,back',
        },
        citations: generation.citations,
        metrics: {
          citationCoverage: generation.citationCoverage,
          duplicateQuestionRatio: generation.duplicateQuestionRatio,
          sourceCoverageRatio: generation.sourceCoverageRatio,
        },
      }),
    },
  };
};

describe('runStudyMaterialOrchestrator', () => {
  it('completes run when quality gate passes', async () => {
    const sources: SourceDocumentRecord[] = [
      {
        id: 'source-1',
        courseId: 'course-1',
        origin: 'local',
        fileType: 'pdf',
        title: 'Lecture 1',
        sourceRef: '/tmp/lecture-1.pdf',
        versionHash: 'hash-1',
        ingestedAt: Date.now(),
      },
      {
        id: 'source-2',
        courseId: 'course-1',
        origin: 'local',
        fileType: 'pptx',
        title: 'Lecture 2',
        sourceRef: '/tmp/lecture-2.pptx',
        versionHash: 'hash-2',
        ingestedAt: Date.now(),
      },
    ];

    const { deps, store } = makeFakeDependencies(sources, {
      citationCoverage: 0.95,
      duplicateQuestionRatio: 0.02,
      sourceCoverageRatio: 1,
      citations: [
        {
          artifactKind: 'summary',
          sectionId: 'sec-1',
          sourceDocumentId: 'source-1',
          sourceLocator: 'page 1',
        },
        {
          artifactKind: 'practice_exam',
          sectionId: 'sec-2',
          sourceDocumentId: 'source-2',
          sourceLocator: 'slide 3',
        },
      ],
    });

    const stageCalls: string[] = [];
    const result = await runStudyMaterialOrchestrator(
      {
        runId: 'run-1',
        courseId: 'course-1',
        destinationType: 'local',
      },
      deps,
      (stage) => {
        stageCalls.push(stage);
      },
    );

    expect(stageCalls).toEqual([
      'discover',
      'extract',
      'normalize',
      'generate',
      'quality_gate',
      'persist',
    ]);
    expect(result.quality.passed).toBe(true);
    expect(result.run.status).toBe('completed');
    expect(result.artifacts).toHaveLength(3);
    expect(store.citations.length).toBe(2);
  });

  it('keeps run awaiting quality override when gate fails', async () => {
    const sources: SourceDocumentRecord[] = [
      {
        id: 'source-1',
        courseId: 'course-2',
        origin: 'local',
        fileType: 'pdf',
        title: 'Sparse Reading',
        sourceRef: '/tmp/sparse.pdf',
        versionHash: 'hash-sparse',
        ingestedAt: Date.now(),
      },
    ];

    const { deps } = makeFakeDependencies(
      sources,
      {
        citationCoverage: 0.2,
        duplicateQuestionRatio: 0.5,
        sourceCoverageRatio: 0.2,
        citations: [],
      },
      {
        'source-1': [
          {
            kind: 'scanned_or_image_like_uncertainty',
            detail: 'Sparse extraction',
            severity: 'warning',
          },
        ],
      },
    );

    const result = await runStudyMaterialOrchestrator(
      {
        runId: 'run-2',
        courseId: 'course-2',
        destinationType: 'notion',
      },
      deps,
    );

    expect(result.quality.passed).toBe(false);
    expect(result.quality.blocked).toBe(true);
    expect(result.run.status).toBe('awaiting_quality_override');
    expect(result.extractionIssues.length).toBe(1);
  });
});

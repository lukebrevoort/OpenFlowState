import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { routeStudyMaterialDestinationWrite } from './study-material-destination-router';
import { summarizeStudyRunDiff } from './study-material-diff-summarizer';
import {
  classifyStudyMaterialFallback,
  type StudyMaterialFallbackClassificationInput,
} from './study-material-fallback';
import { runStudyMaterialOrchestrator } from './study-material-orchestrator';
import { validateLocalStudyMaterialSource } from './study-material-source-validation';
import type {
  CitationSpanRecord,
  ExtractionIssueRecord,
  SourceDocumentRecord,
  StudyMaterialArtifactRecord,
  StudyMaterialRunRecord,
} from './study-material-store';

type FakeStore = {
  runs: StudyMaterialRunRecord[];
  artifacts: StudyMaterialArtifactRecord[];
  issues: ExtractionIssueRecord[];
  citations: CitationSpanRecord[];
};

type FlowResult =
  | {
      status: 'completed';
      attempts: number;
      fallbackClassifications: string[];
      timeline: string[];
      run: StudyMaterialRunRecord;
      writeFiles: string[];
    }
  | {
      status: 'validation_failed';
      attempts: number;
      fallbackClassifications: string[];
      timeline: string[];
      issueCode: string;
    }
  | {
      status: 'fallback_exhausted';
      attempts: number;
      fallbackClassifications: string[];
      timeline: string[];
    };

const decodeInlineArtifactRef = (inlineRef: string): string => {
  const match = /^inline:\/\/[^/]+\/(.+)$/.exec(inlineRef);
  if (!match?.[1]) {
    throw new Error(`Unexpected inline artifact ref: ${inlineRef}`);
  }

  return Buffer.from(match[1], 'base64').toString('utf8');
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
        issues: [],
      }),
      parsePptx: async (source: SourceDocumentRecord) => ({
        source,
        text: `Parsed ${source.title}`,
        issues: [],
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

const executeFallbackFlow = async (input: {
  courseId: string;
  runId: string;
  localFilePath: string;
  destinationDirectory: string;
  fallbackErrors: StudyMaterialFallbackClassificationInput[];
  maxFallbackAttempts: number;
}): Promise<FlowResult> => {
  const timeline: string[] = [];
  const fallbackClassifications: string[] = [];

  for (let attempt = 1; attempt <= input.maxFallbackAttempts; attempt += 1) {
    const failureInput = input.fallbackErrors[Math.min(attempt - 1, input.fallbackErrors.length - 1)] ?? {};
    const fallbackResult = classifyStudyMaterialFallback(failureInput);
    fallbackClassifications.push(fallbackResult.classification);

    if (!fallbackResult.localUploadPrimaryAction) {
      continue;
    }

    const validation = await validateLocalStudyMaterialSource({ filePath: input.localFilePath });
    if (!validation.ok || !validation.fileType || !validation.normalizedPath || !validation.versionHash || !validation.fileName) {
      return {
        status: 'validation_failed',
        attempts: attempt,
        fallbackClassifications,
        timeline,
        issueCode: validation.issue?.code ?? 'UNKNOWN',
      };
    }

    const sourceRecord: SourceDocumentRecord = {
      id: `source-${attempt}`,
      courseId: input.courseId,
      origin: 'local',
      fileType: validation.fileType,
      title: validation.fileName,
      sourceRef: validation.normalizedPath,
      versionHash: validation.versionHash,
      ingestedAt: 1_730_000_000_000 + attempt,
    };

    const { deps } = makeFakeDependencies([sourceRecord], {
      citationCoverage: 1,
      duplicateQuestionRatio: 0,
      sourceCoverageRatio: 1,
      citations: [
        {
          artifactKind: 'summary',
          sectionId: 'section-1',
          sourceDocumentId: sourceRecord.id,
          sourceLocator: 'page 1',
        },
      ],
    });

    const orchestratorResult = await runStudyMaterialOrchestrator(
      {
        runId: input.runId,
        courseId: input.courseId,
        destinationType: 'local',
      },
      deps,
      (stage) => {
        timeline.push(stage);
      },
    );

    if (orchestratorResult.quality.blocked) {
      return {
        status: 'fallback_exhausted',
        attempts: attempt,
        fallbackClassifications,
        timeline,
      };
    }

    const artifactByKind = new Map(orchestratorResult.artifacts.map((artifact) => [artifact.kind, artifact]));
    const summaryRef = artifactByKind.get('summary')?.pathOrBlobRef;
    const practiceExamRef = artifactByKind.get('practice_exam')?.pathOrBlobRef;
    const flashcardsRef = artifactByKind.get('flashcards')?.pathOrBlobRef;

    if (!summaryRef || !practiceExamRef || !flashcardsRef) {
      throw new Error('Expected orchestrator to persist summary, practice exam, and flashcards artifacts.');
    }

    const writeResult = await routeStudyMaterialDestinationWrite({
      run: orchestratorResult.run,
      output: {
        summary: decodeInlineArtifactRef(summaryRef),
        practiceExam: decodeInlineArtifactRef(practiceExamRef),
        flashcardsCsv: decodeInlineArtifactRef(flashcardsRef),
        metadata: {
          runId: orchestratorResult.run.id,
          qualityScore: orchestratorResult.quality.score,
        },
      },
      destination: {
        type: 'local',
        localDirectoryPath: input.destinationDirectory,
      },
    });

    timeline.push('write');

    return {
      status: 'completed',
      attempts: attempt,
      fallbackClassifications,
      timeline,
      run: orchestratorResult.run,
      writeFiles: writeResult.files ?? [],
    };
  }

  return {
    status: 'fallback_exhausted',
    attempts: input.maxFallbackAttempts,
    fallbackClassifications,
    timeline,
  };
};

describe('study material Phase 8 fallback flow', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dirPath) => fs.rm(dirPath, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('runs fallback classification -> local validation -> orchestrator -> quality gate -> write and rerun diff', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowstate-phase8-e2e-'));
    tempDirs.push(tmpDir);

    const localPdfPath = path.join(tmpDir, 'lecture.pdf');
    await fs.writeFile(localPdfPath, Buffer.from('%PDF-1.7\nflowstate\n', 'ascii'));

    const firstRun = await executeFallbackFlow({
      courseId: 'course-phase-8',
      runId: 'run-1',
      localFilePath: localPdfPath,
      destinationDirectory: path.join(tmpDir, 'output-1'),
      fallbackErrors: [{ message: 'Resource is hosted on external host and outside Canvas domain' }],
      maxFallbackAttempts: 2,
    });

    expect(firstRun.status).toBe('completed');
    if (firstRun.status !== 'completed') return;

    expect(firstRun.timeline).toEqual([
      'discover',
      'extract',
      'normalize',
      'generate',
      'quality_gate',
      'persist',
      'write',
    ]);
    expect(firstRun.fallbackClassifications).toEqual(['external_host']);
    expect(firstRun.writeFiles).toHaveLength(4);

    const secondRun = await executeFallbackFlow({
      courseId: 'course-phase-8',
      runId: 'run-2',
      localFilePath: localPdfPath,
      destinationDirectory: path.join(tmpDir, 'output-2'),
      fallbackErrors: [{ message: 'outside Canvas external host' }],
      maxFallbackAttempts: 2,
    });

    expect(secondRun.status).toBe('completed');
    if (secondRun.status !== 'completed') return;

    const rerunDiff = summarizeStudyRunDiff(secondRun.run, firstRun.run);
    expect(rerunDiff).toBe('No major changes detected from previous run.');

    const summary = await fs.readFile(path.join(tmpDir, 'output-1', 'summary.md'), 'utf8');
    expect(summary).toContain('# Summary');
  });

  it('rejects unsupported file types and oversized local uploads', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowstate-phase8-validation-'));
    tempDirs.push(tmpDir);

    const unsupportedPath = path.join(tmpDir, 'lecture.docx');
    const unsupported = await validateLocalStudyMaterialSource({ filePath: unsupportedPath });
    expect(unsupported.ok).toBe(false);
    expect(unsupported.issue?.code).toBe('UNSUPPORTED_EXTENSION');

    const largePdfPath = path.join(tmpDir, 'large.pdf');
    await fs.writeFile(largePdfPath, Buffer.from('%PDF-1.7\nthis-file-is-too-large\n', 'ascii'));
    const oversized = await validateLocalStudyMaterialSource({
      filePath: largePdfPath,
      maxBytes: 8,
    });
    expect(oversized.ok).toBe(false);
    expect(oversized.issue?.code).toBe('FILE_TOO_LARGE');
  });

  it('keeps version hash stable for duplicate uploads and updates hash on content change', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowstate-phase8-hash-'));
    tempDirs.push(tmpDir);

    const firstPath = path.join(tmpDir, 'deck-a.pdf');
    const secondPath = path.join(tmpDir, 'deck-b.pdf');
    const originalContent = Buffer.from('%PDF-1.7\nidentical-content\n', 'ascii');

    await fs.writeFile(firstPath, originalContent);
    await fs.writeFile(secondPath, originalContent);

    const firstValidation = await validateLocalStudyMaterialSource({ filePath: firstPath });
    const secondValidation = await validateLocalStudyMaterialSource({ filePath: secondPath });

    expect(firstValidation.ok).toBe(true);
    expect(secondValidation.ok).toBe(true);
    if (!firstValidation.ok || !secondValidation.ok) return;

    expect(firstValidation.versionHash).toBe(secondValidation.versionHash);

    await fs.writeFile(secondPath, Buffer.from('%PDF-1.7\nmutated-content\n', 'ascii'));
    const mutatedValidation = await validateLocalStudyMaterialSource({ filePath: secondPath });

    expect(mutatedValidation.ok).toBe(true);
    if (!mutatedValidation.ok) return;
    expect(mutatedValidation.versionHash).not.toBe(firstValidation.versionHash);
  });

  it('caps fallback retries to prevent infinite orchestrator loop', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowstate-phase8-retries-'));
    tempDirs.push(tmpDir);

    const localPdfPath = path.join(tmpDir, 'lecture.pdf');
    await fs.writeFile(localPdfPath, Buffer.from('%PDF-1.7\nflowstate\n', 'ascii'));

    const result = await executeFallbackFlow({
      courseId: 'course-phase-8',
      runId: 'run-retry-cap',
      localFilePath: localPdfPath,
      destinationDirectory: path.join(tmpDir, 'output'),
      fallbackErrors: [
        { status: 504, code: 'ETIMEDOUT', message: 'request timed out' },
      ],
      maxFallbackAttempts: 3,
    });

    expect(result.status).toBe('fallback_exhausted');
    expect(result.attempts).toBe(3);
    expect(result.fallbackClassifications).toEqual(['timeout', 'timeout', 'timeout']);
    expect(result.timeline).toEqual([]);
  });
});

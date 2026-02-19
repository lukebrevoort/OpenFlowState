import type {
  CitationSpanRecord,
  ExtractionIssueRecord,
  SourceDocumentRecord,
  StudyMaterialArtifactRecord,
  StudyMaterialRunRecord,
} from './study-material-store';
import { appendInlineCitationsToArtifact } from './study-material-citation-formatter';
import { evaluateStudyMaterialQualityGate } from './study-material-quality-gate';

import type { StudyMaterialQualityGateEvaluateResult } from '../renderer/types/electron';

export type StudyMaterialGenerationArtifacts = {
  summary: string;
  practiceExam: string;
  flashcards: string;
};

export type StudyMaterialGenerationOutput = {
  artifacts: StudyMaterialGenerationArtifacts;
  citations?: Array<{
    artifactKind: StudyMaterialArtifactRecord['kind'];
    sectionId: string;
    sourceDocumentId: string;
    sourceLocator: string;
    confidence?: number;
  }>;
  metrics?: {
    citationCoverage?: number;
    duplicateQuestionRatio?: number;
    sourceCoverageRatio?: number;
  };
};

export type ParsedStudySource = {
  source: SourceDocumentRecord;
  text: string;
  issues: Array<{
    kind: string;
    detail: string;
    severity: string;
  }>;
};

export type StudyMaterialOrchestratorDependencies = {
  listSources: (query: { courseId: string }) => SourceDocumentRecord[];
  createRun: (record: StudyMaterialRunRecord) => StudyMaterialRunRecord;
  updateRun: (
    id: string,
    patch: Partial<Pick<StudyMaterialRunRecord, 'status' | 'qualityScore' | 'destinationType'>> & {
      updatedAt?: number;
    },
  ) => StudyMaterialRunRecord | null;
  createArtifact: (record: StudyMaterialArtifactRecord) => StudyMaterialArtifactRecord;
  createIssue: (record: ExtractionIssueRecord) => ExtractionIssueRecord;
  createCitation: (record: CitationSpanRecord) => CitationSpanRecord;
  parsePdf: (source: SourceDocumentRecord) => Promise<ParsedStudySource>;
  parsePptx: (source: SourceDocumentRecord) => Promise<ParsedStudySource>;
  generate: (input: {
    courseId: string;
    mode: StudyMaterialRunRecord['mode'];
    mergedContext: string;
    parsedSources: ParsedStudySource[];
  }) => Promise<StudyMaterialGenerationOutput>;
};

export type StudyMaterialOrchestratorInput = {
  runId: string;
  courseId: string;
  destinationType: string;
  mode?: StudyMaterialRunRecord['mode'];
  writeAnywayRequested?: boolean;
};

export type StudyMaterialOrchestratorResult = {
  run: StudyMaterialRunRecord;
  parsedSources: ParsedStudySource[];
  artifacts: StudyMaterialArtifactRecord[];
  extractionIssues: ExtractionIssueRecord[];
  quality: StudyMaterialQualityGateEvaluateResult;
};

export type StudyMaterialOrchestratorStage =
  | 'discover'
  | 'extract'
  | 'normalize'
  | 'generate'
  | 'quality_gate'
  | 'persist';

type StageCallback = (stage: StudyMaterialOrchestratorStage, detail: string) => void;

const toInlineArtifactRef = (kind: string, content: string) => {
  return `inline://${kind}/${Buffer.from(content, 'utf8').toString('base64')}`;
};

const safeUuid = (prefix: string) =>
  globalThis.crypto?.randomUUID?.() ??
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const mergeParsedSources = (parsedSources: ParsedStudySource[]): string => {
  return parsedSources
    .map((entry, index) => {
      return [
        `Source ${index + 1}: ${entry.source.title}`,
        `Type: ${entry.source.fileType}`,
        `Path: ${entry.source.sourceRef}`,
        entry.text,
      ].join('\n');
    })
    .join('\n\n---\n\n')
    .trim();
};

const parseSource = async (
  source: SourceDocumentRecord,
  dependencies: StudyMaterialOrchestratorDependencies,
): Promise<ParsedStudySource> => {
  if (source.fileType.toLowerCase() === 'pdf') {
    return dependencies.parsePdf(source);
  }

  if (source.fileType.toLowerCase() === 'pptx') {
    return dependencies.parsePptx(source);
  }

  return {
    source,
    text: '',
    issues: [
      {
        kind: 'unsupported_source_type',
        detail: `Unsupported source type for orchestration: ${source.fileType}`,
        severity: 'warning',
      },
    ],
  };
};

export const runStudyMaterialOrchestrator = async (
  input: StudyMaterialOrchestratorInput,
  dependencies: StudyMaterialOrchestratorDependencies,
  onStage?: StageCallback,
): Promise<StudyMaterialOrchestratorResult> => {
  const mode = input.mode ?? 'conservative';
  const now = Date.now();

  let run = dependencies.createRun({
    id: input.runId,
    courseId: input.courseId,
    mode,
    destinationType: input.destinationType,
    status: 'running',
    createdAt: now,
    updatedAt: now,
  });

  onStage?.('discover', 'Discovering course sources');
  const sources = dependencies.listSources({ courseId: input.courseId });

  onStage?.('extract', `Extracting ${sources.length} source files`);
  const parsedSources = await Promise.all(
    sources.map((source) => parseSource(source, dependencies)),
  );

  const extractionIssues = parsedSources.flatMap((parsed) =>
    parsed.issues.map((issue) =>
      dependencies.createIssue({
        id: safeUuid('issue'),
        studyRunId: input.runId,
        sourceDocumentId: parsed.source.id,
        kind: issue.kind,
        detail: issue.detail,
        severity: issue.severity,
      }),
    ),
  );

  onStage?.('normalize', 'Merging extracted context');
  const mergedContext = mergeParsedSources(parsedSources);

  onStage?.('generate', 'Generating study materials');
  const generationOutput = await dependencies.generate({
    courseId: input.courseId,
    mode,
    mergedContext,
    parsedSources,
  });

  onStage?.('quality_gate', 'Evaluating quality gate');
  const citations = generationOutput.citations ?? [];
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const citedSourceIds = new Set(citations.map((citation) => citation.sourceDocumentId));
  const sourceCoverageRatio =
    generationOutput.metrics?.sourceCoverageRatio ??
    (sources.length > 0 ? citedSourceIds.size / sources.length : 0);

  const quality = evaluateStudyMaterialQualityGate({
    citationCoverage: generationOutput.metrics?.citationCoverage ?? (citations.length > 0 ? 1 : 0),
    duplicateQuestionRatio: generationOutput.metrics?.duplicateQuestionRatio ?? 0,
    sourceCoverageRatio,
    extractionIssueCount: extractionIssues.length,
    writeAnywayRequested: Boolean(input.writeAnywayRequested),
  });

  onStage?.('persist', 'Persisting generated artifacts');
  const artifacts: StudyMaterialArtifactRecord[] = [
    {
      id: safeUuid('artifact'),
      studyRunId: input.runId,
      kind: 'summary',
      pathOrBlobRef: toInlineArtifactRef(
        'summary',
        appendInlineCitationsToArtifact(
          generationOutput.artifacts.summary,
          citations
            .filter((citation) => citation.artifactKind === 'summary')
            .map((citation) => ({
              sourceDocumentId: citation.sourceDocumentId,
              sourceLocator: citation.sourceLocator,
              confidence: citation.confidence,
            })),
          sourceMap,
        ),
      ),
      mime: 'text/markdown',
      createdAt: Date.now(),
    },
    {
      id: safeUuid('artifact'),
      studyRunId: input.runId,
      kind: 'practice_exam',
      pathOrBlobRef: toInlineArtifactRef(
        'practice_exam',
        appendInlineCitationsToArtifact(
          generationOutput.artifacts.practiceExam,
          citations
            .filter((citation) => citation.artifactKind === 'practice_exam')
            .map((citation) => ({
              sourceDocumentId: citation.sourceDocumentId,
              sourceLocator: citation.sourceLocator,
              confidence: citation.confidence,
            })),
          sourceMap,
        ),
      ),
      mime: 'text/markdown',
      createdAt: Date.now(),
    },
    {
      id: safeUuid('artifact'),
      studyRunId: input.runId,
      kind: 'flashcards',
      pathOrBlobRef: toInlineArtifactRef('flashcards', generationOutput.artifacts.flashcards),
      mime: 'text/csv',
      createdAt: Date.now(),
    },
  ].map((artifact) => dependencies.createArtifact(artifact));

  const artifactByKind = new Map(artifacts.map((artifact) => [artifact.kind, artifact]));

  for (const citation of citations) {
    const artifact = artifactByKind.get(citation.artifactKind);
    if (!artifact) {
      continue;
    }

    dependencies.createCitation({
      id: safeUuid('citation'),
      studyRunId: input.runId,
      artifactId: artifact.id,
      sectionId: citation.sectionId,
      sourceDocumentId: citation.sourceDocumentId,
      sourceLocator: citation.sourceLocator,
      confidence: citation.confidence,
    });
  }

  run =
    dependencies.updateRun(input.runId, {
      status: quality.blocked ? 'awaiting_quality_override' : 'completed',
      qualityScore: quality.score,
      destinationType: input.destinationType,
      updatedAt: Date.now(),
    }) ??
    {
      ...run,
      status: quality.blocked ? 'awaiting_quality_override' : 'completed',
      qualityScore: quality.score,
      updatedAt: Date.now(),
    };

  return {
    run,
    parsedSources,
    artifacts,
    extractionIssues,
    quality,
  };
};

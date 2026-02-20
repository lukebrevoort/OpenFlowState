import type {
  StudyMaterialQualityGateCheck,
  StudyMaterialQualityGateEvaluateInput,
  StudyMaterialQualityGateEvaluateResult,
  StudyMaterialQualityGateThresholds,
} from '../renderer/types/electron';

export const DEFAULT_STUDY_MATERIAL_QUALITY_GATE_THRESHOLDS: StudyMaterialQualityGateThresholds = {
  minCitationCoverage: 0.8,
  maxDuplicateQuestionRatio: 0.1,
  minSourceCoverageRatio: 0.7,
};

const clamp01 = (value: number): number => {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
};

const roundScore = (value: number): number => {
  return Math.round(clamp01(value) * 1000) / 1000;
};

const resolveThresholds = (
  overrides: StudyMaterialQualityGateEvaluateInput['thresholds'],
): StudyMaterialQualityGateThresholds => {
  return {
    ...DEFAULT_STUDY_MATERIAL_QUALITY_GATE_THRESHOLDS,
    ...(overrides ?? {}),
  };
};

const citationComponentScore = (value: number, threshold: number): number => {
  if (threshold <= 0) {
    return 1;
  }

  return clamp01(value / threshold);
};

const duplicateComponentScore = (value: number, threshold: number): number => {
  if (threshold >= 1 || value <= threshold) {
    return 1;
  }

  const overflow = value - threshold;
  const range = 1 - threshold;
  return clamp01(1 - overflow / range);
};

const sourceComponentScore = (value: number, threshold: number): number => {
  if (threshold <= 0) {
    return 1;
  }

  return clamp01(value / threshold);
};

const extractionIssueComponentScore = (value: number): number => {
  return value === 0 ? 1 : 0;
};

const makeSummary = (passed: boolean, blocked: boolean, checks: StudyMaterialQualityGateCheck[]): string => {
  const passedChecks = checks.filter((check) => check.passed).length;
  const totalChecks = checks.length;

  if (passed) {
    return `Quality gate passed (${passedChecks}/${totalChecks} checks).`;
  }

  if (blocked) {
    return `Quality gate failed (${passedChecks}/${totalChecks} checks). Writing is blocked.`;
  }

  return `Quality gate failed (${passedChecks}/${totalChecks} checks). Override requested, writing is allowed.`;
};

export const evaluateStudyMaterialQualityGate = (
  input: StudyMaterialQualityGateEvaluateInput,
): StudyMaterialQualityGateEvaluateResult => {
  const thresholds = resolveThresholds(input.thresholds);

  const checks: StudyMaterialQualityGateCheck[] = [
    {
      metric: 'citationCoverage',
      comparator: '>=',
      threshold: thresholds.minCitationCoverage,
      value: input.citationCoverage,
      passed: input.citationCoverage >= thresholds.minCitationCoverage,
    },
    {
      metric: 'duplicateQuestionRatio',
      comparator: '<=',
      threshold: thresholds.maxDuplicateQuestionRatio,
      value: input.duplicateQuestionRatio,
      passed: input.duplicateQuestionRatio <= thresholds.maxDuplicateQuestionRatio,
    },
    {
      metric: 'sourceCoverageRatio',
      comparator: '>=',
      threshold: thresholds.minSourceCoverageRatio,
      value: input.sourceCoverageRatio,
      passed: input.sourceCoverageRatio >= thresholds.minSourceCoverageRatio,
    },
    {
      metric: 'extractionIssueCount',
      comparator: '<=',
      threshold: 0,
      value: input.extractionIssueCount,
      passed: input.extractionIssueCount <= 0,
    },
  ];

  const passed = checks.every((check) => check.passed);
  const blocked = !passed && !input.writeAnywayRequested;

  const score = roundScore(
    (citationComponentScore(input.citationCoverage, thresholds.minCitationCoverage) +
      duplicateComponentScore(input.duplicateQuestionRatio, thresholds.maxDuplicateQuestionRatio) +
      sourceComponentScore(input.sourceCoverageRatio, thresholds.minSourceCoverageRatio) +
      extractionIssueComponentScore(input.extractionIssueCount)) /
      4,
  );

  return {
    passed,
    blocked,
    score,
    checks,
    summary: makeSummary(passed, blocked, checks),
  };
};

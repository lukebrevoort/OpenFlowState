import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STUDY_MATERIAL_QUALITY_GATE_THRESHOLDS,
  evaluateStudyMaterialQualityGate,
} from './study-material-quality-gate.js';

describe('evaluateStudyMaterialQualityGate', () => {
  it('passes when all metrics meet thresholds with no extraction issues', () => {
    const result = evaluateStudyMaterialQualityGate({
      citationCoverage: 0.9,
      duplicateQuestionRatio: 0.05,
      sourceCoverageRatio: 0.9,
      extractionIssueCount: 0,
      writeAnywayRequested: false,
    });

    expect(result.passed).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.checks.every((check) => check.passed)).toBe(true);
    expect(result.score).toBe(1);
    expect(result.summary).toContain('passed');
  });

  it('fails and blocks writing when override is not requested', () => {
    const result = evaluateStudyMaterialQualityGate({
      citationCoverage: 0.6,
      duplicateQuestionRatio: 0.2,
      sourceCoverageRatio: 0.6,
      extractionIssueCount: 2,
      writeAnywayRequested: false,
    });

    expect(result.passed).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.summary).toContain('Writing is blocked');
    expect(result.checks.filter((check) => !check.passed)).toHaveLength(4);
  });

  it('fails but allows writing when write-anyway is requested', () => {
    const result = evaluateStudyMaterialQualityGate({
      citationCoverage: 0.7,
      duplicateQuestionRatio: 0.3,
      sourceCoverageRatio: 0.4,
      extractionIssueCount: 1,
      writeAnywayRequested: true,
    });

    expect(result.passed).toBe(false);
    expect(result.blocked).toBe(false);
    expect(result.summary).toContain('Override requested, writing is allowed');
  });

  it('applies threshold overrides to change pass/fail outcome', () => {
    const baselineInput = {
      citationCoverage: 0.75,
      duplicateQuestionRatio: 0.15,
      sourceCoverageRatio: 0.65,
      extractionIssueCount: 0,
      writeAnywayRequested: false,
    };

    const defaultResult = evaluateStudyMaterialQualityGate(baselineInput);
    expect(defaultResult.passed).toBe(false);
    expect(defaultResult.checks.find((check) => check.metric === 'citationCoverage')?.threshold).toBe(
      DEFAULT_STUDY_MATERIAL_QUALITY_GATE_THRESHOLDS.minCitationCoverage,
    );

    const relaxedResult = evaluateStudyMaterialQualityGate({
      ...baselineInput,
      thresholds: {
        minCitationCoverage: 0.7,
        maxDuplicateQuestionRatio: 0.2,
        minSourceCoverageRatio: 0.6,
      },
    });

    expect(relaxedResult.passed).toBe(true);
    expect(relaxedResult.blocked).toBe(false);
    expect(relaxedResult.checks.find((check) => check.metric === 'citationCoverage')?.threshold).toBe(0.7);
    expect(relaxedResult.checks.find((check) => check.metric === 'duplicateQuestionRatio')?.threshold).toBe(0.2);
    expect(relaxedResult.checks.find((check) => check.metric === 'sourceCoverageRatio')?.threshold).toBe(0.6);
  });
});

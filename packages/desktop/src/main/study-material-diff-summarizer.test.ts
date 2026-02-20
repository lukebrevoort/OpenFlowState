import { describe, expect, it } from 'vitest';

import { summarizeStudyRunDiff } from './study-material-diff-summarizer';

describe('summarizeStudyRunDiff', () => {
  it('reports destination, quality, and status changes', () => {
    const previous = {
      id: 'run-1',
      courseId: 'course-1',
      mode: 'conservative' as const,
      destinationType: 'local',
      status: 'completed' as const,
      qualityScore: 0.8,
      createdAt: 1,
      updatedAt: 1,
    };

    const current = {
      ...previous,
      id: 'run-2',
      destinationType: 'notion',
      status: 'awaiting_quality_override' as const,
      qualityScore: 0.62,
      updatedAt: 2,
    };

    const summary = summarizeStudyRunDiff(current, previous);
    expect(summary).toContain('destination changed from local to notion');
    expect(summary).toContain('quality score 0.800 -> 0.620');
    expect(summary).toContain('status changed from completed to awaiting_quality_override');
  });

  it('returns no-change summary when runs match', () => {
    const run = {
      id: 'run-1',
      courseId: 'course-1',
      mode: 'conservative' as const,
      destinationType: 'local',
      status: 'completed' as const,
      qualityScore: 0.8,
      createdAt: 1,
      updatedAt: 1,
    };

    expect(summarizeStudyRunDiff(run, run)).toBe('No major changes detected from previous run.');
  });
});

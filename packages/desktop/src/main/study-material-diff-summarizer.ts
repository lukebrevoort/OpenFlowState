import type { StudyMaterialRunRecord } from './study-material-store';

export const summarizeStudyRunDiff = (
  currentRun: StudyMaterialRunRecord,
  previousRun: StudyMaterialRunRecord,
): string => {
  const changes: string[] = [];

  if (currentRun.destinationType !== previousRun.destinationType) {
    changes.push(
      `destination changed from ${previousRun.destinationType} to ${currentRun.destinationType}`,
    );
  }

  if ((currentRun.qualityScore ?? null) !== (previousRun.qualityScore ?? null)) {
    const prev = previousRun.qualityScore == null ? 'n/a' : previousRun.qualityScore.toFixed(3);
    const next = currentRun.qualityScore == null ? 'n/a' : currentRun.qualityScore.toFixed(3);
    changes.push(`quality score ${prev} -> ${next}`);
  }

  if (currentRun.status !== previousRun.status) {
    changes.push(`status changed from ${previousRun.status} to ${currentRun.status}`);
  }

  if (changes.length === 0) {
    return 'No major changes detected from previous run.';
  }

  return `Run diff: ${changes.join('; ')}.`;
};

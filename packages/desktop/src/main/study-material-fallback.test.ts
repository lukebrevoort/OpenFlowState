import { describe, expect, it } from 'vitest';

import { classifyStudyMaterialFallback } from './study-material-fallback.js';

describe('classifyStudyMaterialFallback', () => {
  it('classifies auth expired errors', () => {
    const result = classifyStudyMaterialFallback({ status: 401, message: 'Session expired for Canvas token' });

    expect(result.classification).toBe('auth_expired');
    expect(result.localUploadPrimaryAction).toBe(false);
    expect(result.recommendation).toContain('Reconnect Canvas');
  });

  it('classifies external host failures', () => {
    const result = classifyStudyMaterialFallback({ message: 'Resource is hosted on external host and outside Canvas domain' });

    expect(result.classification).toBe('external_host');
    expect(result.localUploadPrimaryAction).toBe(true);
    expect(result.recommendation).toContain('outside Canvas');
  });

  it('classifies inaccessible source failures', () => {
    const result = classifyStudyMaterialFallback({ status: 404, message: 'Source not found' });

    expect(result.classification).toBe('inaccessible');
    expect(result.localUploadPrimaryAction).toBe(true);
    expect(result.recommendation).toContain('could not be accessed');
  });

  it('classifies timeout failures', () => {
    const result = classifyStudyMaterialFallback({ code: 'ETIMEDOUT', status: '504' });

    expect(result.classification).toBe('timeout');
    expect(result.localUploadPrimaryAction).toBe(false);
    expect(result.recommendation).toContain('timed out');
  });

  it('classifies unknown failures when no rule matches', () => {
    const result = classifyStudyMaterialFallback({ message: 'Unexpected parser state', status: 500, code: 'EUNEXPECTED' });

    expect(result.classification).toBe('unknown');
    expect(result.localUploadPrimaryAction).toBe(false);
    expect(result.recommendation).toContain('could not determine');
  });
});

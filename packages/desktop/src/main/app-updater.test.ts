import { describe, expect, it } from 'vitest';
import { extractReleaseNotesFromUpdateInfo, resolveUpdateTrack } from './app-updater.js';

describe('resolveUpdateTrack', () => {
  it('defaults to stable for unknown values', () => {
    expect(resolveUpdateTrack(undefined)).toBe('stable');
    expect(resolveUpdateTrack('preview')).toBe('stable');
  });

  it('uses beta when explicitly configured', () => {
    expect(resolveUpdateTrack('beta')).toBe('beta');
  });
});

describe('extractReleaseNotesFromUpdateInfo', () => {
  it('returns trimmed string release notes', () => {
    expect(
      extractReleaseNotesFromUpdateInfo({
        releaseNotes: '  Bug fixes and reliability improvements.  ',
      }),
    ).toBe('Bug fixes and reliability improvements.');
  });

  it('normalizes array-based release notes from provider payloads', () => {
    expect(
      extractReleaseNotesFromUpdateInfo({
        releaseNotes: [
          {
            version: '0.1.1-beta.1',
            note: 'Added beta channel updates.',
          },
          {
            version: '0.1.1-beta.2',
            note: 'Improved update prompt details.',
          },
        ],
      }),
    ).toBe(
      'v0.1.1-beta.1\nAdded beta channel updates.\n\nv0.1.1-beta.2\nImproved update prompt details.',
    );
  });

  it('returns undefined when no release notes are available', () => {
    expect(extractReleaseNotesFromUpdateInfo({ releaseNotes: null })).toBeUndefined();
  });
});

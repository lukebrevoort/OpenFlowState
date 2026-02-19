import { describe, expect, it } from 'vitest';

import {
  appendInlineCitationsToArtifact,
  buildCitationTag,
} from './study-material-citation-formatter';

describe('study-material-citation-formatter', () => {
  it('builds readable citation tags', () => {
    const sourceMap = new Map([
      [
        'source-1',
        {
          id: 'source-1',
          courseId: 'course-1',
          origin: 'local',
          fileType: 'pdf',
          title: 'Lecture 5',
          sourceRef: '/tmp/lecture-5.pdf',
          versionHash: 'hash',
          ingestedAt: Date.now(),
        },
      ],
    ]);

    const tag = buildCitationTag(
      {
        sourceDocumentId: 'source-1',
        sourceLocator: 'page 12',
        confidence: 0.86,
      },
      sourceMap,
    );

    expect(tag).toBe('[Source: Lecture 5 - page 12; conf 86%]');
  });

  it('appends unique inline citation tags to artifact content', () => {
    const sourceMap = new Map([
      [
        'source-1',
        {
          id: 'source-1',
          courseId: 'course-1',
          origin: 'local',
          fileType: 'pdf',
          title: 'Lecture 5',
          sourceRef: '/tmp/lecture-5.pdf',
          versionHash: 'hash',
          ingestedAt: Date.now(),
        },
      ],
    ]);

    const formatted = appendInlineCitationsToArtifact(
      '## Summary\n- Topic A',
      [
        { sourceDocumentId: 'source-1', sourceLocator: 'page 5' },
        { sourceDocumentId: 'source-1', sourceLocator: 'page 5' },
      ],
      sourceMap,
    );

    expect(formatted).toContain('## Summary');
    expect(formatted.match(/\[Source:/g)?.length).toBe(1);
  });
});

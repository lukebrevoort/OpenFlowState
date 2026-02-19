import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StudyRunDiffCard } from './StudyRunDiffCard';

describe('StudyRunDiffCard', () => {
  it('renders summary copy for timeline display', () => {
    const html = renderToStaticMarkup(
      React.createElement(StudyRunDiffCard, {
        summary: 'Run diff: destination changed from local to notion.',
      }),
    );

    expect(html).toContain('Study Run Diff');
    expect(html).toContain('destination changed from local to notion');
  });
});

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildFlowstatePromptCandidatePaths } from './process-manager-paths.js';

describe('buildFlowstatePromptCandidatePaths', () => {
  it('orders packaged-first candidates and includes env override', () => {
    const candidates = buildFlowstatePromptCandidatePaths({
      envAgentsDir: '/tmp/custom-agents',
      resourcesPath: '/Applications/FlowState.app/Contents/Resources',
      appPath: '/Applications/FlowState.app/Contents/Resources/app.asar',
      repoRoot: '/Users/luke/dev/flowstate',
      packagesDir: '/Applications/FlowState.app/Contents/Resources/mcp-servers',
    });

    expect(candidates[0]).toBe(path.join('/tmp/custom-agents', 'flowstate.md'));
    expect(candidates[1]).toBe(
      path.join('/Applications/FlowState.app/Contents/Resources', 'agents', 'flowstate.md')
    );
    expect(candidates).toContain(path.join('/Users/luke/dev/flowstate', 'agents', 'flowstate.md'));
  });

  it('deduplicates identical candidate paths', () => {
    const resourcesPath = '/repo';
    const candidates = buildFlowstatePromptCandidatePaths({
      envAgentsDir: '/repo/agents',
      resourcesPath,
      appPath: '/repo',
      repoRoot: '/repo',
      packagesDir: '/repo/mcp-servers',
    });

    const normalized = candidates.map((candidate) => path.normalize(candidate));
    const uniqueCount = new Set(normalized).size;
    expect(uniqueCount).toBe(normalized.length);
  });
});

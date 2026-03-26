import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('release workflow gating', () => {
  it('keeps publish blocked behind gate:release', async () => {
    const workflowPath = path.join(repoRoot, '.github', 'workflows', 'release-gate.yml');
    const workflow = await fs.readFile(workflowPath, 'utf8');

    expect(workflow).toContain('run: pnpm gate:release');
    expect(workflow).toContain('needs: release-gate');
    expect(workflow).toContain('run: pnpm --filter @flowstate/desktop package:mac:publish');

    const gateJobIndex = workflow.indexOf('release-gate:');
    const publishJobIndex = workflow.indexOf('release-publish:');
    expect(gateJobIndex).toBeGreaterThan(-1);
    expect(publishJobIndex).toBeGreaterThan(gateJobIndex);
  });
});

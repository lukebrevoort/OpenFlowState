import path from 'node:path';

export interface FlowstatePromptPathOptions {
  envAgentsDir?: string;
  resourcesPath: string;
  appPath: string;
  repoRoot: string;
  packagesDir: string;
}

export function buildFlowstatePromptCandidatePaths(options: FlowstatePromptPathOptions): string[] {
  const envAgentsDir = options.envAgentsDir?.trim() ?? '';

  const rawCandidates = [
    ...(envAgentsDir ? [path.join(envAgentsDir, 'flowstate.md')] : []),
    path.join(options.resourcesPath, 'agents', 'flowstate.md'),
    path.join(options.appPath, 'agents', 'flowstate.md'),
    path.join(options.repoRoot, 'agents', 'flowstate.md'),
    path.join(path.resolve(options.packagesDir, '..', 'agents'), 'flowstate.md'),
  ];

  const seen = new Set<string>();
  return rawCandidates.filter((candidate) => {
    const normalized = path.normalize(candidate);
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

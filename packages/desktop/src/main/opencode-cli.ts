import fs from 'node:fs';
import path from 'node:path';

let cachedPath: string | null | undefined;

const hasExecutableAccess = (candidate: string): boolean => {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const splitPathEntries = (value: string | undefined): string[] => {
  if (!value || value.trim().length === 0) {
    return [];
  }
  return value.split(path.delimiter).filter((entry) => entry.trim().length > 0);
};

export const resolveOpencodeCliPath = (): string | null => {
  if (cachedPath !== undefined) {
    return cachedPath;
  }

  const envOverride = process.env.OPENCODE_BIN?.trim();
  const pathEntries = splitPathEntries(process.env.PATH);
  const packagedCandidates = process.resourcesPath
    ? [
        path.join(process.resourcesPath, 'bin', `opencode-${process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'}`),
        path.join(process.resourcesPath, 'bin', 'opencode'),
      ]
    : [];
  const candidates = [
    ...(envOverride ? [envOverride] : []),
    ...packagedCandidates,
    ...pathEntries.map((entry) => path.join(entry, 'opencode')),
    '/opt/homebrew/bin/opencode',
    '/usr/local/bin/opencode',
    '/usr/bin/opencode',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (hasExecutableAccess(resolved)) {
      cachedPath = resolved;
      return resolved;
    }
  }

  cachedPath = null;
  return null;
};

export const ensureOpencodeCliAvailable = (): string => {
  const cliPath = resolveOpencodeCliPath();
  if (!cliPath) {
    throw new Error(
      'OpenCode CLI is not available. Install OpenCode and ensure `opencode` is on PATH (or set OPENCODE_BIN to an absolute executable path).'
    );
  }

  const cliDir = path.dirname(cliPath);
  const pathEntries = splitPathEntries(process.env.PATH);
  if (!pathEntries.includes(cliDir)) {
    process.env.PATH = [cliDir, ...pathEntries].join(path.delimiter);
  }

  return cliPath;
};

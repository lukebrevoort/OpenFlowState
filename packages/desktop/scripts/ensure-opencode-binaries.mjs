#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(desktopRoot, 'vendor', 'opencode');

const BINARIES = [
  { target: 'darwin-arm64', output: path.join(outputRoot, 'darwin-arm64', 'opencode') },
  { target: 'darwin-x64', output: path.join(outputRoot, 'darwin-x64', 'opencode') },
];

function splitPathEntries(value) {
  if (!value || value.trim().length === 0) return [];
  return value.split(path.delimiter).filter((entry) => entry.trim().length > 0);
}

function canExecute(candidate) {
  try {
    fsSync.accessSync(candidate, fsSync.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveGlobalOpencode() {
  const envOverride = process.env.OPENCODE_BIN?.trim();
  const candidates = [
    ...(envOverride ? [envOverride] : []),
    ...splitPathEntries(process.env.PATH).map((entry) => path.join(entry, 'opencode')),
    '/opt/homebrew/bin/opencode',
    '/usr/local/bin/opencode',
    '/usr/bin/opencode',
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (canExecute(resolved)) {
      return resolved;
    }
  }

  return null;
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function fetchLatestVersion() {
  const response = await fetch('https://api.github.com/repos/anomalyco/opencode/releases/latest', {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'flowstate-desktop-build',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest OpenCode release: ${response.status} ${response.statusText}`);
  }

  const body = await response.json();
  const tag = typeof body.tag_name === 'string' ? body.tag_name : '';
  if (!tag.startsWith('v')) {
    throw new Error(`Unexpected latest release tag: ${tag || '(empty)'}`);
  }

  return tag.slice(1);
}

async function downloadAndExtract(target, outputPath, version) {
  const url = `https://github.com/anomalyco/opencode/releases/download/v${version}/opencode-${target}.zip`;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `flowstate-opencode-${target}-`));
  const archivePath = path.join(tempDir, `opencode-${target}.zip`);

  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(archivePath, buffer);

    await run('unzip', ['-o', archivePath, '-d', tempDir]);

    const extractedBinary = path.join(tempDir, 'opencode');
    await fs.access(extractedBinary, fsSync.constants.R_OK);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.copyFile(extractedBinary, outputPath);
    await fs.chmod(outputPath, 0o755);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  if (process.platform !== 'darwin') {
    console.log('[ensure-opencode-binaries] Skipping: only needed for macOS packaging.');
    return;
  }

  const globalBinary = resolveGlobalOpencode();
  if (globalBinary) {
    const hostTarget = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    const hostOutput = BINARIES.find((entry) => entry.target === hostTarget)?.output;
    if (hostOutput) {
      await fs.mkdir(path.dirname(hostOutput), { recursive: true });
      await fs.copyFile(globalBinary, hostOutput);
      await fs.chmod(hostOutput, 0o755);
      console.log(`[ensure-opencode-binaries] Seeded ${hostTarget} from global binary: ${globalBinary}`);
    }
  }

  const missing = [];
  for (const item of BINARIES) {
    if (!canExecute(item.output)) {
      missing.push(item);
    }
  }

  if (missing.length === 0) {
    console.log('[ensure-opencode-binaries] All packaged OpenCode binaries are present.');
    return;
  }

  const version = await fetchLatestVersion();
  console.log(`[ensure-opencode-binaries] Downloading OpenCode v${version} for ${missing.map((m) => m.target).join(', ')}`);

  for (const item of missing) {
    await downloadAndExtract(item.target, item.output, version);
    console.log(`[ensure-opencode-binaries] Installed ${item.target} to ${item.output}`);
  }
}

main().catch((error) => {
  console.error('[ensure-opencode-binaries] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});

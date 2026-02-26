#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(desktopRoot, 'vendor', 'node');

const TARGETS = [
  { target: 'darwin-arm64', output: path.join(outputRoot, 'darwin-arm64') },
  { target: 'darwin-x64', output: path.join(outputRoot, 'darwin-x64') },
];
const DEFAULT_NODE_VERSION = '24.14.0';

function canExecute(candidate) {
  try {
    fsSync.accessSync(candidate, fsSync.constants.X_OK);
    return true;
  } catch {
    return false;
  }
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

async function downloadAndExtract(target, outputDir, version) {
  const filename = `node-v${version}-${target}.tar.gz`;
  const url = `https://nodejs.org/dist/v${version}/${filename}`;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `flowstate-node-${target}-`));
  const archivePath = path.join(tempDir, filename);

  try {
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(archivePath, buffer);

    await run('tar', ['-xzf', archivePath, '-C', tempDir]);

    const extractedRoot = path.join(tempDir, `node-v${version}-${target}`);
    const extractedNode = path.join(extractedRoot, 'bin', 'node');
    await fs.access(extractedNode, fsSync.constants.X_OK);

    await fs.rm(outputDir, { recursive: true, force: true });
    await fs.mkdir(outputDir, { recursive: true });

    // Copy with symlinks dereferenced so packaged assets don't contain
    // extraction-temp absolute symlinks (which break codesign/stat during packaging).
    await fs.cp(extractedRoot, outputDir, { recursive: true, force: true, dereference: true });

    // Ensure executable bits survived copy.
    const binDir = path.join(outputDir, 'bin');
    await fs.chmod(path.join(binDir, 'node'), 0o755);
    for (const name of ['npm', 'npx', 'corepack']) {
      const candidate = path.join(binDir, name);
      try {
        await fs.chmod(candidate, 0o755);
      } catch {
        // Optional; some Node builds may omit corepack.
      }
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  if (process.platform !== 'darwin') {
    console.log('[ensure-node-runtime] Skipping: only needed for macOS packaging.');
    return;
  }

  const missing = [];
  for (const item of TARGETS) {
    const nodePath = path.join(item.output, 'bin', 'node');
    if (!canExecute(nodePath)) {
      missing.push(item);
    }
  }

  if (missing.length === 0) {
    console.log('[ensure-node-runtime] All packaged Node runtimes are present.');
    return;
  }

  const version = process.env.FLOWSTATE_NODE_VERSION?.trim() || DEFAULT_NODE_VERSION;
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      `Invalid Node version "${version}". Expected semver like "${DEFAULT_NODE_VERSION}".`
    );
  }
  console.log(
    `[ensure-node-runtime] Downloading Node v${version} for ${missing.map((m) => m.target).join(', ')}`
  );

  for (const item of missing) {
    await downloadAndExtract(item.target, item.output, version);
    console.log(`[ensure-node-runtime] Installed ${item.target} to ${item.output}`);
  }
}

main().catch((error) => {
  console.error('[ensure-node-runtime] Failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});

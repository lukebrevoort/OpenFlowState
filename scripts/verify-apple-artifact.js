#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const desktopOutDir = path.join(rootDir, 'packages', 'desktop', 'out');
const dryRun = process.argv.includes('--dry-run');

function parseArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
}

function listCandidateApps() {
  if (!fs.existsSync(desktopOutDir)) {
    return [];
  }

  const subdirs = fs
    .readdirSync(desktopOutDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith('mac') &&
        !entry.name.includes('universal-') &&
        !entry.name.endsWith('-temp')
    )
    .map((entry) => entry.name);

  const candidates = [];
  for (const subdir of subdirs) {
    const appPath = path.join(desktopOutDir, subdir, 'FlowState.app');
    if (!fs.existsSync(appPath)) {
      continue;
    }
    const stat = fs.statSync(appPath);
    candidates.push({ appPath, mtimeMs: stat.mtimeMs });
  }

  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

async function main() {
  if (process.platform !== 'darwin') {
    console.error('verify:apple-artifact currently supports macOS only.');
    process.exit(1);
  }

  const providedApp = parseArg('--app');
  const appPaths = providedApp
    ? [path.resolve(rootDir, providedApp)]
    : listCandidateApps().map((candidate) => candidate.appPath);

  if (dryRun) {
    console.log('verify:apple-artifact dry-run plan:');
    const resolvedLabel =
      appPaths.length > 0
        ? appPaths.join(', ')
        : '<all packages/desktop/out/mac*/FlowState.app candidates>';
    console.log(`1. Resolve app bundle path(s) (${resolvedLabel}).`);
    console.log('2. For each app bundle, run codesign verification (deep/strict).');
    console.log('3. For each app bundle, run spctl assessment.');
    console.log('4. For each app bundle, run stapler validation.');
    return;
  }

  if (appPaths.length === 0) {
    console.error('No FlowState.app bundles found. Build/package first or pass --app <path>.');
    process.exit(1);
  }

  for (const appPath of appPaths) {
    if (!fs.existsSync(appPath)) {
      console.error(`App bundle does not exist: ${appPath}`);
      process.exit(1);
    }

    console.log(`Verifying Apple distribution checks for: ${appPath}`);
    await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
    await run('/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath]);
    await run('/usr/bin/xcrun', ['stapler', 'validate', appPath]);
  }

  console.log('Apple artifact verification checks passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

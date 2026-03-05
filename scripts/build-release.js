#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const steps = [
  'pnpm check:notarization-env',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm test',
  'pnpm --filter @flowstate/desktop build',
  'pnpm --filter @flowstate/desktop package:mac',
  'pnpm prepare:release-artifacts',
];

function run(command) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, {
      cwd: rootDir,
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${code}): ${command}`));
    });
  });
}

async function main() {
  if (dryRun) {
    console.log('build:release dry-run plan:');
    steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step}`);
    });
    return;
  }

  for (const step of steps) {
    console.log(`\n> ${step}`);
    await run(step);
  }

  console.log('\nRelease build pipeline completed.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

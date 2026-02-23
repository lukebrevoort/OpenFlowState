#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const steps = dryRun
  ? [
      'pnpm build:release -- --dry-run',
      'pnpm smoke:dmg -- --dry-run',
      'pnpm test:contracts -- --dry-run',
      'pnpm test:packaged-e2e -- --dry-run',
    ]
  : ['pnpm build:release', 'pnpm smoke:dmg', 'pnpm test:contracts', 'pnpm test:packaged-e2e'];

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
  for (const step of steps) {
    console.log(`\n> ${step}`);
    await run(step);
  }

  if (dryRun) {
    console.log('\nRelease gate dry-run completed.');
    return;
  }

  console.log('\nRelease gate completed successfully.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

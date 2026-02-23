#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const command =
  'pnpm --filter @flowstate/desktop exec vitest run src/main/phase7-happy-path.test.ts src/main/study-material-e2e.test.ts';

function run(step) {
  return new Promise((resolve, reject) => {
    const proc = spawn(step, {
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
      reject(new Error(`Command failed (${code}): ${step}`));
    });
  });
}

async function main() {
  if (dryRun) {
    console.log('test:packaged-e2e dry-run plan:');
    console.log(`1. ${command}`);
    return;
  }

  console.log(`\n> ${command}`);
  await run(command);
  console.log('\nPackaged e2e suite completed.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

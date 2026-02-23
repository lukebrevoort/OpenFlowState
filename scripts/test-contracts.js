#!/usr/bin/env node

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const steps = [
  'pnpm --filter @flowstate/desktop exec vitest run src/main/mcp-config.test.ts src/main/approval-policy-store.test.ts',
  'pnpm --filter @flowstate/mcp-canvas test',
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
    console.log('test:contracts dry-run plan:');
    steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step}`);
    });
    return;
  }

  for (const step of steps) {
    console.log(`\n> ${step}`);
    await run(step);
  }

  console.log('\nContract test suite completed.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

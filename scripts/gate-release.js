#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const artifactsDir = path.join(rootDir, '.opencode', 'artifacts');
const dryRun = process.argv.includes('--dry-run');

const steps = (dryRun
  ? [
      { id: 'build_release', command: 'pnpm build:release -- --dry-run' },
      { id: 'smoke_dmg', command: 'pnpm smoke:dmg -- --dry-run' },
      { id: 'test_contracts', command: 'pnpm test:contracts -- --dry-run' },
      { id: 'test_packaged_e2e', command: 'pnpm test:packaged-e2e -- --dry-run' },
      { id: 'verify_apple_artifact', command: 'pnpm verify:apple-artifact -- --dry-run' },
    ]
  : [
      { id: 'build_release', command: 'pnpm build:release' },
      { id: 'smoke_dmg', command: 'pnpm smoke:dmg' },
      { id: 'test_contracts', command: 'pnpm test:contracts' },
      { id: 'test_packaged_e2e', command: 'pnpm test:packaged-e2e' },
      { id: 'verify_apple_artifact', command: 'pnpm verify:apple-artifact' },
    ]);

function classifyFailure(stepId) {
  if (stepId.startsWith('build_release')) return 'packaging';
  if (stepId.startsWith('smoke_dmg')) return 'smoke';
  if (stepId.startsWith('test_contracts')) return 'contracts';
  if (stepId.startsWith('test_packaged_e2e')) return 'packaged_e2e';
  if (stepId.startsWith('verify_apple_artifact')) return 'apple_verification';
  return 'unknown';
}

function writeReport(report) {
  fs.mkdirSync(artifactsDir, { recursive: true });
  const reportPath = path.join(artifactsDir, `release-gate-${Date.now()}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

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
  const report = {
    status: 'running',
    dryRun,
    startedAt: new Date().toISOString(),
    failClosed: true,
    steps: [],
    failedStep: null,
    failureClass: null,
    error: null,
  };

  try {
    for (const step of steps) {
      const startedAt = new Date().toISOString();
      const startMs = Date.now();

      console.log(`\n> ${step.command}`);
      await run(step.command);

      report.steps.push({
        id: step.id,
        command: step.command,
        status: 'pass',
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startMs,
      });
    }

    report.status = 'pass';
  } catch (error) {
    const failed = report.steps.length < steps.length ? steps[report.steps.length] : null;
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (failed) {
      report.steps.push({
        id: failed.id,
        command: failed.command,
        status: 'fail',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        error: errorMessage,
      });
      report.failedStep = failed.id;
      report.failureClass = classifyFailure(failed.id);
    }

    report.status = 'fail';
    report.error = errorMessage;
    report.finishedAt = new Date().toISOString();

    const reportPath = writeReport(report);
    console.error(`Release gate failed (${report.failureClass ?? 'unknown'}). Report: ${reportPath}`);
    process.exit(1);
  }

  report.finishedAt = new Date().toISOString();
  const reportPath = writeReport(report);

  if (dryRun) {
    console.log(`\nRelease gate dry-run completed. Report: ${reportPath}`);
    return;
  }

  console.log(`\nRelease gate completed successfully. Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

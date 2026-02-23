#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const desktopOutDir = path.join(rootDir, 'packages', 'desktop', 'out');
const dryRun = process.argv.includes('--dry-run');
const smokeOutDir = path.join(rootDir, '.opencode', 'artifacts');

function createSmokeReport(dmgPath) {
  return {
    status: 'running',
    ranAt: new Date().toISOString(),
    host: os.hostname(),
    dmgPath,
    mountPoint: null,
    appPath: null,
    steps: [],
    launch: {
      attempted: false,
      started: false,
      beforePids: [],
      afterPids: [],
      newPids: [],
    },
    error: null,
  };
}

function pushStep(report, name, status, detail) {
  report.steps.push({
    name,
    status,
    detail,
    at: new Date().toISOString(),
  });
}

function writeReport(report) {
  fs.mkdirSync(smokeOutDir, { recursive: true });
  const resultPath = path.join(smokeOutDir, `smoke-dmg-${Date.now()}.json`);
  fs.writeFileSync(resultPath, `${JSON.stringify(report, null, 2)}\n`);
  return resultPath;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
}

function findLatestDmg() {
  if (!fs.existsSync(desktopOutDir)) {
    return null;
  }

  const files = fs
    .readdirSync(desktopOutDir)
    .filter((file) => file.endsWith('.dmg'))
    .map((file) => {
      const fullPath = path.join(desktopOutDir, file);
      const stats = fs.statSync(fullPath);
      return { fullPath, mtime: stats.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return files.length > 0 ? files[0].fullPath : null;
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', reject);

    if (input != null) {
      proc.stdin.end(input);
    }

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed (${code})\n${stderr || stdout}`));
    });
  });
}

function runOptional(command, args) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function getFlowStatePids() {
  const result = await runOptional('pgrep', ['-x', 'FlowState']);
  if (result.code !== 0) {
    return [];
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line));
}

async function terminatePids(pids) {
  for (const pid of pids) {
    await runOptional('kill', ['-TERM', pid]);
  }

  // Give the app a deterministic grace period to exit cleanly.
  const exitedCleanly = await waitForPidsToExit(pids, 5000);
  if (exitedCleanly) {
    return;
  }

  // Escalate to SIGKILL to avoid leaving the DMG busy in CI.
  for (const pid of pids) {
    await runOptional('kill', ['-KILL', pid]);
  }

  await waitForPidsToExit(pids, 5000);
}

async function pidExists(pid) {
  const result = await runOptional('kill', ['-0', pid]);
  return result.code === 0;
}

async function waitForPidsToExit(pids, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const checks = await Promise.all(pids.map((pid) => pidExists(pid)));
    if (checks.every((alive) => !alive)) {
      return true;
    }
    await sleep(200);
  }
  return false;
}

function parseAttachInfo(attachJson) {
  let payload;
  try {
    payload = JSON.parse(attachJson);
  } catch {
    return { mountPoint: null, devEntry: null, devDisk: null };
  }

  const entities = payload['system-entities'];
  if (!Array.isArray(entities)) {
    return { mountPoint: null, devEntry: null, devDisk: null };
  }

  for (const entity of entities) {
    const mountPoint = entity?.['mount-point'];
    if (typeof mountPoint === 'string' && mountPoint.startsWith('/Volumes/')) {
      const devEntry = entity?.['dev-entry'];
      const devDiskMatch = typeof devEntry === 'string' ? devEntry.match(/^\/dev\/disk\d+/) : null;
      return {
        mountPoint,
        devEntry: typeof devEntry === 'string' ? devEntry : null,
        devDisk: devDiskMatch ? devDiskMatch[0] : null,
      };
    }
  }

  return { mountPoint: null, devEntry: null, devDisk: null };
}

async function detachDmg({ detachTarget, mountPoint, report }) {
  // Deterministic, CI-friendly retry schedule (total ~25s).
  const delaysMs = [0, 200, 400, 800, 1200, 2000, 3000, 5000, 6000, 6500];
  let lastOutput = '';
  let lastCode = 1;

  for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
    const delay = delaysMs[attempt];
    if (delay > 0) {
      await sleep(delay);
    }

    const useForce = attempt >= 4;
    const args = useForce ? ['detach', '-force', detachTarget] : ['detach', detachTarget];
    const result = await runOptional('hdiutil', args);
    lastCode = result.code;
    lastOutput = `${result.stderr || result.stdout || ''}`.trim();

    if (result.code === 0) {
      pushStep(
        report,
        'detach_dmg_attempt',
        'pass',
        `Detached ${detachTarget}${useForce ? ' (force)' : ''} after ${attempt + 1} attempt(s)`
      );
      return;
    }

    // Only retry for the common transient unmount failures.
    const retryable = /resource busy/i.test(lastOutput) || /couldn't unmount/i.test(lastOutput);
    if (!retryable) {
      throw new Error(`hdiutil ${args.join(' ')} failed (${result.code})\n${lastOutput}`);
    }

    // Nudge the OS to unmount the volume (best-effort).
    if (mountPoint) {
      await runOptional('diskutil', ['unmount', 'force', mountPoint]);
    }
  }

  throw new Error(
    `hdiutil detach ${detachTarget} failed (${lastCode})\n${lastOutput || 'Unknown error'}`
  );
}

async function main() {
  if (process.platform !== 'darwin') {
    console.error('smoke:dmg currently supports macOS only.');
    process.exit(1);
  }

  const providedDmg = parseArg('--dmg');
  const dmgPath = providedDmg ? path.resolve(rootDir, providedDmg) : findLatestDmg();

  if (dryRun) {
    const resolvedDmg = dmgPath ?? '<latest DMG from packages/desktop/out>';
    const plan = [
      `Validate DMG exists: ${resolvedDmg}`,
      'Attach DMG with hdiutil',
      'Confirm FlowState.app exists in mounted volume',
      'Open mounted app and assert process start',
      'Detach mounted DMG',
    ];

    console.log('smoke:dmg dry-run plan:');
    plan.forEach((step, index) => {
      console.log(`${index + 1}. ${step}`);
    });
    return;
  }

  if (!dmgPath || !fs.existsSync(dmgPath)) {
    console.error('No DMG artifact found. Build one first with `pnpm build:release`.');
    process.exit(1);
  }

  const report = createSmokeReport(dmgPath);
  let detachTarget = null;
  let resultPath = '';

  try {
    console.log(`Using DMG: ${dmgPath}`);
    pushStep(report, 'validate_dmg', 'pass', `Using DMG at ${dmgPath}`);

    const attach = await run('hdiutil', ['attach', '-nobrowse', '-noautoopen', '-readonly', '-plist', dmgPath]);
    const attachJson = await run('plutil', ['-convert', 'json', '-o', '-', '-'], attach.stdout);
    const { mountPoint, devEntry, devDisk } = parseAttachInfo(attachJson.stdout);
    detachTarget = devDisk ?? devEntry ?? mountPoint;

    if (!mountPoint) {
      pushStep(report, 'attach_dmg', 'fail', 'Unable to determine mount point from hdiutil output');
      throw new Error('Unable to determine mount point from hdiutil output.');
    }

    report.mountPoint = mountPoint;
    pushStep(report, 'attach_dmg', 'pass', `Mounted at ${mountPoint}`);

    const appPath = path.join(mountPoint, 'FlowState.app');
    report.appPath = appPath;
    if (!fs.existsSync(appPath)) {
      pushStep(report, 'assert_app_bundle', 'fail', `Expected app bundle not found: ${appPath}`);
      throw new Error(`Expected app bundle not found: ${appPath}`);
    }

    pushStep(report, 'assert_app_bundle', 'pass', `Found app bundle at ${appPath}`);

    const beforePids = await getFlowStatePids();
    report.launch.beforePids = beforePids;
    report.launch.attempted = true;
    await run('open', ['-n', appPath]);
    await sleep(1500);
    const afterPids = await getFlowStatePids();
    report.launch.afterPids = afterPids;
    report.launch.newPids = afterPids.filter((pid) => !beforePids.includes(pid));

    if (report.launch.newPids.length === 0) {
      pushStep(
        report,
        'assert_app_launch',
        'fail',
        'No new FlowState process detected after launch attempt'
      );
      throw new Error('FlowState launch assertion failed: no new process detected.');
    }

    report.launch.started = true;
    pushStep(report, 'assert_app_launch', 'pass', `Started FlowState PID(s): ${report.launch.newPids.join(', ')}`);

    await terminatePids(report.launch.newPids);
    pushStep(report, 'terminate_launched_app', 'pass', 'Stopped launched FlowState process(es)');

    report.status = 'pass';
  } catch (error) {
    report.status = 'fail';
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (detachTarget) {
      try {
        await detachDmg({ detachTarget, mountPoint: report.mountPoint, report });
        pushStep(report, 'detach_dmg', 'pass', `Detached ${detachTarget}`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        pushStep(report, 'detach_dmg', 'fail', detail);
        if (report.status !== 'fail') {
          report.status = 'fail';
          report.error = `Failed to detach DMG: ${detail}`;
        }
      }
    }

    resultPath = writeReport(report);
  }

  if (report.status !== 'pass') {
    console.error(`smoke:dmg failed. Evidence: ${resultPath}`);
    process.exit(1);
  }

  console.log(`smoke:dmg passed. Evidence: ${resultPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

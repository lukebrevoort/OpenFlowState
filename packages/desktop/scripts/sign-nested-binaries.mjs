#!/usr/bin/env node

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function isExecutableFile(mode) {
  return (mode & 0o111) !== 0;
}

async function listExecutableFiles(rootDir) {
  const pending = [rootDir];
  const files = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;

    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      try {
        const stats = await fs.stat(fullPath);
        if (isExecutableFile(stats.mode)) {
          files.push(fullPath);
        }
      } catch {
        // Skip files that cannot be stat'd.
      }
    }
  }

  return files;
}

async function runCodesign(identity, targetPath) {
  const args = ['--force', '--sign', identity];
  if (identity === '-') {
    args.push('--timestamp=none');
  } else {
    args.push('--options', 'runtime', '--timestamp');
  }
  args.push(targetPath);

  await new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/codesign', args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`codesign exited ${code} for ${targetPath}`));
    });
  });
}

export default async function afterSign(context) {
  if (process.platform !== 'darwin') {
    return;
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const resourcesDir = path.join(appPath, 'Contents', 'Resources');
  const targets = [
    path.join(resourcesDir, 'bin'),
    path.join(resourcesDir, 'node-runtime'),
  ];

  const identity = (process.env.CSC_NAME || '').trim() || '-';

  const filesToSign = [];
  for (const target of targets) {
    if (!fsSync.existsSync(target)) {
      continue;
    }
    const nested = await listExecutableFiles(target);
    filesToSign.push(...nested);
  }

  for (const executablePath of filesToSign) {
    await runCodesign(identity, executablePath);
  }
}

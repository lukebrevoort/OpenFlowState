#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'packages', 'desktop', 'out');
const artifactsDir = path.join(rootDir, '.opencode', 'artifacts');
const dryRun = process.argv.includes('--dry-run');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr || stdout}`));
    });
  });
}

function detectArch(fileName) {
  if (fileName.includes('arm64')) return 'arm64';
  if (fileName.includes('x64')) return 'x64';
  if (fileName.includes('universal')) return 'universal';
  return 'universal';
}

function parseArtifactType(fileName) {
  if (fileName.endsWith('.dmg')) return 'dmg';
  if (fileName.endsWith('.zip')) return 'zip';
  return null;
}

async function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function getBuildMetadata() {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJsonRaw = await fsp.readFile(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw);
  const version = typeof packageJson.version === 'string' ? packageJson.version : '0.0.0';

  let gitSha = 'unknown';
  try {
    const { stdout } = await run('git', ['rev-parse', '--short=12', 'HEAD']);
    gitSha = stdout.trim() || 'unknown';
  } catch {
    gitSha = 'unknown';
  }

  const buildId = (process.env.FLOWSTATE_BUILD_ID || gitSha || 'dev').trim().replace(/[^a-zA-Z0-9._-]/g, '-');

  return { version, gitSha, buildId };
}

async function listArtifacts() {
  if (!fs.existsSync(outDir)) {
    throw new Error(`Desktop output directory does not exist: ${outDir}`);
  }

  const entries = await fsp.readdir(outDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => parseArtifactType(name) != null);
}

async function main() {
  const { version, gitSha, buildId } = await getBuildMetadata();
  const artifactNames = await listArtifacts();

  if (artifactNames.length === 0) {
    throw new Error('No DMG/ZIP artifacts found in packages/desktop/out. Run packaging first.');
  }

  const renamePlan = artifactNames.map((currentName) => {
    const type = parseArtifactType(currentName);
    const arch = detectArch(currentName);
    const nextName = `FlowState-${version}-${arch}-${buildId}.${type}`;
    return {
      currentName,
      nextName,
      type,
      arch,
      currentPath: path.join(outDir, currentName),
      nextPath: path.join(outDir, nextName),
    };
  });

  if (dryRun) {
    console.log('prepare:release-artifacts dry-run plan:');
    for (const item of renamePlan) {
      console.log(`- ${item.currentName} -> ${item.nextName}`);
    }
    console.log(`- Build id: ${buildId}`);
    console.log(`- Git SHA: ${gitSha}`);
    console.log(`- Manifest/checksums destination: ${artifactsDir}`);
    return;
  }

  for (const item of renamePlan) {
    if (item.currentPath === item.nextPath) {
      continue;
    }
    if (fs.existsSync(item.nextPath)) {
      await fsp.rm(item.nextPath, { force: true });
    }
    await fsp.rename(item.currentPath, item.nextPath);
  }

  const manifestArtifacts = [];
  for (const item of renamePlan) {
    const stats = await fsp.stat(item.nextPath);
    const hash = await sha256(item.nextPath);
    manifestArtifacts.push({
      fileName: item.nextName,
      relativePath: path.relative(rootDir, item.nextPath),
      type: item.type,
      arch: item.arch,
      sizeBytes: stats.size,
      sha256: hash,
    });
  }

  manifestArtifacts.sort((a, b) => a.fileName.localeCompare(b.fileName));

  const manifest = {
    generatedAt: new Date().toISOString(),
    buildId,
    gitSha,
    version,
    artifacts: manifestArtifacts,
  };

  await fsp.mkdir(artifactsDir, { recursive: true });
  const manifestPath = path.join(artifactsDir, `release-manifest-${buildId}.json`);
  const checksumsPath = path.join(artifactsDir, `release-checksums-${buildId}.txt`);

  await fsp.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const checksumsBody = manifestArtifacts.map((item) => `${item.sha256}  ${item.fileName}`).join('\n');
  await fsp.writeFile(checksumsPath, `${checksumsBody}\n`, 'utf8');

  // Read-after-write verification.
  const verificationData = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  for (const item of verificationData.artifacts) {
    const artifactPath = path.join(rootDir, item.relativePath);
    const actualHash = await sha256(artifactPath);
    if (actualHash !== item.sha256) {
      throw new Error(`Checksum mismatch for ${item.fileName}`);
    }
  }

  console.log(`Prepared ${manifestArtifacts.length} release artifact(s).`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Checksums: ${checksumsPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

#!/usr/bin/env node

import fs from 'node:fs';

const dryRun = process.argv.includes('--dry-run');

const requiredEnv = [
  'CSC_LINK',
  'CSC_KEY_PASSWORD',
  'APPLE_API_KEY',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
];

function resolveFileFromCscLink(value) {
  if (!value) {
    return null;
  }

  if (value.startsWith('file://')) {
    return value.replace('file://', '');
  }

  if (value.startsWith('/')) {
    return value;
  }

  return null;
}

function main() {
  const missing = requiredEnv.filter((name) => {
    const value = process.env[name];
    return typeof value !== 'string' || value.trim() === '';
  });

  const details = [];

  const cscPath = resolveFileFromCscLink(process.env.CSC_LINK?.trim() ?? '');
  if (cscPath && !fs.existsSync(cscPath)) {
    details.push(`CSC_LINK points to a missing file: ${cscPath}`);
  }

  const apiKeyPath = process.env.APPLE_API_KEY?.trim();
  if (apiKeyPath && !fs.existsSync(apiKeyPath)) {
    details.push(`APPLE_API_KEY points to a missing file: ${apiKeyPath}`);
  }

  if (dryRun) {
    console.log('check:notarization-env dry-run plan:');
    console.log('1. Ensure required signing/notarization env vars are present.');
    console.log('2. Validate file-backed secret paths exist when provided as local files.');
    return;
  }

  if (missing.length > 0 || details.length > 0) {
    if (missing.length > 0) {
      console.error(`Missing required env var(s): ${missing.join(', ')}`);
    }
    for (const detail of details) {
      console.error(detail);
    }
    process.exit(1);
  }

  console.log('Notarization/signing env preflight passed.');
}

main();

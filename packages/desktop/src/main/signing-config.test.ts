import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const desktopRoot = path.resolve(__dirname, '../..');

describe('desktop signing config', () => {
  it('wires explicit mac entitlements and afterSign hook', async () => {
    const builderConfigPath = path.join(desktopRoot, 'electron-builder.yml');
    const builderConfig = await fs.readFile(builderConfigPath, 'utf8');

    expect(builderConfig).toContain('entitlements: assets/entitlements.mac.plist');
    expect(builderConfig).toContain('entitlementsInherit: assets/entitlements.mac.inherit.plist');
    expect(builderConfig).toContain('afterSign: scripts/sign-nested-binaries.mjs');
  });

  it('contains hardened runtime entitlements required by bundled runtimes', async () => {
    const baseEntitlementsPath = path.join(desktopRoot, 'assets', 'entitlements.mac.plist');
    const inheritEntitlementsPath = path.join(
      desktopRoot,
      'assets',
      'entitlements.mac.inherit.plist'
    );

    const [baseEntitlements, inheritEntitlements] = await Promise.all([
      fs.readFile(baseEntitlementsPath, 'utf8'),
      fs.readFile(inheritEntitlementsPath, 'utf8'),
    ]);

    for (const key of [
      'com.apple.security.cs.allow-jit',
      'com.apple.security.cs.allow-unsigned-executable-memory',
      'com.apple.security.cs.disable-library-validation',
    ]) {
      expect(baseEntitlements).toContain(`<key>${key}</key>`);
      expect(inheritEntitlements).toContain(`<key>${key}</key>`);
    }
  });
});

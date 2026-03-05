# Phase 9.4 - Notarization and Stapling

Version: v0.1.0-demo-prep
Last Updated: 2026-02-27
Status: Wiring complete (credentialed execution pending)

## Goal

Make notarization and staple validation a first-class release gate for demo artifacts.

## What was implemented

1. Added notarization/signing env preflight command:
   - `scripts/check-notarization-env.js`
   - Required vars enforced: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
   - Validates local secret file paths when using file-backed values.
2. Integrated preflight into release build pipeline:
   - `scripts/build-release.js` now runs `pnpm check:notarization-env` before lint/type/test/package.
3. Added Apple artifact verification gate:
   - `scripts/verify-apple-artifact.js`
   - Validates all discovered `packages/desktop/out/mac*/FlowState.app` bundles (or a specific app via `--app`)
   - Runs:
     - `codesign --verify --deep --strict --verbose=2`
     - `spctl --assess --type execute --verbose=4`
     - `xcrun stapler validate`
4. Integrated verification into full release gate:
   - `scripts/gate-release.js` now includes `pnpm verify:apple-artifact`.
5. Added root package script entrypoints:
   - `pnpm check:notarization-env`
   - `pnpm verify:apple-artifact`

## Standardized env contract

For release candidates, these env vars must be present:

- Signing
  - `CSC_LINK`
  - `CSC_KEY_PASSWORD`
  - optional: `CSC_NAME`, `CSC_IDENTITY_AUTO_DISCOVERY`
- Notarization (App Store Connect API key path)
  - `APPLE_API_KEY`
  - `APPLE_API_KEY_ID`
  - `APPLE_API_ISSUER`

## Validation commands

Dry-run wiring check:

1. `pnpm check:notarization-env -- --dry-run`
2. `pnpm verify:apple-artifact -- --dry-run`
3. `pnpm gate:release -- --dry-run`

Credentialed release-candidate path:

1. `pnpm build:release`
2. `pnpm smoke:dmg`
3. `pnpm test:contracts`
4. `pnpm test:packaged-e2e`
5. `pnpm verify:apple-artifact`
6. `pnpm gate:release`

## Notes

- This phase establishes fail-closed gate wiring; successful notarization/stapling execution requires valid Apple credentials in the environment.
- If credentials are unavailable, release-candidate packaging is intentionally blocked at preflight.
- Gate execution is macOS-only because Apple verification commands must be present.

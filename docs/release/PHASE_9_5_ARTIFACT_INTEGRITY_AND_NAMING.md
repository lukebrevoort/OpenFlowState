# Phase 9.5 - Artifact Integrity and Naming

Version: v0.1.0-demo-prep
Last Updated: 2026-02-27
Status: Implemented

## Goal

Enforce deterministic DMG/ZIP naming, produce traceable artifact metadata, and fail if artifact checksums do not verify.

## Changes Implemented

1. Added release artifact preparation script:
   - `scripts/prepare-release-artifacts.js`
2. Wired script into release build pipeline:
   - `scripts/build-release.js` now runs `pnpm prepare:release-artifacts` after desktop packaging.
3. Added root script entrypoint:
   - `pnpm prepare:release-artifacts`
4. Updated release runbook evidence requirements:
   - `docs/release/RELEASE_GATE_RUNBOOK.md`

## Artifact policy

`prepare-release-artifacts` enforces and emits:

- Naming convention:
  - `FlowState-<version>-<arch>-<build-id>.dmg`
  - `FlowState-<version>-<arch>-<build-id>.zip`
- Build metadata:
  - `buildId` from `FLOWSTATE_BUILD_ID` or git short SHA fallback.
  - `gitSha`, `version`, and `generatedAt` in manifest.
- Integrity outputs under `.opencode/artifacts/`:
  - `release-manifest-<build-id>.json`
  - `release-checksums-<build-id>.txt`
- Checksum verification:
  - Script re-hashes all renamed artifacts after writing manifest and fails if any mismatch is detected.

## Validation commands

1. `pnpm prepare:release-artifacts -- --dry-run`
2. `pnpm build:release -- --dry-run`
3. `pnpm gate:release -- --dry-run`

Credentialed candidate path (when signing/notarization env is present):

1. `pnpm build:release`
2. `pnpm gate:release`

## Notes

- This phase does not alter notarization mechanics; it strengthens artifact traceability and repeatability across machines.
- For CI, set `FLOWSTATE_BUILD_ID` explicitly when a custom build identifier is required.

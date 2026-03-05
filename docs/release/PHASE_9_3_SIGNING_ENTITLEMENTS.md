# Phase 9.3 - Signing + Entitlements

Version: v0.1.0-demo-prep
Last Updated: 2026-02-27
Status: Implemented

## Goal

Lock a deterministic macOS signing posture for packaged FlowState artifacts by making entitlements explicit and ensuring nested runtime executables are signed.

## Changes Implemented

1. Added explicit entitlements files:
   - `packages/desktop/assets/entitlements.mac.plist`
   - `packages/desktop/assets/entitlements.mac.inherit.plist`
2. Wired entitlements in `packages/desktop/electron-builder.yml`:
   - `mac.entitlements: assets/entitlements.mac.plist`
   - `mac.entitlementsInherit: assets/entitlements.mac.inherit.plist`
3. Added `afterSign` hook in `packages/desktop/electron-builder.yml`:
   - `afterSign: scripts/sign-nested-binaries.mjs`
4. Added nested executable signing script:
   - `packages/desktop/scripts/sign-nested-binaries.mjs`
   - Signs executable files under packaged `Contents/Resources/bin` and `Contents/Resources/node-runtime`.
   - Uses `CSC_NAME` identity when provided; falls back to ad-hoc signing (`-`) for local unsigned builds.

## Contract Coverage

- Added `packages/desktop/src/main/signing-config.test.ts` to validate:
  - entitlements wiring in `electron-builder.yml`
  - `afterSign` hook presence
  - expected hardened-runtime entitlements in both plist files
- Included in release contract suite via `scripts/test-contracts.js`.

## Validation Commands

Run from repo root:

1. `pnpm --filter @flowstate/desktop typecheck`
2. `pnpm --filter @flowstate/desktop test`
3. `pnpm test:contracts`

Release-candidate validation (post-package):

1. `codesign --verify --deep --strict --verbose=2 "<path-to-FlowState.app>"`
2. `spctl --assess --type execute --verbose=4 "<path-to-FlowState.app>"`

## Notes

- Notarization/stapling wiring remains Phase 9.4 scope.
- This phase focuses on explicit signing inputs and nested executable signing behavior.

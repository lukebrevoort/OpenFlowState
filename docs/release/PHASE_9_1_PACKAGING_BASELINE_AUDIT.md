# Phase 9.1 Packaging Baseline Audit

Version: v0.1.0-demo-prep
Owner: Developer
Last Updated: 2026-02-25
Status: Complete (Phase 9.1)

## Objective

Establish the release-packaging baseline before Phase 9 hardening:

1. Inventory all packaging entrypoints.
2. Identify configuration drift and hidden assumptions.
3. Choose and document one packaging source of truth.

## Packaging Entrypoint Inventory

| Entrypoint | Location | Purpose | Output |
| --- | --- | --- | --- |
| `pnpm build:release` | `package.json` -> `scripts/build-release.js` | Run lint/type/test/build/package sequence for release candidates | DMG/ZIP in `packages/desktop/out/` |
| `pnpm --filter @flowstate/desktop package:mac` | `packages/desktop/package.json` | Build desktop + MCP prerequisites and call `electron-builder --mac` | mac artifacts in `packages/desktop/out/` |
| `pnpm smoke:dmg` | `package.json` -> `scripts/smoke-dmg.js` | Attach DMG, assert app bundle and launch, write evidence | JSON evidence in `.opencode/artifacts/` |
| `pnpm gate:release` | `package.json` -> `scripts/gate-release.js` | Aggregate release gates (`build:release`, smoke, contracts, packaged e2e) | Pass/fail command gate |

## Builder Configuration Discovery

Current repository contains two active Electron Builder config sources:

1. `packages/desktop/electron-builder.yml`
2. `packages/desktop/package.json` -> `build` block

Current packaging command (`electron-builder --mac`) does not explicitly pin `--config`, so discovery order can cause confusion and drift over time.

## Drift Matrix (YAML vs package.json build block)

| Area | `electron-builder.yml` | `packages/desktop/package.json#build` | Risk |
| --- | --- | --- | --- |
| Mac target arch | Explicit universal DMG + ZIP | DMG + ZIP without explicit arch policy | Artifact inconsistency across machines |
| Hardened runtime | `true` | Not specified | Signing/notarization mismatch |
| Entitlements | Explicit `null` placeholders | Not specified | Hidden signing defaults |
| `files` filters | Excludes maps/docs/tests in node_modules | Broader include list | Bundle size and content drift |
| MCP resource copy | Includes gmail/gcal/system/canvas node_modules + mcp-servers | Includes gmail/gcal/system/canvas + notion in both places | Service availability can diverge |
| Notion packaging | Missing explicit notion entries in YAML | Includes notion dist + package.json | Packaged Notion MCP reliability risk |
| Platform extras | Includes future win/linux sections | Mac-only block in build config | Cognitive overhead and ambiguity |

## Baseline Findings

1. Packaging pipeline exists and is usable, but config duplication introduces non-determinism risk.
2. `packages/desktop/electron-builder.yml` and `packages/desktop/package.json#build` are not equivalent.
3. Notion packaging rules differ between the two sources and must be normalized in Phase 9.2.
4. Release gate and smoke scripts are already in place and provide a solid enforcement foundation.

## Phase 9.1 Decision (Source of Truth)

For Phase 9 onward, the authoritative builder configuration is:

- `packages/desktop/electron-builder.yml`

Policy:

- Treat `packages/desktop/package.json#build` as legacy and non-authoritative until removed or reduced in Phase 9.2.
- All packaging configuration changes must be made in `packages/desktop/electron-builder.yml`.

## Immediate Risks to Carry into Phase 9.2

1. Normalize Notion resource rules so packaged runtime does not depend on implicit fallback behavior.
2. Remove or neutralize duplicate builder config in `packages/desktop/package.json`.
3. Pin packaging invocation to explicit config (`--config`) after normalization.

## Exit Criteria Check (Phase 9.1)

- One authoritative builder config path chosen and documented: `packages/desktop/electron-builder.yml`.
- Packaging input/output map committed: see `docs/release/PHASE_9_1_PACKAGING_IO_MAP.md`.

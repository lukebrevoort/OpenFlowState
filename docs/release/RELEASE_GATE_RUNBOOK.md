# Release Gate Runbook

Version: v0.1.0-beta
Owner: PM v2
Last Updated: 2026-02-23

## Purpose

Define the required command sequence and evidence checks before treating a DMG release candidate as valid.

## Required Command Sequence

Run from repo root (`flowstate/`):

1. `pnpm build:release`
2. `pnpm smoke:dmg`
3. `pnpm test:contracts`
4. `pnpm test:packaged-e2e`
5. `pnpm gate:release`

For wiring validation without full build cost:

- `pnpm gate:release -- --dry-run`

## Required Evidence

- Smoke artifact JSON in `.opencode/artifacts/` from the latest `pnpm smoke:dmg` run.
- Passing command outputs for contract and packaged e2e suites.
- No unresolved critical parity gaps beyond those explicitly tracked in `docs/release/PARITY_TEST_MAP.md`.

## Failure Handling

If any command fails:

1. Capture failing command output and artifact paths.
2. Log failure category (packaging, smoke, contract, e2e, gate wiring).
3. Fix forward in current parity phase; do not publish or bless release drafts.
4. Re-run failed command, then rerun `pnpm gate:release`.

## Go / No-Go Rule

- GO only when all required commands pass and smoke artifact shows `"status": "pass"`.
- NO-GO on any failing command or missing artifact evidence.

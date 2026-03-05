# Phase 9.7 - CI Gate and Release Automation

Version: v0.1.0-demo-prep
Last Updated: 2026-02-27
Status: Implemented (lean)

## Goal

Enforce fail-closed release gates in CI and provide failure-classified artifacts for fast triage.

## Changes Implemented

1. Added structured gate reporting in `scripts/gate-release.js`:
   - Writes `.opencode/artifacts/release-gate-<timestamp>.json`
   - Includes per-step status, durations, and `failureClass` on failure.
2. Added failure class mapping for release triage:
   - `packaging`, `smoke`, `contracts`, `packaged_e2e`, `apple_verification`.
3. Added GitHub Actions workflow:
   - `.github/workflows/release-gate.yml`
   - PRs to `main`: macOS dry-run gate (`pnpm gate:release -- --dry-run`)
   - Manual dispatch input `full_release=true` for credentialed full gate execution.
4. Added artifact upload behavior in CI:
   - Uploads `.opencode/artifacts` on every run for diagnostics.
5. Updated runbook with CI path and failure-class triage guidance:
   - `docs/release/RELEASE_GATE_RUNBOOK.md`

## Validation commands

1. `pnpm gate:release -- --dry-run`
2. Confirm `release-gate-*.json` exists under `.opencode/artifacts/`

## Notes

- This is the lean 9.7 implementation: PRs enforce dry-run gate coverage while manual dispatch supports full credentialed release gates.
- Full release execution requires Apple signing/notarization secrets configured in GitHub repository settings.

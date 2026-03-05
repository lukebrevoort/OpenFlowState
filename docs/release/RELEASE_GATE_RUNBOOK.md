# Release Gate Runbook

Version: v0.1.0-demo-prep
Owner: PM v2
Last Updated: 2026-02-27

## Purpose

Define the required command sequence and evidence checks before treating a DMG release candidate as valid.

## Required Command Sequence

Run from repo root (`flowstate/`):

1. `pnpm gate:release`

`gate:release` is the canonical command and already runs:

1. `pnpm build:release`
2. `pnpm smoke:dmg`
3. `pnpm test:contracts`
4. `pnpm test:packaged-e2e`
5. `pnpm verify:apple-artifact`

For wiring validation without full build cost:

- `pnpm gate:release -- --dry-run`

CI automation:

- GitHub Actions workflow: `.github/workflows/release-gate.yml`
- PRs to `main` run `pnpm gate:release -- --dry-run` on macOS.
- Manual dispatch supports `full_release=true` to run full gate with signing/notarization secrets.
- Gate artifacts are uploaded from `.opencode/artifacts/` for triage.

Platform requirement:

- Run release gates on macOS with Apple CLI tools available (`codesign`, `spctl`, `xcrun`) because Apple verification is part of the required gate.

## Required Evidence

- Smoke artifact JSON in `.opencode/artifacts/` from the latest `pnpm smoke:dmg` run.
- Smoke artifact must show install-copy, launch + relaunch pass, startup log signal checks, and system MCP runner signal checks.
- Passing command outputs for contract and packaged e2e suites.
- Passing outputs for `codesign --verify --deep --strict --verbose=2`, `spctl --assess --type execute --verbose=4`, and `xcrun stapler validate` (enforced via `pnpm verify:apple-artifact`).
- Release manifest and checksum files from `pnpm prepare:release-artifacts` in `.opencode/artifacts/` (`release-manifest-<build-id>.json` and `release-checksums-<build-id>.txt`).
- No unresolved critical parity gaps beyond those explicitly tracked in `docs/release/PARITY_TEST_MAP.md`.

## Demo Distribution Packet

For every demo candidate, prepare and attach:

- `docs/release/DEMO_RELEASE_CHECKLIST.md` (completed)
- `docs/release/DEMO_RELEASE_PACKET_TEMPLATE.md` (filled)
- `docs/release/DEMO_INSTALLER_INSTRUCTIONS.md` (shared with testers)

## Failure Handling

If any command fails:

1. Capture failing command output and artifact paths.
2. Check `release-gate-*.json` in `.opencode/artifacts/` and use `failureClass` for triage.
3. Fix forward in current parity phase; do not publish or bless release drafts.
4. Re-run failed command, then rerun `pnpm gate:release`.

Failure classes:

- `packaging`
- `smoke`
- `contracts`
- `packaged_e2e`
- `apple_verification`

## Go / No-Go Rule

- GO only when all required commands pass and smoke artifact shows `"status": "pass"`.
- NO-GO on any failing command or missing artifact evidence.
- GO requires explicit sign-off in the demo release checklist and packet.

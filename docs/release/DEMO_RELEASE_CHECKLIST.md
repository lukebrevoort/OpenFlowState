# Demo Release Checklist

Version: v0.1.0-demo-prep
Last Updated: 2026-02-27

## Candidate metadata

- [ ] Version:
- [ ] Build ID:
- [ ] Git SHA:
- [ ] Candidate owner:
- [ ] Rollback artifact link (previous known-good):

## Required gate outputs

- [ ] `pnpm gate:release` passed.
- [ ] `release-gate-*.json` exists and status is `pass`.
- [ ] Latest smoke artifact has `status: pass` and includes install-copy + relaunch checks.
- [ ] `release-manifest-<build-id>.json` present.
- [ ] `release-checksums-<build-id>.txt` present.

## Signing and notarization evidence

- [ ] `codesign --verify --deep --strict --verbose=2` passed for all packaged app bundles.
- [ ] `spctl --assess --type execute --verbose=4` passed.
- [ ] `xcrun stapler validate` passed.

## Demo readiness

- [ ] `docs/release/DEMO_INSTALLER_INSTRUCTIONS.md` included in tester handoff.
- [ ] Known issues list prepared and attached.
- [ ] Rollback plan verified (previous artifact still available and checksum-linked).

## Sign-off

- [ ] Release owner: GO / NO-GO
- [ ] Verifier review complete
- [ ] Distribution channel confirmed (who receives DMG)

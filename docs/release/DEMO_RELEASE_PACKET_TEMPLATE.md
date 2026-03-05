# Demo Release Packet Template

Version: v0.1.0-demo-prep
Last Updated: 2026-02-27

Use this template for every DMG demo candidate release.

---

## 1) Candidate Summary

- Version:
- Build ID:
- Git SHA:
- Build date/time:
- Owner:

## 2) Artifact Set

- DMG(s):
- ZIP(s):
- Manifest: `.opencode/artifacts/release-manifest-<build-id>.json`
- Checksums: `.opencode/artifacts/release-checksums-<build-id>.txt`

## 3) Gate Evidence

- Release gate report: `.opencode/artifacts/release-gate-<timestamp>.json`
- Smoke report(s): `.opencode/artifacts/smoke-dmg-<timestamp>.json`
- Contract/e2e outputs: attach CI log links or local run logs

## 4) Apple Verification

- codesign verify result:
- spctl assess result:
- stapler validate result:

## 5) Installer Experience

- Installer instructions used: `docs/release/DEMO_INSTALLER_INSTRUCTIONS.md`
- Tester install proof (screenshots/logs):

## 6) Known Issues

- Issue 1:
- Issue 2:

## 7) Rollback

- Previous known-good build ID:
- Previous artifact links:
- Previous checksums/manifest links:

## 8) Go / No-Go Decision

- Decision: GO / NO-GO
- Decision timestamp:
- Approver(s):
- Notes:

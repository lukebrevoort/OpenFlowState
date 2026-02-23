# Beta Guide

Version: v0.1.0-beta
Build: b20260223.1eefaa4
Last Updated: 2026-02-23
Owner: FlowState PM
Applies To: macOS beta testers (DMG-first install path)

## Install
1. Download `FlowState-v0.1.0-beta+b20260223.1eefaa4-macos-arm64.dmg`.
2. Verify checksum using `SHA256SUMS.txt`.
3. Open the DMG and drag `FlowState.app` to `/Applications`.
4. Launch from `/Applications/FlowState.app`.

Success looks like: app opens without crash and reaches Home.

If this fails: re-verify checksum and re-download before retrying.

## Gatekeeper Workaround (Unsigned Build)
1. In Finder, right-click `FlowState.app` and choose Open.
2. Confirm the macOS prompt and choose Open again.

Success looks like: app launches and no repeated bypass is required on relaunch.

If this fails: ensure app is in `/Applications` and retry from Finder.

## Connect Integrations
1. Open Integrations mode.
2. Connect Notion.
3. Connect Gmail.
4. Connect Google Calendar.

Success looks like: each integration shows connected status.

If this fails: disconnect/reconnect the failing integration, then restart app once.

## Known Limits
- This beta is unsigned and requires Finder Open bypass on first launch.
- Intel + second macOS-version cohort coverage is enforced at launch gate.
- Renderer bundle size warning exists and is tracked for post-beta optimization.

See `KNOWN_LIMITS.md` for severity labels and workarounds.

## Support + Triage SLA
- Operational playbook: `BETA_OPERATIONS.md`
- When reporting issues, include build, macOS version, device architecture, severity, and reproduction steps.
- Severity response targets:
  - P0 acknowledged <= 30 minutes
  - P1 acknowledged <= 2 hours
  - P2 acknowledged <= 1 business day
  - P3 acknowledged <= 2 business days

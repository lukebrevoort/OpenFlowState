# FlowState Demo Installer Instructions

Version: v0.1.0-demo-prep
Last Updated: 2026-02-27
Audience: Demo testers

## Supported platform

- macOS 13+ (Apple Silicon or Intel)

## Install steps (signed/notarized builds)

1. Download the DMG provided by the FlowState team.
2. Double-click the DMG to mount it.
3. Drag `FlowState.app` into `Applications`.
4. Eject the DMG.
5. Launch `FlowState` from `Applications`.

Expected behavior:

- App opens without Gatekeeper bypass instructions.

## First-run checks for testers

1. App launches to main shell.
2. Second launch after closing also succeeds.
3. Chat mode opens and accepts input.
4. Integrations page loads without crash.

## If install or launch fails

Please capture and send:

1. macOS version + device arch (`arm64` or `x64`).
2. DMG filename used.
3. Screenshot of any warning/error dialog.
4. Last 100 lines of startup log:
   - `~/Library/Application Support/@flowstate/desktop/logs/startup.log`

# Phase 9.6 - Installer Smoke and Runtime Parity

Version: v0.1.0-demo-prep
Last Updated: 2026-02-27
Status: Implemented

## Goal

Validate installed-app behavior from DMG artifacts and capture stronger runtime parity evidence beyond single-launch checks.

## Changes Implemented

1. Expanded `scripts/smoke-dmg.js` from mount-and-launch to install-and-relaunch flow.
2. Added temp install simulation:
   - Copies `FlowState.app` from mounted DMG into a temporary install directory via `ditto`.
3. Added deterministic launch assertions:
   - Launch #1 and launch #2 both require new process detection.
   - Each launch is terminated cleanly and escalated to `SIGKILL` if needed.
4. Added runtime parity checks tied to packaged startup behavior:
   - Startup log signals: `FlowState initialize() started`, `OpenCode server initialized`.
   - System MCP runner signals: `start mcp-system`, `import @flowstate/mcp-system/dist/index.js`.
5. Added cleanup guarantees:
   - Temporary installed app directory is removed in both success and failure paths.
6. Extended smoke evidence JSON schema:
   - Includes `installDir`, `installedAppPath`, per-launch PID snapshots, and runtime signal matches.

## Validation commands

1. `pnpm smoke:dmg -- --dry-run`
2. `pnpm gate:release -- --dry-run`

Credentialed candidate path:

1. `pnpm build:release`
2. `pnpm smoke:dmg`
3. `pnpm gate:release`

## Notes

- This phase focuses on parity confidence for demo distribution by validating installed app launch/relaunch and key startup capabilities from packaged artifacts.

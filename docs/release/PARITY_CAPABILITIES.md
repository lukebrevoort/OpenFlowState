# Build-to-DMG Parity Capabilities

Version: v0.1.0-beta
Owner: PM v2
Last Updated: 2026-02-23
Applies To: Build-to-DMG Parity Stabilization Program

## Purpose

Define the authoritative parity contract between local `pnpm build` validation and the downloadable DMG artifact used by beta users.

## Baseline Inventory (Current)

- Existing release packaging command: `pnpm --filter @flowstate/desktop package:mac`
- Existing root checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- Existing runtime dependency check: `pnpm --filter @flowstate/desktop check:runtime-deps`
- Missing before this phase: explicit parity commands for release build, DMG smoke, contract tests, packaged e2e, and aggregate release gate

## Capability Parity Checklist

Each capability is required for stable demo parity.

| Capability | Build Validation | DMG Validation | Evidence Required |
| --- | --- | --- | --- |
| Install + first launch | `pnpm --filter @flowstate/desktop build` succeeds | DMG mounts and exposes `FlowState.app`; app launches without startup crash | Smoke artifact + launch log snippet |
| Relaunch persistence | Local run stores config/auth state | Installed app relaunches with persisted state | Config/auth state verification note |
| Mode navigation | Home, Chat, Tasks, Workflows, Integrations render in local build | Same mode transitions in installed app | Checklist with pass/fail per mode |
| Process startup | OpenCode + enabled MCP process startup in local run | Same startup in installed runtime with packaged resource paths | Startup diagnostics + process status snapshot |
| Workflow execution | One bundled workflow reaches terminal state locally | Same workflow reaches terminal state in installed app | Timeline event excerpt + terminal status |
| Approval behavior | `Approve`, `Always Approve`, `Deny` paths work in local run | Same behavior in installed app session | Three approval outcome events |

## Command Contract (Phase 1 Scaffold)

- `pnpm build:release` -> deterministic release build and package flow
- `pnpm smoke:dmg` -> DMG smoke validation (mount + app bundle check + evidence output)
- `pnpm test:contracts` -> contract/mocked boundary test suite
- `pnpm test:packaged-e2e` -> packaged critical-path regression suite
- `pnpm gate:release` -> aggregate release gate over parity/test steps

## Pass/Fail Rules

- Pass: every checklist row has explicit pass evidence for both local build and DMG validation.
- Fail: any checklist row lacks DMG evidence or diverges from local build behavior.
- Blocker threshold: any P0/P1 parity failure blocks release-gate completion.

## Known Gaps at Phase Start

- Full install-to-launch automation from downloaded GitHub draft DMG is not complete yet.
- Packaged runtime diagnostics need deeper coverage for child-process pathing and auth edge cases.
- Contract/e2e suites are partially mapped and require expansion in later parity phases.

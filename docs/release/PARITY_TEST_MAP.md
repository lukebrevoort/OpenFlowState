# Build-to-DMG Parity Test Map

Version: v0.1.0-beta  
Owner: PM v2  
Last Updated: 2026-02-23

Source parity contract: `docs/release/PARITY_CAPABILITIES.md`.

## Coverage by Test Pyramid Layer

### Unit Coverage

- `pnpm test` (root `turbo test`, includes desktop/unit-level Vitest suites)
- Examples currently exercised in that umbrella run:
  - `packages/desktop/src/main/approval-blocking.test.ts`
  - `packages/desktop/src/main/approval-policy-store.test.ts`
  - `packages/desktop/src/main/mcp-config.test.ts`

### Contract Coverage

- `pnpm test:contracts`
  - `pnpm --filter @flowstate/desktop exec vitest run src/main/mcp-config.test.ts src/main/approval-policy-store.test.ts`
  - `pnpm --filter @flowstate/mcp-canvas test`

### Integration Coverage

- Current automated path is folded into `pnpm test` (no dedicated `test:integration` command yet).
- Integration-leaning checks in current suite include workflow and persistence paths in `packages/desktop/src/main/phase7-happy-path.test.ts`.

### Packaged E2E Coverage

- `pnpm test:packaged-e2e`
  - `pnpm --filter @flowstate/desktop exec vitest run src/main/phase7-happy-path.test.ts src/main/study-material-e2e.test.ts`

### Smoke Gate Coverage

- `pnpm smoke:dmg` (DMG mount + `FlowState.app` presence evidence in `.opencode/artifacts`)
- `pnpm build:release` (lint + typecheck + test + desktop build + `package:mac`)
- `pnpm gate:release` (aggregate: `build:release` + `smoke:dmg` + `test:contracts` + `test:packaged-e2e`)

## Parity Capability to Automated Check Map

| Parity Capability | Current Automated Checks | Gap / Owner / Follow-up |
| --- | --- | --- |
| Install + first launch | `pnpm build:release` (includes `pnpm --filter @flowstate/desktop build` and `pnpm --filter @flowstate/desktop package:mac`); `pnpm smoke:dmg` verifies DMG mount and `FlowState.app` presence | **Gap:** No automated app launch assertion from mounted/installed DMG (startup crash check missing). **Owner:** Desktop runtime + Release automation. **Follow-up:** extend `pnpm smoke:dmg` to launch app and assert successful startup logs/exit health. |
| Relaunch persistence | `pnpm test:packaged-e2e` includes `src/main/phase7-happy-path.test.ts` (workflow completion and persisted run/output state in local runtime) | **Gap:** No DMG-installed relaunch persistence automation for config/auth state. **Owner:** Desktop runtime. **Follow-up:** add packaged relaunch scenario to `pnpm test:packaged-e2e` with persisted state assertions across app restarts. |
| Mode navigation (Home/Chat/Tasks/Workflows/Integrations) | Explicit automated mode-transition parity check not present in release gate commands | **Gap:** Missing automated navigation checks in local and DMG-installed runtime. **Owner:** Desktop renderer + QA automation. **Follow-up:** add renderer/integration navigation suite and include in `pnpm test:packaged-e2e`. |
| Process startup (OpenCode + enabled MCP) | `pnpm test:contracts` validates MCP config normalization (`src/main/mcp-config.test.ts`); `pnpm test:mcp` validates MCP server process boot; `pnpm --filter @flowstate/desktop check:runtime-deps` validates runtime dependency declarations | **Gap:** No packaged-resource-path startup verification in installed DMG flow. **Owner:** Desktop runtime + Packaging. **Follow-up:** add packaged startup diagnostics assertions to `pnpm smoke:dmg` and/or `pnpm test:packaged-e2e`. |
| Workflow execution to terminal state | `pnpm test:packaged-e2e` includes `src/main/phase7-happy-path.test.ts` (workflow completes, artifacts written) | **Gap:** Installed DMG workflow execution parity is not directly automated. **Owner:** Workflow runtime + QA automation. **Follow-up:** run workflow from installed app in packaged e2e harness and assert terminal/timeline evidence. |
| Approval behavior (`Approve` / `Always Approve` / `Deny`) | `pnpm test` covers `src/main/approval-blocking.test.ts`; `pnpm test:contracts` covers `src/main/approval-policy-store.test.ts`; `pnpm test:packaged-e2e` covers `src/main/phase7-happy-path.test.ts` (always-approve opt-in wiring) | **Gap:** No explicit automated parity assertion for all three user-facing approval outcomes in installed DMG session (especially `Deny`). **Owner:** Approval policy + QA automation. **Follow-up:** add packaged approval scenario matrix (Approve, Always Approve, Deny) and gate it in `pnpm test:packaged-e2e`. |

## Release-Gate Use

- Use `pnpm gate:release` as the single blocking command.
- Treat each gap above as release-risk debt; close highest-risk gaps first: first-launch assertion, DMG relaunch persistence, approval outcome matrix.

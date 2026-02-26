# Phase 9.2 Config Normalization

Version: v0.1.0-demo-prep
Owner: Developer
Last Updated: 2026-02-25
Status: In Progress (normalization + packaged validation complete)

## Objective

Normalize desktop packaging configuration so release artifacts are deterministic and do not regress MCP startup in packaged builds.

## Phase 9.2 Changes Implemented

### 1) Single builder config source in execution path

- Updated desktop packaging scripts to explicitly use `electron-builder.yml`:
  - `packages/desktop/package.json` `package`
  - `packages/desktop/package.json` `package:mac`
- Both now call `electron-builder ... --config electron-builder.yml`.

Result:

- Packaging no longer relies on implicit config discovery order.

### 2) Removed duplicate/competing builder config

- Removed legacy `build` block from `packages/desktop/package.json`.

Result:

- `packages/desktop/electron-builder.yml` is the only active packaging config source.

### 3) Notion MCP packaging parity fix (primary risk)

- Added missing Notion MCP runtime copy rules to `packages/desktop/electron-builder.yml`:
  - `mcp-servers/mcp-notion/dist`
  - `node_modules/@flowstate/mcp-notion/package.json`
  - `node_modules/@flowstate/mcp-notion/dist`
- Added missing workspace dependency in desktop package:
  - `@flowstate/mcp-notion: workspace:*`

Result:

- Packaged runtime can resolve Notion MCP consistently with other managed MCPs.
- This removes the prior asymmetry where Notion depended on legacy fallback behavior.

### 4) Lockfile consistency

- Regenerated lockfile metadata after dependency normalization:
  - `pnpm install --lockfile-only`

### 5) Arch policy normalization for packaging stability

- Observed universal packaging failure during `electron-builder --mac` due to bundled OpenCode binary layout conflict in universal merge stage.
- Normalized `mac.target` arch policy to explicit per-arch outputs:
  - `arm64`
  - `x64`
- Removed `universal` target for this demo-packaging phase.

Result:

- Packaging now completes deterministically for both arm64 and x64 artifacts.
- Avoids universal merge edge-case while preserving dual-architecture demo coverage.

### 6) Packaged runtime validation after normalization

- Ran full packaging:
  - `pnpm --filter @flowstate/desktop package:mac`
- Ran DMG smoke test against arm64 artifact:
  - `pnpm smoke:dmg -- --dmg packages/desktop/out/FlowState-0.1.0-arm64.dmg`
- Verified packaged resource layout includes Notion in both required paths:
  - `.../Resources/mcp-servers/mcp-notion/`
  - `.../Resources/node_modules/@flowstate/mcp-notion/`
- Re-ran release-oriented validation suites:
  - `pnpm test:contracts`
  - `pnpm test:packaged-e2e`

Result:

- Packaging and smoke pass with Notion resources present in packaged app output.
- Contract and packaged e2e checks remain green.

## Risk Focus Mapping

### Notion MCP failure risk

Previous risk:

- Notion handling diverged from Gmail/GCal/System/Canvas between config sources.
- Packaged build could miss expected Notion runtime copy path.

Mitigation now in place:

- Notion copy rules are explicit in the authoritative YAML config.
- Desktop now declares `@flowstate/mcp-notion` dependency directly.

### OpenCode handling inconsistency risk

Previous risk:

- Mixed builder config sources can produce different resource layouts, impacting packaged OpenCode/MCP startup assumptions.

Mitigation now in place:

- Packaging command path is pinned to one config file.
- Resource layout is now controlled from one source of truth.

## Remaining Phase 9.2 Follow-Ups

1. Run full `package:mac` + `smoke:dmg` verification and confirm Notion MCP startup in packaged mode.
2. Validate packaged logs for OpenCode binary resolution and managed MCP runtime selection.
3. If any packaged fallback path still activates unexpectedly, classify and normalize in Phase 9.3.

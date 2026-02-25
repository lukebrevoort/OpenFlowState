# Phase 9.1 Packaging Input Output Map

Version: v0.1.0-demo-prep
Owner: Developer
Last Updated: 2026-02-25
Status: Complete (Phase 9.1)

## Purpose

Document the current release packaging graph: what inputs are required, which commands transform them, and where outputs are written.

## Command Graph (Current Baseline)

```text
pnpm gate:release
  -> pnpm build:release
      -> pnpm lint
      -> pnpm typecheck
      -> pnpm test
      -> pnpm --filter @flowstate/desktop build
      -> pnpm --filter @flowstate/desktop package:mac
          -> electron-builder --mac
  -> pnpm smoke:dmg
  -> pnpm test:contracts
  -> pnpm test:packaged-e2e
```

## Packaging Inputs

### Source Inputs

| Input | Path | Used By |
| --- | --- | --- |
| Desktop compiled app | `packages/desktop/dist/**` | electron-builder `files` |
| Desktop assets | `packages/desktop/assets/**` | app icon + packaged assets |
| Agent prompts | `agents/**` | `extraResources -> agents` |
| Workflow templates | `workflows/**` | `extraResources -> workflows` |
| MCP build output | `packages/mcp-*/dist/**` | `extraResources` + node_modules runtime copy |
| MCP package metadata | `packages/mcp-*/package.json` | node_modules runtime copy |
| OpenCode binaries | `packages/desktop/vendor/opencode/**` | `extraResources -> bin/*` |

### Build-Time Command Inputs

| Dependency | Why It Matters |
| --- | --- |
| `pnpm-lock.yaml` | Dependency determinism |
| Node >= 20 | Required by root engines |
| macOS host | Required for DMG generation and signing/notarization flow |

## Packaging Transform Stages

### Stage A - Workspace Build

- `pnpm --filter @flowstate/core build`
- `pnpm --filter @flowstate/mcp-gmail build`
- `pnpm --filter @flowstate/mcp-notion build`
- `pnpm --filter @flowstate/mcp-gcal build`
- `pnpm --filter @flowstate/mcp-system build`
- `pnpm --filter @flowstate/mcp-canvas build`
- `pnpm --filter @flowstate/desktop build`

Produces compiled JS artifacts under package `dist/` trees.

### Stage B - Desktop Packaging

- `pnpm --filter @flowstate/desktop prepare:opencode-binaries`
- `electron-builder --mac`

Consumes build outputs + static resources and produces mac artifacts.

### Stage C - Candidate Validation

- `pnpm smoke:dmg` mounts latest DMG, asserts `FlowState.app`, launches app, captures evidence.
- `pnpm test:contracts` and `pnpm test:packaged-e2e` enforce non-smoke release behavior.

## Packaging Outputs

### Artifact Outputs

| Output | Path | Producer |
| --- | --- | --- |
| DMG artifact | `packages/desktop/out/*.dmg` | electron-builder |
| ZIP artifact | `packages/desktop/out/*.zip` | electron-builder |
| Unpacked app (if generated) | `packages/desktop/out/mac*/FlowState.app` | electron-builder |

### Evidence Outputs

| Output | Path | Producer |
| --- | --- | --- |
| DMG smoke report JSON | `.opencode/artifacts/smoke-dmg-*.json` | `scripts/smoke-dmg.js` |
| Gate command output | terminal/CI logs | `scripts/gate-release.js` |

## Runtime Resource Expectations in Packaged App

Expected under app resources at runtime:

- `agents/flowstate.md`
- `workflows/` templates
- `mcp-servers/mcp-gmail/dist/index.js`
- `mcp-servers/mcp-gcal/dist/index.js`
- `mcp-servers/mcp-system/dist/index.js`
- `mcp-servers/mcp-canvas/dist/index.js`
- `mcp-servers/mcp-notion/dist/index.js` (must be normalized explicitly in Phase 9.2)
- `bin/opencode-darwin-arm64` and `bin/opencode-darwin-x64`

## Known Mapping Gaps (Baseline)

1. Builder config duplication (`electron-builder.yml` vs `package.json#build`) can produce divergent copies.
2. Notion copy rules are not consistently represented in both config sources.
3. Packaging command does not explicitly pin `--config`, which can hide config-source assumptions.

## Phase 9.2 Normalization Targets

1. Collapse to one builder config source and remove duplicate rules.
2. Ensure Notion MCP resource mapping is explicit and tested in packaged runtime.
3. Pin build invocation to explicit config to make CI behavior deterministic.

# Phase 9.2 MCP Startup Best Practices (Electron)

Version: v0.1.0-demo-prep
Last Updated: 2026-02-26
Status: Research complete

## Goal

Capture practical best practices used by Electron/MCP hosts to avoid runtime failures like:

- `MCP unavailable: MCP error -32000: Connection closed`

## External references reviewed

- MCP Transports spec (`stdio` requirements) - `modelcontextprotocol.io/docs/concepts/transports`
- MCP Debugging guidance (Claude Desktop) - `modelcontextprotocol.io/docs/tools/debugging`
- Node child process API guidance - `nodejs.org/api/child_process.html`
- Open-source Electron MCP host implementation notes (Groq Desktop) - `github.com/groq/groq-desktop-beta`
- VS Code MCP config model patterns (`stdio` command/args/env shape) - `github.com/microsoft/vscode`

## Best practices observed

### 1) Keep stdio protocol channel clean

For stdio MCP servers:

- `stdout` must contain only valid MCP JSON-RPC messages.
- Any logs must go to `stderr`, never `stdout`.

Why it matters:

- Any non-protocol output on `stdout` can cause parse/desync and surface as `-32000 Connection closed`.

### 2) Prefer explicit command/args over shell wrappers

- Start MCP servers with direct executable command + args (no shell interpolation where possible).
- Avoid platform-incompatible wrappers in packaged apps (for example, `.sh` wrappers on Windows).

Why it matters:

- Wrapper mismatch is a known real-world cause of immediate subprocess exit and `Connection closed` errors.

### 3) Use absolute runtime paths in packaged context

- Resolve executable and server entrypoint paths from packaged resources explicitly.
- Do not rely on cwd-relative paths in packaged apps.

Why it matters:

- Packaged app cwd and resources layout differ from dev; relative assumptions fail silently.

### 4) Guarantee env completeness and PATH stability

- Preserve a valid `PATH` when overriding env.
- Pass required auth/runtime env explicitly per MCP.
- Keep env keys deterministic and platform-safe.

Why it matters:

- Missing `PATH`/env values causes child startup failures or missing binary resolution.

### 5) Ensure packaged dependency closure for each MCP

- Every managed MCP package must include runtime dependencies in packaged output.
- Validate transitive deps used by MCP servers are present in `app.asar`/resources.

Why it matters:

- Missing transitive deps can crash MCP process immediately after spawn, producing generic connection-closed errors.

### 6) Add startup supervision and actionable diagnostics

- Track per-server spawn/close/error events and exit codes.
- Capture stderr tails per server in runtime logs.
- Report server-specific error context in UI/API (not only generic `-32000`).

Why it matters:

- Fast root-cause isolation depends on per-server diagnostics, not aggregate failure text.

### 7) Perform readiness checks before declaring available

- Confirm MCP server process is alive and responsive before surfacing as connected.
- Separate "configured" from "connected" from "healthy" states.

Why it matters:

- Avoids false-positive "ready" status where process exits moments later.

### 8) Add bounded restart/retry policy

- Use exponential backoff for reconnect attempts.
- Cap retries and emit explicit "needs attention" state after budget exhausted.

Why it matters:

- Prevents crash loops while preserving self-healing for transient failures.

### 9) Keep deterministic config schema for stdio servers

- Follow a typed local server shape (`command`, optional `args`, `env`), similar to other hosts.
- Avoid divergent config pathways for the same server across env modes.

Why it matters:

- Reduces drift between dev and packaged startup behavior.

## FlowState alignment snapshot (Phase 9.2)

Already aligned:

- Single packaging config source and explicit `--config` usage.
- Packaged resource paths for managed MCPs (including Notion).
- OpenCode binary inclusion and path resolution.
- Runtime logging pipeline exists and has actionable startup entries.

Remaining improvements before/alongside Phase 9.3:

1. Add per-MCP stderr tail capture + structured exit diagnostics in `ProcessManager`.
2. Add explicit startup readiness timeout and classified status transitions.
3. Add targeted packaged-runtime startup test that asserts all managed MCPs reach connected state.
4. Add retry/backoff policy specific to MCP process startup (separate from tool-call reliability retries).

## Recommended acceptance checks

For each packaged candidate:

1. Build/package completes for arm64 and x64.
2. DMG smoke passes.
3. Runtime logs show each managed MCP either:
   - connected successfully, or
   - failed with explicit server-specific reason and exit metadata.
4. UI does not collapse all failures into generic `-32000` without server context.

# FlowState 2.0 - Progress Tracker

> **Purpose**: Track development progress, decisions made, and blockers encountered.  
> **Last Updated**: February 20, 2026 (Phase 8 + ChatMode Live Updates merged)

---

## Current Status: ✅ Phase 8 COMPLETE (Academic Intelligence study-pack scope)

Phase 8 execution is complete, including implementation and verification through `phase-8.full.verify-batch-6`.

---

## Tasks Completed (Feb 23, 2026 - Build-to-DMG Parity Program Kickoff)

- ✅ Added parity contract documentation at `docs/release/PARITY_CAPABILITIES.md` with explicit build-vs-DMG capability checks and evidence requirements.
- ✅ Added root release command contract scaffolding: `build:release`, `smoke:dmg`, `test:contracts`, `test:packaged-e2e`, and `gate:release`.
- ✅ Added deterministic script entrypoints under `scripts/` for release build orchestration, DMG smoke validation, contract tests, packaged e2e tests, and aggregate gate execution.
- ✅ Defined phase-start known gaps so upcoming parity phases can focus on packaged runtime hardening and deeper DMG automation.

---

## Tasks Completed (Feb 23, 2026 - Parity Phase 2/3/4/5 Execution Wave)

- ✅ Hardened packaged prompt loading and bundled `agents/` into desktop release resources with deterministic candidate path resolution.
- ✅ Made packaged model-sync path safe by skipping bundled resource mutations and persisting selected model via user config only.
- ✅ Added runtime path regression coverage (`process-manager-paths.test.ts`) and parity capability-to-test mapping (`docs/release/PARITY_TEST_MAP.md`).
- ✅ Upgraded `smoke:dmg` to assert app launch, write deterministic step/status artifacts, and handle DMG detach retries/force fallback for CI reliability.
- ✅ Added release gate runbook (`docs/release/RELEASE_GATE_RUNBOOK.md`) and re-validated command wiring with `pnpm gate:release -- --dry-run`.

---

## Tasks Completed (Feb 23, 2026 - DMG runtime follow-up fixes)

- ✅ Bundled default `workflows/` into packaged desktop resources and seeded bundled workflows into user data on first list load.
- ✅ Added persistent startup diagnostics logging at `~/Library/Application Support/@flowstate/desktop/logs/startup.log` for initialize/startup steps and OpenCode startup failures.
- ✅ Exposed OpenCode startup failure text via `opencode:status` (`startError`) and surfaced it in the renderer shell when OpenCode is unavailable.

---

## Tasks Completed (Feb 23, 2026 - DMG startup path + browser runtime hardening)

- ✅ Added packaged-safe OpenCode CLI resolution (`opencode-cli.ts`) that searches known binary paths, validates executability, and patches runtime PATH before SDK startup.
- ✅ Updated OpenCode model listing IPC to use resolved CLI path instead of assuming `opencode` is already on PATH.
- ✅ Added shared Playwright runtime loader (`playwright-runtime.ts`) with clearer missing-runtime and missing-Chromium-binaries guidance.
- ✅ Updated Canvas browser login, Outlook browser session flows, and Canvas browser health checks to use shared Playwright runtime loading.

### What's Working:
- Electron main process with macOS window management
- Preload script with secure IPC bridge (CommonJS for Electron compatibility)
- React renderer with Vite bundler
- Tailwind CSS with FlowState theme colors
- Four-mode layout (Chat, Tasks, Workflows, Integrations)
- Sidebar with recent convos, pinned workflows, running tasks
- **OpenCode SDK integration with `opencode/grok-code` model**
- **Real-time chat with AI responses**
- **Code block formatting in responses**
- **Zustand state management for chat and config**
- **Custom React hooks for OpenCode and config**
- **IPC handlers wired to ProcessManager and ConfigStore**
- **OAuth flow for Google services (Gmail, Calendar)**
- **API token auth for Notion Internal Integration**
- **Encrypted token storage (AES-256-GCM)**
- **MCP server configuration with environment variables**
- **User profile store (local JSON) with system tools**
- **Shared LRU cache with TTL for MCP servers**
- **Workflows QoL: delete with confirmation, editable command file in details menu, generation no longer creates stuck tasks**
- **Canvas browser auth persistence via MCP-to-desktop pending auth files**

---

## Tasks Completed (Feb 18, 2026 - Phase 8 Completion Wave)

- ✅ Completed fallback UX end-to-end for Canvas pull failures, including local upload recovery and fallback decision flow.
- ✅ Completed destination confirmation and destination routing paths for study-pack writes.
- ✅ Completed parsers/orchestration/provenance scope (PDF/PPTX parsing, orchestrator wiring, citation spans, extraction issues, run diffs).
- ✅ Completed Phase 8 settings + local metrics/export scope (external-knowledge toggle, concurrency/retention controls, JSON/CSV export).
- ✅ Completed verification wave with successful e2e and regression coverage; all implementation/verify batches through `phase-8.full.verify-batch-6` are successful.

---

## Tasks Completed (Feb 18, 2026 - Canvas MCP Auth-Tool Removal + Refresh Guidance)

- ✅ Removed `canvas_auth_browser_login` from exposed Canvas MCP tools to prevent agents from triggering browser sign-in flows.
- ✅ Updated Canvas browser-auth error guidance to instruct users to refresh Canvas authentication in Integrations and retry.
- ✅ Added regression validation to ensure `canvas_auth_browser_login` is not listed by tool discovery.
- ✅ Updated Integrations UI copy to remove references to the removed MCP auth tool.

---

## Tasks Completed (Feb 18, 2026 - Canvas Pull Accuracy Guardrails)

- ✅ Tightened `pull-canvas` skill with explicit file-ID resolution flow (`canvas_list_course_files` -> `canvas_read_file_text`).
- ✅ Added hard guardrails against module-item-ID misuse for file text extraction.
- ✅ Updated FlowState agent prompt to route Canvas pulls through `pull-canvas` guidance and avoid in-agent browser-login flows.
- ✅ Clarified reauthentication path: user should reconnect from Integrations -> Canvas, then retry after lightweight tool health check.

---

## Tasks Completed (Feb 18, 2026 - Save Destination Guardrails)

- ✅ Added agent-level policy to ask users where generated files should be saved before writing artifacts.
- ✅ Added explicit prohibition against defaulting generated files into FlowState source directories unless requested.
- ✅ Updated Canvas study workflow guidance to prompt for destination (`Desktop`, specific path, or inline-only) before saving study guides.

---

## Tasks Completed (Feb 18, 2026 - Phase 8 Upload Fallback Wave A/B/C)

- ✅ Added desktop local-file picker IPC (`app:showOpenFilesDialog`) with typed preload/renderer API and safe path normalization/approval.
- ✅ Added `studyMaterials` source APIs (`create/get/list`) and local PDF/PPTX validation (`validateLocalSource`) with size/signature/hash checks.
- ✅ Added fallback orchestration APIs: Canvas failure classification (`studyMaterials:fallback:classify`) and destination confirmation flow (`studyMaterials:runs:confirmDestination`).
- ✅ Added provenance persistence APIs for `citation_spans`, `extraction_issues`, and `study_run_diffs` (store + IPC + typed preload/renderer surfaces).
- ✅ Added quality-gate evaluator API (`studyMaterials:quality:evaluate`) with default thresholds, override support, and explicit block/unblock semantics.
- ✅ Added regression tests for fallback classification, quality-gate logic, source validation, source listing pagination, and provenance persistence; desktop typecheck + tests pass.

---

## Tasks Completed (Feb 18, 2026 - Chat Dropzone for Local Study Sources)

- ✅ Added a ChatMode drag-and-drop upload zone for local PDF/PPTX study files.
- ✅ Added a `Browse files` fallback action in ChatMode using `app:showOpenFilesDialog`.
- ✅ Wired dropzone upload flow to `studyMaterials.validateLocalSource` + `studyMaterials.createSource` with per-file success/failure feedback.
- ✅ Verified desktop typecheck after ChatMode UI changes.

---

## Tasks Completed (Feb 18, 2026 - Session Attachment Context Injection)

- ✅ Added automatic session-scoped source loading in ChatMode for locally attached study files.
- ✅ Injected attached source metadata (title/type/path/sourceId/version hash) into outbound chat prompts so agents can act on uploaded files.
- ✅ Added lightweight attached-source count indicator in ChatMode to confirm what is available to the active session.
- ✅ Updated `useOpenCode.sendMessage` to support hidden context prefixes without altering displayed user message text.

---

## Tasks Completed (Feb 18, 2026 - Compact Upload Badge + Local Source Reading Skill)

- ✅ Simplified ChatMode upload UI to a compact badge (`1 file uploaded`) above the chat bar instead of larger persistent status sections.
- ✅ Reduced drag overlay to a minimal one-line drop hint to lower visual footprint.
- ✅ Added `read-local-study-sources` skill under `.opencode/skills/` to enforce actual file reads from attached local source paths.
- ✅ Updated FlowState agent prompts to invoke local-source reading behavior when attached-source context is present.

---

## Tasks Completed (Feb 18, 2026 - Phase 8 Canvas External-Host Download Guidance)

- ✅ Updated Canvas external-host download failures to avoid misleading reauthentication guidance when files are inaccessible via API mode.
- ✅ Clarified user-facing fallback to direct upload or pasted text for externally hosted files.
- ✅ Added regression coverage to ensure external-host 403 errors do not suggest `canvas_auth_browser_login` and preserve non-reauth guidance.
- ✅ Re-validated modified packages (`@flowstate/mcp-canvas` and `@flowstate/desktop`) with passing typecheck + test runs.

---

## Tasks Completed (Feb 17, 2026 - Phase 8 Kickoff: Canvas Ingestion + Study-Material Foundations)

- ✅ Added the initial Canvas ingestion slice for Phase 8 so course/file inputs can be pulled into the study-pack pipeline foundation.
- ✅ Added study-material store foundations for Phase 8 run data, source-document tracking, and artifact metadata persistence.
- ✅ Added desktop IPC foundations to connect renderer-triggered Phase 8 study-material actions to main-process orchestration.
- ✅ Captured kickoff status to anchor Phase 8 execution against the new Academic Intelligence plan scope.

### Follow-Up (Phase 8)
- Closed by the Feb 18 completion wave and verification batches through `phase-8.full.verify-batch-6`.

---

## Tasks Completed (Feb 17, 2026 - Phase 7 Chat/Sidebar Reliability + Launch Prep)

- ✅ Added cancellable chat generation flow end-to-end (renderer -> preload -> main -> ProcessManager) with session-scoped cancellation checks.
- ✅ Improved ChatMode rendering reliability for large assistant responses by parsing response headers up front and skipping expensive animation/normalization paths when content is large.
- ✅ Replaced Sidebar placeholder data with live sessions/pinned workflows/running tasks and added debounced refresh coalescing to reduce event-driven reload churn.
- ✅ Added Phase 7 regression coverage (`phase7-happy-path.test.ts`, timeline normalization regressions, workflow ID immutability regression).
- ✅ Hardened IPC boundaries: `app:openExternal` protocol allowlist and `app:ensureFile` path restrictions to app-owned or dialog-approved locations.
- ✅ Added launch prep documentation for unsigned DMG packaging and repeatable beta demo capture (`docs/phase-7-launch-prep.md`).

---

## Tasks Completed (Feb 18, 2026 - ChatMode Live Updates + Stop-to-Cancel Sync)

- ✅ Added timeline-driven message refresh fallback in `useOpenCode` so ChatMode receives incremental assistant updates during long-running promoted tasks without requiring a TasksMode round-trip.
- ✅ Added a `Stop task` action in ChatMode header that cancels the active task run and syncs cancellation state into shared chat/task state.
- ✅ Kept refresh behavior session-safe with debounced in-flight guards to avoid duplicate loads and cross-session message clobbering.
- ✅ Validated desktop package checks in this branch (`pnpm --filter @flowstate/core build`, `pnpm --filter @flowstate/desktop typecheck`, `pnpm --filter @flowstate/desktop test`).

---

## Tasks Completed (Feb 17, 2026 - Phase 6.75 Outlook Browser Session)

- ✅ Added Playwright-based Outlook browser session flow in desktop main (`outlook-browser-session.ts`) for manual sign-in and local storage-state persistence.
- ✅ Added IPC + preload API for Outlook browser login and inbox reads (`outlook:browserLogin`, `outlook:readInbox`).
- ✅ Added Outlook Browser Session mode to Integrations UI with manual-login guardrails and confirmation step.
- ✅ Updated Outlook health checks to support both OAuth and browser-session auth modes.
- ✅ Updated ProcessManager to configure `flowstate-outlook` only for OAuth mode and skip MCP wiring for browser-session mode.
- ✅ Verified desktop checks pass (`pnpm --filter @flowstate/desktop typecheck`, `pnpm --filter @flowstate/desktop build:main`, `pnpm --filter @flowstate/desktop build:renderer`).

---

## Tasks Completed (Feb 17, 2026 - Phase 6.75 Outlook MCP + Inbox Parsing Fixes)

- ✅ Added `User.Read` to Outlook OAuth scopes to align Graph `/v1.0/me` usage with delegated consent requirements.
- ✅ Added a desktop local MCP server for Outlook browser-session mode (`outlook-browser-mcp.ts`) so Outlook MCP appears and is runnable during startup when OAuth is not used.
- ✅ Updated ProcessManager to configure `flowstate-outlook` for browser-session mode using local MCP stdio command and saved storage-state path.
- ✅ Improved Outlook inbox extraction reliability (mailbox readiness wait + broader DOM/frame parsing + OWA API endpoint fallback).
- ✅ Changed empty extraction result from hard failure to connected-with-guidance response so users can recover without false disconnect states.

---

## Tasks Completed (Feb 17, 2026 - Phase 6.75 Outlook Full-Body + Write Toggle)

- ✅ Added full-message body extraction for Outlook browser-session mode (`readOutlookMessageBodyWithBrowserSession`) with message selection by inbox index or subject match.
- ✅ Added browser-session compose capability (`composeOutlookMessageWithBrowserSession`) supporting draft-only and send-now modes.
- ✅ Expanded local Outlook browser MCP tools with `outlook_browser_get_message_body` and `outlook_browser_compose_message`.
- ✅ Added write-mode guardrail (`OUTLOOK_BROWSER_WRITE_ENABLED`) so compose/send tools are blocked unless explicitly enabled.
- ✅ Added Integrations UI control to toggle Outlook browser mode between `Read-only` and `Read + Write`, persisted in auth additionalData and applied via MCP reload.

---

## Tasks Completed (Feb 12, 2026 - Phase 3 Integration Wrap-Up)

- ✅ Added OAuth batch validation endpoint for Gmail/GCal/Notion (`integrations:healthCheckOAuthBatch`) with typed preload/renderer API.
- ✅ Implemented macOS Keychain-first secrets policy in desktop `AuthManager` with encrypted-file fallback and legacy migration.
- ✅ Completed Custom MCP configure UX in Integrations mode (edit name/command/env/enabled + MCP reload handling).
- ✅ Updated `PLAN.md` to mark remaining Phase 3 checklist items as complete.
- ✅ Verified desktop package checks pass (`pnpm --filter @flowstate/desktop typecheck`, `pnpm --filter @flowstate/desktop test`).

---

## Tasks Completed (Feb 17, 2026 - Custom MCP Removal in Integrations)

- ✅ Added a `Remove` action for each custom MCP card in Integrations mode.
- ✅ Wired custom MCP removal to `flowstate.config.json` updates via `window.flowstate.config.set`.
- ✅ Reloaded MCP services after removal via `window.flowstate.mcp.reload()` and refreshed the custom MCP list in UI.
- ✅ Added inline removal error handling and per-item loading state (`Removing...`) in the Custom MCP section.
- ✅ Fixed desktop main-process TypeScript build blocker in Outlook browser session parsing (`TS2677` type predicate mismatch).

---

## Tasks Completed (Feb 7, 2026 - Canvas Browser Auth Fix)

Fixed an issue where Canvas browser authentication (via `canvas_auth_browser_login` MCP tool) wasn't persisting:

**Problem**: When the agent called `canvas_auth_browser_login`:
1. Browser opened, user logged in successfully
2. Playwright storage state was saved to file
3. But the desktop app didn't know about it - auth wasn't persisted
4. Subsequent Canvas tool calls failed because MCP didn't have `CANVAS_STORAGE_STATE_PATH`

**Solution**: Implemented a "pending auth" file-based IPC mechanism:
1. After `canvas_auth_browser_login` succeeds, the MCP writes a pending auth JSON file to `${FLOWSTATE_DATA_DIR}/pending-auth/`
2. Desktop main process watches this directory with chokidar
3. When a pending auth file is detected, desktop:
   - Parses and validates the auth data
   - Stores the token via authManager (with browser mode + storage state path in additionalData)
   - Reloads MCPs so Canvas MCP restarts with correct environment variables
   - Deletes the processed file

**Files Created:**
- `packages/desktop/src/main/pending-auth-watcher.ts` - Watches for and processes pending auth files

**Files Modified:**
- `packages/mcp-canvas/src/api/index.ts` - Write pending auth file after successful browser login
- `packages/mcp-canvas/src/tools/index.ts` - Updated success message to reflect automatic persistence
- `packages/desktop/src/main/index.ts` - Import and start pending auth watcher, stop on quit

**Dependencies Added:**
- `chokidar` (devDependency in @flowstate/desktop)

---

## Decision Log

| Date | Decision | Rationale | Status |
|------|----------|-----------|--------|
| Jan 2026 | Build on top of OpenCode (not fork) | Leverage their maintenance, MCP infra, and community | Approved |
| Jan 2026 | MCP-first architecture | Pluggable integrations, can be used independently | Approved |
| Jan 2026 | ~~TUI + Web Config hybrid~~ | ~~TUI for power users, Web for easier OAuth/config~~ | **Superseded** |
| Jan 2026 | Progressive autonomy model | Auto-read, approval-write for safety | Approved |
| Jan 2026 | Local-only auth storage | User privacy, no cloud dependency | Approved |
| Jan 2026 | TypeScript throughout | Consistency with OpenCode SDK | Approved |
| Jan 2026 | MIT License | Match OpenCode, give back to community | Approved |
| Jan 2026 | Mac-first for MVP | Simplify scope, add Windows later | Approved |
| Jan 2026 | Default to OpenCode Zen | Free, zero-friction for new users | Approved |
| Jan 2026 | **Desktop App (Electron)** | TUI too complex for non-technical users | **New** |
| Jan 2026 | **Headless OpenCode** | Run OpenCode silently, control via SDK/API | **New** |
| Jan 2026 | **Four-Mode UI** | Chat, Tasks, Workflows, Integrations | **New** |
| Jan 2026 | **Workflows as Commands/Skills** | Use OpenCode's .md-based command system | **New** |
| Jan 2026 | **Fresh UI Design** | New React UI inspired by FlowState 1.0 aesthetic | **New** |
| Jan 2026 | **Model Provider Choice** | Ask user in onboarding, default to Zen | **New** |
| Jan 2026 | **opencode/grok-code as default** | Fast, capable model for initial testing | **New** |
| Jan 2026 | **Unified Real-Time Timeline** | Single chronological feed for tool calls/approvals/status (no tabs) | **New** |
| Jan 2026 | **Hybrid Timeline Storage** | SQLite metadata + disk blobs for large payloads (≥10KB) | **New** |
| Jan 2026 | **Smart Metadata Gmail Defaults** | Snippet + headers + labels by default; full body on-demand only | **New** |
| Jan 2026 | **Always Redact Secrets** | Strip tokens/keys even in Developer Mode; export requires explicit action | **New** |

---

## Phase Progress (Original TUI Approach)

### Phase 1: Foundation ✅ COMPLETE
### Phase 2: Core MCP Servers ✅ COMPLETE
### Phase 3: FlowState Core ✅ COMPLETE
### Phase 4: Web Dashboard ✅ COMPLETE (Now Deprecated)
### Phase 5: Agent Development ✅ COMPLETE

---

## NEW: Desktop App Development Phases

### Desktop Phase 1: Foundation ✅ COMPLETE
- [x] Set up `packages/desktop/` with Electron + React + TypeScript
- [x] Implement four-mode layout shell (Chat, Tasks, Workflows, Integrations)
- [x] Port FlowState theme to Tailwind CSS
- [x] Create sidebar component (recent convos, pinned workflows, running tasks)
- [x] Set up Electron main/renderer IPC
- [x] Configure electron-builder for macOS

### Desktop Phase 2: OpenCode Integration ✅ COMPLETE
- [x] Implement process manager for headless OpenCode
- [x] Create SDK bridge in Electron main process
- [x] Build Chat mode with real-time message streaming
- [x] Wire IPC handlers to ConfigStore and ProcessManager
- [x] Create Zustand stores (chatStore, configStore)
- [x] Create custom hooks (useOpenCode, useConfig)
- [x] Test basic conversation flow end-to-end

**Files Created/Modified:**
```
packages/desktop/src/
├── main/
│   ├── index.ts                    # Updated with full IPC handler wiring
│   ├── process-manager.ts          # OpenCode SDK integration (createOpencode)
│   └── config-store.ts             # Configuration management
├── preload/
│   └── index.ts                    # Updated with new IPC methods (CommonJS)
└── renderer/
    ├── stores/
    │   ├── index.ts                # Store exports
    │   ├── chatStore.ts            # Zustand store for chat state
    │   └── configStore.ts          # Zustand store for config state
    ├── hooks/
    │   ├── index.ts                # Hook exports
    │   ├── useOpenCode.ts          # OpenCode communication hook
    │   └── useConfig.ts            # Configuration hook
    ├── types/
    │   └── electron.d.ts           # Updated with new types
    └── modes/
        └── ChatMode.tsx            # Updated with real OpenCode integration
```

---

### Desktop Phase 3: Integrations & Config (Weeks 5-6) 🔄 IN PROGRESS
- [x] Implement config store (Claude Desktop-style `config.json`)
- [x] Build Integrations mode UI with real connection status
- [x] Implement temporary localhost OAuth server (port 3847)
- [x] Port auth manager from `@flowstate/core` (AES-256-GCM encryption)
- [x] Create IPC handlers for auth and OAuth
- [x] Create useIntegrations hook with event listeners
- [x] Create credentials modal for OAuth client setup
- [x] Add user profile store + system tools
- [x] Add shared cache module + MCP caching pass (Gmail, GCal, Notion, Canvas)
- [ ] Test OAuth flow for Google services (needs real credentials)
- [ ] Connect to existing MCP servers as child processes

### Desktop Phase 4: Onboarding & Polish (Weeks 7-8)
- [ ] Build complete onboarding flow (Welcome → Apps → Connect → Wow)
- [ ] Implement LLM provider selection
- [ ] Create suggested prompts for wow moment
- [ ] Add inline approval flow UI
- [ ] Implement macOS notifications for approvals
- [ ] Build Tasks mode (view running/completed tasks)

### Desktop Phase 5: Workflows (Weeks 9-10)
- [ ] Build Workflows mode UI
- [ ] Create pre-built workflow templates (SKILL.md format)
  - [ ] Inbox Review
  - [ ] Meeting Prep
  - [ ] Desktop Cleanup
- [ ] Implement workflow runner
- [ ] Add "pin to sidebar" functionality

### Desktop Phase 6: Testing & Launch (Weeks 11-12)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Create user documentation
- [ ] Build unsigned DMG for beta distribution
- [ ] Create demo video
- [ ] GitHub release v0.1.0

---

## Code Salvage Status

| Component | Salvage? | Notes |
|-----------|----------|-------|
| `@flowstate/mcp-notion` | ✅ Yes | Unchanged, spawn as child process |
| `@flowstate/mcp-gmail` | ✅ Yes | Unchanged, spawn as child process |
| `@flowstate/mcp-gcal` | ✅ Yes | Unchanged, spawn as child process |
| `@flowstate/mcp-system` | ✅ Yes | Unchanged, spawn as child process |
| `@flowstate/core/auth` | ✅ Yes | Port to Electron main process |
| `@flowstate/core/memory` | ✅ Yes | Port to Electron main process |
| `@flowstate/core/notifications` | ⚠️ Partial | Adapt for Electron notifications |
| `@flowstate/core/daemon` | ❌ No | Electron main process replaces it |
| `@flowstate/web-config` | ❌ No | Fresh React UI in desktop package |
| Agent definitions | ✅ Yes | Copy to desktop package |
| Theme colors | ✅ Yes | Port to Tailwind theme |
| Logo assets | ✅ Yes | Copy to desktop assets |

---

## Blockers & Issues

| Issue | Impact | Proposed Solution | Status |
|-------|--------|-------------------|--------|
| No Apple Developer account | High | Distribute unsigned DMG with instructions | Noted |
| ~~Headless OpenCode mode unclear~~ | ~~Medium~~ | ~~Research OpenCode SDK capabilities~~ | ✅ Resolved |
| Electron bundle size (~150MB+) | Low | Acceptable for MVP, optimize later | Noted |
| Preload script module format | Low | Use CommonJS for Electron compatibility | ✅ Resolved |

---

## Learnings & Insights

### Desktop Phase 1 Development
- Vite + React + TypeScript + Tailwind is a great stack for Electron renderers
- Separate TypeScript configs needed for main, preload, and renderer
- The FlowState warm earthy color palette works well in a desktop context
- lucide-react provides excellent icons that match the design language

### Desktop Phase 2 Development
- **OpenCode SDK** (`@opencode-ai/sdk@1.1.20`) provides excellent TypeScript support
- `createOpencode()` spawns both server and client, returns typed client
- Preload scripts MUST use CommonJS (`module: "CommonJS"` in tsconfig)
- Event streaming via `client.event.subscribe()` returns an AsyncGenerator
- Session management is straightforward: `session.create()`, `session.prompt()`
- Zustand works great for React state management in Electron renderers
- IPC communication pattern: main process handles all SDK calls, renderer uses hooks

### Desktop Phase 3 Development
- **OAuth Flow**: Localhost server on port 3847 handles callbacks cleanly
- **Token Storage**: AES-256-GCM encryption with per-app master key works well
- **Credentials Modal**: Users need to provide their own OAuth client credentials
- **Event-driven OAuth**: Success/error events from main process to renderer
- **Google OAuth**: Requires Google Cloud Console setup with Desktop App type
- **Notion Auth**: Two paths - Internal Integration (simple token) or Public OAuth
- **Node.js Crypto**: Must use `require('crypto').randomBytes()` not Web Crypto API in Electron main
- **Modal Visibility**: Electron needs solid backdrop colors, not just opacity - use `backdrop-filter: blur()`

### Architecture Decisions Validated
- **Electron**: Successfully reusing TypeScript code and dependencies
- **Tailwind**: FlowState theme colors integrate seamlessly
- **Four-mode UI**: Clean separation of concerns, easy to extend
- **OpenCode SDK**: Headless mode works perfectly for desktop integration
- **Zustand**: Lightweight, simple state management for React
- **Encrypted Storage**: Node.js crypto module works well in Electron main process

---

## Resources

- [OpenCode Documentation](https://opencode.ai/docs/)
- [OpenCode Commands](https://opencode.ai/docs/commands/)
- [OpenCode Agent Skills](https://opencode.ai/docs/skills/)
- [OpenCode SDK Reference](https://opencode.ai/docs/sdk/)
- [Claude Cowork Reference](https://support.claude.com/en/articles/13345190-getting-started-with-cowork)
- [FlowState 1.0 (Design Reference)](https://github.com/lukebrevoort/flowstate)
- [Electron Documentation](https://www.electronjs.org/docs)
- [electron-builder](https://www.electron.build/)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)

---

## Next Session Goals

1. [ ] Test OAuth flow end-to-end with real Google credentials
2. [ ] Verify MCP servers connect successfully (check console logs)
3. [ ] Test Gmail tool calls through AI chat
4. [ ] Add MCP status display to Integrations UI
5. [ ] Handle MCP server failures gracefully

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 3 - MCP Debugging)

- ✅ Added comprehensive logging to `process-manager.ts` for MCP debugging
- ✅ Improved MCP path resolution with `getMcpPackagesDir()` method
- ✅ Fixed dev path when running from `dist/main`
- ✅ Added `verifyMcpServer()` to check if MCP server scripts exist before config
- ✅ Added `logMcpStatus()` to check MCP server status after OpenCode starts
- ✅ Added `getMcpStatus()` to expose MCP status via IPC
- ✅ Updated `reloadMcpConfig()` to use `mcp.add()` API for dynamic server management
- ✅ Added `mcp:status` IPC handler in `main/index.ts`
- ✅ Added `mcp` namespace to preload script with `reload()` and `status()` methods
- ✅ Added `McpServerStatus` type to `electron.d.ts`
- ✅ Verified Gmail MCP server starts correctly with environment variables
- ✅ **Fixed `invalid_request` errors in Gmail/GCal by cleaning up empty parameters**
- ✅ **Added `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to MCP environment for token refresh**
- ✅ **Added MCP transport logging to capture raw JSON-RPC traffic**
- ✅ **Added tool error formatting to surface Google API errors**
- ✅ All MCP servers rebuilt (gmail, gcal, notion, system)
- ✅ All desktop builds passing (main, preload, renderer)

**Key Changes:**
- MCP servers now log raw inbound JSON-RPC messages for debugging
- Tool calls log their arguments before execution
- Tool errors include HTTP status and response body when available
- MCP servers now receive tokens AND client credentials via environment variables
- API calls now filter out empty query strings and empty arrays to prevent API errors
- Process manager handles `dist/main` paths when running built main
- MCP status is checked 2 seconds after OpenCode starts
- Failed MCP servers are logged with their error messages
- `mcp.add()` API is used for dynamic MCP server management after OAuth completion

**Files Modified:**
```
packages/desktop/src/
├── main/
│   ├── index.ts                    # Added mcp:status IPC handler
│   └── process-manager.ts          # Complete MCP debugging overhaul
├── preload/
│   └── index.ts                    # Added mcp namespace
└── renderer/
    └── types/
        └── electron.d.ts           # Added McpServerStatus, mcp API types

packages/mcp-gmail/src/
├── index.ts                        # Added transport logging for MCP traffic
└── tools/index.ts                  # Added tool call logging + error formatting

packages/mcp-gcal/src/
├── index.ts                        # Added transport logging for MCP traffic
└── tools/index.ts                  # Added tool call logging + error formatting
```

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 2)

- ✅ Fixed modal transparency issue - added `fs-modal-overlay` CSS class with solid backdrop
- ✅ Fixed `crypto is not defined` error - use Node.js `crypto.randomBytes()` instead of Web Crypto API
- ✅ Redesigned Notion auth to support both Internal Integration (API token) and Public OAuth
- ✅ Added `AuthMethod` type (`'oauth' | 'api_token'`) throughout the system
- ✅ Created `AuthMethodSelector` component for choosing connection method
- ✅ Created separate `OAuthForm` and `ApiTokenForm` components
- ✅ Added `storeApiToken` IPC handler for direct token storage
- ✅ Updated `integrationsStore` with `authOptions` array per integration
- ✅ Added `flowstate-card` and `flowstate-overlay` colors to Tailwind config
- ✅ All builds passing (main, preload, renderer)

**Key Changes:**
- Notion now shows two options: "Internal Integration" (simple token) or "Public OAuth"
- Google services (Gmail, Calendar) only show OAuth option
- Modal is now properly visible with solid backdrop and blur effect
- Each integration tracks which auth method was used (`activeAuthMethod`)

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 1)

- ✅ Created `auth-manager.ts` with AES-256-GCM encrypted token storage
- ✅ Created `oauth-server.ts` with localhost callback server (port 3847)
- ✅ Created `integrationsStore.ts` Zustand store for integration state
- ✅ Updated `electron.d.ts` with expanded auth/OAuth types
- ✅ Updated `preload/index.ts` with new IPC methods for auth/OAuth
- ✅ Wired IPC handlers in `main/index.ts` for auth-manager and oauth-server
- ✅ Updated `IntegrationsMode.tsx` with real store data and credentials modal
- ✅ Added setup instructions for Google Cloud Console and Notion

**Files Created/Modified:**
```
packages/desktop/src/
├── main/
│   ├── index.ts                    # Added auth/OAuth IPC handlers
│   ├── auth-manager.ts             # Encrypted token storage (with authMethod)
│   └── oauth-server.ts             # OAuth callback server (fixed crypto)
├── preload/
│   └── index.ts                    # Added auth/OAuth + API token IPC methods
└── renderer/
    ├── stores/
    │   └── integrationsStore.ts    # Integration state with authOptions
    ├── styles/
    │   └── globals.css             # Added fs-modal-overlay, fs-modal classes
    ├── types/
    │   └── electron.d.ts           # Added AuthMethod, ApiTokenCredentials types
    └── modes/
        └── IntegrationsMode.tsx    # Complete rewrite with auth method selection
```

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 2)

- ✅ Updated `@opencode-ai/sdk` to version 1.1.20
- ✅ Rewrote `process-manager.ts` with correct SDK API usage
- ✅ Fixed preload script to use CommonJS module format
- ✅ Wired all IPC handlers to ConfigStore and ProcessManager
- ✅ Created `chatStore.ts` Zustand store for chat state
- ✅ Created `configStore.ts` Zustand store for config state
- ✅ Created `useOpenCode.ts` hook for OpenCode communication
- ✅ Created `useConfig.ts` hook for configuration management
- ✅ Updated `ChatMode.tsx` with real OpenCode integration
- ✅ Added code block formatting for AI responses
- ✅ Updated TypeScript types in `electron.d.ts`
- ✅ Tested end-to-end chat flow with Electron MCP
- ✅ Verified AI responses work (jokes, code generation)
- ✅ OpenCode server starts automatically on app launch
- ✅ Event streaming from main to renderer working

---

## Tasks Completed (Jan 13, 2026 - Desktop Phase 1)

- ✅ Created `packages/desktop/` package structure
- ✅ Set up Electron + React + TypeScript + Tailwind
- ✅ Created Electron main process with macOS window management
- ✅ Created preload script with secure contextBridge API
- ✅ Created React renderer with Vite bundler
- ✅ Ported FlowState theme colors to Tailwind config
- ✅ Created TitleBar component (macOS style)
- ✅ Created TabBar component (mode selector)
- ✅ Created Sidebar component (recent convos, pinned workflows, running tasks)
- ✅ Created ChatMode component (message UI with streaming placeholder)
- ✅ Created TasksMode component (running/completed tasks view)
- ✅ Created WorkflowsMode component (workflow browser)
- ✅ Created IntegrationsMode component (OAuth connections)
- ✅ Configured electron-builder for macOS packaging
- ✅ Successfully built all three compilation targets (main, preload, renderer)

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 4 - Chat UX Polish)
**Timestamp**: Jan 14, 2026 21:35
**TASKS COMPLETED**
- ✅ Added FlowState Pulse and Live Activity panels so the chat surface now exposes OpenCode status, MCP health, and recent events while the assistant thinks.
- ✅ Hooked ChatMode into config + MCP APIs and OpenCode events so activity hints, MCP badges, and event summaries surface more context for Google MCPs.
- ✅ Enriched assistant message cards and loading placeholders with parts badges, dynamic hint text, and richer copy to show more of the reasoning journey.
**IN PROGRESS**
- [ ] Phase 4 prep: Draft the onboarding/wow flow, provider selector, and UX polish that kick off the next phase.
**BLOCKERS**
- None

---

## Tasks Completed (Feb 7, 2026 - Phase 5 & 5.5 Status Update)
**Timestamp**: Feb 7, 2026 21:15

**SUMMARY**
- ✅ Analyzed Phase 5 and Phase 5.5 implementation status against PLAN.md
- ✅ Verified all 12 Phase 5.5 (Inline Approvals) PM tasks are marked SUCCESS
- ✅ Verified Phase 5 (Workflows + Commands) features are implemented in code:
  - Task created immediately on workflow start (`workflows-runner.ts` line 396-412)
  - WorkflowRuns + artifacts persisted in SQLite (`workflow-run-store.ts`)
  - Workflow run history with last N runs visible in UI
  - Dedicated OpenCode sessions via `createDetachedSession()`
  - Pin limit enforcement (3 max) via `PinnedWorkflowsLimitError`
  - WorkflowDetailsDrawer with Always Approve toggle
  - Workflows vs Commands separation ready via `allowlistedGlobalCommands` hook
- ✅ Updated PLAN.md to mark Phases 5 and 5.5 as COMPLETE
- ✅ Fixed TypeScript lint errors (unused imports in timeline-normalizer.ts and AssistantMarkdown.tsx)
- ✅ Verified desktop build passes

**KEY FINDINGS**
- Phase 5 was largely complete in code but PLAN.md checkboxes weren't updated
- The "Workflows vs Commands" separation is architecturally complete (allowlist hook exists)
- Global commands (like `tdd`) aren't shown by design; when needed, add to `allowlistedGlobalCommands`
- Phase 5.5 approvals system fully implemented with security hardening, full payloads, and state machine tests

**IN PROGRESS**
- [x] Phase 5 complete
- [x] Phase 5.5 complete
- [ ] Phase 6: Onboarding + UX Polish (next)

**NEXT STEPS**
- Begin Phase 6: tighten onboarding → integrations handshake, add missing UI wiring
- Consider adding specific global commands to allowlist (e.g., `tdd`, `debug`) if desired
- Run `pnpm dev:desktop` to manually test workflow flows

**NEXT STEPS**
- Re-check the chat layout after any new MCP additions and continue Phase 4 onboarding work.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 6 - Chat Welcome Cleanup)
**Timestamp**: Jan 14, 2026 22:25
**TASKS COMPLETED**
- ✅ Removed the initial FlowState welcome message so the chat history starts clean after onboarding and no longer overflows into the composer.
**IN PROGRESS**
- [ ] Phase 4 prep: Draft the onboarding/wow flow, provider selector, and UX polish that kick off the next phase.
**BLOCKERS**
- None
**NEXT STEPS**
- Verify the chat input area stays clear across empty-state scenarios and continue Phase 4 onboarding work.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 7 - Empty Message Guard)
**Timestamp**: Jan 14, 2026 22:35
**TASKS COMPLETED**
- ✅ Filtered empty assistant messages (no content or parts) so blank chat bubbles no longer render after onboarding.
**IN PROGRESS**
- [ ] Phase 4 prep: Draft the onboarding/wow flow, provider selector, and UX polish that kick off the next phase.
**BLOCKERS**
- None
**NEXT STEPS**
- Verify chat history remains clean after session switches and continue Phase 4 onboarding work.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 8 - Desktop Dev Shortcut)
**Timestamp**: Jan 14, 2026 22:45
**TASKS COMPLETED**
- ✅ Added a root-level `dev:desktop` script to start the desktop main watcher, renderer dev server, and Electron in one command.
**IN PROGRESS**
- [ ] Phase 4 prep: Draft the onboarding/wow flow, provider selector, and UX polish that kick off the next phase.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` to validate the single-command startup and continue Phase 4 onboarding work.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 9 - Chat Store Hotfix)
**Timestamp**: Jan 14, 2026 22:55
**TASKS COMPLETED**
- ✅ Fixed chat store initialization to remove the orphaned `welcomeMessage` reference so the app renders without a runtime crash.
**IN PROGRESS**
- [ ] Phase 4 prep: Draft the onboarding/wow flow, provider selector, and UX polish that kick off the next phase.
**BLOCKERS**
- None
**NEXT STEPS**
- Restart the renderer and confirm the chat view loads cleanly.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 10 - Thinking Carousel)
**Timestamp**: Jan 14, 2026 23:20
**TASKS COMPLETED**
- ✅ Added a centralized Activity Carousel that appears only while OpenCode is thinking and fades away once the response is ready.
- ✅ Implemented an OpenCode event translator to convert raw events into human-readable phases/tool steps and suppress JSON payloads.
- ✅ Removed the old Live Activity feed to avoid dumping raw event blobs into the UI.
**IN PROGRESS**
- [ ] Phase 4 prep: Draft the onboarding/wow flow, provider selector, and UX polish that kick off the next phase.
**BLOCKERS**
- None
**NEXT STEPS**
- Run the desktop app and confirm the carousel cycles through steps during tool calls.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3 Session 11 - Streaming Message Animation)
**Timestamp**: Jan 14, 2026 23:45
**TASKS COMPLETED**
- ✅ Added a streaming-style animation for assistant responses so messages reveal progressively and feel real-time like Claude.
- ✅ Ensured formatted content and tool part badges appear after the animation completes.
**IN PROGRESS**
- [ ] Phase 4 prep: Draft the onboarding/wow flow, provider selector, and UX polish that kick off the next phase.
**BLOCKERS**
- None
**NEXT STEPS**
- Run another chat prompt to confirm the streaming effect feels smooth and readable.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3.5 Session 1 - Mockup Parity UI)
**Timestamp**: Jan 14, 2026 23:59
**TASKS COMPLETED**
- ✅ Rebuilt the desktop renderer shell to match the `appmockup/` navigation flow (home-first, toggleable sidebar, page pills, zen background).
- ✅ Ported mockup theme tokens and zen garden animations into the renderer styles, with reduced-motion support.
- ✅ Re-skinned Chat, Tasks, and Workflows screens to match the mockup layout while keeping OpenCode chat logic intact.
- ✅ Added new UI primitives for approval cards and task handoff messaging to support upcoming long-running task UX.
- ✅ Added a conversation sidebar with title search and recent thread switching tied to OpenCode sessions.
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Validate the new UI in the desktop app and start wiring approval/task UI into real state sources.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 2 - Build Fixes)
**Timestamp**: Jan 15, 2026 00:20
**TASKS COMPLETED**
- ✅ Fixed Tailwind `@apply` errors by removing unsupported opacity utilities from shared component styles.
- ✅ Verified desktop build succeeds (`pnpm -C packages/desktop run build`).
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run the desktop UI to spot any layout regressions from the Tailwind token changes.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 3 - Tailwind Base Fix)
**Timestamp**: Jan 15, 2026 00:28
**TASKS COMPLETED**
- ✅ Removed `@apply border-border` from the base layer and set `border-color` directly to avoid Tailwind class resolution errors.
- ✅ Verified renderer build succeeds (`pnpm -C packages/desktop run build:renderer`).
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Re-run `pnpm dev:desktop` to confirm the runtime UI loads without Tailwind CSS errors.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 4 - Tailwind Token Fix)
**Timestamp**: Jan 15, 2026 00:36
**TASKS COMPLETED**
- ✅ Removed `bg-background`/`text-foreground` `@apply` usage and replaced with explicit CSS variables in the base layer.
- ✅ Replaced semantic badge opacity utilities with fixed RGBA backgrounds to keep Tailwind `@apply` happy.
- ✅ Verified renderer build succeeds (`pnpm -C packages/desktop run build:renderer`).
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Re-run `pnpm dev:desktop` and confirm Vite no longer reports missing utility classes.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 5 - Tailwind Apply Cleanup)
**Timestamp**: Jan 15, 2026 00:44
**TASKS COMPLETED**
- ✅ Removed custom-token `@apply` usage for `bg-card`, `border-border`, `text-muted-foreground`, and related utilities in shared component styles.
- ✅ Replaced component color styling with explicit CSS variable assignments to avoid missing Tailwind utility errors.
- ✅ Verified renderer build succeeds (`pnpm -C packages/desktop run build:renderer`).
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Re-run `pnpm dev:desktop` and confirm Vite no longer reports missing utility classes.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 6 - UI Polish Pass)
**Timestamp**: Jan 15, 2026 01:05
**TASKS COMPLETED**
- ✅ Replaced the header and sidebar logos with the FlowState mark and adjusted titlebar padding to clear macOS window controls.
- ✅ Added ambient gradient drift + slowed zen garden animations for a calmer moving background.
- ✅ Smoothed hover/transition timings across navigation, sidebar, tasks, and workflows.
- ✅ Added proper padding + max-width layout to the Integrations page.
- ✅ Verified renderer build succeeds (`pnpm -C packages/desktop run build:renderer`).
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` to validate the refined UI motion and spacing.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 7 - Motion & Navigation Polish)
**Timestamp**: Jan 15, 2026 01:32
**TASKS COMPLETED**
- ✅ Lowered the titlebar controls to clear macOS window buttons and added the FlowState logo asset in the header + sidebar.
- ✅ Softened sidebar presentation with floating panel styling and eased transitions.
- ✅ Added ambient background drift and pulse-ring treatment for the status widget.
- ✅ Slowed hover/transition timings across navigation pills, cards, and buttons for smoother motion.
- ✅ Added extra padding and narrower max-width to the Integrations page.
- ✅ Verified renderer build succeeds (`pnpm -C packages/desktop run build:renderer`).
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Re-run `pnpm dev:desktop` and check the updated navigation + pulse feel against the mockup.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 8 - Figma Motion Pass)
**Timestamp**: Jan 15, 2026 01:53
**TASKS COMPLETED**
- ✅ Dropped the titlebar controls further and shifted main content when the sidebar opens for a softer reveal.
- ✅ Refined navigation pills and sidebar hover behavior with longer easing.
- ✅ Added ambient background drift and pulse-ring animation to deepen background motion.
- ✅ Increased spacing for the Integrations page layout.
- ✅ Verified renderer build succeeds (`pnpm -C packages/desktop run build:renderer`).
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` to confirm the updated motion matches the mockup feel.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 9 - Theme & Motion Alignment)
**Timestamp**: Jan 15, 2026 02:10
**TASKS COMPLETED**
- ✅ Synced desktop theme tokens with the `appmockup` palette, including corrected secondary color and brand variables.
- ✅ Slowed interaction transitions across app surfaces with smoother easing for a less snappy feel.
- ✅ Updated the navigation pill colors to match the mockup (active indicator + hover styling).
- ✅ Verified renderer build succeeds (`pnpm -C packages/desktop run build:renderer`).
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` and compare navigation/pulse colors against the mockup.


---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3.5 Session 10 - Remove Reduced Motion Toggle)
**Timestamp**: Jan 14, 2026 19:40
**TASKS COMPLETED**
- ✅ Removed the reduced motion toggle UI and state from desktop settings to keep animations active.
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Re-run `pnpm dev:desktop` and verify animations now play without reduced-motion gating.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3.5 Session 11 - Tailwind Motion Cleanup)
**Timestamp**: Jan 14, 2026 20:05
**TASKS COMPLETED**
- ✅ Replaced nonstandard `duration-800`/`duration-900` classes with valid `duration-700` utilities across the renderer.
- ✅ Removed custom cubic-bezier easing utilities in favor of `ease-in-out` for consistent motion.
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` and confirm motion feels smoother without invalid utilities.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3.5 Session 12 - Screen Fade-Up Transition)
**Timestamp**: Jan 14, 2026 20:22
**TASKS COMPLETED**
- ✅ Added a reusable page fade-up animation utility for screen transitions.
- ✅ Applied the fade-up animation when switching between primary screens.
- ✅ Tuned the page transition to a slower, opacity-only fade for better alignment across layouts.
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` and validate screen transitions feel smooth.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3.5 Session 13 - Chat Scroll Fix)
**Timestamp**: Jan 14, 2026 20:34
**TASKS COMPLETED**
- ✅ Ensured the chat message list fills available height so scroll works correctly.
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` and confirm chat history scrolls as expected.

---

## Tasks Completed (Jan 14, 2026 - Desktop Phase 3.5 Session 14 - Chat Status Center)
**Timestamp**: Jan 14, 2026 20:52
**TASKS COMPLETED**
- ✅ Enlarged and centered the chat status avatar inside the floating info card.
- ✅ Surface the current status label and activity detail beneath the avatar for better readability.
- ✅ Shifted the OpenCode/provider info into a centered stack beneath the avatar for balance.
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` and confirm the updated chat header feels cohesive.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 15 - Chat Header Layout)
**Timestamp**: Jan 15, 2026 01:02
**TASKS COMPLETED**
- ✅ Positioned the OpenCode/provider callouts as an absolute badge in the top-right of the chat info card to keep the central avatar undistracted.
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` and ensure the floating info card still feels balanced with the new badge.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 3.5 Session 16 - Chat Header Centering)
**Timestamp**: Jan 15, 2026 01:12
**TASKS COMPLETED**
- ✅ Reapplied the absolute OpenCode/provider badge and centered the larger avatar/status block to align with the floating area layout after the rollback.
**IN PROGRESS**
- [ ] Phase 3.5 follow-through: wire approval/task UI to real task state and begin adding real handoff events.
**BLOCKERS**
- None
**NEXT STEPS**
- Run `pnpm dev:desktop` and confirm the chat header layers look stable again.

---

## Tasks Completed (Jan 15, 2026 - Desktop Phase 4 Session 2 - Providers + Connect CTA)
**Timestamp**: Jan 15, 2026 11:35
**TASKS COMPLETED**
- ✅ Refined secondary button styling and swapped onboarding secondary CTAs to ghost buttons for cleaner contrast.
- ✅ Added provider + model selection sourced from `opencode models`, plus model dropdowns and provider setup CTA in onboarding.
- ✅ Introduced provider/auth helper data (`providerData.ts`, `providerAuth.ts`) and new provider state store for model persistence.
- ✅ Wired onboarding connect buttons to open the existing Integrations modal via shared store flagging.
- ✅ Added terminal-based OpenCode auth launcher and Settings debug option to reset onboarding.
- ✅ Fixed Integrations update loop by removing unstable hook dependencies.
- ✅ Added fallback + terminal launch guard when `openTerminal` is missing in renderer.
- ✅ Wired headless OpenCode to use persisted `provider.default` model and restart after onboarding.
- ✅ Reverted priming and instead inject FlowState system prompt per message to avoid developer-mode responses.
**IN PROGRESS**
- [ ] Phase 4: integrate OpenCode provider auth UI (embedded vs external) and finalize approvals/tasks polish.
**BLOCKERS**
- None
**NEXT STEPS**
- Rebuild/restart the desktop app so the preload + headless model changes take effect.

## Tasks Completed (Jan 15, 2026 - Desktop Phase 4 Session 3 - Timeline + Gmail Efficiency)
**Timestamp**: Jan 15, 2026 14:10
**TASKS COMPLETED**
- ✅ Added timeline storage foundation (`timeline-types.ts`, `timeline-store.ts`) with SQLite metadata + blob storage for large payloads.
- ✅ Implemented OpenCode timeline normalization + redaction (`timeline-normalizer.ts`) and wired event persistence from the OpenCode event stream.
- ✅ Added timeline IPC endpoints + preload API (`timeline:list`, `timeline:payload`, `timeline:event`) for renderer consumption.
- ✅ Introduced Gmail MCP efficiency upgrades: metadata-first list/search/read, new `gmail_get_thread`, default body truncation, and HTML stripping toggle.
- ✅ Added in-memory LRU caches for Gmail messages + threads to reduce repeat fetch cost.
- ✅ Fixed ChatMode overflow by confining scroll to the message list and preserving the header/composer layout for long conversations.
**IN PROGRESS**
- [ ] Render timeline events in Chat/Tasks UI and add approval cards inline.
- [ ] Add developer-mode payload viewer (redacted) + debug bundle export.
**BLOCKERS**
- None
**NEXT STEPS**
- Build Activity Timeline component and wire it to `chatStore.timeline`.
- Update agent/workflow prompts to use metadata-first Gmail tools.
- Run `pnpm -C packages/desktop run build` and `pnpm -C packages/mcp-gmail run build` to validate.

## Tasks Completed (Jan 15, 2026 - Desktop Phase 4 Session 4 - Timeline UI + Task Promotion Spec)
**Timestamp**: Jan 15, 2026 15:30
**TASKS COMPLETED**
- ✅ Added Activity Timeline component and surfaced it in Chat + Tasks UI with collapsed/expanded behavior.
- ✅ Removed "Keep in Chat" from Task handoff; Chat now only offers "View Task".
- ✅ Began wiring timeline events to chat store and session switching so activity persists across sessions.
- ✅ Defined hybrid task promotion rules and timeline-derived summary behavior in PLAN.md.
- ✅ Tasks page now derives progress from timeline steps and shows inline timeline details.
**IN PROGRESS**
- [ ] Replace sample task data in TasksMode with real task store + taskId routing.
- [ ] Emit explicit `task.promoted` events from OpenCode/agent to drive task handoff.
- [ ] Generate final summary message from timeline on task completion.
**BLOCKERS**
- None
**NEXT STEPS**
- Implement task store + routing for running tasks and details.
- Wire approvals into timeline and Task detail view.
- Run desktop build to validate component wiring.

## Tasks Completed (Jan 15, 2026 - Desktop Phase 4 Session 5 - Task MVP + Timeline Wiring)
**Timestamp**: Jan 15, 2026 16:40
**TASKS COMPLETED**
- ✅ Added MVP constraint: one active task per session and documented in PLAN.
- ✅ Introduced `activeTask` state (task run tracking) and progress updates derived from timeline events.
- ✅ Added summary injection: task summary becomes the last assistant message once `Task summary` arrives.
- ✅ Wired Tasks view to live timeline/active task and removed sample-only running tasks.
- ✅ Added `task.completed`/`task.summary` normalization support for task lifecycle events.
- ✅ Builds passed (`pnpm -C packages/desktop run build`, `pnpm -C packages/mcp-gmail run build`).
**IN PROGRESS**
- [ ] Emit `task.promoted` / `task.completed` / `task.summary` events from agent execution.
- [ ] Replace remaining mock approvals with real approval data.
**BLOCKERS**
- None
**NEXT STEPS**
- Connect OpenCode agent output to task lifecycle events.
- Finalize task detail routing + run detail view.
- Replace sample approvals with real approval payloads.

## Tasks Completed (Jan 15, 2026 - Desktop Phase 4 Session 6 - Native Module Fix)
**Timestamp**: Jan 15, 2026 16:55
**TASKS COMPLETED**
- ✅ Rebuilt `better-sqlite3` against Electron using `@electron/rebuild` to resolve NODE_MODULE_VERSION mismatch.
- ✅ Desktop + Gmail MCP builds passed after native module rebuild.
**IN PROGRESS**
- [ ] Emit `task.promoted` / `task.completed` / `task.summary` events from agent execution.
- [ ] Replace remaining mock approvals with real approval data.
**BLOCKERS**
- None
**NEXT STEPS**
- Add an Electron rebuild step to the dev flow or a script for repeatability.
- Continue task lifecycle event wiring.

## Tasks Completed (Jan 16, 2026 - Desktop Phase 4 Session 13 - Task Timeline Cleanup)
**Timestamp**: Jan 16, 2026 11:05
**TASKS COMPLETED**
- ✅ Reordered task timelines so the newest entries appear first and deduped repeated status rows for a shorter activity feed.
- ✅ Capped expanded timelines to keep the UI focused and updated the task status icon to show completion states.
- ✅ Desktop build passes (`pnpm -C packages/desktop run build`).
**IN PROGRESS**
- [ ] Emit explicit task lifecycle events from the agent execution pipeline.
- [ ] Replace remaining mock approvals with real approval execution (approve/deny handlers).
**BLOCKERS**
- None
**NEXT STEPS**
- Wire approve/deny IPC handlers into Tasks approvals.
- Run the desktop app and verify the activity timeline shows newest items at the top.

## Tasks Completed (Jan 20, 2026 - Agent Model & Naming Fix)
**Timestamp**: Jan 20, 2026 23:45

**ISSUES DIAGNOSED:**
1. **Invalid model configured**: `opencode/zen` not a valid OpenCode model
2. **Agent name conflict**: FlowState's "flowstate" agent was conflicting with global "Developer" agent
3. **Rate limiting**: Global Developer agent using `github-copilot/claude-opus-4.5` was rate-limited

**ROOT CAUSE:**
- Global OpenCode config (`~/.config/opencode/opencode.json`) has a "developer" agent marked as `mode: primary` with model `github-copilot/claude-opus-4.5`
- FlowState's agent in `.opencode/agent/flowstate.md` was also marked as `mode: primary` with name "flowstate"
- OpenCode was defaulting to the global "Developer" agent instead of FlowState's agent
- Additionally, the agent YAML files had `model: opencode/zen` which is invalid

**FIXES APPLIED:**

1. **Updated agent model configurations** (line 5 in each file):
   ```
   .opencode/agent/flowstate.md:     model: opencode/zen → opencode/grok-code
   .opencode/agent/scheduler.md:     model: opencode/zen → opencode/grok-code
   .opencode/agent/organizer.md:     model: opencode/zen → opencode/grok-code
   .opencode/agent/communicator.md:  model: opencode/zen → opencode/grok-code
   .opencode/agent/executor.md:      model: opencode/zen → opencode/grok-code
   ```

2. **Renamed FlowState's agent to avoid conflict**:
   ```
   .opencode/agent/flowstate.md: name: flowstate → flowstate-assistant
   agents/flowstate.md: name: flowstate → flowstate-assistant
   agents/flowstate.md: model: opencode/glm-4.7-free → opencode/grok-code
   ```

3. **Updated default provider in config files**:
   ```
   flowstate.config.json: defaultProvider: opencode/zen → opencode/grok-code
   packages/core/src/memory/index.ts: defaultLLMProvider: 'opencode/zen' → 'opencode/grok-code'
   packages/desktop/src/main/config-store.ts: default: 'opencode/zen' → 'opencode/grok-code'
   ```

**VALID OPENCODE MODELS:**
- ✅ `opencode/grok-code` (recommended)
- ✅ `opencode/gpt-5-nano`
- ✅ `opencode/glm-4.7-free`
- ✅ `opencode/minimax-m2.1-free` (for subagents)

**FILES MODIFIED:**
```
.opencode/agent/
├── flowstate.md              # Renamed to flowstate-assistant, fixed model
├── scheduler.md              # Fixed model
├── organizer.md              # Fixed model
├── communicator.md           # Fixed model
└── executor.md               # Fixed model

agents/
└── flowstate.md              # Renamed to flowstate-assistant, fixed model

flowstate.config.json         # Fixed defaultProvider
packages/core/src/memory/index.ts  # Fixed defaultLLMProvider
packages/desktop/src/main/config-store.ts  # Fixed default model
```

**TASKS COMPLETED:**
- ✅ Identified invalid model configuration in agent YAML files
- ✅ Fixed all 5 agent files to use valid model (opencode/grok-code)
- ✅ Renamed "flowstate" agent to "flowstate-assistant" to avoid global conflict
- ✅ Updated default provider in all config files
- ✅ Verified subagents already use valid models (opencode/minimax-m2.1-free)

**IN PROGRESS**
- [ ] Test agent selection after restart

**NEXT STEPS**
- Restart desktop app to apply all changes
- Verify FlowState agent is now being used instead of Developer agent
- Test message sending to confirm agent responds

---

## Tasks Completed (Jan 20, 2026 - Model Configuration Fix)
**Timestamp**: Jan 20, 2026 22:45

**ISSUES FIXED:**
1. **Canvas MCP not showing in OpenCode Session**
   - Added `flowstate-canvas` MCP configuration to `opencode.json`
   - Added Canvas MCP configuration to `process-manager.ts` `buildMcpConfig()` method
   - Updated auth manager to store Canvas API URL alongside API token

2. **Chat messages rendering blank**
   - Fixed duplicate import in `useIntegrations.ts`
   - Added `CanvasApiTokenForm` component with Canvas URL + token fields
   - Updated auth manager `AuthToken` interface to support `additionalData` for Canvas API URL
   - Updated `storeApiToken` to accept optional `additionalData` parameter
   - Updated `process-manager.ts` to pass Canvas API URL as environment variable
   - **Fixed blank messages**: Ensured all assistant messages have non-empty content by adding space fallback (`textContent || ' '`) in `streamMessage()`, `sendMessage()`, and `getSessionMessages()` methods

3. **Canvas integration form**
   - Created `CanvasApiTokenForm` component with Canvas URL and API token fields
   - Updated `ConnectionModal` to use Canvas-specific form for Canvas integration
   - Updated `handleApiTokenSubmit` to pass additional data (canvasApiUrl)
   - Fixed type signatures for `onOAuthSubmit` and `onApiTokenSubmit` callbacks

4. **Canvas API URL not being stored (ROOT CAUSE)**
   - **Found the bug**: The preload script's `storeApiToken` only accepted 2 parameters (service, apiToken) but the Canvas integration needed 3 (including `additionalData` with `canvasApiUrl`)
   - Fixed preload script to accept and pass `additionalData` parameter
   - Now Canvas API URL is properly stored and passed to MCP server environment

**FILES MODIFIED:**
```
opencode.json                              # Added flowstate-canvas MCP config
packages/desktop/src/
├── main/
│   ├── index.ts                            # Updated storeApiToken IPC handler
│   ├── auth-manager.ts                     # Added additionalData support to AuthToken
│   └── process-manager.ts                  # Added Canvas MCP config, fixed blank messages
├── preload/
│   └── index.ts                            # Fixed storeApiToken to accept additionalData
├── renderer/
│   ├── hooks/
│   │   └── useIntegrations.ts              # Fixed duplicate import, added additionalData param
│   ├── modes/
│   │   └── IntegrationsMode.tsx            # Added CanvasApiTokenForm, updated ConnectionModal
│   └── types/
│       └── electron.d.ts                   # Updated storeApiToken type signature
```

**IN PROGRESS**
- [ ] Test Canvas LMS integration end-to-end
- [ ] Verify MCP server connects and tools are available

**NEXT STEPS**
- Restart the desktop app to apply all fixes
- Test Canvas integration by connecting with API token and URL
- Verify chat messages render correctly
**Timestamp**: Jan 20, 2026 22:26

**TASKS COMPLETED**
- ✅ Pulled Canvas MCP feature from Notion Project Database
- ✅ Created `feature/canvas-mcp` branch from main
- ✅ Built `@flowstate/mcp-canvas` package with 11 Canvas LMS tools
- ✅ Implemented Canvas LMS API client with full type definitions
- ✅ Added tools for: courses, assignments, grades, announcements, modules, calendar
- ✅ Created comprehensive README with setup instructions
- ✅ Created PR #1: https://github.com/lukebrevoort/OpenFlowState/pull/1
- ✅ Researched existing Canvas MCP implementations (vishalsachdev/canvas-mcp)
- ✅ Updated Notion task status to "In progress" with PR link

**IN PROGRESS**
- [ ] Add comprehensive test suite for Canvas MCP tools
- [ ] Update onboarding flow to include Canvas integration
- [ ] Create OpenCode skill for study strategy recommendations

**BLOCKERS**
- None

**NEXT STEPS**
- Add peer review and rubric tools based on research
- Consider adding FERPA-compliant anonymization for educator use cases
- Add caching layer for performance optimization
- Create study planning skill that leverages Canvas data

**Research Insights:**
- Existing implementations support 80+ tools (we have 11 core tools)
- FERPA compliance is important for educator use cases
- Code execution patterns can save 99.7% tokens on bulk operations
- Peer review management is a key student workflow

*Update this document after each development session.*

---

## Tasks Completed (Jan 20, 2026 - Debug Message Flow)
**Timestamp**: Jan 20, 2026 23:55

**TASKS COMPLETED:**
- ✅ Added debugging logs to `process-manager.ts` sendMessage() method to trace prompt results
- ✅ Added debugging logs to `useOpenCode.ts` to trace message reception in renderer
- ✅ Rebuilt desktop package successfully

**DEBUGGING ADDED:**
```
Main Process (process-manager.ts):
- Log when prompt result is received
- Log if there's an error in prompt result
- Log number of response parts
- Log response text length and preview

Renderer (useOpenCode.ts):
- Log message ID, role, and content length when received
- Log number of message parts
- Log OpenCode errors
```

**IN PROGRESS**
- [ ] Test agent response with new debugging logs
- [ ] Identify where the message flow is breaking

**NEXT STEPS**
- Run `pnpm dev:desktop` to start the app with debugging enabled
- Send a test message and check console logs for:
  - "[ProcessManager] Prompt result received: YES/NO"
  - "[ProcessManager] Response text length: X"
  - "[Renderer] Received message: ..."

---

## Tasks Completed (Jan 24, 2026 - Settings + Error Surfacing)
**Timestamp**: Jan 24, 2026 14:30

**TASKS COMPLETED**
- ✅ Wired Settings to persisted config for provider/model/timezone and API keys, with OpenCode restart on changes.
- ✅ Replaced hardcoded model options with provider definitions to ensure valid model IDs.
- ✅ Added structured OpenCode error payloads and improved user-facing error messaging in chat.

**IN PROGRESS**
- [ ] Validate provider/model switching and error banners in the desktop app.

**BLOCKERS**
- None

**NEXT STEPS**
- Run `pnpm dev:desktop` to verify Settings changes restart OpenCode with new models.
- Trigger a model-not-available error to confirm user-facing copy shows model/provider details.

---

## Tasks Completed (Jan 24, 2026 - Runtime Model Sync)
**Timestamp**: Jan 24, 2026 15:20

**TASKS COMPLETED**
- ✅ Added OpenCode model discovery via `opencode models` and surfaced results in Settings.
- ✅ Simplified Settings to a single model text input with validation against registered models.
- ✅ Synced agent/config model files on OpenCode start so runtime model changes take effect.

**IN PROGRESS**
- [ ] Validate model changes update `.opencode` and runtime agent selection without errors.

**BLOCKERS**
- None

**NEXT STEPS**
- Run `pnpm dev:desktop` and save a new model to confirm agent files update before restart.
- Swap to a deliberately invalid model and confirm the Settings warning prevents save.

---

## Tasks Completed (Jan 23, 2026 - OpenCode Silent Failure Fix)
**Timestamp**: Jan 23, 2026 10:30

**TASKS COMPLETED**
- ✅ Fixed TUI agent selection by updating `start:tui` to use `flowstate-assistant`.
- ✅ Forced Desktop OpenCode prompts to use `flowstate-assistant` so sessions no longer fall back to a global default agent/model.
- ✅ Surfaced OpenCode `session.*` retry states as timeline errors so rate limits/quota issues are visible instead of looking like a hang.

**IN PROGRESS**
- [ ] Validate on OpenCode v1.1.34 with both TUI and Desktop flows.

**BLOCKERS**
- None

**NEXT STEPS**
- Run `pnpm dev:desktop` and send a simple prompt ("hello") to confirm responses return.
- Run `pnpm start:tui` and confirm the FlowState agent is selected.

---

## Tasks Completed (Jan 23, 2026 - Duplicate Messages + Task Promotion Fix)
**Timestamp**: Jan 23, 2026 11:10

**TASKS COMPLETED**
- ✅ Stopped auto-promoting every chat request into a Task (only emit task lifecycle events if promotion criteria was met).
- ✅ Removed timeline-derived task summary injection into chat to prevent duplicate assistant messages (and truncation).
- ✅ Added defensive message de-duping by message id in the chat store.
- ✅ Adjusted Tasks screen so completed tasks no longer remain in the "Active Task" card.

**IN PROGRESS**
- [ ] Validate behavior on both a fast chat prompt and a long-running MCP/tool prompt.

**BLOCKERS**
- None

**NEXT STEPS**
- Send "hello" and confirm: one assistant message, no task handoff.
- Trigger a tool-heavy request and confirm: task handoff appears only when promoted.

---

## Tasks Completed (Jan 25, 2026 - Chat Alignment + Thinking Indicator)
**Timestamp**: Jan 25, 2026 19:05

**TASKS COMPLETED**
- ✅ Right-aligned the chat layout to avoid the condensed/centered column.
- ✅ Added a chat-level thinking indicator for in-progress responses.
- ✅ Prevented message typing animation from replaying on tab switches.

**IN PROGRESS**
- [ ] Validate chat alignment and thinking indicator in the desktop app.

**BLOCKERS**
- None

**NEXT STEPS**
- Run `pnpm dev:desktop` and verify the chat panel aligns right with the new indicator.

**UPDATE (Jan 25, 2026 19:15)**
- Adjusted approach: keep the overall chat container centered; right-align chat bubbles only.
- Updated thinking indicator to a 3-dot bounce animation.

---

## Tasks Completed (Jan 28, 2026 - Chat Loading UI Polish)
**Timestamp**: Jan 28, 2026 14:15

**TASKS COMPLETED**
- ✅ Enhanced the chat loading indicator with clearer status copy and skeleton lines.
- ✅ Surfaced the current activity title/detail inside the loading bubble for better feedback.

**IN PROGRESS**
- [ ] Validate the updated loading UI in the desktop app.

**BLOCKERS**
- None

**NEXT STEPS**
- Run `pnpm dev:desktop` and send a prompt to confirm the new processing state reads clearly.

---

## Tasks Completed (Jan 28, 2026 - Simplified Thinking Indicator)
**Timestamp**: Jan 28, 2026 14:22

**TASKS COMPLETED**
- ✅ Simplified the chat loading UI to just the three bouncing dots.

**IN PROGRESS**
- [ ] Validate the simplified indicator in the desktop app.

**BLOCKERS**
- None

**NEXT STEPS**
- Run `pnpm dev:desktop` and confirm the dots-only indicator feels clear.

---

## Tasks Completed (Jan 28, 2026 - Chat Input Auto-Expand + Flicker Reduction)
**Timestamp**: Jan 28, 2026 14:40

**TASKS COMPLETED**
- ✅ Added textarea auto-grow with upward expansion and internal scroll cap.
- ✅ Reduced loading-time flicker by stabilizing assistant message rendering and narrowing chat store subscriptions.

**IN PROGRESS**
- [ ] Validate long-input behavior and message loading stability in the desktop app.

**BLOCKERS**
- None

**NEXT STEPS**
- Run `pnpm dev:desktop` and type a multi-line prompt to confirm the input grows upward.
- Send a tool-heavy prompt and verify the response no longer flickers during loading.

---

## Tasks Completed (Jan 28, 2026 - Switch to Notion MCP Package)
**Timestamp**: Jan 28, 2026 18:10

**TASKS COMPLETED**
- ✅ Replaced the local `@flowstate/mcp-notion` entry with the `@notionhq/notion-mcp-server` package in `opencode.json`.
- ✅ Updated desktop ProcessManager to launch Notion MCP via `npx` and pass `NOTION_TOKEN` from stored auth.

**IN PROGRESS**
- [ ] Validate the Notion MCP starts via `npx` and tools show up in OpenCode.

**BLOCKERS**
- None

**NEXT STEPS**
- Rebuild/restart the desktop app and verify Notion MCP connects with stored token.
- Run a simple Notion tool call to confirm the remote package responds.

---

## Tasks Completed (Jan 28, 2026 - Notion MCP Context Strategy Research)
**Timestamp**: Jan 28, 2026 17:45

**TASKS COMPLETED**
- ✅ Researched Notion API pagination and filtering limits to reduce payload size at the source.
- ✅ Compared local stdio MCP vs remote HTTP MCP tradeoffs for large Notion workspaces.
- ✅ Documented a tiered context strategy (small/medium/large) with chunking, summaries, and retrieval.
- ✅ Outlined caching and index invalidation approaches to avoid repeated full-database reads.

**IN PROGRESS**
- [ ] Decide on the target architecture for Notion MCP (local + pagination vs remote RAG service).

**BLOCKERS**
- None

**NEXT STEPS**
- Add strict pagination + filter inputs to `@flowstate/mcp-notion` query tools to cap payload size.
- Evaluate a remote Notion MCP that fronts a vector index (embeddings + BM25) for large workspaces.
- Define cache invalidation (Notion webhooks or time-based) and chunking strategy for page content.

---

## Tasks Completed (Feb 6, 2026 - OpenCode Approval API Compatibility Fix)
**Timestamp**: Feb 6, 2026 22:55

**TASKS COMPLETED**
- ✅ Fixed approval replies to support both OpenCode SDK API shapes:
  - v2 style `client.permission.reply({ requestID, reply })`
  - v1 style `client.postSessionIdPermissionsPermissionId({ path: { id, permissionID }, body: { response } })`
- ✅ Removed false-negative "permission API unavailable" path for v1 clients.
- ✅ Added legacy approval event compatibility for `permission.updated`:
  - request-id extraction now recognizes `permissionID` and variants
  - request classification/timeline normalization treats `permission.updated` as an approval request
  - auto-approve for "always approve" now handles `permission.updated`
- ✅ Added regression test coverage for legacy `permission.updated` request blocking behavior.
- ✅ Verified with desktop package test + typecheck:
  - `npm run test -- approval-blocking.test.ts`
  - `npm run typecheck`

**IN PROGRESS**
- [ ] Validate end-to-end in desktop UI by approving/always-approving/denying an active permission request.

**BLOCKERS**
- None

**NEXT STEPS**
- Restart the desktop app and trigger a permission-gated tool action.
- Confirm each action button (`Approve`, `Always Approve`, `Deny`) returns success and unblocks the task timeline.

---

## Tasks Completed (Feb 6, 2026 - Workflow Approval UX + Request Tracking Reliability)
**Timestamp**: Feb 6, 2026 23:07

**TASKS COMPLETED**
- ✅ Fixed `approvals:reply` IPC flow to stop hard-failing on in-memory-only tracking.
  - Added session fallback resolution through persisted timeline events (`timelineStore.findSessionIdByApprovalRequestId`).
  - Added `processManager.getSessionIdForApprovalRequest()` and reused it in both IPC + reply path.
- ✅ Improved request-id extraction robustness across payload variants:
  - Supports `requestId`, `requestID`, `permissionID`, and nested `permission.id`.
- ✅ Improved approval request context shown to users:
  - Approval payload now derives actionable `title`/`summary`/`body` from permission type, targets/patterns, tool call IDs, and metadata.
- ✅ Fixed Tasks output panel behavior while waiting on approvals:
  - Summary-only output is now rendered instead of incorrectly showing "No outputs yet."
- ✅ Reduced approval card lingering noise:
  - Resolved approval requests now show a compact "Request resolved" state in timeline instead of persistent action card UI.
- ✅ Added tests for approval normalization and legacy event compatibility.
  - `timeline-normalizer.test.ts`
  - `approval-blocking.test.ts`

**IN PROGRESS**
- [ ] Manual end-to-end verification in desktop app with the "Clean Desktop" workflow.

**BLOCKERS**
- None

**NEXT STEPS**
- Restart desktop app and run "Clean Desktop" workflow.
- Validate:
  - multiple pending approvals can all be approved/denied without "Unknown or untracked requestId"
  - approval cards show clear target/action metadata
  - workflow output panel shows summary text while waiting for approval
  - resolved approvals collapse to "Request resolved" state in timeline.

---

## Tasks Completed (Feb 6, 2026 - Needs Response Status Reversion Fix)
**Timestamp**: Feb 6, 2026 23:47

**TASKS COMPLETED**
- ✅ Fixed workflow reply flow so status persists as running after user response:
  - `TasksMode` now calls `markRunning(taskRunId)` immediately after successful reply send.
  - follow-up silent refresh now includes `loadActiveRun` to avoid stale run state.
- ✅ Updated main-process workflow sync to respect response headers:
  - `[TASK_IN_PROGRESS]` now keeps workflow/task in running state (not completed).
  - `[NEEDS_RESPONSE]` keeps response block.
  - `[TASK_COMPLETE]` marks completed.
  - `[TASK_BLOCKED]` marks failed.
- ✅ Cleared stale "Waiting for input..." description when new assistant output is not requesting input.

**IN PROGRESS**
- [ ] Manual validation in desktop app on a workflow that transitions from `[NEEDS_RESPONSE]` to `[TASK_IN_PROGRESS]`.

**BLOCKERS**
- None

---

## Tasks Completed (Feb 6, 2026 - Task Promoted UI Space Reduction)
**Timestamp**: Feb 6, 2026 23:59

**TASKS COMPLETED**
- ✅ Removed the large Task promoted handoff card from the chat body area to preserve message reading space.
- ✅ Repositioned Task promoted visibility to a compact notice below the message composer helper text.
- ✅ Tightened compact notice styling into a single-line status with a clear `View task` action.
- ✅ Kept the handoff state visible and actionable without interrupting the assistant response flow.
- ✅ Verified desktop renderer types via `pnpm --filter @flowstate/desktop typecheck`.

**IN PROGRESS**
- [ ] Manual desktop validation to confirm the compact notice placement and readability on real conversation history.

**BLOCKERS**
- None

---

## Tasks Completed (Feb 7, 2026 - Tasks Sidebar Pagination + Retention Window)
**Timestamp**: Feb 7, 2026 00:12

**TASKS COMPLETED**
- ✅ Added sidebar pagination in `TasksMode` with a fixed page size of 5 task runs.
- ✅ Added `Prev` / `Next` controls and page indicator (`Page X of Y`) beneath task cards.
- ✅ Added retention filtering so only runs updated within the last 10 days are shown in sidebar pagination.
- ✅ Ensured selection stays valid when filtered data changes by auto-selecting the newest visible run.
- ✅ Verified types with `pnpm --filter @flowstate/desktop typecheck`.

**IN PROGRESS**
- [ ] Manual UI validation for pagination controls and 10-day filtering behavior in desktop app.

**BLOCKERS**
- None

---

## Phase 8 Architecture Review (Feb 18, 2026)
**Timestamp**: Feb 18, 2026

**REVIEW COMPLETED**
- ✅ Full codebase audit of all Phase 8 implementation files
- ✅ Verified all 44 Phase 8 tests pass (10 test files, 0 failures)
- ✅ Confirmed Wave A (foundation) is fully complete: file picker IPC, SourceDocument CRUD, local source validation
- ✅ Confirmed Wave B partially complete: drag-and-drop upload + validation + context injection working in ChatMode
- ✅ Updated PLAN.md Phase 8 with implementation status table, wave completion markers, and 13 specific continuation steps
- ✅ Identified migration version conflict risk (`user_version` pragma is DB-global, shared across stores)

**WHAT'S WORKING**
- SQLite persistence for all 6 Phase 8 tables (793 lines, 6 tests)
- Local file validation with magic byte checking (302 lines, 8 tests)
- Canvas failure classification (146 lines, 5 tests)
- Quality gate evaluator (139 lines, 4 tests)
- 15 IPC handlers + preload bridge + TypeScript types
- Drag-and-drop PDF/PPTX upload in ChatMode with validation
- Context injection prepending source metadata to AI messages
- Agent skill for reading attached local study sources

**NOT YET BUILT**
- "Browse files" button (IPC exists, no UI trigger)
- PDF text extractor / PPTX slide+notes parser
- Generation orchestrator (the core pipeline)
- Fallback decision UX (Canvas failure → upload prompt)
- Destination confirmation + router (Notion/Obsidian/Local)
- Inline citation rendering
- Study run versioning + diff UI
- Phase 8 settings, metrics dashboard, e2e tests

**NEXT PRIORITY**: Step 1 (Browse button) and Step 2 (migration conflict) are quick wins. Steps 3-5 (parsers + orchestrator) are the critical path.

**BLOCKERS**
- Migration version conflict must be resolved before production use (Step 2)

---

## Tasks Completed (Feb 7, 2026 - Workflow Title Editing)
**Timestamp**: Feb 7, 2026 20:24

**TASKS COMPLETED**
- ✅ Added support for editable workflow titles via `title` in workflow frontmatter (`SKILL.md`).
- ✅ Kept workflow identity stable by treating the folder name (`workflows/<id>/`) as canonical workflow ID.
- ✅ Updated workflow save validation message to clarify that `name` is immutable and `title` should be used for rename.
- ✅ Updated workflow generation to include frontmatter `title` by default.
- ✅ Added regression tests in `packages/desktop/src/main/workflows-runner.test.ts`:
  - save supports title changes while keeping `name` fixed
  - listing uses folder ID even if frontmatter `name` drifts
- ✅ Verified with:
  - `pnpm --filter @flowstate/desktop test -- workflows-runner.test.ts`
  - `pnpm --filter @flowstate/desktop typecheck`

**IN PROGRESS**
- [ ] Manual desktop app validation of editing workflow title in the Workflows drawer.

**BLOCKERS**
- None

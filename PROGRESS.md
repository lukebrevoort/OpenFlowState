# FlowState 2.0 - Progress Tracker

> **Purpose**: Track development progress, decisions made, and blockers encountered.  
> **Last Updated**: January 14, 2026 (Phase 3 Session 3 - MCP Debugging)

---

## Current Status: 🔄 Desktop Phase 3 IN PROGRESS

**Desktop Phase 3: Integrations & Config is underway!** MCP server configuration and debugging improved.

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

*Update this document after each development session.*

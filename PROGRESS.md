# FlowState 2.0 - Progress Tracker

> **Purpose**: Track development progress, decisions made, and blockers encountered.  
> **Last Updated**: January 13, 2026

---

## Current Status: ✅ Desktop Phase 1 COMPLETE

**Desktop Phase 1: Foundation is complete!** The Electron + React + TypeScript desktop app shell is fully scaffolded and building successfully.

### What's Working:
- Electron main process with macOS window management
- Preload script with secure IPC bridge
- React renderer with Vite bundler
- Tailwind CSS with FlowState theme colors
- Four-mode layout (Chat, Tasks, Workflows, Integrations)
- Sidebar with recent convos, pinned workflows, running tasks
- All components building successfully

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

**Files Created:**
```
packages/desktop/
├── package.json                    # Package configuration with Electron dependencies
├── tsconfig.json                   # Base TypeScript config
├── tsconfig.main.json              # Electron main process TypeScript config
├── tsconfig.preload.json           # Preload script TypeScript config
├── vite.config.ts                  # Vite bundler configuration
├── tailwind.config.js              # Tailwind with FlowState theme colors
├── postcss.config.js               # PostCSS configuration
├── electron-builder.yml            # macOS packaging configuration
├── assets/
│   └── flowstate-main-logo.png     # App icon
└── src/
    ├── main/
    │   └── index.ts                # Electron main process with IPC handlers
    ├── preload/
    │   └── index.ts                # Secure IPC bridge via contextBridge
    └── renderer/
        ├── index.html              # HTML entry point
        ├── main.tsx                # React entry point
        ├── App.tsx                 # Root component with mode switching
        ├── styles/
        │   └── globals.css         # Tailwind imports + FlowState components
        ├── types/
        │   └── electron.d.ts       # TypeScript types for preload API
        ├── components/
        │   ├── index.ts            # Component exports
        │   ├── TitleBar.tsx        # macOS-style title bar
        │   ├── TabBar.tsx          # Mode selector tabs
        │   └── Sidebar.tsx         # Navigation sidebar
        └── modes/
            ├── index.ts            # Mode exports
            ├── ChatMode.tsx        # Natural language chat interface
            ├── TasksMode.tsx       # Running/completed tasks view
            ├── WorkflowsMode.tsx   # Workflow browser and editor
            └── IntegrationsMode.tsx # OAuth connections and MCP status
```

---

### Desktop Phase 2: OpenCode Integration (Weeks 3-4) 🔜 NEXT
- [ ] Implement process manager for headless OpenCode
- [ ] Create SDK bridge in Electron main process
- [ ] Build Chat mode with real-time message streaming
- [ ] Connect to existing MCP servers as child processes
- [ ] Test basic conversation flow end-to-end

### Desktop Phase 3: Integrations & Config (Weeks 5-6)
- [ ] Implement config store (Claude Desktop-style `config.json`)
- [ ] Build Integrations mode UI
- [ ] Implement temporary localhost OAuth server
- [ ] Port auth manager from `@flowstate/core`
- [ ] Test OAuth flow for Google services

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
| Headless OpenCode mode unclear | Medium | Research OpenCode SDK capabilities | To investigate |
| Electron bundle size (~150MB+) | Low | Acceptable for MVP, optimize later | Noted |

---

## Learnings & Insights

### Desktop Phase 1 Development
- Vite + React + TypeScript + Tailwind is a great stack for Electron renderers
- Separate TypeScript configs needed for main, preload, and renderer
- The FlowState warm earthy color palette works well in a desktop context
- lucide-react provides excellent icons that match the design language

### Architecture Decisions Validated
- **Electron**: Successfully reusing TypeScript code and dependencies
- **Tailwind**: FlowState theme colors integrate seamlessly
- **Four-mode UI**: Clean separation of concerns, easy to extend

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

---

## Next Session Goals

1. [ ] Research OpenCode headless mode / SDK capabilities
2. [ ] Implement process manager to spawn OpenCode
3. [ ] Create streaming message handler for Chat mode
4. [ ] Connect Chat UI to real OpenCode responses
5. [ ] Test MCP server spawning from Electron

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

# FlowState 2.0 - Project Plan

> **Status**: Planning Phase  
> **Last Updated**: January 2026  
> **License**: MIT  
> **Built On**: [OpenCode](https://opencode.ai) SDK

---

## Vision

FlowState 2.0 is an open-source productivity orchestration platform that enables users to manage their entire digital life from one place. Unlike traditional productivity tools that silo your data, FlowState connects your apps, learns your preferences, and executes complex cross-platform workflows on your behalf.

**The Core Promise**: Open FlowState, connect your apps, describe what you want, and let it handle the rest.

### Philosophy

1. **One Place, All Apps**: Stop bouncing between Notion, Gmail, Calendar, and your desktop. Orchestrate everything from a single interface.

2. **Progressive Autonomy**: Safe actions (reading, organizing, drafting) happen automatically. Risky actions (sending, deleting, creating) always require your approval.

3. **User-Controlled**: Your data stays on your machine. Your tokens stay on your machine. No cloud dependency required.

4. **Extensible by Design**: Power users can add MCP servers, create custom agents, and build workflows. Casual users can connect 2 apps and let it ride.

5. **Open Source**: Built on MIT-licensed OpenCode, giving back to the community that makes this possible.

---

## Target Users

| User Type | Description | Primary Use Cases |
|-----------|-------------|-------------------|
| **Productivity Enthusiasts** | People who use Notion, calendars, and email heavily | Cross-app task management, inbox organization |
| **Students** | Managing coursework, deadlines, study schedules | Assignment tracking, study planning (original FlowState vision) |
| **Busy Professionals** | 100+ emails/day, back-to-back meetings | Email triage, meeting prep, conflict resolution |
| **Developers** | Already comfortable with CLI tools | Full power-user features, custom agents, scripting |
| **Non-Technical Users** | Want the benefits without the complexity | Web config UI, guided setup, sensible defaults |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────────────┐          ┌─────────────────────────────┐  │
│   │   FlowState TUI     │          │   Web Config Dashboard      │  │
│   │   (OpenCode-based)  │◄────────►│   (localhost:3847)          │  │
│   │                     │          │                             │  │
│   │ - Distinct theming  │          │ - OAuth flows               │  │
│   │ - Primary interface │          │ - Integration status        │  │
│   │ - Full agent access │          │ - Preferences               │  │
│   └─────────┬───────────┘          └─────────────┬───────────────┘  │
│             │                                    │                   │
└─────────────┼────────────────────────────────────┼───────────────────┘
              │                                    │
              ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      OPENCODE SERVER LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                    OpenCode Server                            │  │
│   │                                                               │  │
│   │  - Session Management    - LLM Orchestration                  │  │
│   │  - Event Streaming       - Tool Execution                     │  │
│   │  - MCP Protocol          - Agent Routing                      │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         MCP SERVER LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │   Notion    │ │   Gmail     │ │   GCal      │ │   System    │   │
│  │   MCP       │ │   MCP       │ │   MCP       │ │   MCP       │   │
│  ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤   │
│  │ - Pages     │ │ - Read      │ │ - Events    │ │ - Shell     │   │
│  │ - DBs       │ │ - Send      │ │ - Create    │ │ - Apps      │   │
│  │ - Blocks    │ │ - Draft     │ │ - Conflicts │ │ - Windows   │   │
│  │ - Search    │ │ - Labels    │ │ - Free/Busy │ │ - Notify    │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    User's Custom MCPs                        │    │
│  │         (Slack, Obsidian, Outlook, etc.)                    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       FLOWSTATE CORE LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │     Daemon       │  │     Memory       │  │   Auth Store     │   │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤   │
│  │ - Background     │  │ - Context        │  │ - OAuth tokens   │   │
│  │ - Long tasks     │  │ - Preferences    │  │ - Encrypted      │   │
│  │ - Monitoring     │  │ - Entity links   │  │ - Local-only     │   │
│  │ - Notifications  │  │ - SQLite backed  │  │ - JSON file      │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **TUI Foundation** | OpenCode (themed) | Proven, extensible, MCP-native, MIT licensed |
| **SDK** | `@opencode-ai/sdk` (TypeScript) | Type-safe, full server API access |
| **MCP Servers** | TypeScript/Node.js | Matches SDK, excellent MCP tooling ecosystem |
| **Daemon** | Node.js (long-running) | Same runtime, good for background async tasks |
| **Web Config** | React + Vite | Fast, modern, serves on localhost |
| **Auth Storage** | Encrypted JSON file | User-controlled, local-first, matches OpenCode pattern |
| **Memory/State** | SQLite (local) | Lightweight, queryable, works offline |
| **Package Manager** | pnpm | Fast, disk-efficient, great monorepo support |
| **Build System** | Turborepo | Monorepo orchestration, caching |

### LLM Provider Strategy

- **Default**: OpenCode Zen (supports the platform we build on)
- **Recommended for Power Users**: Anthropic Claude (best agentic performance)
- **Supported**: All providers OpenCode supports (OpenAI, Google, Ollama, etc.)
- **Configuration**: Identical to OpenCode's provider system

---

## Project Structure

```
flowstate/
├── packages/
│   ├── core/                    # FlowState daemon, memory, orchestration
│   │   ├── src/
│   │   │   ├── daemon/          # Background process management
│   │   │   ├── memory/          # Context and preference storage
│   │   │   ├── auth/            # Token encryption/storage
│   │   │   └── notifications/   # Desktop notification system
│   │   └── package.json
│   │
│   ├── mcp-notion/              # Notion MCP server
│   │   ├── src/
│   │   │   ├── tools/           # MCP tool definitions
│   │   │   ├── oauth/           # Notion OAuth flow
│   │   │   └── api/             # Notion API wrapper
│   │   └── package.json
│   │
│   ├── mcp-gmail/               # Gmail MCP server
│   │   ├── src/
│   │   │   ├── tools/           # Read, send, draft, label
│   │   │   ├── oauth/           # Google OAuth flow
│   │   │   └── api/             # Gmail API wrapper
│   │   └── package.json
│   │
│   ├── mcp-gcal/                # Google Calendar MCP server
│   │   ├── src/
│   │   │   ├── tools/           # Events, free/busy, conflicts
│   │   │   ├── oauth/           # Shared with gmail or separate
│   │   │   └── api/             # Calendar API wrapper
│   │   └── package.json
│   │
│   ├── mcp-system/              # Mac/Windows system MCP server
│   │   ├── src/
│   │   │   ├── tools/           # Shell, apps, windows, notify
│   │   │   ├── macos/           # macOS-specific implementations
│   │   │   └── windows/         # Windows-specific implementations
│   │   └── package.json
│   │
│   └── web-config/              # Local web dashboard
│       ├── src/
│       │   ├── components/      # React components
│       │   ├── pages/           # Dashboard pages
│       │   │   ├── Integrations.tsx
│       │   │   ├── Preferences.tsx
│       │   │   └── Agents.tsx
│       │   └── api/             # Local API routes
│       └── package.json
│
├── themes/
│   └── flowstate.json           # OpenCode theme (FlowState branding)
│
├── agents/
│   ├── flowstate.md             # Primary orchestrator agent
│   ├── subagents/
│   │   ├── scheduler.md         # Calendar-focused subagent
│   │   ├── organizer.md         # Task/Notion-focused subagent
│   │   ├── communicator.md      # Email/messaging subagent
│   │   └── executor.md          # System command subagent
│   └── README.md
│
├── opencode.json                # OpenCode config (wires everything)
├── turbo.json                   # Turborepo config
├── pnpm-workspace.yaml          # pnpm workspace config
├── package.json                 # Root package
├── AGENTS.md                    # OpenCode agent instructions
├── PLAN.md                      # This file
├── PROGRESS.md                  # Development progress tracking
└── README.md                    # User-facing documentation
```

---

## Core Components (Detailed)

### 1. FlowState TUI Theme

The TUI must be **distinctly FlowState** while leveraging OpenCode's infrastructure.

**Design Principles** (from original FlowState):
- Warm, earthy color palette (browns, creams, terracotta)
- Clean, approachable typography (Alegreya-inspired)
- Rounded, soft UI elements
- Clear visual hierarchy

**Theme Configuration** (`themes/flowstate.json`):
```json
{
  "name": "flowstate",
  "colors": {
    "primary": "#8B6B59",
    "secondary": "#665F5D", 
    "background": "#F6EEE3",
    "surface": "#E8DFD3",
    "text": "#1E1E1E",
    "accent": "#331C16",
    "success": "#4A7C59",
    "warning": "#D4A574",
    "error": "#C45B4A"
  }
}
```

### 2. MCP Servers

Each integration is a standalone MCP server that can be:
- Developed independently
- Published to npm
- Used by anyone (not just FlowState users)
- Tested in isolation

**Notion MCP Tools**:
| Tool | Description | Autonomy |
|------|-------------|----------|
| `notion_search` | Search pages, databases | Auto |
| `notion_read_page` | Read page content | Auto |
| `notion_read_database` | Query database entries | Auto |
| `notion_create_page` | Create new page | Requires Approval |
| `notion_update_page` | Update existing page | Requires Approval |
| `notion_create_database_entry` | Add database row | Requires Approval |

**Gmail MCP Tools**:
| Tool | Description | Autonomy |
|------|-------------|----------|
| `gmail_list` | List emails with filters | Auto |
| `gmail_read` | Read email content | Auto |
| `gmail_search` | Search emails | Auto |
| `gmail_draft` | Create draft (no send) | Auto |
| `gmail_label` | Apply/remove labels | Auto |
| `gmail_send` | Send email | Requires Approval |
| `gmail_reply` | Reply to email | Requires Approval |
| `gmail_delete` | Delete email | Requires Approval |

**GCal MCP Tools**:
| Tool | Description | Autonomy |
|------|-------------|----------|
| `gcal_list_events` | List calendar events | Auto |
| `gcal_get_event` | Get event details | Auto |
| `gcal_free_busy` | Check availability | Auto |
| `gcal_find_conflicts` | Identify scheduling conflicts | Auto |
| `gcal_create_event` | Create new event | Requires Approval |
| `gcal_update_event` | Modify event | Requires Approval |
| `gcal_delete_event` | Delete event | Requires Approval |

**System MCP Tools** (Tier 2):
| Tool | Description | Autonomy |
|------|-------------|----------|
| `system_notify` | Send desktop notification | Auto |
| `system_open_app` | Open application | Auto |
| `system_open_url` | Open URL in browser | Auto |
| `system_open_file` | Open file in default app | Auto |
| `system_clipboard_read` | Read clipboard | Auto |
| `system_shell` | Execute shell command | Requires Approval |
| `system_window_focus` | Focus window | Auto |
| `system_window_arrange` | Arrange windows | Auto |
| `system_dnd` | Toggle Do Not Disturb | Requires Approval |

### 3. MCP Extensibility

FlowState embraces **"low floor, high ceiling"** extensibility. Users can connect just the official integrations, or build their entire digital life into custom workflows.

#### Three Tiers of MCPs

| Tier | Description | Setup Complexity | Example |
|------|-------------|------------------|---------|
| **Official** | FlowState-maintained, pre-configured, one-click OAuth in Web Dashboard | Zero config | Notion, Gmail, GCal, System |
| **Community** | Published to npm by the community, user adds to config | Add to `opencode.json` | Obsidian, Slack, Linear, Todoist |
| **Custom** | User builds their own MCP for personal/work tools | Build + configure | Internal company APIs, custom scripts |

#### How Users Add Custom MCPs

Since FlowState builds on OpenCode, users inherit OpenCode's full MCP system. They can add any MCP to their `opencode.json`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  
  // FlowState's official MCPs (auto-configured via Web Dashboard)
  "mcp": {
    "flowstate-notion": {
      "type": "local",
      "command": ["npx", "@flowstate/mcp-notion"],
      "enabled": true
    },
    "flowstate-gmail": {
      "type": "local", 
      "command": ["npx", "@flowstate/mcp-gmail"],
      "enabled": true
    },
    
    // User adds their own MCPs here
    "obsidian": {
      "type": "local",
      "command": ["npx", "@anthropic/mcp-obsidian"],
      "enabled": true
    },
    "slack": {
      "type": "remote",
      "url": "https://mcp.slack.com/mcp",
      "oauth": {}
    },
    "my-company-api": {
      "type": "local",
      "command": ["node", "./my-custom-mcp/index.js"],
      "enabled": true
    }
  }
}
```

#### Web Dashboard MCP Management

The Web Dashboard provides a visual interface for MCP management:

```
┌─────────────────────────────────────────────────────────────┐
│  Integrations                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  OFFICIAL INTEGRATIONS                                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │   Notion    │ │   Gmail     │ │   GCal      │            │
│  │  ✓ Connected│ │  ✓ Connected│ │  ○ Connect  │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                              │
│  YOUR CUSTOM MCPS                            [+ Add MCP]     │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │   Obsidian  │ │   Slack     │                            │
│  │   ✓ Active  │ │   ✓ Active  │                            │
│  └─────────────┘ └─────────────┘                            │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  [Browse Community MCPs]  [Create Custom MCP Guide]          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**"+ Add MCP" Flow** (MVP - Manual):
1. User clicks "+ Add MCP"
2. Form asks for: Name, Type (local/remote), Command or URL
3. FlowState writes to `opencode.json`
4. MCP becomes available immediately

**"+ Add MCP" Flow** (Future - Guided):
1. User browses curated list of community MCPs
2. One-click install (runs `npx` or configures remote)
3. Guided OAuth if required
4. Auto-configures optimal permissions

#### Why This Matters

1. **No Waiting**: When Anthropic, Vercel, or anyone publishes a new MCP, FlowState users can use it immediately without waiting for official support.

2. **Community Growth**: Contributors can publish `@community/mcp-todoist` and others install with one command.

3. **Enterprise Ready**: Companies can build private MCPs for internal tools without forking FlowState.

4. **Your Use Case Scales**: The SGA email workflow could extend to include a custom university portal MCP or internal SGA tools.

5. **Future-Proof**: The MCP ecosystem is growing rapidly. FlowState rides that wave automatically.

---

### 4. FlowState Daemon

A background Node.js process that:
- Monitors for scheduled tasks
- Handles long-running operations
- Manages notification delivery
- Maintains MCP server connections

**Daemon States**:
```
IDLE        → Waiting for work, minimal resource usage
MONITORING  → Watching for triggers (time, events)
EXECUTING   → Running a background task
WAITING     → Task paused, awaiting user approval
```

**MVP Daemon Capabilities**:
- Start/stop via TUI or web dashboard
- Execute queued background tasks
- Send desktop notifications for:
  - Task completion
  - Approval requests
  - Errors/conflicts
- Persist state across restarts

### 5. Memory System

**Contextual Memory** (MVP):
- Current session context
- Recent interactions per integration
- User's project/workspace mappings

**Preference Memory** (MVP):
- Working hours
- Timezone
- Notification preferences  
- Per-integration settings

**Entity Linking** (Future):
- Connect Notion pages to calendar events
- Link email threads to tasks
- Build knowledge graph across apps

**Storage**: SQLite database at `~/.flowstate/memory.db`

### 6. Web Config Dashboard

Local React app served on `localhost:3847`

**MVP Pages**:

1. **Integrations** (Priority: 10/10)
   - OAuth connect/disconnect for official MCPs
   - Connection status indicators
   - Last sync timestamps
   - Quick test buttons
   - **"+ Add Custom MCP" button** (manual config)
   - List of user's custom MCPs with enable/disable

2. **Preferences** (Priority: 8/10)
   - Timezone selection
   - Working hours definition
   - Notification preferences
   - Default LLM provider

3. **MCP Status** (Priority: 8/10)
   - List of active MCP servers
   - Health status per server
   - Tool availability matrix
   - Quick enable/disable toggles

4. **Agents** (Priority: 8/10)
   - View configured agents
   - Simple agent editor (later)
   - Enable/disable agents

**Future Pages**:
- Workflows/Recipes (Priority: 6/10)
- Daemon Settings (Priority: 5/10)
- Task History (Priority: 5/10)
- **Community MCP Browser** (Priority: 6/10) - Discover and install community MCPs

---

## FlowState Agents

### Primary Agent: `flowstate`

The main orchestrator that routes to specialized subagents.

```markdown
---
description: FlowState - Your productivity orchestrator
mode: primary
model: opencode/claude-sonnet (or user-configured)
temperature: 0.3
---

You are FlowState, a productivity assistant that helps users manage their 
digital life across multiple applications.

## Your Capabilities
- Notion: Pages, databases, task management
- Gmail: Email reading, drafting, organizing
- Google Calendar: Events, scheduling, conflicts
- System: Applications, files, notifications

## Behavior Rules
1. ALWAYS use tools to gather information before responding
2. For READING operations: Execute immediately
3. For WRITING operations: Describe what you'll do and wait for approval
4. When tasks span multiple apps, break them into clear steps
5. Delegate to specialized subagents for complex domain tasks

## Subagents Available
- @scheduler: Calendar optimization, meeting scheduling, conflict resolution
- @organizer: Notion organization, task prioritization, project management
- @communicator: Email drafting, response handling, message composition
- @executor: System commands, file operations, app automation
```

### Subagents

**scheduler.md**:
```markdown
---
description: Calendar and scheduling specialist
mode: subagent
tools:
  gcal_*: true
  notion_read_*: true
  system_notify: true
---

You optimize schedules, resolve conflicts, and manage time.
Focus on: availability, conflicts, time blocking, meeting prep.
```

**organizer.md**:
```markdown
---
description: Task and project organization specialist  
mode: subagent
tools:
  notion_*: true
  gmail_read: true
  gmail_search: true
---

You organize tasks, prioritize work, and manage projects in Notion.
Focus on: prioritization, categorization, deadline tracking.
```

**communicator.md**:
```markdown
---
description: Email and messaging specialist
mode: subagent
tools:
  gmail_*: true
  gcal_free_busy: true
  notion_read_*: true
---

You draft emails, organize inboxes, and handle communications.
Focus on: clear writing, appropriate tone, efficient responses.
```

**executor.md**:
```markdown
---
description: System automation specialist
mode: subagent
tools:
  system_*: true
permission:
  bash:
    "*": ask
---

You execute system-level tasks on the user's machine.
Focus on: safe execution, clear explanations, minimal disruption.
```

---

## MVP Definition

### Success Criteria

> "I can open FlowState, connect my Notion and Gmail through the TUI or Web dashboard, configure an LLM provider (or use the default), and execute a task like 'organize my inbox based on my Notion projects' with the system handling reads automatically and asking for my approval before making changes."

### MVP Feature Set

| Feature | Description | Status |
|---------|-------------|--------|
| OpenCode Integration | FlowState runs on OpenCode server | Planned |
| FlowState Theme | Distinct visual identity in TUI | Planned |
| Notion MCP | Full Notion integration via MCP | Planned |
| Gmail MCP | Email reading, drafting, sending | Planned |
| GCal MCP | Calendar events and scheduling | Planned |
| System MCP | Basic system control (Tier 2) | Planned |
| Web Dashboard | Local config UI on localhost | Planned |
| OAuth Flows | Connect integrations via OAuth | Planned |
| Progressive Autonomy | Auto-read, approval-write | Planned |
| Desktop Notifications | Push notifications for approvals | Planned |
| Local Auth Storage | Encrypted token storage | Planned |
| Memory (Basic) | Context + preferences | Planned |
| **Custom MCP Support** | Users can add their own MCPs | Planned |

### Out of Scope for MVP

- Entity linking / knowledge graph
- Workflow builder UI
- Task history / audit log
- Custom notification channels (Slack, SMS)
- Windows support (Mac-first)
- Multi-device sync
- Obsidian integration (community MCP available)
- Outlook/Office 365 integration (community MCP available)
- Slack integration (community MCP available)
- Community MCP browser/marketplace (users can still add MCPs manually)

---

## Development Milestones

### Phase 1: Foundation (Weeks 1-2)
- [ ] Initialize new FlowState 2.0 repository
- [ ] Set up monorepo structure (pnpm + Turborepo)
- [ ] Create FlowState OpenCode theme
- [ ] Configure OpenCode with FlowState branding
- [ ] Create AGENTS.md for the new project
- [ ] Set up development environment documentation

### Phase 2: Core MCP Servers (Weeks 3-5)
- [ ] Build `mcp-notion` with OAuth flow
- [ ] Build `mcp-gmail` with OAuth flow
- [ ] Build `mcp-gcal` with OAuth flow
- [ ] Build `mcp-system` (macOS only for MVP)
- [ ] Test all MCPs work with OpenCode
- [ ] Document MCP tool schemas

### Phase 3: FlowState Core (Weeks 6-7)
- [ ] Implement encrypted auth storage
- [ ] Build basic memory system (SQLite)
- [ ] Create daemon process with notification support
- [ ] Implement progressive autonomy logic
- [ ] Test background task execution

### Phase 4: Web Dashboard (Weeks 8-9)
- [ ] Set up React + Vite project
- [ ] Build Integrations page with OAuth
- [ ] Build Preferences page
- [ ] Build MCP Status page
- [ ] Connect dashboard to daemon

### Phase 5: Agent Development (Week 10)
- [ ] Create `flowstate` primary agent
- [ ] Create `scheduler` subagent
- [ ] Create `organizer` subagent
- [ ] Create `communicator` subagent
- [ ] Create `executor` subagent
- [ ] Test multi-agent workflows

### Phase 6: Polish & Launch (Weeks 11-12)
- [ ] End-to-end testing
- [ ] Documentation (README, guides)
- [ ] Create demo video
- [ ] Publish to npm (MCPs)
- [ ] Announce on OpenCode Discord
- [ ] GitHub release v0.1.0

---

## What We're Salvaging from FlowState Legacy

| Component | Salvageable | How We'll Use It |
|-----------|-------------|------------------|
| OAuth Patterns (Notion) | Yes | Port to `mcp-notion` package |
| OAuth Patterns (Google) | Yes | Port to `mcp-gmail` and `mcp-gcal` |
| Tool Definitions | Partial | Convert LangChain tools to MCP tools |
| Agent Prompts | Partial | Adapt for OpenCode agent format |
| Date/Time Utilities | Yes | Copy to `core` package |
| UI Colors/Branding | Yes | Create OpenCode theme |
| Supervisor Pattern | Conceptual | Inform primary agent design |
| Assignment Dataclass | No | Replaced by Notion MCP tools |
| React Frontend | No | New web dashboard from scratch |
| FastAPI Backend | No | Replaced by OpenCode server |
| Supabase Integration | No | Local-only for privacy |
| LangGraph State | No | OpenCode handles orchestration |

---

## Open Questions for Future Discussion

1. **Windows Support Timeline**: When should we prioritize Windows? After Mac MVP is stable?

2. **Obsidian Integration**: Should this be an official FlowState MCP or community-contributed?

3. **Monetization**: Any plans for paid features? Or pure open-source?

4. **Community MCP Registry**: Should FlowState maintain a curated list of recommended community MCPs? Or point to a broader MCP registry?

5. **MCP Verification**: Should we have a "verified" badge for community MCPs that meet quality/security standards?

6. **Mobile Companion**: Any interest in a mobile app for approvals when away from computer?

7. **Team Features**: Should FlowState ever support team/shared workflows?

---

## Appendix: Original FlowState Vision (Preserved)

The original FlowState was built for **students managing academic workloads**:

> "FlowState is designed to simplify and optimize task management by providing users with tailored study plans, schedules, and task breakdowns."

FlowState 2.0 expands this vision to **everyone managing their digital life**:

> "FlowState 2.0 enables anyone to orchestrate their productivity tools from one place, whether you're a student, professional, or power user."

The core philosophy remains: **Flow State** - that optimal mental state where you're fully immersed in productive work, undistracted by tool-switching and manual coordination.

---

## Getting Started (For Contributors)

```bash
# Clone the repository (once created)
git clone https://github.com/YOUR_USERNAME/flowstate.git
cd flowstate

# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test

# Build all packages
pnpm build
```

---

*This is a living document. Update it as decisions are made and the project evolves.*

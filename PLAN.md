# FlowState 2.0 - Project Plan

> **Status**: Architecture Pivot - Desktop App  
> **Last Updated**: February 2026  
> **License**: MIT  
> **Built On**: [OpenCode](https://opencode.ai) (Headless)

---

## Vision

FlowState 2.0 is an open-source productivity orchestration platform that brings agentic AI capabilities to everyone - not just developers. Think **Claude Cowork, but open-source and model-agnostic**.

Unlike terminal-based tools that intimidate non-technical users, FlowState is a native **macOS Desktop App** that feels as natural as any other productivity tool. Connect your apps, describe what you want, and let FlowState handle the rest.

**The Core Promise**: Open FlowState, connect your apps, describe what you want, and let it handle the rest.

### Philosophy

1. **Accessible to Everyone**: No terminal required. A beautiful desktop app that anyone can use.

2. **One Place, All Apps**: Stop bouncing between Notion, Gmail, Calendar, and your desktop. Orchestrate everything from a single interface.

3. **Progressive Autonomy**: Safe actions (reading, organizing, drafting) happen automatically. Risky actions (sending, deleting, creating) always require your approval.

4. **Model Agnostic**: Unlike Claude Cowork (Claude-only), FlowState works with any LLM - OpenAI, Anthropic, Google, Ollama, and more. Default to free OpenCode Zen models for zero friction.

5. **User-Controlled**: Your data stays on your machine. Your tokens stay on your machine. No cloud dependency required.

6. **Open Source**: Built on MIT-licensed OpenCode, giving back to the community that makes this possible.

### Inspiration: Claude Cowork

FlowState takes direct inspiration from [Claude Cowork](https://support.claude.com/en/articles/13345190-getting-started-with-cowork) - Anthropic's agentic productivity feature:

> "Cowork uses the same agentic architecture that powers Claude Code, now accessible within Claude Desktop. Instead of responding to prompts one at a time, Claude can take on complex, multi-step tasks and execute them on your behalf."

**Where FlowState differs:**

- **Open Source**: Not locked to a $200/month Claude Max plan
- **Model Agnostic**: Bring your own API keys, use any provider
- **Extensible**: Add any MCP server, not just Anthropic's curated list
- **Workflow Templates**: Pre-built automations for common tasks

---

## Target Users

| User Type                    | Description                                         | Primary Use Cases                               |
| ---------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| **Productivity Enthusiasts** | People who use Notion, calendars, and email heavily | Cross-app task management, inbox organization   |
| **Students**                 | Managing coursework, deadlines, study schedules     | Assignment tracking, study planning             |
| **Busy Professionals**       | 100+ emails/day, back-to-back meetings              | Email triage, meeting prep, conflict resolution |
| **Non-Technical Users**      | Want AI benefits without the complexity             | Guided setup, sensible defaults, beautiful UI   |
| **Power Users**              | Comfortable adding custom MCPs                      | Full extensibility, custom workflows            |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLOWSTATE DESKTOP APP (Electron)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         RENDERER PROCESS (React)                        │ │
│  │                                                                         │ │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │ │
│  │   │    Chat     │ │    Tasks    │ │  Workflows  │ │  Integrations   │  │ │
│  │   │    Mode     │ │    Mode     │ │    Mode     │ │     Mode        │  │ │
│  │   ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────────┤  │ │
│  │   │ Conversation│ │ Running     │ │ Command/    │ │ OAuth Connect   │  │ │
│  │   │ Interface   │ │ Tasks List  │ │ Skill Editor│ │ MCP Status      │  │ │
│  │   │ Streaming   │ │ Progress    │ │ Templates   │ │ Custom MCPs     │  │ │
│  │   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘  │ │
│  │                                                                         │ │
│  │   ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │   │                         SIDEBAR                                  │  │ │
│  │   │  • Recent Conversations                                          │  │ │
│  │   │  • Pinned Workflows (3 max)                                      │  │ │
│  │   │  • Running Tasks                                                 │  │ │
│  │   └─────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      │ IPC                                   │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         MAIN PROCESS (Node.js)                          │ │
│  │                                                                         │ │
│  │   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │ │
│  │   │  Process Manager │  │   Config Store   │  │    Auth Manager      │ │ │
│  │   │  (OpenCode +     │  │   (MCP config,   │  │    (Encrypted        │ │ │
│  │   │   MCP servers)   │  │    preferences)  │  │     tokens)          │ │ │
│  │   └────────┬─────────┘  └──────────────────┘  └──────────────────────┘ │ │
│  │            │                                                            │ │
│  │            │                                                            │ │
│  │   ┌────────▼─────────┐  ┌──────────────────┐  ┌──────────────────────┐ │ │
│  │   │  Memory Store    │  │  OAuth Server    │  │   Notification       │ │ │
│  │   │  (SQLite)        │  │  (temp localhost)│  │   Service            │ │ │
│  │   └──────────────────┘  └──────────────────┘  └──────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
└──────────────────────────────────────┼───────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHILD PROCESSES                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    OPENCODE (Headless Mode)                           │   │
│  │                                                                       │   │
│  │  • Session Management     • LLM Orchestration                         │   │
│  │  • Event Streaming        • Tool Execution                            │   │
│  │  • Agent Routing          • MCP Protocol Coordination                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Notion    │ │   Gmail     │ │   GCal      │ │   System    │           │
│  │   MCP       │ │   MCP       │ │   MCP       │ │   MCP       │           │
│  ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤           │
│  │ • Pages     │ │ • Read      │ │ • Events    │ │ • Shell     │           │
│  │ • DBs       │ │ • Send      │ │ • Create    │ │ • Apps      │           │
│  │ • Blocks    │ │ • Draft     │ │ • Conflicts │ │ • Desktop   │           │
│  │ • Search    │ │ • Labels    │ │ • Free/Busy │ │ • Notify    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    User's Custom MCPs                                │    │
│  │         (Slack, Obsidian, Linear, Todoist, etc.)                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Decision Log

| Date     | Decision                                   | Rationale                                                                | Status   |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------ | -------- |
| Jan 2026 | Build on top of OpenCode (not fork)        | Leverage their maintenance, MCP infra, and community                     | Approved |
| Jan 2026 | MCP-first architecture                     | Pluggable integrations, can be used independently                        | Approved |
| Jan 2026 | Progressive autonomy model                 | Auto-read, approval-write for safety                                     | Approved |
| Jan 2026 | Local-only auth storage                    | User privacy, no cloud dependency                                        | Approved |
| Jan 2026 | TypeScript throughout                      | Consistency with OpenCode SDK                                            | Approved |
| Jan 2026 | MIT License                                | Match OpenCode, give back to community                                   | Approved |
| Jan 2026 | Mac-first for MVP                          | Simplify scope, add Windows later                                        | Approved |
| Jan 2026 | Default to OpenCode Zen                    | Free, zero-friction onboarding                                           | Approved |
| Jan 2026 | **Desktop App (Electron)**                 | TUI too complex for non-technical users, Cowork-style UX                 | **New**  |
| Jan 2026 | **Headless OpenCode**                      | Run OpenCode silently, control via SDK/API                               | **New**  |
| Jan 2026 | **Four-Mode UI**                           | Chat, Tasks, Workflows, Integrations                                     | **New**  |
| Jan 2026 | **Workflows as Curated Commands**          | Use OpenCode's .md-based command system; hide global commands by default | **New**  |
| Jan 2026 | **Claude Desktop-style MCP Config**        | Local JSON file for MCP configuration                                    | **New**  |
| Jan 2026 | **Fresh UI Design**                        | New React UI inspired by FlowState 1.0 aesthetic                         | **New**  |
| Jan 2026 | **Model Provider Choice in Onboarding**    | Ask user which provider, default to Zen                                  | **New**  |
| Jan 2026 | **Internet Required for MVP**              | Optimize for offline later                                               | **New**  |
| Jan 2026 | **Unified Real-Time Timeline**             | Single chronological feed (no tabs) for tool calls, approvals, status    | **New**  |
| Jan 2026 | **Hybrid Timeline Storage**                | SQLite for metadata, disk blobs for payloads ≥10KB                       | **New**  |
| Jan 2026 | **Smart Metadata Gmail Defaults**          | Return snippet + headers + labels by default, full body on-demand        | **New**  |
| Jan 2026 | **Redact Secrets Even in Dev Mode**        | Always strip tokens/keys; export bundle requires explicit action         | **New**  |
| Jan 2026 | **Hybrid Task Promotion**                  | Agent-led promotion + heuristic escalation; no user override             | **New**  |
| Jan 2026 | **Task Summary from Timeline**             | Final task summary auto-generated from timeline; last chat message       | **New**  |
| Jan 2026 | **Workflow Runs in SQLite**                | Durable history + queryable run metadata                                 | **New**  |
| Jan 2026 | **WorkflowRun + TaskRun Linking**          | Separate workflowRunId; reference taskRunId + chat message/session       | **New**  |
| Jan 2026 | **Workflow Auto-Route to Tasks**           | Starting a workflow always switches to Tasks                             | **New**  |
| Feb 2026 | **User Profile JSON + System Tools**       | Persist user preferences + inject into system prompt                     | **New**  |
| Feb 2026 | **Shared LRU Cache Module**                | Standardize caching across MCP servers                                   | **New**  |
| Feb 2026 | **Single-Session MVP, Multi-Stream Later** | Workflows parallel via detached sessions; full multi-stream for v1.1     | **New**  |
| Feb 2026 | **Phase 5/5.5 Before Phase 6**             | Security + workflow persistence required before onboarding polish        | **New**  |

---

## Technology Stack

| Layer                 | Technology                      | Rationale                                                  |
| --------------------- | ------------------------------- | ---------------------------------------------------------- |
| **Desktop Framework** | Electron                        | Cross-platform, leverages existing TypeScript/Node.js code |
| **UI Framework**      | React + TypeScript              | Modern, component-based, great ecosystem                   |
| **Styling**           | Tailwind CSS                    | Rapid development, consistent design system                |
| **Engine**            | OpenCode (Headless)             | Proven agentic orchestration, MCP-native                   |
| **SDK**               | `@opencode-ai/sdk` (TypeScript) | Type-safe, full server API access                          |
| **MCP Servers**       | TypeScript/Node.js              | Matches SDK, excellent MCP tooling ecosystem               |
| **Auth Storage**      | Encrypted JSON file             | User-controlled, local-first                               |
| **Memory/State**      | SQLite (local)                  | Lightweight, queryable, works offline                      |
| **Package Manager**   | pnpm                            | Fast, disk-efficient, great monorepo support               |
| **Build System**      | Turborepo                       | Monorepo orchestration, caching                            |
| **Electron Builder**  | electron-builder                | Packaging, distribution, auto-updates                      |

### LLM Provider Strategy

- **Default**: OpenCode Zen (free, zero-friction for new users)
- **Onboarding**: Ask user which provider they prefer
- **Supported**: All providers OpenCode supports (Anthropic, OpenAI, Google, Ollama, etc.)
- **Configuration**: Stored in FlowState config file

---

## Project Structure

```
flowstate/
├── packages/
│   ├── desktop/                     # NEW: Electron Desktop App
│   │   ├── src/
│   │   │   ├── main/                # Electron main process
│   │   │   │   ├── index.ts         # Entry point
│   │   │   │   ├── process-manager.ts   # Spawns OpenCode + MCP servers
│   │   │   │   ├── config-store.ts  # Reads/writes config.json
│   │   │   │   ├── auth-manager.ts  # Token encryption/storage
│   │   │   │   ├── memory-store.ts  # SQLite operations
│   │   │   │   ├── oauth-server.ts  # Temporary localhost OAuth handler
│   │   │   │   └── notifications.ts # Desktop notifications
│   │   │   │
│   │   │   ├── renderer/            # React UI
│   │   │   │   ├── App.tsx          # Root component
│   │   │   │   ├── components/      # Shared components
│   │   │   │   ├── modes/           # Mode-specific views
│   │   │   │   │   ├── ChatMode.tsx
│   │   │   │   │   ├── TasksMode.tsx
│   │   │   │   │   ├── WorkflowsMode.tsx
│   │   │   │   │   └── IntegrationsMode.tsx
│   │   │   │   ├── hooks/           # React hooks
│   │   │   │   ├── stores/          # State management
│   │   │   │   └── styles/          # Tailwind + theme
│   │   │   │
│   │   │   └── preload/             # Electron preload scripts
│   │   │
│   │   ├── assets/                  # Icons, images
│   │   │   └── flowstate-main-logo.png
│   │   ├── electron-builder.yml     # Build configuration
│   │   └── package.json
│   │
│   ├── core/                        # FlowState core systems (EXISTING)
│   │   ├── src/
│   │   │   ├── daemon/              # Background process management
│   │   │   ├── memory/              # Context and preference storage
│   │   │   ├── auth/                # Token encryption/storage
│   │   │   └── notifications/       # Notification system
│   │   └── package.json
│   │
│   ├── mcp-notion/                  # Notion MCP server (EXISTING)
│   ├── mcp-gmail/                   # Gmail MCP server (EXISTING)
│   ├── mcp-gcal/                    # Google Calendar MCP server (EXISTING)
│   ├── mcp-system/                  # System MCP server (EXISTING)
│   │
│   └── web-config/                  # DEPRECATED: Replaced by desktop app
│
├── workflows/                       # Pre-built workflow templates
│   ├── inbox-review/
│   │   └── SKILL.md                 # "Review and organize my inbox"
│   ├── daily-standup/
│   │   └── SKILL.md                 # "Prepare my standup notes"
│   └── meeting-prep/
│       └── SKILL.md                 # "Prepare for my next meeting"
│
├── themes/
│   └── flowstate.json               # FlowState color theme
│
├── agents/
│   ├── flowstate.md                 # Primary orchestrator agent
│   └── subagents/
│       ├── scheduler.md             # Calendar-focused subagent
│       ├── organizer.md             # Task/Notion-focused subagent
│       ├── communicator.md          # Email/messaging subagent
│       └── executor.md              # System command subagent
│
├── opencode.json                    # OpenCode config
├── turbo.json                       # Turborepo config
├── pnpm-workspace.yaml              # pnpm workspace config
├── package.json                     # Root package
├── AGENTS.md                        # Agent instructions
├── PLAN.md                          # This file
├── PROGRESS.md                      # Development progress tracking
└── README.md                        # User-facing documentation
```

---

## Data Storage

FlowState stores all user data locally on device:

```
~/Library/Application Support/FlowState/
├── config.json              # MCP servers, preferences, provider settings
├── memory.db                # SQLite (context, history, preferences)
├── auth/                    # Encrypted OAuth tokens
│   ├── notion.enc
│   ├── gmail.enc
│   └── gcal.enc
├── workflows/               # User-created workflows (copied from defaults)
│   ├── inbox-review/
│   │   └── SKILL.md
│   └── custom-workflow/
│       └── SKILL.md
└── logs/                    # Debug logs
    └── flowstate.log
```

### Config File Format

Similar to Claude Desktop's `claude_desktop_config.json`:

```json
{
  "$schema": "https://flowstate.app/config.json",
  "provider": {
    "default": "zen/claude-sonnet",
    "apiKeys": {}
  },
  "mcpServers": {
    "flowstate-notion": {
      "command": ["node", "/path/to/mcp-notion/dist/index.js"],
      "enabled": true
    },
    "flowstate-gmail": {
      "command": ["node", "/path/to/mcp-gmail/dist/index.js"],
      "enabled": true
    },
    "flowstate-gcal": {
      "command": ["node", "/path/to/mcp-gcal/dist/index.js"],
      "enabled": true
    },
    "flowstate-system": {
      "command": ["node", "/path/to/mcp-system/dist/index.js"],
      "enabled": true
    }
  },
  "preferences": {
    "timezone": "America/Los_Angeles",
    "workingHours": { "start": "09:00", "end": "17:00" },
    "notifications": {
      "approvals": true,
      "taskComplete": true
    }
  }
}
```

---

## User Interface Design

### Design Language

FlowState's visual identity carries forward from [FlowState 1.0](https://github.com/lukebrevoort/flowstate):

**Color Palette** (Warm, earthy tones):

```json
{
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
```

**Design Principles**:

- Warm, approachable, not clinical
- Clean visual hierarchy
- Rounded, soft UI elements
- Plenty of whitespace
- Non-intimidating to non-technical users

### App Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ◉ ◉ ◉  FlowState                                    [Settings] [?] │
├──────────────┬──────────────────────────────────────────────────────┤
│              │                                                       │
│   SIDEBAR    │                    MAIN CONTENT                       │
│              │                                                       │
│  ┌────────┐  │  ┌───────┬───────┬───────────┬──────────────────┐   │
│  │ Recent │  │  │ Chat  │ Tasks │ Workflows │   Integrations   │   │
│  │ Convos │  │  └───────┴───────┴───────────┴──────────────────┘   │
│  │  • ...  │  │                                                      │
│  │  • ...  │  │  ┌──────────────────────────────────────────────┐   │
│  │  • ...  │  │  │                                               │   │
│  └────────┘  │  │                                               │   │
│              │  │           MODE-SPECIFIC CONTENT               │   │
│  ┌────────┐  │  │                                               │   │
│  │ Pinned │  │  │                                               │   │
│  │Workflows│  │  │                                               │   │
│  │  ⚡ ...  │  │  │                                               │   │
│  │  ⚡ ...  │  │  │                                               │   │
│  │  ⚡ ...  │  │  └──────────────────────────────────────────────┘   │
│  └────────┘  │                                                       │
│              │  ┌──────────────────────────────────────────────┐   │
│  ┌────────┐  │  │                                               │   │
│  │Running │  │  │              INPUT / ACTIONS                  │   │
│  │ Tasks  │  │  │                                               │   │
│  │  🔄 ... │  │  └──────────────────────────────────────────────┘   │
│  └────────┘  │                                                       │
│              │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

### Mockup Behavior Decisions (Jan 2026)

These are product decisions derived from the current `appmockup/` and Luke's clarifications. Treat these as the default behavior unless later phases intentionally change them.

- **Home-first UX**: App opens to Home so users can choose between Chat / Tasks / Workflows / Integrations instead of defaulting into Chat.
- **Sidebar is optional**: Sidebar is toggleable (Notion-style) to keep the “zen garden” workspace clutter-free.
- **Dual navigation**: Main navigation is via the center/page navigation; sidebar is primarily for recents/pins/running items.
- **Zen status indicator**: Replace the current “FlowState pulse” with a minimal status indicator (e.g., green=ready, yellow=thinking) while keeping a separate live activity bar.
- **Multi-thread chat**: Support multiple conversations (OpenCode sessions). Show the most recent 3 in the sidebar, plus search for older conversations.
  - Search is **title-only** for MVP; titles must be intentionally unique.
  - Default retention target: **90 days** (future: user-configurable).
- **Approvals**: Inline approval cards support `Approve`, `Always Approve`, and `Deny`.
  - `Always Approve` applies to the current **task run / session only** (MVP).
  - Workflows can be explicitly configured as **Always Approve** (opt-in) after the user has validated behavior.
    - Semantics: if the workflow is set to auto-approve, FlowState intercepts approval-gated tool requests associated with that workflow task run (including follow-up approvals like retries/delayed steps) and approves them automatically (the user never sees the approval prompt).
  - Tasks is the primary place to review/approve long-running actions.
- **Chat vs task routing**: Quick actions stay in Chat; anything expected to run longer than ~1 minute becomes a Task via **hybrid promotion** (agent-driven + heuristic escalation).
  - No manual override: if promoted, execution continues as a Task.
  - Chat shows a handoff card linking to Task details (click → Tasks view).
  - Completed long-running tasks end with an **auto-generated summary** derived from the timeline; this summary becomes the last assistant message in the original chat.
- **Workflow execution**: Running a workflow always creates a Task and switches the UI to Tasks.
- **Integrations focus**: Optimize for easy setup of custom MCPs (local + remote) with “Easy” + “Advanced” paths; store secrets in **macOS Keychain** (MVP).
  - Use OAuth for specific providers (e.g., Google, Notion, Office 365).
- **Reliability policy**: If an integration drops mid-task, notify the user, auto-retry up to 5 times, then fail the task.
- **Privacy**: No telemetry/usage-data collection.
- **Accessibility**: Include “Reduce motion” support (ZenGarden can be user-toggleable).

### Four Modes

#### 1. Chat Mode

Primary interface for natural language interaction.

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│  FlowState                                     Today 2:34 PM  │
│  ─────────────────────────────────────────────────────────   │
│  I found 23 unread emails. Here's a summary:                 │
│                                                               │
│  🔴 High Priority (3)                                        │
│  • Meeting reschedule from Sarah - needs response            │
│  • Invoice approval from Accounting - due today              │
│  • Client feedback on proposal                               │
│                                                               │
│  📧 Newsletters (12) - can be archived                       │
│  📢 Notifications (8) - mostly GitHub                        │
│                                                               │
│  Would you like me to:                                        │
│  • Draft replies to the high priority emails?                │
│  • Archive the newsletters?                                   │
│  • Create Notion tasks for follow-ups?                       │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  You                                          Just now        │
│  ─────────────────────────────────────────────────────────   │
│  Yes, draft replies and create tasks for the follow-ups      │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Type a message...                              [Send]  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Approval Flow (Inline)**:
When FlowState wants to do something that requires approval, it shows inline:

```
┌──────────────────────────────────────────────────────────────┐
│  FlowState is requesting approval:                           │
│                                                               │
│  📧 Send email to sarah@example.com                          │
│  Subject: "Re: Meeting Reschedule"                           │
│  ─────────────────────────────────────────────────────────   │
│  Hi Sarah,                                                    │
│  Tuesday at 2pm works great for me. Looking forward to it!  │
│  Best, Luke                                                   │
│                                                               │
│  [Approve]  [Always Approve]  [Deny]                         │
└──────────────────────────────────────────────────────────────┘
```

#### 2. Tasks Mode

View and manage long-running background tasks.

```
┌──────────────────────────────────────────────────────────────┐
│  Active Tasks                                                 │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🔄 Organizing Gmail inbox                              │  │
│  │    Started 5 min ago • Processing 847 emails           │  │
│  │    ████████████░░░░░░░░ 58%                            │  │
│  │    Currently: Categorizing newsletters                  │  │
│  │    [View Details]  [Cancel]                             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ⏸ Waiting for approval                                 │  │
│  │    Desktop organization ready                          │  │
│  │    Will move 34 files to organized folders             │  │
│  │    [Review Changes]                                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Completed Today                                              │
│  ─────────────────────────────────────────────────────────   │
│  ✅ Morning inbox review • 2 hours ago                       │
│  ✅ Calendar conflict resolution • 4 hours ago               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### 3. Workflows Mode

Browse, create, and manage reusable workflows (OpenCode Commands/Skills).

```
┌──────────────────────────────────────────────────────────────┐
│  Workflows                                    [+ New Workflow]│
│                                                               │
│  Pre-built                                                    │
│  ─────────────────────────────────────────────────────────   │
│  ┌─────────────────────┐ ┌─────────────────────┐             │
│  │ ⚡ Inbox Review      │ │ ⚡ Meeting Prep      │             │
│  │ Summarize and       │ │ Prepare notes for   │             │
│  │ organize unread     │ │ your next meeting   │             │
│  │ emails              │ │                     │             │
│  │ [Run]  [Edit]  [Pin]│ │ [Run]  [Edit]  [Pin]│             │
│  └─────────────────────┘ └─────────────────────┘             │
│                                                               │
│  ┌─────────────────────┐ ┌─────────────────────┐             │
│  │ ⚡ Daily Standup     │ │ ⚡ Desktop Cleanup   │             │
│  │ Prepare your        │ │ Organize files on   │             │
│  │ standup notes       │ │ your desktop        │             │
│  │                     │ │                     │             │
│  │ [Run]  [Edit]  [Pin]│ │ [Run]  [Edit]  [Pin]│             │
│  └─────────────────────┘ └─────────────────────┘             │
│                                                               │
│  Your Workflows                                               │
│  ─────────────────────────────────────────────────────────   │
│  ┌─────────────────────┐                                     │
│  │ ⚡ Weekly Report     │                                     │
│  │ Generate weekly     │                                     │
│  │ progress report     │                                     │
│  │ [Run]  [Edit]  [Pin]│                                     │
│  └─────────────────────┘                                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Workflow Editor** (SKILL.md format):

```
┌──────────────────────────────────────────────────────────────┐
│  Edit Workflow: Inbox Review                     [Save] [X]   │
│                                                               │
│  Name: inbox-review                                           │
│  Description: Summarize and organize unread emails            │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ---                                                    │  │
│  │ name: inbox-review                                     │  │
│  │ description: Summarize and organize unread emails      │  │
│  │ ---                                                    │  │
│  │                                                        │  │
│  │ ## What you do                                         │  │
│  │ - Read all unread emails in my inbox                   │  │
│  │ - Categorize by priority (High, Medium, Low)           │  │
│  │ - Summarize each high-priority email in 1-2 sentences  │  │
│  │ - Suggest which newsletters can be unsubscribed        │  │
│  │ - Create Notion tasks for any action items             │  │
│  │                                                        │  │
│  │ ## Output format                                       │  │
│  │ Present a summary with:                                │  │
│  │ - High priority items that need response               │  │
│  │ - Action items with suggested Notion tasks             │  │
│  │ - Newsletters that can be archived                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

#### 4. Integrations Mode

Connect and manage external services.

```
┌──────────────────────────────────────────────────────────────┐
│  Integrations                                                 │
│                                                               │
│  Connected                                                    │
│  ─────────────────────────────────────────────────────────   │
│  ┌─────────────────────┐ ┌─────────────────────┐             │
│  │ 📓 Notion           │ │ 📧 Gmail             │             │
│  │ ✅ Connected        │ │ ✅ Connected         │             │
│  │ luke@email.com      │ │ luke@gmail.com       │             │
│  │ Last sync: 2m ago   │ │ Last sync: 5m ago    │             │
│  │ [Disconnect]        │ │ [Disconnect]         │             │
│  └─────────────────────┘ └─────────────────────┘             │
│                                                               │
│  ┌─────────────────────┐                                     │
│  │ 📅 Google Calendar  │                                     │
│  │ ✅ Connected        │                                     │
│  │ 3 calendars synced  │                                     │
│  │ Last sync: 2m ago   │                                     │
│  │ [Disconnect]        │                                     │
│  └─────────────────────┘                                     │
│                                                               │
│  Available                                                    │
│  ─────────────────────────────────────────────────────────   │
│  ┌─────────────────────┐ ┌─────────────────────┐             │
│  │ 💬 Slack            │ │ 📝 Obsidian          │             │
│  │ Team communication  │ │ Local notes vault    │             │
│  │ [Connect]           │ │ [Connect]            │             │
│  └─────────────────────┘ └─────────────────────┘             │
│                                                               │
│  Custom MCPs                                    [+ Add MCP]   │
│  ─────────────────────────────────────────────────────────   │
│  ┌─────────────────────┐                                     │
│  │ 🔧 My Custom API    │                                     │
│  │ ✅ Active           │                                     │
│  │ [Configure] [Remove]│                                     │
│  └─────────────────────┘                                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Onboarding Flow

### First Launch Experience

**Step 1: Welcome**

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│                    [FlowState Logo]                           │
│                                                               │
│              Welcome to FlowState                             │
│                                                               │
│     Your AI-powered productivity assistant that              │
│     connects all your apps and works for you.                │
│                                                               │
│                                                               │
│                     [Get Started]                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Step 2: What Apps Do You Use?**

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│              What apps do you use?                            │
│                                                               │
│     Select the apps you'd like FlowState to connect          │
│                                                               │
│     ┌───────────┐ ┌───────────┐ ┌───────────┐               │
│     │ ☑ Notion  │ │ ☑ Gmail   │ │ ☑ Calendar│               │
│     └───────────┘ └───────────┘ └───────────┘               │
│                                                               │
│     ┌───────────┐ ┌───────────┐ ┌───────────┐               │
│     │ ☐ Slack   │ │ ☐ Obsidian│ │ ☐ Linear  │               │
│     └───────────┘ └───────────┘ └───────────┘               │
│                                                               │
│     You can always add more integrations later               │
│                                                               │
│                      [Continue]                               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Step 3: Connect Integrations**

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│              Connect your apps                                │
│                                                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │ 📓 Notion                          [Connect →]   │     │
│     └──────────────────────────────────────────────────┘     │
│                                                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │ 📧 Gmail                           [Connect →]   │     │
│     └──────────────────────────────────────────────────┘     │
│                                                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │ 📅 Google Calendar       ✅ Connected            │     │
│     └──────────────────────────────────────────────────┘     │
│                                                               │
│                 [Skip for now]  [Continue]                    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Step 4: Choose Your AI Provider**

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│              Choose your AI provider                          │
│                                                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │ ⭐ OpenCode Zen (Recommended)                    │     │
│     │    Free to use, no API key required              │     │
│     │    ○ Selected                                    │     │
│     └──────────────────────────────────────────────────┘     │
│                                                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │    Anthropic Claude                              │     │
│     │    Requires API key                              │     │
│     │    ○                                             │     │
│     └──────────────────────────────────────────────────┘     │
│                                                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │    OpenAI                                        │     │
│     │    Requires API key                              │     │
│     │    ○                                             │     │
│     └──────────────────────────────────────────────────┘     │
│                                                               │
│     You can change this anytime in Settings                  │
│                                                               │
│                      [Continue]                               │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Step 5: You're Ready! (Wow Moment)**

```
┌──────────────────────────────────────────────────────────────┐
│                                                               │
│              You're all set! 🎉                              │
│                                                               │
│     Try one of these to see FlowState in action:             │
│                                                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │ "Summarize my unread emails and add action       │     │
│     │  items to my Notion inbox"                       │     │
│     │                                        [Try →]   │     │
│     └──────────────────────────────────────────────────┘     │
│                                                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │ "Organize my Gmail to get rid of spam and        │     │
│     │  only see things that are important"             │     │
│     │                                        [Try →]   │     │
│     └──────────────────────────────────────────────────┘     │
│                                                               │
│     ┌──────────────────────────────────────────────────┐     │
│     │ "Organize my desktop into folders"               │     │
│     │                                        [Try →]   │     │
│     └──────────────────────────────────────────────────┘     │
│                                                               │
│               [Skip and go to FlowState]                      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## MCP Server Architecture

### Official FlowState MCPs

Each integration is a standalone MCP server that can be:

- Developed independently
- Published to npm
- Used by anyone (not just FlowState users)
- Tested in isolation

**Notion MCP Tools**:

| Tool                           | Description             | Autonomy          |
| ------------------------------ | ----------------------- | ----------------- |
| `notion_search`                | Search pages, databases | Auto              |
| `notion_read_page`             | Read page content       | Auto              |
| `notion_read_database`         | Query database entries  | Auto              |
| `notion_create_page`           | Create new page         | Requires Approval |
| `notion_update_page`           | Update existing page    | Requires Approval |
| `notion_create_database_entry` | Add database row        | Requires Approval |

**Gmail MCP Tools**:

| Tool           | Description              | Autonomy          |
| -------------- | ------------------------ | ----------------- |
| `gmail_list`   | List emails with filters | Auto              |
| `gmail_read`   | Read email content       | Auto              |
| `gmail_search` | Search emails            | Auto              |
| `gmail_draft`  | Create draft (no send)   | Auto              |
| `gmail_label`  | Apply/remove labels      | Auto              |
| `gmail_send`   | Send email               | Requires Approval |
| `gmail_reply`  | Reply to email           | Requires Approval |
| `gmail_delete` | Delete email             | Requires Approval |

**GCal MCP Tools**:

| Tool                  | Description                   | Autonomy          |
| --------------------- | ----------------------------- | ----------------- |
| `gcal_list_events`    | List calendar events          | Auto              |
| `gcal_get_event`      | Get event details             | Auto              |
| `gcal_free_busy`      | Check availability            | Auto              |
| `gcal_find_conflicts` | Identify scheduling conflicts | Auto              |
| `gcal_create_event`   | Create new event              | Requires Approval |
| `gcal_update_event`   | Modify event                  | Requires Approval |
| `gcal_delete_event`   | Delete event                  | Requires Approval |

**System MCP Tools**:

| Tool                    | Description               | Autonomy          |
| ----------------------- | ------------------------- | ----------------- |
| `system_notify`         | Send desktop notification | Auto              |
| `system_open_app`       | Open application          | Auto              |
| `system_open_url`       | Open URL in browser       | Auto              |
| `system_open_file`      | Open file in default app  | Auto              |
| `system_list_files`     | List files in directory   | Auto              |
| `system_organize_files` | Move/rename files         | Requires Approval |
| `system_shell`          | Execute shell command     | Requires Approval |

### User Custom MCPs

Users can add any MCP server via the config file, just like Claude Desktop:

```json
{
  "mcpServers": {
    "my-custom-mcp": {
      "command": ["node", "/path/to/my-mcp/index.js"],
      "enabled": true
    },
    "remote-mcp": {
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${CUSTOM_API_KEY}"
      }
    }
  }
}
```

---

## Workflow System

Workflows use OpenCode's Commands/Skills system, defined as Markdown files:

### Pre-built Workflows

**`workflows/inbox-review/SKILL.md`**:

```markdown
---
name: inbox-review
description: Summarize and organize unread emails, create action items
---

## What you do

- Read all unread emails in my inbox using Gmail MCP
- Categorize by priority (High, Medium, Low) based on sender and content
- Summarize each high-priority email in 1-2 sentences
- Identify newsletters that can be archived or unsubscribed
- Create Notion tasks for any emails requiring follow-up action

## Output format

Present a summary with:

- High priority items that need response today
- Action items with links to created Notion tasks
- Newsletters that can be safely archived

## When to use me

Use this workflow at the start of your workday or when returning from time away.
```

**`workflows/meeting-prep/SKILL.md`**:

```markdown
---
name: meeting-prep
description: Prepare notes and context for your next meeting
---

## What you do

- Check Google Calendar for the next upcoming meeting
- Look up attendees and recent email threads with them
- Search Notion for any relevant project pages or notes
- Summarize any outstanding action items related to this meeting
- Create a brief agenda or talking points

## Output format

Present:

- Meeting details (time, attendees, location/link)
- Context from recent communications
- Relevant Notion pages
- Suggested agenda items

## When to use me

Use this 10-15 minutes before an important meeting.
```

**`workflows/desktop-cleanup/SKILL.md`**:

```markdown
---
name: desktop-cleanup
description: Organize files on your desktop into logical folders
---

## What you do

- List all files on the Desktop using System MCP
- Categorize by file type (Documents, Images, Downloads, etc.)
- Suggest a folder structure based on content
- Create folders and move files (with approval)

## Output format

Show proposed changes before executing:

- New folders to create
- Files to move and their destinations
- Files that couldn't be categorized

## When to use me

Use this when your desktop is cluttered and needs organization.
```

---

## MVP Definition

### Success Criteria

> "I can download FlowState.app, connect my Gmail and Notion through a friendly onboarding flow, and immediately run a workflow like 'Summarize my inbox and create Notion tasks' - seeing the agent work in real-time and approving any changes it wants to make."

### MVP Feature Set (Desktop App v1.0)

| Feature                | Description                                             | Priority |
| ---------------------- | ------------------------------------------------------- | -------- |
| Electron Shell         | Four-mode layout (Chat, Tasks, Workflows, Integrations) | P0       |
| Headless OpenCode      | Engine runs in background, controlled via SDK           | P0       |
| Chat Mode              | Natural language conversation with streaming            | P0       |
| Integrations Mode      | OAuth connect for Notion, Gmail, GCal                   | P0       |
| MCP Config File        | Claude Desktop-style local config                       | P0       |
| Onboarding Flow        | Welcome → Apps → Connect → Wow moment                   | P0       |
| Notion MCP             | Full Notion integration                                 | P0       |
| Gmail MCP              | Full Gmail integration                                  | P0       |
| GCal MCP               | Full Calendar integration                               | P0       |
| System MCP             | Desktop/file organization                               | P1       |
| Tasks Mode             | View running/completed tasks                            | P1       |
| Workflows Mode         | Browse and run pre-built workflows                      | P1       |
| One Pre-built Workflow | "Inbox Review" as example                               | P1       |
| Approval Flow          | Inline approval with notifications                      | P1       |
| Provider Selection     | Choose LLM provider in onboarding                       | P1       |
| FlowState Theme        | Warm earthy color palette                               | P1       |

### Desktop App v1.1 (Post-MVP)

| Feature                 | Description                              |
| ----------------------- | ---------------------------------------- |
| Workflow Builder UI     | Visual editor for creating workflows     |
| Real-time Task Progress | Detailed progress indicators like Cowork |
| Custom MCP Addition UI  | Add MCPs without editing config file     |
| Approval Queue          | Batch approve multiple pending actions   |
| Conversation History    | Browse and continue past conversations   |
| Keyboard Shortcuts      | Power user efficiency                    |

### Out of Scope for MVP

- Windows support (Mac-first)
- Offline mode
- Multi-device sync
- Team/shared workflows
- Mobile companion app
- Code signing / notarization (requires Apple Developer account)

---

## Development Milestones

### Phase 1: Desktop Foundation - DONE

- [x] Electron + React + TypeScript + Tailwind skeleton in `packages/desktop/`
- [x] Four-mode shell + navigation + sidebar
- [x] Main/renderer IPC bridge

### Phase 2: Headless OpenCode Integration - DONE

- [x] ProcessManager starts OpenCode + streams events
- [x] Chat mode streaming with session management

### Phase 3: Integrations + Config Baseline - DONE

Value: users can connect core services (Gmail/GCal/Notion/Canvas) and persist config.

- [x] Config store persisted to disk
- [x] Auth manager + OAuth server
- [x] Integrations UI + connect/disconnect
- [x] Confirm OAuth end-to-end with real credentials across Gmail + GCal (and Notion OAuth if we keep it)
- [x] Decide + implement secrets storage policy: keep encrypted files vs move to macOS Keychain
- [x] Implement Custom MCP add/configure UI (currently placeholder)

### Phase 4: Execution Core (Timeline + Approvals + Tasks)

Value: users can see what the agent is doing and approve risky actions; Tasks become a real first-class system (not just derived UI state).

- [x] Timeline storage (SQLite + blob refs) and renderer timeline UI
- [x] Approval request/response surfaced; Approve/Always Approve/Deny wired to OpenCode permission API
- [x] Implement real TaskRun persistence + IPC (`tasks:listRuns`, `tasks:getActiveRun`, optional cancel)
- [x ] Add Task run routing (Task list -> Task details) so Workflows/Chat can link to a stable task page
- [x ] Connect per-workflow approval opt-in (`approval-policies.json`) to workflow runs (not just per-session)

### Phase 5: Workflows + Commands Productization ✅ COMPLETE

Value: workflows feel immediate, have durable outputs, and are organized (no global-command clutter).

- [x] Workflows list + generator + runner exist (MVP-level)
- [x] Always create a Task immediately when a workflow starts (no delayed promotion path)
- [x] Persist WorkflowRuns + outputs (SQLite via workflow-run-store.ts)
- [x] Add Output/Artifacts for each run (final output, summary, exports) and show them in Task details
- [x] Add workflow run history (last N runs with status, duration, output preview)
- [x] Ensure workflow runs use dedicated OpenCode sessions; persist session + assistant message linkage
- [x] Surface approval requests/responses for workflow runs in Tasks (tie to workflow run + task run)
- [x] Split Workflows view into `Workflows` vs `Commands` (allowlistedGlobalCommands hook ready in workflows-runner.ts)
- [x] Replace the current per-workflow menu with a Workflow Details drawer (Always Approve, inputs, export/duplicate/delete)
- [x] Persist pins and enforce pinned limit (3 max) consistently (PinnedWorkflowsLimitError in workflows-pins-store.ts)

### Phase 5.5: Inline Approvals System Optimization ✅ COMPLETE

Value: users can safely and consistently approve/deny agent actions across all modes, with proper security, full context, and reliable state management.

**Context**: Oracle deep-dive revealed that approvals work in TasksMode but are missing from ChatMode, payload truncation prevents informed decisions, XSS vulnerabilities exist, and tool classification is inconsistent across MCP servers.

**Completed (12 PM tasks all SUCCESS)**:

- [x] Security hardening: XSS sanitization in ChatMode, IPC validation for approvals:reply, audit logging
- [x] Approval payload quality: Removed truncation, ApprovalCard handles large payloads with expand/collapse
- [x] State machine correctness: waiting_approval → running transitions, state machine tests
- [x] Chat mode actionable approvals: ApprovalCard rendered inline with approve/deny actions
- [x] Unified blocking semantics: BlockingReason model (permission vs response)
- [x] MCP tool annotations standardization across gmail/gcal/notion/system
- [x] Per-workflow Always Approve persistence + UI toggle in WorkflowDetailsDrawer
- [x] Desktop notifications for pending approvals (configStore.preferences.notifications.approvals)
- [x] End-to-end verification of approvals flow across Chat/Tasks/Workflows

### Phase 6: Onboarding + UX Polish

> **Prerequisite**: Complete Phase 5 and Phase 5.5 before starting Phase 6. Security hardening and workflow persistence are required for a polished onboarding experience.

Value: first-run success rate goes up and the product feels coherent (less "stub" UI).

- [x] Onboarding flow exists (apps, connect, provider/model, wow prompt)
- [ ] Tighten the onboarding -> integrations handshake (clear "connected" feedback, fewer dead-ends)
- [ ] Add missing UI wiring: workflow edit/duplicate/delete, custom MCP add, integration settings link
- [ ] Notifications for approvals + task completion (macOS)
- [ ] Reliability policy enforcement: retry/backoff + user messaging when MCP drops mid-task

### Phase 6.5 Onboarding and Integrations Polish

Value: integrations feel trustworthy (status reflects reality), connection UX feels polished, onboarding is shorter and more accurate.

#### Connection Status + Health Checks

Problem: current integrations status is largely “static” (token/session present) and can report “Connected” even when the integration is no longer usable (notably Canvas Playwright session expiry).

Decision: keep the existing fast “configured/credential present” status, but add a manual **Health Check** that verifies the integration actually works. Only run health checks when the user explicitly clicks **Sync** (in Integrations mode) so we do not silently ping third-party services.

UI semantics (per integration):

- **Connected**: credentials exist AND last health check succeeded.
- **Connected (Not verified yet)**: credentials exist but no successful health check has been run yet.
- **Needs reconnect**: last health check failed; user should reconnect.
- **Not connected**: no credentials.

Required new IPC surface (preload + main):

- `window.flowstate.integrations.healthCheck(service: string): Promise<{ ok: boolean; checkedAt: string; message?: string; email?: string }>`
  - Runs a minimal “whoami/profile” style request per service and returns success/failure.
  - Does not mutate tokens on failure (do not auto-remove credentials).

Health check behavior by service (MVP):

- Gmail / Google Calendar: use stored OAuth token, refresh if needed, then run a lightweight endpoint to confirm validity (and optionally return email).
- Notion (API token): call Notion “me” style endpoint to confirm token validity.
- Canvas:
  - Token mode: call Canvas API `GET /api/v1/users/self/profile` using stored `canvasApiUrl`.
  - Browser session mode (Playwright storage state): validate by performing an authenticated request using the stored state (same endpoint as above) and fail clearly when session is invalid/expired.

Persistence:

- Store per-integration `lastHealthCheckAt` + `lastHealthCheckOk` + `lastHealthCheckError` in config (or a small local store) so the UI can show “Not verified yet” vs “Needs reconnect” without background polling.

Integrations UI updates:

- **Sync** becomes “Run health check” for that integration (spinner per-card, not global).
- On failure: card shows “Needs reconnect” state + short error message + Connect button.
- On success: update “Last sync” to reflect the health check time.

Acceptance criteria:

- Canvas: if the Playwright session is expired, clicking **Sync** changes the card to “Needs reconnect” and shows a failure message (no false “Connected”).
- Gmail/GCal/Notion: clicking **Sync** produces a definitive pass/fail based on an actual API request.
- Health check is available and consistent in both Integrations mode and when launched from onboarding (same UI/components).

#### Connection Modal UX Polish

Problem: modal overlay is visually messy/too transparent and does not feel like it cleanly covers the app (notably near the top bar area).

Changes:

- Update modal overlay styling so the dim + blur feels intentional and covers the usable surface cleanly (acceptable to exclude the native title bar region, but the boundary must look deliberate).
- Improve instruction blocks for OAuth/API token flows: clearer hierarchy, more legible callouts, and better “open console” affordances.

Acceptance criteria:

- Overlay appears uniform, sufficiently opaque, and visually consistent across all modes; no “leaking” UI at the top edge.
- Instructions are more scannable (setup steps visible without hunting).

#### Onboarding: Integrations Step Matches New UI

Keep the current flow:

- Onboarding “Connect” step shows only apps selected on the “Apps” step.
- “Connect/Manage” navigates into IntegrationsMode in `onboardingMode`, uses the same ConnectionModal UI, and user returns via “Back to onboarding”.

Changes:

- Ensure onboarding uses the same polished connection modal and reflects updated status semantics.

#### Onboarding: Provider Models from OpenCode

Problem: onboarding provider models are hardcoded and drift from what OpenCode actually has configured.

Decision:

- Populate provider model options dynamically using `window.flowstate.opencode.listModels()` (same source of truth as Settings).
- Keep model selection as a `<select>` (no free-text) for onboarding simplicity.

Implementation notes:

- Derive provider groups from model IDs (`<provider>/<model>`) and show provider cards based on discovered providers.
- Use existing `providerDefinitions` only as display metadata/ordering hints; do not treat it as the authoritative model list.

Acceptance criteria:

- On first-run, provider step lists models that match the user’s actual `opencode models` output.
- Selecting a provider limits the model dropdown to models for that provider.

#### Remove “Wow Moment” From Onboarding

Decision:

- Replace the “Wow Moment” step with a simple final step that contains a single “Start FlowState” button.
- Remove all related state and props (no dead code).

Acceptance criteria:

- Onboarding steps become: `welcome → apps → connect → provider → finish`.
- No references remain to wow prompts, wow selection, or skip-wow actions in the renderer stores/components.

Files likely touched (non-exhaustive):

- `packages/desktop/src/renderer/modes/IntegrationsMode.tsx`
- `packages/desktop/src/renderer/hooks/useIntegrations.ts`
- `packages/desktop/src/renderer/stores/integrationsStore.ts`
- `packages/desktop/src/renderer/components/OnboardingFlow.tsx`
- `packages/desktop/src/renderer/stores/onboardingStore.ts`
- `packages/desktop/src/renderer/data/providerData.ts`
- `packages/desktop/src/renderer/styles/globals.css`
- `packages/desktop/src/renderer/types/electron.d.ts`
- Main/preload IPC: integrations + auth managers (new healthCheck IPC + implementation)

### Phase 6.75: Official MCP Expansion (Outlook First)

Value: expand FlowState's first-party integration surface with a repeatable "official MCP" pattern that works for both API-native providers and harder enterprise providers.

#### Research Snapshot (Feb 2026)

- `@softeria/ms-365-mcp-server` is a strong reference for Microsoft 365 MCP shape: broad tool coverage, `--org-mode`, cloud variants, and multiple auth paths (device code, auth code in HTTP mode, BYOT).
- Microsoft Graph is still the canonical and supportable Outlook integration path (mail/calendar/contacts/tasks) via delegated OAuth scopes.
- Microsoft Entra tenant policies can disable or restrict user consent; in school/work tenants this can block OAuth for custom apps without admin approval.
- Because tenant policies are enforced server-side, FlowState should not attempt to bypass organizational controls. Any browser automation path must be user-authenticated and policy-compliant.

#### Architecture Decision (for official MCPs)

Build a shared "Official MCP Framework" with provider-specific adapters:

- **Auth adapter**: OAuth/device-code/BYOT interfaces with common token lifecycle + health check contracts.
- **API adapter**: primary path for stable, policy-compliant integrations (Graph for Outlook).
- **Browser adapter (Playwright-assisted)**: optional fallback for user-initiated web interactions where API access is unavailable; defaults to read-only and requires explicit user confirmation.
- **Tool safety metadata**: every tool tagged with `auto` vs `approval_required` and data sensitivity class.

#### Outlook MCP Pseudo Plan

1. **Create `@flowstate/mcp-outlook` package scaffold**
   - Transport + tool registry + capability reporting (`authModes`, `supportsWrite`, `tenantType`, `health`).
   - Tool namespaces aligned with existing FlowState conventions (`outlook_mail_*`, `outlook_calendar_*`).

2. **Implement Graph-first auth and tools (official path)**
   - Auth modes: device code + authorization code + BYOT (parity with current FlowState auth manager patterns).
   - Initial scopes (least privilege): `User.Read`, `Mail.Read`, `Mail.ReadWrite` (optional), `Mail.Send` (approval-gated), `Calendars.Read`, `Calendars.ReadWrite`.
   - Core tool set (MVP): list/read/search mail, draft/send mail, list/create/update calendar events.

3. **Add Playwright-assisted Outlook Web mode (fallback path)**
   - Launch user-visible browser session for manual login only.
   - Persist storage state encrypted via desktop auth manager (same pattern as Canvas pending-auth flow).
   - Restrict MVP fallback to read-only inbox/calendar extraction unless user explicitly enables write actions in settings.
   - Add strict guardrails: no hidden login, no credential capture, no anti-bot/captcha circumvention, immediate "reconnect required" on session expiry.

4. **Integrations UI + onboarding updates**
   - Add Outlook card with auth mode selector: `Official OAuth` and `Browser Session`.
   - Per-mode health checks and clear status messaging (`Connected`, `Not verified`, `Needs reconnect`).
   - Show tenant-policy failure guidance ("Admin approval required") with next-step copy.

5. **Workflow + routing support**
   - Add Outlook variants of inbox-review and meeting-prep workflows.
   - Provider routing policy: prefer API adapter; fallback to browser adapter only when API path unavailable and user has enabled fallback.

6. **Quality + compliance hardening**
   - Add integration tests for token refresh, consent failure, session expiry, and tool approval boundaries.
   - Log auth mode in timeline events for observability and debugging.
   - Security review gate before enabling write tools in browser mode.

#### Generalized Official MCP Rollout (Post-Outlook)

Use Outlook as the template and then apply the same framework to additional official MCPs:

- Phase 6.75.A: Outlook MCP (mail + calendar)
- Phase 6.75.B: Microsoft To Do / Planner MCP slice (or extension inside Outlook/365 MCP)
- Phase 6.75.C: Slack official MCP
- Phase 6.75.D: Drive/Files MCP (Google Drive + OneDrive convergence strategy)

Each new official MCP must include:

- Auth mode matrix (OAuth/device-code/token/browser where applicable)
- Health check contract and reconnect UX
- Tool autonomy classification
- Minimum workflow coverage (at least one prebuilt workflow)

#### Acceptance Criteria (Phase 6.75)

- Outlook appears in Integrations with two explicit connection modes and clear guardrail copy.
- Graph mode supports end-to-end read + draft flows; send/create actions are approval-gated.
- Browser Session mode works for user-authenticated read flows and fails safely when session expires.
- No claim or behavior in product/docs suggests bypassing tenant or school authorization policy.
- Architecture artifacts (PLAN + AGENTS responsibilities) reflect the reusable official MCP framework.

### Phase 7: Testing + Launch Prep

Value: repeatable builds, fewer regressions, and a shippable beta.

- [ ] Add e2e happy-path tests: onboarding -> connect -> run a workflow -> approve -> output saved
- [ ] Add regression tests for timeline normalization + storage
- [ ] Performance pass (timeline virtualization, memory usage, native module rebuild ergonomics)
- [ ] Package unsigned DMG + docs + demo video
- [ ] Improve ChatMode.tsx to better use Headers System for better performance and reliability (reduce re-renders, fix edge cases with large messages)
- [ ] ChatMode.tsx should allow users to cancle message generation (currently no way to stop a runaway message stream); add a button that calls `session.cancel()` and properly handles UI state cleanup
- [ ] Clean up Sidebar to use Real-Time Data (e.g. active workflow run, pending approvals) instead of stale session state
- [ ] Clean Sidebar Clean and allow users to search for previous conversations / sessions

### Phase 8: Academic Intelligence - Canvas Document Study Pack Engine

Value: FlowState can pull Canvas course files (PDF + PPTX), interpret them with source-grounded reasoning, and generate high-quality study materials with citation traceability.

#### Phase 8 Product Goal

Enable users to ask:

- "Build study materials for my next exam from Canvas"
- "Use my latest slides and make a practice exam"
- "Refresh my study pack because new lecture files were uploaded"

And FlowState should:

1. Pull scoped source docs from Canvas (and local attachments in MVP).
2. Parse PDFs + PPTX slide text + speaker notes.
3. Merge context at course level.
4. Generate study outputs with per-section inline citations.
5. Save outputs to user-selected destination (ask every run).

#### Confirmed Phase 8 Decisions (Interview Locked)

- Destination selection is asked every run; if unknown, suggest local file fallback (Downloads).
- Destination options include Notion, Obsidian vault write, and local files.
- MVP output bundle: quiz/practice exam + summary sheet/exam review + flashcards (if possible).
- Citation model: per-section citations with inline tags.
- Extraction failures are non-blocking: continue with uncertainty markers and recovery guidance.
- Two-tier reasoning mode: Conservative (source-grounded) and Coaching (light inference), but practice content remains strictly source-derived.
- Context scope is course-level merged context.
- Output is versioned on reruns; include summary diff.
- Refresh policy is event-driven suggestion + one-click regenerate (also when exam proximity signals urgency).
- Autonomy policy: auto for read/extract/compose; approval required for external writes.
- Canvas scope is strict explicit course scope first.
- PPTX MVP extraction includes slide text + speaker notes only.
- OCR is out of MVP; image-only/scanned sections are flagged.
- Stable internal schema is required in Phase 8.
- Notion destination uses hybrid model (DB row + rich page).
- Personalization uses user profile with transparency notice.
- Learning science defaults are lightweight and on by default.
- Quality gate runs before write; failed gate produces draft preview + explicit "write anyway" approval.
- Task summary order: succeeded -> gaps -> next actions.
- Storage is local durable with user-controlled purge and per-course retention.
- Concurrency defaults to 2, configurable up to 3.
- External knowledge retrieval is allowlist-based + explicit user toggle.
- Metrics are local-only with export (JSON/CSV).

#### User Experience Flow (Phase 8 MVP)

1. User prompt in Chat or Workflow: "Create study materials for [Course]".
2. FlowState prompts for destination (Notion / Obsidian / Local).
3. FlowState prompts source scope mode:
   - Course-wide recent files, or
   - Explicit file selection.
4. FlowState creates a TaskRun and routes to Tasks mode.
5. Pipeline runs: discover -> extract -> normalize -> generate -> validate -> preview.
6. User sees draft preview + quality summary + extraction gaps.
7. If quality gate passes, user approves write destination action.
8. Outputs saved and versioned; run summary includes diff vs previous run.

#### Destinations and Output Format

Destination is user-selected per run.

- Notion (hybrid):
  - one DB row per study material run (metadata),
  - linked page with full outputs, citations, and extraction warnings,
  - optional attached artifacts.
- Obsidian:
  - direct vault write (path selected/approved by user),
  - markdown files + flashcards CSV artifact.
- Local fallback:
  - folder output in Downloads by default,
  - `summary.md`, `practice-exam.md`, `flashcards.csv`, `run-metadata.json`.

#### Source Ingestion Scope (MVP)

Supported sources:

- Canvas course files (strict explicit course scope).
- Local file attach (manual upload path).

Supported file types:

- PDF (text extraction).
- PPTX (slide text + speaker notes).

Out of MVP:

- OCR for scanned/image-only content.
- Non-PDF/non-PPTX academic format expansion.

#### Generation and Guardrails

Generation outputs:

- Summary Sheet / Exam Review.
- Practice Exam / Quiz.
- Flashcards (Anki-friendly CSV first).

Grounding and creativity policy:

- Practice questions are strictly source-derived.
- Per-section inline citations are required in generated outputs.
- External knowledge augmentation is configurable via settings and constrained to allowlisted domains.

Quality gate checks before write:

- Citation coverage threshold (default 80%).
- Duplicate question threshold (default <10%).
- Source coverage requirement (selected files represented).
- Parsing uncertainty report attached to run.

If quality gate fails:

- Show draft preview + issues.
- Require explicit "write anyway" approval to persist externally.

#### Data Model Additions (Phase 8)

Add durable local entities (SQLite + file artifacts):

- `SourceDocument`
  - `id`, `courseId`, `origin` (`canvas` | `local`), `fileType`, `title`, `sourceRef`, `versionHash`, `ingestedAt`.
- `StudyMaterialRun`
  - `id`, `courseId`, `taskRunId`, `mode` (`conservative` | `coaching`), `destinationType`, `status`, `qualityScore`, `createdAt`, `updatedAt`.
- `StudyMaterialArtifact`
  - `id`, `studyRunId`, `kind` (`summary` | `practice_exam` | `flashcards` | `report`), `pathOrBlobRef`, `mime`, `createdAt`.
- `CitationSpan`
  - `id`, `studyRunId`, `artifactId`, `sectionId`, `sourceDocumentId`, `sourceLocator` (`page`/`slide`/`note`), `confidence`.
- `ExtractionIssue`
  - `id`, `studyRunId`, `sourceDocumentId`, `kind`, `detail`, `severity`.
- `StudyRunDiff`
  - `id`, `studyRunId`, `previousStudyRunId`, `summary`.

#### Settings Additions (Phase 8)

New settings in Integrations/Agent/Storage surfaces:

- External knowledge mode toggle (allowlisted domains only).
- Generation mode default (Conservative vs Coaching).
- Max concurrent study runs (default 2, max 3).
- Retention + purge controls:
  - per-course,
  - per-source-file,
  - cache class,
  - global TTL override.
- Destination preferences (optional suggestions only; destination still asked each run).

#### Task and Timeline Behavior

- Any study-material generation request is promoted to Tasks mode.
- Timeline emits explicit stages:
  - source discovery,
  - extraction,
  - uncertainty detection,
  - generation,
  - quality gate,
  - destination write.
- Summary ordering in task completion:
  - what succeeded,
  - what gaps remain,
  - recommended next actions.

#### Metrics (Local Only)

Track locally and expose in dashboard/export:

- Citation coverage.
- Rerun frequency.
- User acceptance/edit rate.

Export formats:

- JSON.
- CSV.

#### Phase 8 Acceptance Criteria

- User can select a Canvas course (or local files), generate a study pack, and save to selected destination.
- Generated summary + practice exam include inline per-section citations.
- PPTX speaker notes are included when present.
- Extraction uncertainty is surfaced clearly when OCR-like limitations occur.
- Failed quality gate blocks write by default and requires explicit "write anyway" approval.
- Runs are versioned; reruns include a summary diff.
- Notion hybrid write path and Obsidian direct vault write both function end-to-end.
- Concurrency honors default 2 and configurable cap up to 3.
- Metrics are available locally and exportable with no telemetry.

#### Phase 8 Implementation Checklist

- [x] Add Phase 8 schema + migrations for source docs, study runs, artifacts, citations, extraction issues, and run diffs
- [ ] Implement Canvas source discovery + explicit file picker flow (course-wide + file-scoped)
- [x] Implement local file attach flow for PDF/PPTX
- [x] Implement PDF parser and PPTX parser (slide text + speaker notes)
- [x] Add extraction uncertainty detector and issue model
- [x] Build generation orchestrator for summary + practice exam + flashcards
- [x] Add per-section inline citation formatter and source map rendering
- [x] Add quality gate evaluator and draft-only failure path
- [x] Add destination router (Notion hybrid, Obsidian direct vault, local folder output)
- [x] Add study run versioning + diff summarizer
- [x] Add settings UI for external knowledge toggle, concurrency, and retention/purge controls
- [x] Add local metrics dashboard + JSON/CSV export
- [x] Add e2e tests: Canvas scope -> generate -> quality gate -> destination write -> rerun diff

#### Phase 8 completed (Feb 18 2026)

- Implemented Canvas-failure fallback UX with local upload recovery and structured failure handling.
- Shipped destination confirmation + destination routing for final write paths.
- Completed PDF/PPTX parsing, generation orchestration, inline citation/provenance persistence, and rerun diff support.
- Added settings and local metrics/export surfaces, then closed Phase 8 with passing e2e and regression verification batches.

#### Phase 8 Implementation Status (as of Feb 18 2026)

**All 44 Phase 8 tests pass (10 test files, 0 failures).**

What is fully built and working:

| Component | File | Status | Tests |
|-----------|------|--------|-------|
| SQLite persistence (6 tables, full CRUD) | `study-material-store.ts` (793 lines) | Complete | 6/6 |
| Local file validation (path, ext, size, magic bytes, SHA-256) | `study-material-source-validation.ts` (302 lines) | Complete | 8/8 |
| Canvas failure classification (5 failure types + recommendations) | `study-material-fallback.ts` (146 lines) | Complete | 5/5 |
| Quality gate evaluator (4 checks, composite score, write-anyway) | `study-material-quality-gate.ts` (139 lines) | Complete | 4/4 |
| IPC handlers (15 handlers across studyMaterials namespace) | `main/index.ts` | Complete | covered by above |
| Preload bridge (full studyMaterials namespace) | `preload/index.ts` | Complete | — |
| TypeScript interfaces (all Phase 8 types) | `renderer/types/electron.d.ts` | Complete | — |
| Drag-and-drop upload in ChatMode | `ChatMode.tsx` | Complete | — |
| Upload validation + SourceDocument creation flow | `ChatMode.tsx` | Complete | — |
| Context injection (attached sources prepended to AI messages) | `ChatMode.tsx` + `useOpenCode.ts` | Complete | — |
| Agent skill for reading local study sources | `.opencode/skills/read-local-study-sources/SKILL.md` | Complete | — |

**Known issue — migration version conflict risk:** `study-material-store.ts` uses SQLite `user_version` pragma for migration tracking, but this is database-global. If `timeline-store.ts` or `task-store.ts` also use `user_version` on the shared `memory.db`, migrations could be skipped or re-run. Must be investigated before production use.

#### Phase 8 Completion Plan: Canvas-Failure Local Upload Fallback

Goal: when Canvas document pull fails, users can seamlessly switch to local PDF/PPTX upload and still complete a high-quality study-pack run.

Execution is organized as dependency-aware waves to maximize parallelism and minimize rework.

Wave A (foundation) — COMPLETE

- [x] `phase-8.a1` Add desktop file-picker IPC for local source files (`showOpenFilesDialog`) with PDF/PPTX filters, multi-select support, and path normalization.
- [x] `phase-8.a2` Add `studyMaterials:sources:*` IPC + preload + renderer typing for `SourceDocument` CRUD.
- [x] `phase-8.a3` Add local source validation (type, MIME sniff, size bounds, hash/version) and safe error mapping.

Wave B (fallback orchestration + UX) — COMPLETE

- [x] `phase-8.b1` Detect classified Canvas source failures (`auth_expired`, `external_host`, `inaccessible`, `timeout`) and emit structured fallback events.
- [x] `phase-8.b2` Add fallback decision UX in Chat/Tasks timeline: `Retry Canvas now` vs `Upload local file instead`.
- [x] `phase-8.b3` Implement upload flow states: pick file -> validate -> attach to run -> resume generation pipeline.
- [x] `phase-8.b4` Enforce destination confirmation each run before final write (`Notion`, `Obsidian`, `Local`) with explicit user approval for external writes.

Wave C (generation quality and provenance) — COMPLETE

- [x] `phase-8.c1` Unify local and Canvas document parsing behavior for PDF/PPTX (including PPTX speaker notes and uncertainty flags).
- [x] `phase-8.c2` Persist extraction issues and citation spans for fallback runs; ensure per-section inline citation rendering remains intact.
- [x] `phase-8.c3` Keep quality-gate blocking default for failed runs, with explicit `write anyway` approval path.

Wave D (verification and hardening) — COMPLETE

- [x] `phase-8.d1` Add e2e: Canvas failure -> fallback upload -> generate -> quality gate -> destination write -> rerun diff.
- [x] `phase-8.d2` Add regression tests for unsupported files, oversized files, duplicate uploads/version hash behavior, and repeated retry loop prevention.
- [x] `phase-8.d3` Add timeline assertions for fallback stage ordering: discover -> fallback decision -> upload/validate -> generate -> quality gate -> write.

Parallelization and dependency notes

- Wave A tasks can run in parallel except `a3` should consume finalized picker and source contract from `a1/a2`.
- Wave B depends on Wave A completion.
- Wave C can start once `b3` is in place; `c2/c3` can run in parallel.
- Wave D gates merge readiness and should run after B+C verification.

Definition of done for this fallback slice

- A user can recover from Canvas file pull failure without leaving the current run.
- User can upload local PDF/PPTX, see validation feedback, and continue generation.
- Generated outputs preserve citation traceability and quality-gate behavior.
- Destination selection is explicit per run and defaults never write into project source paths.
- Tests cover both happy path and failure/retry edge cases.

#### Phase 8 Continuation Steps (historical execution order)

The following steps were used to execute and close Phase 8 and are kept as a historical implementation sequence.

**Step 1 — Add "Browse files" button to ChatMode (trivial)**
The `app:showOpenFilesDialog` IPC handler already exists and works. Add a small paperclip/attach button next to the ChatMode input that calls `window.flowstate.studyMaterials.sources.validateLocal()` after the file picker returns. Wire it into the same `uploadStudySourceFiles()` flow that drag-and-drop uses.
Files: `ChatMode.tsx`

**Step 2 — Investigate and fix migration version conflict**
`study-material-store.ts` uses SQLite `PRAGMA user_version` which is DB-global. Check whether `timeline-store.ts` and `task-store.ts` also use `user_version` on the shared `memory.db`. If so, migrate all stores to a `_migrations` table keyed by store name, or use separate DB files per store.
Files: `study-material-store.ts`, `timeline-store.ts`, `task-store.ts`

**Step 3 — Build PDF text extractor**
Add a `study-material-pdf-parser.ts` module that uses `pdf-parse` (or similar) to extract text from PDF files. Return structured output: `{ pages: Array<{ pageNumber: number, text: string }>, metadata: { title, author, pageCount } }`. Flag pages with no extractable text (likely scanned/image-only) as `ExtractionIssue` with kind `ocr_required`.
Files: new `study-material-pdf-parser.ts`, new test file

**Step 4 — Build PPTX parser (slide text + speaker notes)**
Add a `study-material-pptx-parser.ts` module. PPTX files are ZIP archives; extract `ppt/slides/slide*.xml` for slide text and `ppt/notesSlides/notesSlide*.xml` for speaker notes. Return `{ slides: Array<{ slideNumber: number, text: string, speakerNotes: string | null }> }`. Flag slides with no text as potential image-only. Use `adm-zip` or `jszip` for ZIP handling and a lightweight XML parser.
Files: new `study-material-pptx-parser.ts`, new test file

**Step 5 — Build generation orchestrator**
Create `study-material-orchestrator.ts` that chains: (1) discover sources for course → (2) extract text via PDF/PPTX parsers → (3) normalize/merge extracted text at course level → (4) generate outputs (summary, practice exam, flashcards) via AI prompts → (5) run quality gate → (6) present draft preview → (7) write to destination on approval. This is the core pipeline. Each step should emit timeline events. The orchestrator should create a `StudyMaterialRun` and update its status as it progresses.
Files: new `study-material-orchestrator.ts`, new test file

**Step 6 — Add fallback decision UX (phase-8.b2)**
When Canvas source pull fails and the fallback classifier fires, show an inline decision card in the Chat/Tasks timeline: "Canvas returned [error type]. Retry Canvas now / Upload local file instead". Wire the "Upload" action to the file picker flow from Step 1.
Files: `ChatMode.tsx` or a new `FallbackDecisionCard.tsx` component

**Step 7 — Add destination confirmation flow (phase-8.b4)**
Before final write, prompt the user with a destination selection: Notion / Obsidian / Local (Downloads). The `studyMaterials:runs:confirmDestination` IPC handler exists but has no UI. Add a modal or inline card that presents the three options, remembers the last choice as a suggestion, and requires explicit confirmation.
Files: new `DestinationConfirmation.tsx` component, wire into orchestrator

**Step 8 — Build destination router**
Implement the actual write paths: (a) **Local**: write `summary.md`, `practice-exam.md`, `flashcards.csv`, `run-metadata.json` to user-selected folder. (b) **Notion**: create DB row for run metadata + linked page with rich content, citations, and warnings. (c) **Obsidian**: write markdown files + CSV to vault path.
Files: new `study-material-destination-router.ts`, new test file

**Step 9 — Add inline citation rendering**
The `CitationSpan` data model and persistence are complete. Build a formatter that takes generated output text + citation spans and produces markdown/JSX with inline citation tags (e.g., `[Source: Lecture 5, Slide 12]`). Apply during generation step in the orchestrator.
Files: new `study-material-citation-formatter.ts`, integrate into orchestrator

**Step 10 — Add study run versioning + diff UI**
`StudyRunDiff` storage works. Build a summarizer that compares two runs for the same course and produces a human-readable diff (new content, removed content, updated sections). Show in the timeline after a rerun completes.
Files: new `study-material-diff-summarizer.ts`, UI component for diff display

**Step 11 — Add Phase 8 settings**
Add settings surface entries for: external knowledge toggle, generation mode default, max concurrent runs, retention/purge controls. Wire to existing settings infrastructure.
Files: settings UI components, settings store integration

**Step 12 — Add metrics dashboard + export**
Track citation coverage, rerun frequency, user acceptance rate locally. Add a dashboard view and JSON/CSV export.
Files: new metrics components

**Step 13 — Add e2e tests (phase-8.d1/d2/d3)**
Full pipeline e2e: Canvas failure → fallback upload → generate → quality gate → destination write → rerun diff. Regression tests for edge cases. Timeline stage ordering assertions.
Files: new e2e test files

#### Legacy Spec: Unified Real-Time Timeline

> Goal: show users what FlowState is doing _in real time_ via a single, chronological activity feed. No tabs—just a live stream of steps, tool calls, and approvals that auto-scrolls as work progresses.

**Task Promotion (Hybrid)**:

- Agent can explicitly promote a chat to a Task.
- FlowState can auto-promote based on heuristics (runtime > 60s, multi-tool chains, multi-step approvals).
- **MVP constraint**: one active Task per session; new tasks can start after completion.
- Once promoted, execution continues in Tasks; Chat shows a single handoff card with a “View Task” CTA.
- No “Keep in Chat” option.
- Completed task runs end with a **timeline-derived summary**, which becomes the last assistant message in the original chat.

**Task Progress**:

- Percent progress derived from completed steps vs. total steps in the timeline (approvals count as steps).
- Tasks display current step + progress bar; Chat shows a collapsed current step indicator.

**Timeline Event Schema** (`TimelineEvent`):

```typescript
type TimelineEvent = {
  id: string; // UUID
  sessionId: string;
  taskId?: string; // if promoted to Task
  timestamp: number; // epoch ms
  kind:
    | "phase"
    | "tool_call"
    | "tool_result"
    | "approval_request"
    | "approval_response"
    | "error"
    | "status";
  title: string; // user-friendly label

  detail?: string; // short description (≤120 chars)
  toolName?: string; // e.g. "gmail_search"
  // For large payloads, store reference instead of inline
  payloadRef?: string; // file path to blob on disk (if ≥10KB)
  payloadInline?: unknown; // JSON if <10KB
  redacted?: boolean; // true if secrets were stripped
};
```

**Storage strategy (performance-first)**:

| Data                     | Location                                                                             | Reason                             |
| ------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------- |
| `TimelineEvent` metadata | SQLite row                                                                           | Fast queries, pagination           |
| Payload < 10 KB          | `payloadInline` (JSON in SQLite)                                                     | Single read, no extra I/O          |
| Payload ≥ 10 KB          | Disk blob (`~/Library/Application Support/FlowState/blobs/<id>.json`) + `payloadRef` | Keeps DB lean; lazy-load on expand |

**Implementation checklist**:

- [ ] Audit OpenCode `client.event.subscribe()` and document all event types we need to capture
- [ ] Expand `ProcessManager.startEventStream` to forward _all_ relevant events (tool._, permission._, message._, session._, error.\*) with redaction of secrets (`/token|secret|key|password|credential|bearer/i`)
- [ ] Create `TimelineEventNormalizer` class in main process: raw OpenCode event → `TimelineEvent`
- [ ] Implement `TimelineStore` (SQLite table + blob dir) with append, query-by-session, and retention (90-day default, configurable)
- [ ] Build `<ActivityTimeline>` React component: auto-scroll, collapsible in Chat (shows latest step inline), fully expanded in Tasks "Run Details"
- [ ] Inline approval cards within timeline when `kind === 'approval_request'`
- [ ] Add "Developer Mode" toggle (Settings): shows raw JSON + full payloads; secrets _still_ redacted even in dev mode
- [ ] Add "Export Debug Bundle" action per run: zips messages + timeline + blobs (with explicit user warning)

**UI behavior**:

```
Chat Mode (collapsed):
┌─────────────────────────────────────────────────────────┐
│ ⏳ Searching Gmail for unread emails…            [▾]   │
└─────────────────────────────────────────────────────────┘

Chat Mode (expanded via [▾]):
┌─────────────────────────────────────────────────────────┐
│  Activity                                               │
│  ───────────────────────────────────────────────────────│
│  ✓ Understanding your request                   2:34:01│
│  ✓ Searching Gmail (gmail_search)               2:34:03│
│  ✓ Found 23 unread messages                     2:34:05│
│  ⏳ Reading email from Sarah…                   2:34:07│
│                                                         │
│  ┌─────────────────────────────────────────────────────┐
│  │ 📧 Approval Required                                │
│  │ Send reply to sarah@example.com                     │
│  │ [Approve]  [Always Approve]  [Deny]                 │
│  └─────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────┘

Tasks Mode "Run Details": same timeline, always expanded, virtualized for long runs.
```

---

#### Legacy Spec: MCP Efficiency (Gmail-first) — Smart Metadata Defaults

> Goal: reduce LLM context/token cost by returning lean, structured data by default. Full bodies are fetched _only_ on explicit request.

**Default response shape** for `gmail_list` / `gmail_search`:

```typescript
// Per message (default detailLevel: 'metadata')
{
  id: string;
  threadId: string;
  snippet: string;            // ~100 char preview
  headers: {
    from: string;
    to: string;
    subject: string;
    date: string;             // ISO 8601
  };
  labelIds: string[];         // e.g. ["INBOX", "UNREAD"]
  // NO body, NO attachments, NO raw payload
}
```

**Controlled expansion** via optional params on `gmail_read`:

| Param          | Type                                | Default      | Description                          |
| -------------- | ----------------------------------- | ------------ | ------------------------------------ |
| `detailLevel`  | `'ids'` \| `'metadata'` \| `'full'` | `'metadata'` | How much data to return              |
| `maxBodyChars` | `number`                            | `2000`       | Truncate body to N chars (full mode) |
| `includeHtml`  | `boolean`                           | `false`      | Return HTML part if available        |

**New tool**: `gmail_get_thread`

```typescript
gmail_get_thread({
  threadId: string;
  maxMessages?: number;       // default 5
  detailLevel?: 'metadata' | 'full';
})
```

**Implementation checklist**:

- [ ] Refactor `gmail_list` / `gmail_search` to use Gmail API `format: 'metadata'` + `fields` param for partial response
- [ ] Refactor `gmail_read` to accept `detailLevel`, `maxBodyChars`, `includeHtml`; default to metadata-only
- [ ] Add `gmail_get_thread` tool with `maxMessages` limit
- [ ] Implement LRU in-memory cache (100 messages) in Gmail MCP to avoid repeat fetches within a session
- [ ] Add guardrails: `maxResults` default 10 (cap 50), body truncation, and `contentRef` handle for oversized payloads (>50KB) so UI can lazy-expand
- [ ] Update FlowState agent prompt to follow two-step pattern: (1) list/search metadata, (2) selectively `gmail_read` top N messages
- [ ] Update workflow templates (e.g. `inbox-review`) to use lean tools

**Token savings estimate**: typical inbox scan drops from ~80K tokens (full payloads for 20 emails) to ~4K tokens (metadata only), with selective reads adding ~2K per expanded email.

### Phase 3.75: Canvas + School-Friendly Login (Folded Into Phases 3/6)

Canvas is already present in the codebase (Canvas MCP + integration surface). Remaining work belongs in integrations/onboarding polish:

- [ ] Decide the supported Canvas auth modes for MVP (API token vs browser storage-state)
- [ ] If browser login is required: implement the Playwright storage-state flow and wire it into onboarding + integrations
- [ ] Add 2-3 student workflows that use Canvas (pull assignments, summarize upcoming deadlines, generate study plan)

---

## What We're Salvaging from Existing Code

| Component                       | Salvageable | How We'll Use It                        |
| ------------------------------- | ----------- | --------------------------------------- |
| `@flowstate/mcp-notion`         | ✅ Yes      | Spawn as child process, unchanged       |
| `@flowstate/mcp-gmail`          | ✅ Yes      | Spawn as child process, unchanged       |
| `@flowstate/mcp-gcal`           | ✅ Yes      | Spawn as child process, unchanged       |
| `@flowstate/mcp-system`         | ✅ Yes      | Spawn as child process, unchanged       |
| `@flowstate/core/auth`          | ✅ Yes      | Port to Electron main process           |
| `@flowstate/core/memory`        | ✅ Yes      | Port to Electron main process           |
| `@flowstate/core/notifications` | ✅ Partial  | Adapt for Electron native notifications |
| `@flowstate/core/daemon`        | ❌ No       | Electron main process replaces daemon   |
| `@flowstate/web-config`         | ❌ No       | Fresh React UI in desktop package       |
| Agent definitions               | ✅ Yes      | Copy to desktop package                 |
| Theme colors                    | ✅ Yes      | Port to Tailwind theme                  |
| FlowState logo                  | ✅ Yes      | Copy to desktop assets                  |
| opencode.json                   | ✅ Partial  | Adapt for desktop config format         |

---

## Future Considerations (Post-MVP)

### Multi-Session Support (P1 - Target: v1.1)

> **Decision (Feb 2026)**: Current single-active-session model is acceptable for MVP. Workflows already run in parallel via detached sessions. Full multi-stream support planned for post-launch.

**Current Behavior:**

- Workflows use detached sessions → run in parallel ✅
- Chat has single `activeSessionId` → only one chat can actively stream at a time
- User can switch between conversations, but only one processes at a time
- Sending to a session with an active task is blocked

**Target Behavior (Option B - Multi-Stream):**

- Multiple chat conversations can process simultaneously
- User can watch multiple conversations stream responses in real-time
- Each conversation has independent `isProcessing` state
- Sidebar shows which conversations are "thinking"

**Implementation Scope:**

1. Decouple event stream from single `activeSessionId`
2. Route events to correct renderer context by sessionId
3. Session switcher UI shows per-conversation processing state
4. Global status indicator: "N conversations processing"
5. Desktop notification when background conversation completes

**Architecture Changes Required:**

- `ProcessManager`: Support multiple active event streams
- `chatStore`: Per-session processing state (not global `isLoading`)
- IPC: Filter/route events by sessionId to correct store slice
- Consider WebSocket-based session multiplexing for efficiency

---

## Beta Packaging + Launch Program (v0.1.0-beta)

This section defines the packaging and beta-readiness execution plan for initial external testers.

### Program Goal

Ship a reproducible, installable macOS beta build with clear onboarding, support channels, rollback path, and release quality gates.

### Phase DAG (PM-Executable)

```text
phase.beta.1_release-hardening
  -> phase.beta.2_packaging-pipeline
  -> phase.beta.3_tester-experience
  -> phase.beta.4_beta-operations
  -> phase.beta.5_launch-gate
```

### Phase Details

#### `phase.beta.1_release-hardening`
- Scope: lock release target, validate critical UX flows, freeze risky feature work.
- Outputs:
  - Beta scope manifest (what is in/out).
  - Critical-path checklist (onboarding, auth, workflow run, approval, export).
  - Known-issues list with severity labels.
- Exit criteria:
  - All P0/P1 defects closed or explicitly waived.
  - Reproducible local build + test commands documented.

##### `phase.beta.1` execution spec (required)

**A) Beta Scope Manifest (template)**

```md
## Beta Scope Manifest (`beta-scope-manifest.md`)

Release Target: v0.1.0-beta
Owner: <name>
Date Frozen: <YYYY-MM-DD>

### In Scope (must ship in beta)
- [ ] <feature or flow>
- [ ] <feature or flow>

### Out of Scope (not allowed in beta build)
- [ ] <feature or flow>
- [ ] <feature or flow>

### Deferred (accepted gap with planned follow-up)
- [ ] <feature or flow> -> Target: <phase/version>
- [ ] <feature or flow> -> Target: <phase/version>
```

**B) Critical-Path Validation Matrix (must pass before phase exit)**

| Flow | Precondition | Validation Action | Expected Outcome | Evidence Required |
| --- | --- | --- | --- | --- |
| Onboarding | Fresh local app data state | Complete first-launch onboarding with default provider path | User reaches Home/Chat without crash; provider config persists after restart | Screenshot of completion + persisted config key/value |
| Auth | Notion or Google integration disconnected | Connect one OAuth integration, restart app, verify connected state | Token survives restart in encrypted storage; integration shows connected in UI | Log snippet + UI proof after restart |
| Workflow Run | At least one bundled workflow available | Run one bundled workflow from Workflows mode | Workflow creates Task, auto-routes to Tasks, timeline events stream, terminal status recorded | Task timeline excerpt + final status record |
| Approval | Workflow/chat action that triggers approval-gated tool call | Validate `Approve`, `Always Approve`, and `Deny` paths in one session | `Approve` executes once, `Always Approve` suppresses later prompts for same run, `Deny` blocks action and records denial | Three timeline events showing each path outcome |
| Export | Completed workflow/task run with timeline data | Export run bundle from UI/command path | Export artifact is created, readable, and redacted of secrets/tokens | Artifact path + redaction check notes |

**C) Known-Issues Policy + P0/P1 Waiver Rules**

- Severity labels: `P0` (data loss, security exposure, app unusable), `P1` (critical flow blocked, no safe workaround), `P2` (major but workable degradation), `P3` (minor defect/documentation/UI polish).
- `P0` waiver policy: **not permitted**. Every `P0` must be fixed and verified before `phase.beta.1_release-hardening` can exit.
- `P1` waiver policy: permitted only with explicit written waiver containing owner, user impact, workaround, rollback/hotfix plan, and expiration date.
- `P1` waiver approvals required from all of: release owner + verifier owner + product owner. Missing any signer means waiver is invalid.
- Any waived `P1` auto-fails launch gate if not resolved or re-approved before `phase.beta.5_launch-gate` review.

**D) Reproducible Local Verification Command Sequence (clean state)**

Run from repo root (`flowstate/`) on a clean working tree:

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter @flowstate/desktop clean`
3. `pnpm lint && pnpm typecheck && pnpm test`
4. `pnpm --filter @flowstate/desktop build`
5. `pnpm --filter @flowstate/desktop package:mac`

Expected verification output: desktop artifacts generated under `packages/desktop/out/` with no failing lint/type/test/package step.

#### `phase.beta.2_packaging-pipeline`
- Scope: deterministic packaging and artifact production for macOS testers.
- Outputs:
  - Repeatable command flow for building desktop artifacts.
  - Unsigned DMG and zipped app artifact naming convention.
  - SHA256 checksum generation + artifact manifest.
- Exit criteria:
  - Packaging succeeds from clean machine state.
  - Install/uninstall instructions validated end-to-end.

##### `phase.beta.2` execution spec (required)

**A) Deterministic Packaging Runbook (clean environment + exact order)**

Run from repo root (`flowstate/`) on a clean working tree. Do not skip or reorder:

1. `git status --porcelain` (must return no modified/untracked files for release run)
2. `rm -rf packages/desktop/out packages/desktop/dist`
3. `pnpm install --frozen-lockfile`
4. `pnpm --filter @flowstate/desktop clean`
5. `pnpm lint && pnpm typecheck && pnpm test`
6. `pnpm --filter @flowstate/desktop build`
7. `pnpm --filter @flowstate/desktop package:mac`
8. `mkdir -p packages/desktop/out/release`
9. Copy only beta deliverables into `packages/desktop/out/release/` (DMG first, then zip)

Determinism rules:
- Packaging must run on a clean machine state or fresh CI runner with pinned lockfile.
- Artifact set is invalid if any step above is retried in-place after a failure; restart from step 1.
- Distribution order is DMG-first (primary tester path), zip second (fallback for extraction/manual app move).

**B) Artifact Naming Convention (DMG + zip)**

Use this exact naming format for copied release artifacts:

`FlowState-v<version>-beta+<build>-macos-<arch>.<ext>`

- `<version>`: semantic version from root package (`0.1.0` for this program)
- `<build>`: release identifier `b<YYYYMMDD>.<shortsha>` (example: `b20260223.a1b2c3d`)
- `<arch>`: `arm64` or `x64`
- `<ext>`: `dmg` for primary installer, `zip` for fallback bundle

Example pair for one architecture:
- `FlowState-v0.1.0-beta+b20260223.a1b2c3d-macos-arm64.dmg`
- `FlowState-v0.1.0-beta+b20260223.a1b2c3d-macos-arm64.zip`

**C) SHA256 + Artifact Manifest Generation (traceable)**

From repo root, after naming artifacts in `packages/desktop/out/release/`:

1. `cd packages/desktop/out/release`
2. `shasum -a 256 FlowState-v*-beta+*-macos-*.dmg FlowState-v*-beta+*-macos-*.zip > SHA256SUMS.txt`
3. Create `artifact-manifest.json` with one entry per artifact including:
   - `name`, `sha256`, `bytes`, `arch`, `channel` (`beta-private`), `primary` (`true` for DMG), `builtAt` (ISO 8601), `gitSha`, `version`
4. Verify checksum traceability:
   - `shasum -a 256 -c SHA256SUMS.txt`
   - each `artifact-manifest.json` entry must map to an identical `SHA256SUMS.txt` digest

Required deliverables in `packages/desktop/out/release/`:
- DMG + zip artifacts
- `SHA256SUMS.txt`
- `artifact-manifest.json`

**D) GitHub Draft Release Flow (private-access distribution)**

Release process (testable, repeatable):

1. Create release branch/tag for target build (`v0.1.0-beta+<build>`).
2. Open draft release only (do not publish):
   - Title: `FlowState v<version> Beta (<build>)`
   - Tag: `v<version>-beta+<build>`
   - Mark as pre-release.
3. Upload assets in this order:
   1) DMG(s) 2) zip(s) 3) `SHA256SUMS.txt` 4) `artifact-manifest.json`
4. Add release notes sections:
   - `Install (DMG first)`
   - `Gatekeeper workaround for unsigned app`
   - `Checksum verification`
   - `Known issues`
   - `Uninstall`
5. Keep release in **draft** state and share only with approved private beta cohort via direct collaborator access.
6. Before any publish action, verifier confirms checksum + manifest + install checklist evidence.

**E) Unsigned DMG Install/Uninstall Validation Checklist**

Execute and record evidence on the packaging host architecture for phase.beta.2. Cross-architecture coverage (2 Apple Silicon + 1 Intel across at least 2 macOS versions) is enforced at `phase.beta.5_launch-gate` cohort gate:

- Install:
  - Download DMG from draft release assets and verify `shasum -a 256 -c SHA256SUMS.txt` passes.
  - Mount DMG, drag `FlowState.app` to `/Applications`.
  - First launch via Finder context menu `Open` (expected unsigned warning path).
  - Confirm app boots to Home, no startup crash, and creates local app data directory.
- Re-launch:
  - Quit and reopen from `/Applications/FlowState.app` without repeating bypass steps.
  - Confirm user config persists across relaunch.
- Uninstall:
  - Remove `/Applications/FlowState.app`.
  - Remove support data under `~/Library/Application Support/FlowState/`.
  - Validate no running background process remains for FlowState.
- Evidence required:
  - Installer screenshots (warning + successful first launch), checksum output, uninstall confirmation notes.

#### `phase.beta.3_tester-experience`
- Scope: first-run experience, docs, and tester instrumentation.
- Outputs:
  - Beta guide (`install`, `Gatekeeper workaround`, `connect integrations`, `known limits`).
  - In-app beta feedback entry point (link or command).
  - Privacy notice for local-only data and optional log sharing.
- Exit criteria:
  - First-run validation protocol is finalized and one internal smoke run completes in <=15 minutes.
  - Required support docs are in-repo and versioned.
  - Five-session non-technical cohort evidence is scheduled and deferred to `phase.beta.5_launch-gate`.

##### `phase.beta.3` execution spec (required)

**A) Beta Guide Artifact Set (must exist and be testable)**

Create a single beta onboarding packet that includes all of the following sections, in this order:

1. `Install` (DMG-first path): download, checksum verify, mount, drag to `/Applications`, first launch, relaunch.
2. `Gatekeeper workaround` (unsigned app path): Finder `Open` flow, expected warning copy, successful launch confirmation.
3. `Connect integrations`: minimum path for Notion + Gmail + Google Calendar, with expected connected-state indicators.
4. `Known limits`: current beta constraints, accepted rough edges, and user-safe workarounds.

Executable checklist for the guide artifact:
- [ ] A tester with no prior context can follow steps without CLI usage.
- [ ] Every section includes expected result text (`what success looks like`).
- [ ] Every section includes at least one recovery step (`if this fails, do X`).
- [ ] The `Known limits` list includes severity label (`P1/P2/P3`) and workaround status.

**B) In-App Feedback Entrypoint + Fallback Channel (explicit behavior)**

Entrypoint requirements:
- Primary UI entrypoint label is exactly `Send Beta Feedback`.
- Entry point appears in both `Settings > Help` and onboarding completion screen.
- Activation opens a feedback composer prefilled with: app version, build id, macOS version, active integration names, and timestamp.
- Prefill must exclude secrets/tokens, email bodies, OAuth codes, and filesystem paths outside FlowState support dir.

Fallback behavior requirements:
- If online submission fails (offline, request error, provider blocked), app shows `Fallback: Email Feedback` with one-click copy of sanitized feedback payload.
- Fallback channel is email to `flowstate-beta@proton.me` with subject format: `FlowState Beta Feedback - v<version>+<build>`.
- App must display `Feedback not sent` until user explicitly confirms manual fallback action.

Validation checks:
- [ ] Primary path succeeds in normal online environment.
- [ ] Forced-failure path triggers fallback UI in <=3 seconds.
- [ ] Copied fallback payload contains required metadata and no redacted-field leaks.

**C) Privacy Notice Requirements (local-only + explicit consent)**

Privacy notice must be shown during first-run onboarding before integration connection starts.

Required notice statements (verbatim intent, can vary in wording):
- Local-only storage: settings, tokens, and memory are stored on this Mac under `~/Library/Application Support/FlowState/`.
- No telemetry by default: FlowState does not auto-send usage analytics.
- Optional log sharing: user may opt in to share a redacted log bundle for support.

Consent rules:
- Log sharing toggle default is `Off`.
- Consent is granular (one-time share or persistent opt-in) and revocable in Settings.
- `Continue` in onboarding cannot imply consent; consent must be a separate control.
- If log sharing is enabled, preview must list included/excluded data categories before send.

Validation checks:
- [ ] First-run user sees notice before first OAuth/connect action.
- [ ] Default state is no log sharing.
- [ ] Revocation path works without app restart.

**D) First-Run Validation Protocol + Launch-Gate Rubric**

Phase.beta.3 output requirement:
- Define and version the validation protocol, run-sheet template, and pass/fail rubric.
- Execute one internal smoke run to confirm the protocol is usable end-to-end.

Phase.beta.5 execution requirement:
- Execute the full 5-session non-technical cohort validation and evaluate against the rubric below.

Test method (measurable):
1. Recruit 5 non-technical testers with no FlowState setup history.
2. Reset app state before each run (`/Applications/FlowState.app` fresh install + clear support dir).
3. Start timer at first app launch.
4. End timer when tester reaches Home and successfully completes one guided action (send prompt + receive response OR run one bundled workflow to terminal status).
5. Record interventions (`none`, `minor hint`, `hands-on assistance`) and blocker category.

Pass/fail rubric:

| Metric | Pass Threshold | Fail Trigger |
| --- | --- | --- |
| Completion time | >=4/5 testers finish in <=15:00 | <=3/5 finish in <=15:00 |
| Assistance level | >=4/5 require no more than one minor hint | Any tester requires hands-on operator control |
| Critical blockers | 0 P0/P1 onboarding blockers | Any reproducible P0/P1 blocker |
| Feedback capture | 5/5 submit feedback via primary or fallback path | Any run cannot submit feedback |

Phase exit evidence required:
- Timestamped run sheet for all 5 sessions.
- Per-session notes with blocker type and resolution.
- Aggregated outcome summary mapped to rubric above.

**E) Required In-Repo Doc Locations + Versioning Conventions**

Required docs for this phase (must be committed):
- `docs/beta/v0.1.0-beta/BETA_GUIDE.md`
- `docs/beta/v0.1.0-beta/KNOWN_LIMITS.md`
- `docs/beta/v0.1.0-beta/PRIVACY_NOTICE.md`
- `docs/beta/v0.1.0-beta/FEEDBACK_CHANNELS.md`
- `docs/beta/v0.1.0-beta/FIRST_RUN_VALIDATION.md`

Versioning rules:
- Beta docs are versioned by directory (`v<semver>-beta`), immutable after launch gate except errata.
- Any post-freeze edit requires an entry in `docs/beta/CHANGELOG.md` with date, owner, reason, and affected file.
- Each phase.beta.3 doc must include metadata header fields: `Version`, `Build`, `Last Updated`, `Owner`, `Applies To`.
- `docs/beta/current` must be updated to point to the active beta doc set (symlink or index file reference).

Completion checklist:
- [ ] All required docs exist at required paths.
- [ ] Metadata headers present in every required doc.
- [ ] Changelog entry added for any modified published beta doc.
- [ ] `docs/beta/current` resolves to the same version used in release artifacts.

#### `phase.beta.4_beta-operations`
- Scope: operate the beta safely (intake, triage, release cadence, rollback).
- Outputs:
  - Issue template set (bug, UX friction, integration failure).
  - Triage SLA and severity policy.
  - Hotfix path for emergency repackage.
  - Artifact channel policy: GitHub Releases (draft), private-access distribution.
- Exit criteria:
  - Team can classify and respond to critical bug reports within SLA.
  - Rollback communication template is ready.

##### `phase.beta.4` execution spec (required)

**A) Intake Templates (GitHub Issues)**

Required templates (version-controlled):
- `.github/ISSUE_TEMPLATE/beta-bug-report.md`
- `.github/ISSUE_TEMPLATE/beta-ux-friction.md`
- `.github/ISSUE_TEMPLATE/beta-integration-failure.md`

Template requirements:
- Include required fields for `build`, `macOS version`, `device arch`, `steps to reproduce`, `expected`, `actual`, `severity`, and `attachments/log bundle`.
- Include privacy reminder: no secrets/tokens in ticket body.
- Include severity selector constrained to `P0`, `P1`, `P2`, `P3`.

**B) Triage SLA + Severity Policy**

- `P0` (data loss/security/app unusable): acknowledge <= 30 minutes, owner assigned <= 1 hour, mitigation/rollback decision <= 4 hours.
- `P1` (critical flow blocked): acknowledge <= 2 hours, owner assigned <= 4 hours, fix or workaround <= 24 hours.
- `P2` (major but workable): acknowledge <= 1 business day, triage <= 2 business days.
- `P3` (minor/polish): acknowledge <= 2 business days, backlog prioritization in next weekly triage.

Operational rules:
- Every issue must have `severity`, `owner`, `status`, and `next update time`.
- Any `P0` automatically triggers `@oracle` diagnostic handoff + verifier follow-up.

**C) Hotfix + Rollback Path (emergency repackage)**

1. Branch from last known-good release commit.
2. Apply minimal fix scoped to blocker.
3. Re-run release pipeline: `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @flowstate/desktop package:mac`.
4. Stage deterministic artifacts in `packages/desktop/out/release/` and regenerate checksums + manifest.
5. Publish new GitHub draft pre-release (`v<version>-beta+<build>-hotfix.<n>`) and update beta docs changelog.

Rollback communication requirements:
- Prewritten message template must include: affected build, risk summary, immediate action, replacement build ETA, and support channel.

**D) Release Cadence + Operations Rituals**

- Beta cadence: one scheduled drop per week + emergency hotfixes as needed.
- Triage rhythm: daily 15-minute triage standup during active beta week.
- Weekly ops review must output: open P0/P1 count, mean time to acknowledge, mean time to mitigation, top friction themes.

**E) Exit Evidence Checklist**

- [ ] Issue templates exist and are usable in GitHub UI.
- [ ] SLA policy is published in repo docs and referenced in beta guide set.
- [ ] Hotfix dry-run completed at least once (artifact restage + checksum verification).
- [ ] Rollback communication template drafted and stored in docs.

#### `phase.beta.5_launch-gate`
- Scope: final go/no-go review and beta cohort handoff.
- Outputs:
  - Release checklist with sign-offs.
  - Published beta artifacts + checksums + release notes.
  - Draft GitHub Release containing DMG + SHA256 manifest + release notes.
  - Completed first-run validation report (5 non-technical sessions + rubric outcome summary).
  - Tester invite packet.
- Exit criteria:
  - Gate reviewers approve quality/security/UX readiness.
  - First cohort receives validated install package.
  - Cohort coverage gate passes: minimum 2 Apple Silicon testers + 1 Intel tester across at least 2 macOS versions.
  - First-run rubric passes: >=4/5 sessions complete in <=15 minutes, no reproducible P0/P1 onboarding blockers, and 5/5 feedback capture success.

##### `phase.beta.5` execution spec (required)

**A) Launch Readiness Inputs (must be present before review)**

- Deterministic artifacts from `packages/desktop/out/release/`:
  - `FlowState-v<version>-beta+<build>-macos-<arch>.dmg`
  - `FlowState-v<version>-beta+<build>-macos-<arch>.zip`
  - `SHA256SUMS.txt`
  - `artifact-manifest.json`
- Beta docs set at `docs/beta/v0.1.0-beta/` including guide, privacy, feedback, operations, rollout/rollback, and first-run validation.
- Final known-issues list with severity labels and explicit waiver decisions.

**B) Cohort Matrix + First-Run Evidence (hard gate)**

Required matrix minimum:
- 2 Apple Silicon tester runs
- 1 Intel tester run
- Coverage across at least 2 macOS versions

Required first-run evidence:
- Complete `docs/beta/v0.1.0-beta/FIRST_RUN_VALIDATION.md` for T1-T5 with timestamps, duration, assistance level, blocker type, and feedback submission path.
- Include aggregated rubric summary and explicit pass/fail decision.

**C) Draft GitHub Release Procedure (private distribution)**

From repo root:
1. `gh release create "v0.1.0-beta+b<build>" --draft --prerelease --title "FlowState v0.1.0 Beta (b<build>)" --notes-file "docs/beta/v0.1.0-beta/RELEASE_NOTES.md"`
2. `gh release upload "v0.1.0-beta+b<build>" packages/desktop/out/release/*.dmg packages/desktop/out/release/*.zip packages/desktop/out/release/SHA256SUMS.txt packages/desktop/out/release/artifact-manifest.json --clobber`
3. Confirm draft visibility is restricted to approved private collaborators.

**D) Final Reviewer Sign-Off Packet**

- Reviewer roles: release owner, verifier owner, product owner.
- Required sign-off blocks:
  - `Quality`: tests/package evidence + install validation
  - `Security/Privacy`: no telemetry default + redaction behavior validated
  - `UX`: first-run rubric pass + known workarounds documented

**E) Go/No-Go Rules**

- `GO` only when all required inputs exist, cohort matrix and first-run rubric pass, and all reviewer sign-offs are complete.
- `NO-GO` if any P0 exists, any unresolved/expired P1 waiver exists, or any required cohort/evidence slot is missing.

### Required Gates

1. Verification gate per phase (`@verifier`): tests, packaging reproducibility, doc completeness.
2. Security/privacy gate (final): token handling, redaction behavior, no accidental telemetry.
3. Final review gate: launch readiness review before tester distribution.

### Subagent Registry

- Core:
  - `@general`: implementation and doc updates.
  - `@verifier`: acceptance checks and release gates.
  - `@uiux`: install/onboarding clarity and beta UX messaging.
  - `@oracle`: deep debugging for blockers and flaky behavior.
- Project-specific:
  - None added for this program (current scope covered by core roster).

### Routing Matrix (`task_type x risk_level -> subagent`)

| Task Type | Low Risk | Medium Risk | High Risk |
| --- | --- | --- | --- |
| Build/test command hardening | `@general` | `@general` | `@oracle` |
| Packaging config/artifacts | `@general` | `@general` | `@oracle` |
| Install docs + tester guide | `@general` | `@uiux` | `@uiux` |
| Release validation | `@verifier` | `@verifier` | `@verifier` |
| Security/privacy checks | `@verifier` | `@verifier` | `@oracle` + `@verifier` |
| Blocker diagnosis | `@general` | `@oracle` | `@oracle` |

### Delegation Triggers

- Route to `@oracle` when:
  - Packaging fails non-deterministically.
  - Build/test failures cannot be resolved in one iteration.
  - Crash/hang is reproducible but root cause is unclear.
- Route to `@uiux` when:
  - First-run friction is reported by >2 testers.
  - Installation instructions produce confusion or drop-off.
- Route to `@verifier` when:
  - Any phase declares completion.
  - A release artifact is ready for distribution.

### Verification Owner Rules

- Any artifact intended for external testers requires `@verifier` approval.
- Any high-risk fix requires `@oracle` diagnosis notes plus `@verifier` confirmation.

### Worktree + Risk Policy

- High-risk tasks (packaging config, auth, update flow) execute in isolated worktrees/branches.
- Medium-risk tasks may share a branch only if files do not overlap.
- One in-progress high-risk task at a time.

### Model Routing Policy

- Low risk: fast model tier.
- Medium risk: balanced model tier.
- High risk: highest-reasoning model tier; mandatory verification gate.

### Subagent Lifecycle Policy

- Create new specialist only if a domain repeats >=3 times with poor handoffs.
- Evaluate specialist usefulness at end of each beta phase.
- Prune specialist if no owned tasks in two consecutive phases.

### Beta Launch Deliverables Checklist

- Build and test are green on clean environment.
- Unsigned DMG + zip app artifacts produced.
- Checksums + artifact manifest published.
- Install guide + known issues + troubleshooting published.
- Feedback intake path verified.
- Rollback and hotfix procedure documented.
- Go/no-go review completed.

---

## Build-to-DMG Parity Stabilization Program (Immediate Priority)

This program is now the immediate execution focus before expanding feature scope.

### Program Goal

Ensure all behavior validated in `pnpm build` is reproducible from the downloaded DMG in GitHub draft releases, then lock that parity with a full test pyramid (unit + mocks/contracts + integration + packaged e2e).

### Stable Demo Definition (Locked)

`Stable demo` means:

1. The downloaded DMG install behaves the same as the local validated build for all in-scope capabilities.
2. No critical regression exists between `pnpm build` verification and packaged runtime behavior.
3. Release draft creation is blocked unless parity and test gates pass.

### In-Scope Capabilities for Parity Gate (v0.1.0-beta)

- App install/launch/relaunch from `/Applications/FlowState.app`
- Home + Chat + Tasks + Workflows + Integrations mode navigation
- Core process startup (OpenCode headless + enabled MCP server processes)
- One workflow run to terminal status with timeline events
- Approval flow (`Approve`, `Always Approve`, `Deny`) in one session
- Config and auth persistence across restart

### Explicit Non-Goals (for this program)

- New end-user feature additions unrelated to parity or testability
- Cross-platform packaging beyond macOS
- Telemetry additions (must remain opt-in and local-first)

### Phase DAG (PM-Executable)

```text
phase.parity.1_capability-baseline
  -> phase.parity.2_packaged-runtime-hardening
  -> phase.parity.3_dmg-smoke-automation
  -> phase.parity.5_release-gate-enforcement

phase.parity.1_capability-baseline
  -> phase.parity.4_test-pyramid-buildout
  -> phase.parity.5_release-gate-enforcement
```

### Phase Details

#### `phase.parity.1_capability-baseline`
- Scope: codify the exact `build vs DMG` parity contract and establish reproducible failure evidence.
- Outputs:
  - `docs/release/PARITY_CAPABILITIES.md` (authoritative checklist)
  - Failure matrix with reproducible steps (`dev-build`, `packaged-dmg`, expected, actual)
  - Startup diagnostics schema (required fields and redaction rules)
- Exit criteria:
  - Every parity capability has an objective pass/fail check.
  - At least one DMG run and one local build run captured with comparable evidence.

#### `phase.parity.2_packaged-runtime-hardening`
- Scope: eliminate runtime differences caused by packaging/build environment assumptions.
- Outputs:
  - Production-safe path resolution policy (no `cwd` dependency for packaged runtime)
  - Packaged spawn policy for OpenCode + MCP child processes
  - Startup preflight checks (resources, config, permissions, keychain readiness)
  - Structured packaged diagnostics in local logs
- Exit criteria:
  - Known DMG-only blockers are fixed or formally waived with owner/date.
  - No P0/P1 crash/blocker in first-launch and relaunch parity flows.

#### `phase.parity.3_dmg-smoke-automation`
- Scope: automate DMG-first validation as the default release confidence path.
- Outputs:
  - `pnpm smoke:dmg` command: build -> package -> install -> launch -> run parity checks -> collect artifacts
  - Artifact bundle for each smoke run (logs, checklist results, screenshots if needed)
  - Deterministic failure codes (so CI and humans can interpret outcomes quickly)
- Exit criteria:
  - Smoke automation passes on clean local state.
  - Smoke automation is CI-runnable and fails release flow on parity break.

#### `phase.parity.4_test-pyramid-buildout`
- Scope: establish durable confidence for continuous refactoring and release safety.
- Outputs:
  - Unit tests for core stores/policies/transformers/validators
  - Mock/contract tests for MCP adapters and IPC boundaries
  - Integration tests for main-renderer-process-manager flows
  - Packaged e2e tests for critical user journeys from installed app
- Exit criteria:
  - Minimum required suite passes in CI on every release candidate.
  - Critical-path test map links each parity capability to at least one automated test.

#### `phase.parity.5_release-gate-enforcement`
- Scope: enforce parity and quality gates before any GitHub draft release is considered valid.
- Outputs:
  - Release gate definition in CI (blocking checks)
  - Draft release policy: create/update draft only after parity + test gates pass
  - Maintainer runbook for local pre-release verification
- Exit criteria:
  - A release candidate cannot produce an accepted draft without passing all required gates.
  - One full dry-run completes from commit -> artifacts -> gated draft release.

### Required Gates (Strict)

1. `Gate A - Build/Type/Test`: lint + typecheck + required automated tests.
2. `Gate B - Parity Smoke`: DMG install/launch/relaunch + capability checklist.
3. `Gate C - Packaged E2E`: critical user journeys in installed app.
4. `Gate D - Final Verification`: `@verifier` sign-off with parity evidence.

### Command Contract (to implement)

- `pnpm build:release` -> deterministic release build + package artifacts.
- `pnpm smoke:dmg` -> execute DMG parity smoke sequence.
- `pnpm test:contracts` -> MCP/IPC contract tests.
- `pnpm test:packaged-e2e` -> installed app journey tests.
- `pnpm gate:release` -> aggregate gates A-D; non-zero exit on any failure.

### PM Routing Policy (Task Type x Risk)

| Task Type | Low Risk | Medium Risk | High Risk |
| --- | --- | --- | --- |
| Parity checklist/docs | `@general` | `@general` | `@verifier` |
| Packaging/runtime fixes | `@general` | `@oracle` | `@oracle` |
| DMG smoke automation | `@general` | `@general` | `@oracle` |
| Test harness buildout | `@general` | `@general` | `@verifier` |
| Release gate wiring | `@general` | `@verifier` | `@verifier` + `@oracle` |

### Delegation Triggers

- Route to `@oracle` when a bug appears only in packaged runtime or is non-deterministic.
- Route to `@verifier` when any gate is introduced/modified or a phase declares completion.
- Route to `@uiux` if parity failures are caused by onboarding/install interaction confusion.

### Verification Owner Rule

- Any DMG artifact intended for testers is invalid until `@verifier` confirms parity checklist + smoke output + packaged e2e evidence.

### Worktree and Risk Policy

- High-risk packaging/auth/runtime tasks run in isolated branches/worktrees.
- One high-risk parity task in progress at a time.
- No release-branch merges without passing `pnpm gate:release`.

### Subagent Lifecycle Policy (for this program)

- Use core roster first (`@general`, `@oracle`, `@verifier`, `@uiux`).
- Propose a project-specific specialist only if the same parity/packaging failure pattern repeats in 3+ tasks with poor handoffs.
- Re-evaluate specialist need at end of each parity phase.

---

## Open Questions for Future Discussion

1. **Code Signing Timeline**: When will Apple Developer account be available?

2. **Auto-Updates**: Implement electron-updater for seamless updates?

3. **Windows Support**: Timeline after Mac MVP is stable?

4. **Community Workflows**: Should FlowState host a gallery of user-contributed workflows?

5. **Telemetry**: Any anonymous usage analytics for improvement?

6. **Menubar Mode**: Should FlowState also have a menubar presence for quick access?

---

## Resources

- [OpenCode Documentation](https://opencode.ai/docs/)
- [OpenCode Commands](https://opencode.ai/docs/commands/)
- [OpenCode Agent Skills](https://opencode.ai/docs/skills/)
- [OpenCode SDK Reference](https://opencode.ai/docs/sdk/)
- [Claude Cowork](https://support.claude.com/en/articles/13345190-getting-started-with-cowork)
- [FlowState 1.0 (Design Reference)](https://github.com/lukebrevoort/flowstate)
- [Electron Documentation](https://www.electronjs.org/docs)

---

_This is a living document. Update it as decisions are made and the project evolves._

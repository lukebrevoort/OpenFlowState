# FlowState 2.0 - Project Plan

> **Status**: Architecture Pivot - Desktop App  
> **Last Updated**: January 2026  
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

| Date     | Decision                                | Rationale                                                             | Status   |
| -------- | --------------------------------------- | --------------------------------------------------------------------- | -------- |
| Jan 2026 | Build on top of OpenCode (not fork)     | Leverage their maintenance, MCP infra, and community                  | Approved |
| Jan 2026 | MCP-first architecture                  | Pluggable integrations, can be used independently                     | Approved |
| Jan 2026 | Progressive autonomy model              | Auto-read, approval-write for safety                                  | Approved |
| Jan 2026 | Local-only auth storage                 | User privacy, no cloud dependency                                     | Approved |
| Jan 2026 | TypeScript throughout                   | Consistency with OpenCode SDK                                         | Approved |
| Jan 2026 | MIT License                             | Match OpenCode, give back to community                                | Approved |
| Jan 2026 | Mac-first for MVP                       | Simplify scope, add Windows later                                     | Approved |
| Jan 2026 | Default to OpenCode Zen                 | Free, zero-friction onboarding                                        | Approved |
| Jan 2026 | **Desktop App (Electron)**              | TUI too complex for non-technical users, Cowork-style UX              | **New**  |
| Jan 2026 | **Headless OpenCode**                   | Run OpenCode silently, control via SDK/API                            | **New**  |
| Jan 2026 | **Four-Mode UI**                        | Chat, Tasks, Workflows, Integrations                                  | **New**  |
| Jan 2026 | **Workflows as Curated Commands**       | Use OpenCode's .md-based command system; hide global commands by default | **New**  |
| Jan 2026 | **Claude Desktop-style MCP Config**     | Local JSON file for MCP configuration                                 | **New**  |
| Jan 2026 | **Fresh UI Design**                     | New React UI inspired by FlowState 1.0 aesthetic                      | **New**  |
| Jan 2026 | **Model Provider Choice in Onboarding** | Ask user which provider, default to Zen                               | **New**  |
| Jan 2026 | **Internet Required for MVP**           | Optimize for offline later                                            | **New**  |
| Jan 2026 | **Unified Real-Time Timeline**          | Single chronological feed (no tabs) for tool calls, approvals, status | **New**  |
| Jan 2026 | **Hybrid Timeline Storage**             | SQLite for metadata, disk blobs for payloads ≥10KB                    | **New**  |
| Jan 2026 | **Smart Metadata Gmail Defaults**       | Return snippet + headers + labels by default, full body on-demand     | **New**  |
| Jan 2026 | **Redact Secrets Even in Dev Mode**     | Always strip tokens/keys; export bundle requires explicit action      | **New**  |
| Jan 2026 | **Hybrid Task Promotion**               | Agent-led promotion + heuristic escalation; no user override          | **New**  |
| Jan 2026 | **Task Summary from Timeline**          | Final task summary auto-generated from timeline; last chat message    | **New**  |
| Jan 2026 | **Workflow Runs in SQLite**             | Durable history + queryable run metadata                              | **New**  |
| Jan 2026 | **WorkflowRun + TaskRun Linking**       | Separate workflowRunId; reference taskRunId + chat message/session    | **New**  |
| Jan 2026 | **Workflow Auto-Route to Tasks**        | Starting a workflow always switches to Tasks                          | **New**  |

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

### Phase 3: Integrations + Config Baseline - MOSTLY DONE

Value: users can connect core services (Gmail/GCal/Notion/Canvas) and persist config.

- [x] Config store persisted to disk
- [x] Auth manager + OAuth server
- [x] Integrations UI + connect/disconnect
- [ ] Confirm OAuth end-to-end with real credentials across Gmail + GCal (and Notion OAuth if we keep it)
- [ ] Decide + implement secrets storage policy: keep encrypted files vs move to macOS Keychain
- [ ] Implement Custom MCP add/configure UI (currently placeholder)

### Phase 4: Execution Core (Timeline + Approvals + Tasks)

Value: users can see what the agent is doing and approve risky actions; Tasks become a real first-class system (not just derived UI state).

- [x] Timeline storage (SQLite + blob refs) and renderer timeline UI
- [x] Approval request/response surfaced; Approve/Always Approve/Deny wired to OpenCode permission API
- [x] Implement real TaskRun persistence + IPC (`tasks:listRuns`, `tasks:getActiveRun`, optional cancel)
- [x ] Add Task run routing (Task list -> Task details) so Workflows/Chat can link to a stable task page
- [x ] Connect per-workflow approval opt-in (`approval-policies.json`) to workflow runs (not just per-session)

### Phase 5: Workflows + Commands Productization

Value: workflows feel immediate, have durable outputs, and are organized (no global-command clutter).

- [x] Workflows list + generator + runner exist (MVP-level)
- [ ] Always create a Task immediately when a workflow starts (no delayed promotion path)
- [ ] Persist WorkflowRuns + outputs (today runs are in-memory only)
- [ ] Add Output/Artifacts for each run (final output, summary, exports) and show them in Task details
- [ ] Add workflow run history (last N runs with status, duration, output preview)
- [ ] Ensure workflow runs use dedicated OpenCode sessions; persist session + assistant message linkage
- [ ] Surface approval requests/responses for workflow runs in Tasks (tie to workflow run + task run)
- [ ] Split Workflows view into `Workflows` vs `Commands` (power-user global commands like `tdd`)
- [ ] Replace the current per-workflow menu with a Workflow Details drawer (Always Approve, inputs, export/duplicate/delete)
- [ ] Persist pins and enforce pinned limit (3 max) consistently

### Phase 6: Onboarding + UX Polish

Value: first-run success rate goes up and the product feels coherent (less "stub" UI).

- [x] Onboarding flow exists (apps, connect, provider/model, wow prompt)
- [ ] Tighten the onboarding -> integrations handshake (clear "connected" feedback, fewer dead-ends)
- [ ] Add missing UI wiring: workflow edit/duplicate/delete, custom MCP add, integration settings link
- [ ] Notifications for approvals + task completion (macOS)
- [ ] Reliability policy enforcement: retry/backoff + user messaging when MCP drops mid-task

### Phase 7: Testing + Launch Prep

Value: repeatable builds, fewer regressions, and a shippable beta.

- [ ] Add e2e happy-path tests: onboarding -> connect -> run a workflow -> approve -> output saved
- [ ] Add regression tests for timeline normalization + storage
- [ ] Performance pass (timeline virtualization, memory usage, native module rebuild ergonomics)
- [ ] Package unsigned DMG + docs + demo video

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

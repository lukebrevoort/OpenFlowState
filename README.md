# FlowState 2.0

> Open-source, model-agnostic productivity orchestration built on [OpenCode](https://opencode.ai)

FlowState is a local-first desktop app that helps you work across email,
calendars, docs, and system tools from one place.

## Current Project Phase

FlowState is in the post-Phase 8 / Phase 9 packaging hardening stage.

- Desktop-first architecture is active (`packages/desktop`)
- Core workflows and integrations are implemented and being hardened for release
- Release tooling now includes packaging, smoke checks, contract tests,
  and release gates

See [`PROGRESS.md`](./PROGRESS.md) for the execution log and
[`PLAN.md`](./PLAN.md) for architecture and roadmap details.

## Product Direction

1. **One Place, All Apps** - Work across Notion, Gmail, Calendar,
   Canvas, and desktop automation
2. **Progressive Autonomy** - Read/organize actions can run
   automatically; write/send/delete actions require approval
3. **Local-First Control** - Data, tokens, and runtime stay
   on your machine
4. **Model Agnostic** - Works with OpenCode-supported providers
   (OpenAI, Anthropic, Google, Ollama, and more)
5. **Extensible by Design** - Add custom MCP servers and workflow skills

## Quick Start

### Requirements

- Node.js 20+
- pnpm 9+
- macOS (current MVP target)

### Install

```bash
pnpm install
```

### Develop

```bash
# Run the full monorepo dev graph
pnpm dev

# Run desktop app flow directly
pnpm dev:desktop
```

### Build and Test

```bash
pnpm build
pnpm test
pnpm typecheck
```

## Repository Layout

```text
flowstate/
├── packages/
│   ├── desktop/             # Electron + React desktop app
│   ├── core/                # Shared core systems (auth, memory, notifications)
│   ├── mcp-notion/          # Notion MCP server
│   ├── mcp-gmail/           # Gmail MCP server
│   ├── mcp-gcal/            # Google Calendar MCP server
│   ├── mcp-system/          # System automation MCP server
│   ├── mcp-canvas/          # Canvas MCP server
│   └── web-config/          # Legacy web config package (deprecated)
├── workflows/               # Pre-built workflow skills
├── agents/                  # Primary agent + subagents
├── docs/release/            # Release hardening docs and runbooks
├── PLAN.md                  # Architecture and roadmap
├── PROGRESS.md              # Ongoing execution log
└── README.md
```

## Integrations

### Built-In MCP Servers

| Integration | Capability Highlights | Status |
| --- | --- | --- |
| Notion | Pages, databases, task workflows | Active |
| Gmail | Inbox read, draft, send, labeling | Active |
| Google Calendar | Events, free/busy, conflict checks | Active |
| System | Notifications, shell, app/window actions | Active |
| Canvas | Courses, assignments, files, study-material flows | Active |

### Custom MCP Support

FlowState can run additional local MCP servers through config.

```json
{
  "mcp": {
    "my-custom-mcp": {
      "type": "local",
      "command": ["node", "./my-mcp/index.js"],
      "enabled": true
    }
  }
}
```

## Release and Validation Commands

For focused release validation and packaging checks:

```bash
pnpm build:release
pnpm smoke:dmg
pnpm test:contracts
pnpm test:packaged-e2e
pnpm gate:release -- --dry-run
```

Supporting scripts are documented in [`docs/release/RELEASE_GATE_RUNBOOK.md`](./docs/release/RELEASE_GATE_RUNBOOK.md).

## Agents

FlowState ships with a primary orchestrator and focused subagents:

| Agent | Role |
| --- | --- |
| `@flowstate` | Primary orchestrator and task router |
| `@scheduler` | Calendar planning and scheduling |
| `@organizer` | Notion and task organization |
| `@communicator` | Email composition and inbox workflows |
| `@executor` | System automation and command execution |

## License

MIT - see [`LICENSE`](./LICENSE).

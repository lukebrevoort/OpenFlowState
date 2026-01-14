# FlowState 2.0 - AI Agent Instructions

> This file provides instructions for AI coding assistants working on FlowState.

---

## Project Overview

FlowState 2.0 is an open-source productivity orchestration platform built on [OpenCode](https://opencode.ai). It enables users to manage their digital life from one place by connecting apps like Notion, Gmail, and Google Calendar through MCP (Model Context Protocol) servers.

**Core Philosophy**:
1. **One Place, All Apps** - Orchestrate everything from a single interface
2. **Progressive Autonomy** - Auto-read, approval-write for safety
3. **User-Controlled** - Data and tokens stay local
4. **Extensible** - Power users can add custom MCPs and agents
5. **Open Source** - MIT licensed, giving back to the community

---

## Architecture

```
User Interfaces (TUI + Web Dashboard)
           ↓
OpenCode Server Layer (SDK, Session Management)
           ↓
MCP Server Layer (Notion, Gmail, GCal, System, Custom)
           ↓
FlowState Core Layer (Daemon, Memory, Auth Storage)
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| TUI | OpenCode (themed) |
| SDK | @opencode-ai/sdk (TypeScript) |
| MCP Servers | TypeScript/Node.js |
| Web Config | React + Vite |
| Auth Storage | Encrypted JSON |
| Memory | SQLite |
| Monorepo | pnpm + Turborepo |

---

## Project Structure

```
flowstate/
├── packages/
│   ├── core/                # Daemon, memory, auth, notifications
│   ├── mcp-notion/          # Notion MCP server
│   ├── mcp-gmail/           # Gmail MCP server
│   ├── mcp-gcal/            # Google Calendar MCP server
│   ├── mcp-system/          # System automation MCP server
│   └── web-config/          # React web dashboard
├── themes/
│   └── flowstate.json       # OpenCode theme
├── agents/
│   ├── flowstate.md         # Primary agent
│   └── subagents/           # Specialized subagents
├── opencode.json            # OpenCode configuration
├── PLAN.md                  # Project plan
└── PROGRESS.md              # Development progress
```

---

## Coding Standards

### TypeScript
- Use strict mode
- Prefer interfaces over types where possible
- Use meaningful variable names
- Document public APIs with JSDoc

### MCP Servers
- Each tool should have clear input/output schemas
- Mark tools with autonomy level (auto vs approval)
- Handle errors gracefully with meaningful messages
- Support graceful shutdown

### Testing
- Unit tests for utility functions
- Integration tests for MCP tools
- E2E tests for critical workflows

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `opencode.json` | Main configuration, wires MCPs and agents |
| `themes/flowstate.json` | Visual theming for TUI |
| `agents/flowstate.md` | Primary orchestrator agent prompts |
| `packages/core/` | Daemon, memory, and auth systems |
| `PLAN.md` | Full project plan and architecture |
| `PROGRESS.md` | Current development status |

---

## MCP Tool Conventions

### Naming
- `[service]_[action]` format (e.g., `notion_search`, `gmail_send`)
- Read operations: `list`, `get`, `read`, `search`
- Write operations: `create`, `update`, `delete`, `send`

### Autonomy Levels
```typescript
// Auto - executes without user confirmation
{ autonomy: "auto" }

// Approval - requires user confirmation
{ autonomy: "approval" }
```

### Tool Schema Example
```typescript
{
  name: "gmail_send",
  description: "Send an email",
  inputSchema: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email" },
      subject: { type: "string", description: "Email subject" },
      body: { type: "string", description: "Email body (plain text or HTML)" }
    },
    required: ["to", "subject", "body"]
  },
  autonomy: "approval"
}
```

---

## Development Workflow

1. **Before coding**: Check PLAN.md for architecture decisions
2. **During coding**: Follow the package structure and conventions
3. **After coding**: Update PROGRESS.md with changes
4. **Testing**: Run `pnpm test` before committing
5. **Commits**: Use conventional commit messages

---

## Common Tasks

### Adding a new MCP tool
1. Define tool in `packages/mcp-[service]/src/tools/`
2. Add API wrapper in `packages/mcp-[service]/src/api/`
3. Register tool in the MCP server
4. Add tests
5. Document in PROGRESS.md

### Adding a new subagent
1. Create markdown file in `agents/subagents/`
2. Define agent's scope and tools
3. Reference in `opencode.json`
4. Update primary agent to delegate appropriately

### Modifying the theme
1. Edit `themes/flowstate.json`
2. Test in TUI to verify appearance
3. Ensure accessibility (contrast ratios)

---

## Questions?

Check PLAN.md for detailed architecture and decisions. For open questions, see the "Open Questions for Future Discussion" section.

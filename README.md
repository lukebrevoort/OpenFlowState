# FlowState 2.0

> **Open-source productivity orchestration platform built on [OpenCode](https://opencode.ai)**

FlowState enables you to manage your entire digital life from one place. Connect your apps, describe what you want, and let FlowState handle the rest.

Note: This README reflects the current MVP phase, so integrations marked "In Progress" are actively being built.

## Core Philosophy

1. **One Place, All Apps** - Stop bouncing between Notion, Gmail, Calendar, and your desktop
2. **Progressive Autonomy** - Safe actions happen automatically; risky actions require approval
3. **User-Controlled** - Your data and tokens stay on your machine
4. **Extensible** - Power users can add custom MCPs and agents
5. **Open Source** - MIT licensed, giving back to the community

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Build all packages
pnpm build
```

## Project Structure

```
flowstate/
├── packages/
│   ├── core/                # Daemon, memory, auth systems
│   ├── mcp-notion/          # Notion MCP server
│   ├── mcp-gmail/           # Gmail MCP server
│   ├── mcp-gcal/            # Google Calendar MCP server
│   ├── mcp-system/          # System automation MCP server
│   └── web-config/          # React web dashboard
├── themes/
│   └── flowstate.json       # OpenCode theme
├── agents/
│   ├── flowstate.md         # Primary orchestrator agent
│   └── subagents/           # Specialized subagents
├── opencode.json            # OpenCode configuration
├── PLAN.md                  # Project plan
└── PROGRESS.md              # Development progress
```

## Integrations

### Official MCPs

| Integration | Description | Status |
|-------------|-------------|--------|
| Notion | Pages, databases, task management | 🚧 In Progress |
| Gmail | Email reading, drafting, sending | 🚧 In Progress |
| Google Calendar | Events, scheduling, conflicts | 🚧 In Progress |
| System | Notifications, apps, automation | 🚧 In Progress |

### Adding Custom MCPs

FlowState supports any MCP server. Add to your `opencode.json`:

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

## Web Dashboard

The web dashboard runs on `http://localhost:3847` and provides:

- **Integrations**: Connect and manage OAuth for your apps
- **Preferences**: Configure timezone, working hours, LLM provider
- **Agents**: View and configure FlowState agents

## Agents

FlowState uses a primary orchestrator with specialized subagents:

| Agent | Role |
|-------|------|
| `@flowstate` | Primary orchestrator, routes tasks |
| `@scheduler` | Calendar optimization, scheduling |
| `@organizer` | Notion organization, task management |
| `@communicator` | Email drafting, inbox management |
| `@executor` | System automation, shell commands |

## Development

See [PLAN.md](./PLAN.md) for full architecture details and [PROGRESS.md](./PROGRESS.md) for current status.

### Requirements

- Node.js 20+
- pnpm 9+
- macOS (for MVP - Windows support planned)

### Testing

```bash
pnpm test
```

## License

MIT - See [LICENSE](./LICENSE) for details.

## Acknowledgments

Built on [OpenCode](https://opencode.ai) - thank you for the amazing platform!

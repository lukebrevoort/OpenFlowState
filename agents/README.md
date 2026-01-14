# FlowState Agents

This directory contains agent definitions for FlowState's AI-powered productivity orchestration.

## Agent Structure

```
agents/
├── flowstate.md          # Primary orchestrator agent
├── README.md             # This file
└── subagents/
    ├── scheduler.md      # Calendar and time management specialist
    ├── organizer.md      # Task and project organization specialist
    ├── communicator.md   # Email and messaging specialist
    └── executor.md       # System automation specialist
```

## Primary Agent

**flowstate.md** - The main orchestrator that:
- Routes requests to appropriate subagents
- Handles cross-app workflows
- Enforces progressive autonomy (auto-read, approval-write)
- Maintains conversation context

## Subagents

### @scheduler
- Calendar event management
- Conflict detection and resolution
- Free/busy queries
- Time blocking recommendations

### @organizer
- Notion page and database management
- Task prioritization
- Project organization
- Deadline tracking

### @communicator
- Email drafting and responses
- Inbox organization
- Label management
- Communication tone matching

### @executor
- Desktop notifications
- Application control
- File operations
- Shell command execution (with approval)

## Adding New Subagents

1. Create a new `.md` file in `subagents/`
2. Define the agent's scope, tools, and behavior
3. Register in `opencode.json` under `agents.subagents`
4. Update the primary agent to delegate appropriately

## Agent Configuration

Agents are configured in frontmatter:

```yaml
---
name: agent-name
description: What this agent does
mode: primary | subagent
model: provider/model
temperature: 0.0-1.0
tools:
  tool_pattern: true | false
---
```

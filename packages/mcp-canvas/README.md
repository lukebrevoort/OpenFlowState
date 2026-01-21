# @flowstate/mcp-canvas

Canvas LMS MCP server for FlowState - enabling students to access their courses, assignments, grades, and announcements directly through FlowState's AI-powered productivity platform.

## Overview

This MCP server integrates with Canvas LMS (used by many universities and schools) to provide FlowState's agents with context about a student's academic workload. This enables:

- **Smart Study Planning**: Agents can see upcoming assignments and suggest study schedules
- **Academic Tracking**: View grades across all courses to identify areas needing attention
- **Assignment Context**: Get detailed assignment descriptions and requirements for study sessions
- **Deadline Awareness**: Know when assignments are due to prioritize work effectively

## Setup

### 1. Generate a Canvas API Token

1. Log into your Canvas account
2. Go to **Account** → **Settings**
3. Scroll to **Approved Integrations** (or **New Access Token**)
4. Click **+ New Access Token**
5. Give it a name like "FlowState" and set an expiration (recommended: end of semester)
6. Copy the token - you won't be able to see it again!

### 2. Configure Environment Variables

Set these environment variables:

```bash
# Your Canvas API token from step 1
CANVAS_API_TOKEN=your_token_here

# Your school's Canvas URL (e.g., https://your-school.instructure.com)
CANVAS_API_URL=https://your-school.instructure.com
```

### 3. Add to FlowState Config

Add the MCP server to your FlowState configuration:

```json
{
  "mcpServers": {
    "flowstate-canvas": {
      "command": ["node", "packages/mcp-canvas/dist/index.js"],
      "enabled": true,
      "env": {
        "CANVAS_API_TOKEN": "${CANVAS_API_TOKEN}",
        "CANVAS_API_URL": "${CANVAS_API_URL}"
      }
    }
  }
}
```

## Available Tools

### Read Operations (Automatic)

| Tool | Description |
|------|-------------|
| `canvas_list_courses` | List all enrolled courses with optional grades |
| `canvas_get_course` | Get details about a specific course |
| `canvas_list_assignments` | List assignments for a course with due dates |
| `canvas_get_assignment` | Get detailed assignment info including description |
| `canvas_get_upcoming` | Get all upcoming assignments across all courses |
| `canvas_get_grades` | Get current grades for all courses |
| `canvas_get_submission` | Check submission status for an assignment |
| `canvas_list_announcements` | Get recent course announcements |
| `canvas_list_modules` | List course modules/units |
| `canvas_get_module_items` | Get items within a module |
| `canvas_get_calendar` | Get calendar events and due dates |

## Example Usage with FlowState

Once configured, you can ask FlowState things like:

- "What assignments do I have due this week?"
- "Show me my current grades in all classes"
- "What's my next assignment for CS 101?"
- "Help me plan my study schedule for the upcoming exams"
- "What announcements did I miss in my biology class?"

## Privacy & Security

- **Local Only**: Your Canvas token is stored locally on your machine
- **Read-Only**: This MCP only reads data - it cannot submit assignments or modify anything
- **No Telemetry**: No data is sent anywhere except to your Canvas instance
- **Token Control**: You can revoke your token anytime from Canvas Settings

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## License

MIT - See LICENSE file in root directory.

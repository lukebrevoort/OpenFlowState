# FlowState MCP Tool Schemas

> **Generated**: January 2026  
> **Purpose**: Comprehensive documentation of all FlowState MCP tools

This document provides detailed schemas for all tools exposed by FlowState's MCP servers. Each tool includes its description, input schema, and autonomy level.

---

## Autonomy Levels

FlowState uses **progressive autonomy** to balance productivity with safety:

| Level | Behavior | Examples |
|-------|----------|----------|
| **auto** | Executes immediately without approval | Reading emails, listing events, searching |
| **approval** | Requires user confirmation before execution | Sending emails, creating events, deleting |

---

## Notion MCP (`@flowstate/mcp-notion`)

### `notion_search`
Search Notion pages and databases by query.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `query` | **Yes** | `string` | Search query text |
| `filter` | No | `"page" \| "database"` | Filter results by type |

**Autonomy**: `auto`

---

### `notion_read_page`
Read the content of a Notion page.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `pageId` | **Yes** | `string` | The ID of the page to read |

**Autonomy**: `auto`

---

### `notion_read_database`
Query entries from a Notion database.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `databaseId` | **Yes** | `string` | The ID of the database to query |
| `filter` | No | `object` | Optional filter object for the query |
| `sorts` | No | `array` | Optional sort configuration |

**Autonomy**: `auto`

---

### `notion_create_page`
Create a new Notion page.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `parentId` | **Yes** | `string` | Parent page or database ID |
| `title` | **Yes** | `string` | Page title |
| `content` | No | `string` | Page content in markdown format |
| `properties` | No | `object` | Database properties (if parent is a database) |

**Autonomy**: `approval`

---

### `notion_update_page`
Update an existing Notion page.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `pageId` | **Yes** | `string` | The ID of the page to update |
| `properties` | No | `object` | Properties to update |
| `content` | No | `string` | New content in markdown format |

**Autonomy**: `approval`

---

### `notion_create_database_entry`
Add a new entry to a Notion database.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `databaseId` | **Yes** | `string` | The ID of the database |
| `properties` | **Yes** | `object` | Properties for the new entry |

**Autonomy**: `approval`

---

## Gmail MCP (`@flowstate/mcp-gmail`)

### `gmail_list`
List emails from inbox with optional filters.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `maxResults` | No | `number` | Maximum number of emails to return (default: 10) |
| `labelIds` | No | `string[]` | Filter by label IDs (e.g., INBOX, UNREAD) |
| `query` | No | `string` | Gmail search query (same as Gmail search box) |

**Autonomy**: `auto`

---

### `gmail_read`
Read the full content of a specific email.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `messageId` | **Yes** | `string` | The ID of the email to read |

**Autonomy**: `auto`

---

### `gmail_search`
Search emails using Gmail query syntax.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `query` | **Yes** | `string` | Gmail search query (e.g., "from:john subject:meeting") |
| `maxResults` | No | `number` | Maximum number of results (default: 10) |

**Autonomy**: `auto`

---

### `gmail_draft`
Create an email draft (does not send).

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `to` | **Yes** | `string` | Recipient email address |
| `subject` | **Yes** | `string` | Email subject |
| `body` | **Yes** | `string` | Email body (plain text or HTML) |
| `cc` | No | `string` | CC recipients (comma-separated) |
| `bcc` | No | `string` | BCC recipients (comma-separated) |

**Autonomy**: `auto`

---

### `gmail_label`
Add or remove labels from an email.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `messageId` | **Yes** | `string` | The ID of the email |
| `addLabels` | No | `string[]` | Labels to add |
| `removeLabels` | No | `string[]` | Labels to remove |

**Autonomy**: `auto`

---

### `gmail_send`
Send an email.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `to` | **Yes** | `string` | Recipient email address |
| `subject` | **Yes** | `string` | Email subject |
| `body` | **Yes** | `string` | Email body (plain text or HTML) |
| `cc` | No | `string` | CC recipients (comma-separated) |
| `bcc` | No | `string` | BCC recipients (comma-separated) |

**Autonomy**: `approval`

---

### `gmail_reply`
Reply to an email thread.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `threadId` | **Yes** | `string` | The ID of the thread to reply to |
| `body` | **Yes** | `string` | Reply body |
| `replyAll` | No | `boolean` | Reply to all recipients (default: false) |

**Autonomy**: `approval`

---

### `gmail_delete`
Move an email to trash.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `messageId` | **Yes** | `string` | The ID of the email to delete |

**Autonomy**: `approval`

---

## Google Calendar MCP (`@flowstate/mcp-gcal`)

### `gcal_list_events`
List calendar events within a time range.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `timeMin` | No | `string` | Start of time range (ISO 8601 format) |
| `timeMax` | No | `string` | End of time range (ISO 8601 format) |
| `maxResults` | No | `number` | Maximum number of events to return (default: 10) |
| `calendarId` | No | `string` | Calendar ID (default: primary) |

**Autonomy**: `auto`

---

### `gcal_get_event`
Get details of a specific calendar event.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `eventId` | **Yes** | `string` | The ID of the event |
| `calendarId` | No | `string` | Calendar ID (default: primary) |

**Autonomy**: `auto`

---

### `gcal_free_busy`
Check availability/free-busy times for calendars.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `timeMin` | **Yes** | `string` | Start of time range (ISO 8601 format) |
| `timeMax` | **Yes** | `string` | End of time range (ISO 8601 format) |
| `calendarIds` | No | `string[]` | List of calendar IDs to check |

**Autonomy**: `auto`

---

### `gcal_find_conflicts`
Find scheduling conflicts within a time range.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `timeMin` | **Yes** | `string` | Start of time range (ISO 8601 format) |
| `timeMax` | **Yes** | `string` | End of time range (ISO 8601 format) |

**Autonomy**: `auto`

---

### `gcal_create_event`
Create a new calendar event.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `summary` | **Yes** | `string` | Event title |
| `start` | **Yes** | `string` | Start time (ISO 8601 format) |
| `end` | **Yes** | `string` | End time (ISO 8601 format) |
| `description` | No | `string` | Event description |
| `attendees` | No | `string[]` | Email addresses of attendees |
| `location` | No | `string` | Event location |
| `calendarId` | No | `string` | Calendar ID (default: primary) |

**Autonomy**: `approval`

---

### `gcal_update_event`
Update an existing calendar event.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `eventId` | **Yes** | `string` | The ID of the event to update |
| `summary` | No | `string` | New event title |
| `description` | No | `string` | New event description |
| `start` | No | `string` | New start time (ISO 8601 format) |
| `end` | No | `string` | New end time (ISO 8601 format) |
| `attendees` | No | `string[]` | Updated attendee emails |
| `calendarId` | No | `string` | Calendar ID (default: primary) |

**Autonomy**: `approval`

---

### `gcal_delete_event`
Delete a calendar event.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `eventId` | **Yes** | `string` | The ID of the event to delete |
| `calendarId` | No | `string` | Calendar ID (default: primary) |

**Autonomy**: `approval`

---

## System MCP (`@flowstate/mcp-system`)

> **Note**: macOS only for MVP

### `system_notify`
Send a desktop notification.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `title` | **Yes** | `string` | Notification title |
| `message` | **Yes** | `string` | Notification message |
| `sound` | No | `string` | Notification sound name |

**Autonomy**: `auto`

---

### `system_open_app`
Open an application.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `appName` | **Yes** | `string` | Name of the application to open |

**Autonomy**: `auto`

---

### `system_open_url`
Open a URL in the default browser.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `url` | **Yes** | `string` | The URL to open |

**Autonomy**: `auto`

---

### `system_open_file`
Open a file in its default application.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `path` | **Yes** | `string` | Path to the file |

**Autonomy**: `auto`

---

### `system_clipboard_read`
Read the current clipboard contents.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| (none) | - | - | No parameters required |

**Autonomy**: `auto`

---

### `system_shell`
Execute a shell command.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `command` | **Yes** | `string` | Shell command to execute |
| `timeout` | No | `number` | Timeout in milliseconds |

**Autonomy**: `approval`

---

### `system_window_focus`
Focus a window by application name.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `appName` | **Yes** | `string` | Name of the application to focus |

**Autonomy**: `auto`

---

### `system_window_arrange`
Arrange windows on screen.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `layout` | **Yes** | `string` | Layout type (e.g., "split", "stack") |

**Autonomy**: `auto`

---

### `system_dnd`
Toggle Do Not Disturb mode.

| Property | Required | Type | Description |
|----------|----------|------|-------------|
| `enabled` | **Yes** | `boolean` | Enable or disable DND |

**Autonomy**: `approval`

---

## Tool Summary

| MCP Server | Total Tools | Auto | Approval |
|------------|-------------|------|----------|
| `mcp-notion` | 6 | 3 | 3 |
| `mcp-gmail` | 8 | 5 | 3 |
| `mcp-gcal` | 7 | 4 | 3 |
| `mcp-system` | 9 | 7 | 2 |
| **Total** | **30** | **19** | **11** |

---

## Usage with OpenCode

These MCP servers are configured in `opencode.json`:

```json
{
  "mcp": {
    "flowstate-notion": {
      "type": "local",
      "command": ["node", "./packages/mcp-notion/dist/index.js"],
      "enabled": true
    },
    "flowstate-gmail": {
      "type": "local",
      "command": ["node", "./packages/mcp-gmail/dist/index.js"],
      "enabled": true
    },
    "flowstate-gcal": {
      "type": "local",
      "command": ["node", "./packages/mcp-gcal/dist/index.js"],
      "enabled": true
    },
    "flowstate-system": {
      "type": "local",
      "command": ["node", "./packages/mcp-system/dist/index.js"],
      "enabled": true
    }
  }
}
```

---

*Last Updated: January 2026*

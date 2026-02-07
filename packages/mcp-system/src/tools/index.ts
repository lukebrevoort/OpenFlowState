/**
 * System MCP Tools
 * 
 * Tool definitions for system automation (macOS-focused for MVP).
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as macos from '../macos/index.js';
import { userProfile } from '@flowstate/core';

// Tool definitions with MCP annotations for better LLM understanding
const SYSTEM_TOOLS = [
  {
    name: 'system_notify',
    description: 'Send a desktop notification',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Notification title',
        },
        message: {
          type: 'string',
          description: 'Notification message',
        },
        sound: {
          type: 'boolean',
          description: 'Play notification sound (default: true)',
        },
      },
      required: ['title', 'message'],
    },
  },
  {
    name: 'system_open_app',
    description: 'Open an application',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name of the application (e.g., "Notion", "Slack")',
        },
      },
      required: ['appName'],
    },
  },
  {
    name: 'system_open_url',
    description: 'Open a URL in the default browser',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to open',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'system_open_file',
    description: 'Open a file in its default application',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'system_clipboard_read',
    description: 'Read the current clipboard contents',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'system_window_focus',
    description: 'Focus a specific application window',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        appName: {
          type: 'string',
          description: 'Name of the application to focus',
        },
      },
      required: ['appName'],
    },
  },
  {
    name: 'system_window_arrange',
    description: 'Arrange windows (requires approval for complex arrangements)',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        layout: {
          type: 'string',
          enum: ['split-horizontal', 'split-vertical', 'maximize', 'center'],
          description: 'Window arrangement layout',
        },
        apps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Apps to arrange (for split layouts)',
        },
      },
      required: ['layout'],
    },
  },
  {
    name: 'system_user_profile_get',
    description: 'Read the FlowState user profile preferences',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'system_user_profile_update',
    description: 'Update FlowState user profile preferences',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          description: 'Partial user profile fields to update',
        },
      },
      required: ['profile'],
    },
  },
  {
    name: 'system_user_profile_path',
    description: 'Get the path to the FlowState user profile file',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'system_shell',
    description: 'Execute a shell command',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'system_dnd',
    description: 'Toggle Do Not Disturb mode',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Enable or disable Do Not Disturb',
        },
      },
      required: ['enabled'],
    },
  },
];

export function registerTools(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: SYSTEM_TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'system_notify':
        await macos.sendNotification(
          args?.title as string,
          args?.message as string,
          args?.sound as boolean
        );
        return {
          content: [
            {
              type: 'text',
              text: `Notification sent: ${args?.title}`,
            },
          ],
        };

      case 'system_open_app':
        await macos.openApp(args?.appName as string);
        return {
          content: [
            {
              type: 'text',
              text: `Opened: ${args?.appName}`,
            },
          ],
        };

      case 'system_open_url':
        await macos.openUrl(args?.url as string);
        return {
          content: [
            {
              type: 'text',
              text: `Opened URL: ${args?.url}`,
            },
          ],
        };

      case 'system_open_file':
        await macos.openFile(args?.path as string);
        return {
          content: [
            {
              type: 'text',
              text: `Opened file: ${args?.path}`,
            },
          ],
        };

      case 'system_clipboard_read':
        const clipboardContent = await macos.readClipboard();
        return {
          content: [
            {
              type: 'text',
              text: clipboardContent,
            },
          ],
        };

      case 'system_window_focus':
        await macos.focusApp(args?.appName as string);
        return {
          content: [
            {
              type: 'text',
              text: `Focused: ${args?.appName}`,
            },
          ],
        };

      case 'system_window_arrange':
        await macos.arrangeWindows(
          args?.layout as string,
          args?.apps as string[]
        );
        return {
          content: [
            {
              type: 'text',
              text: `Arranged windows: ${args?.layout}`,
            },
          ],
        };

      case 'system_user_profile_get': {
        const profile = await userProfile.getProfile();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(profile, null, 2),
            },
          ],
        };
      }

      case 'system_user_profile_update': {
        const updates = args?.profile as Record<string, unknown> | undefined;
        if (!updates || typeof updates !== 'object') {
          throw new Error('system_user_profile_update requires a profile object');
        }
        const updated = await userProfile.updateProfile(updates);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updated, null, 2),
            },
          ],
        };
      }

      case 'system_user_profile_path': {
        const profilePath = userProfile.getProfilePath();
        return {
          content: [
            {
              type: 'text',
              text: profilePath,
            },
          ],
        };
      }

      case 'system_shell':
        const output = await macos.executeShell(
          args?.command as string,
          args?.cwd as string
        );
        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };

      case 'system_dnd':
        await macos.setDoNotDisturb(args?.enabled as boolean);
        return {
          content: [
            {
              type: 'text',
              text: `Do Not Disturb: ${args?.enabled ? 'enabled' : 'disabled'}`,
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
}

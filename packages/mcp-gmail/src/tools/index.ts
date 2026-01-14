/**
 * Gmail MCP Tools
 * 
 * Tool definitions for Gmail integration.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { notifications } from '@flowstate/core';
import * as gmailApi from '../api/index.js';

// Tool definitions with autonomy levels
const GMAIL_TOOLS = [
  {
    name: 'gmail_list',
    description: 'List emails from inbox with optional filters',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: {
          type: 'number',
          description: 'Maximum number of emails to return (default: 10)',
        },
        labelIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by label IDs (e.g., INBOX, UNREAD)',
        },
        query: {
          type: 'string',
          description: 'Gmail search query (same as Gmail search box)',
        },
      },
    },
  },
  {
    name: 'gmail_read',
    description: 'Read the full content of a specific email',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the email to read',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'gmail_search',
    description: 'Search emails using Gmail query syntax',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Gmail search query (e.g., "from:john subject:meeting")',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'gmail_draft',
    description: 'Create an email draft (does not send)',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject',
        },
        body: {
          type: 'string',
          description: 'Email body (plain text or HTML)',
        },
        cc: {
          type: 'string',
          description: 'CC recipients (comma-separated)',
        },
        bcc: {
          type: 'string',
          description: 'BCC recipients (comma-separated)',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'gmail_label',
    description: 'Add or remove labels from an email',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the email',
        },
        addLabels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to add',
        },
        removeLabels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to remove',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'gmail_send',
    description: 'Send an email',
    autonomy: 'approval',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject',
        },
        body: {
          type: 'string',
          description: 'Email body (plain text or HTML)',
        },
        cc: {
          type: 'string',
          description: 'CC recipients (comma-separated)',
        },
        bcc: {
          type: 'string',
          description: 'BCC recipients (comma-separated)',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'gmail_reply',
    description: 'Reply to an email thread',
    autonomy: 'approval',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: {
          type: 'string',
          description: 'The ID of the thread to reply to',
        },
        body: {
          type: 'string',
          description: 'Reply body',
        },
        replyAll: {
          type: 'boolean',
          description: 'Reply to all recipients (default: false)',
        },
      },
      required: ['threadId', 'body'],
    },
  },
  {
    name: 'gmail_delete',
    description: 'Move an email to trash',
    autonomy: 'approval',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the email to delete',
        },
      },
      required: ['messageId'],
    },
  },
];

export function registerTools(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: GMAIL_TOOLS.map(({ autonomy, ...tool }) => tool),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'gmail_list':
        case 'gmail_search': {
          const messages = await gmailApi.listMessages({
            maxResults: args?.maxResults as number | undefined,
            labelIds: args?.labelIds as string[] | undefined,
            query: args?.query as string | undefined,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(messages, null, 2),
              },
            ],
          };
        }

        case 'gmail_read': {
          const message = await gmailApi.getMessage(args?.messageId as string);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(message, null, 2),
              },
            ],
          };
        }

        case 'gmail_draft': {
          const draft = await gmailApi.createDraft({
            to: args?.to as string,
            subject: args?.subject as string,
            body: args?.body as string,
            cc: args?.cc as string | undefined,
            bcc: args?.bcc as string | undefined,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `Created draft: ${draft.id}\n${JSON.stringify(draft, null, 2)}`,
              },
            ],
          };
        }

        case 'gmail_label': {
          const message = await gmailApi.modifyLabels(
            args?.messageId as string,
            args?.addLabels as string[] | undefined,
            args?.removeLabels as string[] | undefined
          );
          
          return {
            content: [
              {
                type: 'text',
                text: `Modified labels on message: ${message.id}\n${JSON.stringify(message, null, 2)}`,
              },
            ],
          };
        }

        case 'gmail_send': {
          const approved = await notifications.requestApproval(
            'Send Email',
            `Send email to ${args?.to} with subject "${args?.subject}"?`
          );

          if (!approved) {
            return {
              content: [{ type: 'text', text: 'Action denied by user.' }],
              isError: true,
            };
          }

          const message = await gmailApi.sendMessage({
            to: args?.to as string,
            subject: args?.subject as string,
            body: args?.body as string,
            cc: args?.cc as string | undefined,
            bcc: args?.bcc as string | undefined,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `Sent email: ${message.id}\n${JSON.stringify(message, null, 2)}`,
              },
            ],
          };
        }

        case 'gmail_reply': {
          const approved = await notifications.requestApproval(
            'Reply to Email',
            `Reply to thread ${args?.threadId}?`
          );

          if (!approved) {
            return {
              content: [{ type: 'text', text: 'Action denied by user.' }],
              isError: true,
            };
          }

          const message = await gmailApi.replyToMessage(
            args?.threadId as string,
            args?.body as string,
            args?.replyAll as boolean
          );
          
          return {
            content: [
              {
                type: 'text',
                text: `Sent reply to thread: ${args?.threadId}\n${JSON.stringify(message, null, 2)}`,
              },
            ],
          };
        }

        case 'gmail_delete': {
          const approved = await notifications.requestApproval(
            'Delete Email',
            `Move email ${args?.messageId} to trash?`
          );

          if (!approved) {
            return {
              content: [{ type: 'text', text: 'Action denied by user.' }],
              isError: true,
            };
          }

          const message = await gmailApi.trashMessage(args?.messageId as string);
          
          return {
            content: [
              {
                type: 'text',
                text: `Trashed email: ${message.id}\n${JSON.stringify(message, null, 2)}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });
}

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

const DEFAULT_FIELDS = 'id,threadId,labelIds,snippet,payload/headers';
const THREAD_FIELDS = 'id,historyId,messages/id,messages/threadId,messages/labelIds,messages/snippet,messages/payload/headers';

const formatToolError = (error: unknown): string => {
  if (error instanceof Error) {
    const responseData = (error as { response?: { data?: unknown; status?: number } }).response;
    if (responseData?.data) {
      return `${error.message} (status: ${responseData.status ?? 'unknown'})\n${JSON.stringify(responseData.data, null, 2)}`;
    }
    return error.message;
  }

  return String(error);
};

// Tool definitions with autonomy levels
const GMAIL_TOOLS = [
  {
    name: 'gmail_list',
    description: 'List emails from inbox with optional filters (metadata by default)',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: {
          type: 'number',
          description: 'Maximum number of emails to return (default: 10, max: 50)',
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
        detailLevel: {
          type: 'string',
          description: 'ids | metadata | full (default: metadata)',
        },
      },
    },
  },
  {
    name: 'gmail_read',
    description: 'Read a specific email (metadata by default)',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the email to read',
        },
        detailLevel: {
          type: 'string',
          description: 'ids | metadata | full (default: metadata)',
        },
        maxBodyChars: {
          type: 'number',
          description: 'Maximum body characters to return (default: 2000)',
        },
        includeHtml: {
          type: 'boolean',
          description: 'Include HTML content when detailLevel=full (default: false)',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'gmail_search',
    description: 'Search emails using Gmail query syntax (metadata by default)',
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
          description: 'Maximum number of results (default: 10, max: 50)',
        },
        detailLevel: {
          type: 'string',
          description: 'ids | metadata | full (default: metadata)',
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
    name: 'gmail_get_thread',
    description: 'Get messages from a thread (metadata by default)',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: {
          type: 'string',
          description: 'The ID of the thread to fetch',
        },
        maxMessages: {
          type: 'number',
          description: 'Maximum number of messages to return (default: 5)',
        },
        detailLevel: {
          type: 'string',
          description: 'metadata | full (default: metadata)',
        },
      },
      required: ['threadId'],
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

    console.error('[mcp-gmail] Tool call:', name, JSON.stringify(args));

    try {
      switch (name) {
        case 'gmail_list':
        case 'gmail_search': {
          const detailLevel = (args?.detailLevel as gmailApi.GmailMessageDetailLevel | undefined) ?? 'metadata';
          const messageIds = await gmailApi.listMessages({
            maxResults: args?.maxResults as number | undefined,
            labelIds: args?.labelIds as string[] | undefined,
            query: args?.query as string | undefined,
          });

          if (detailLevel === 'ids') {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(messageIds, null, 2),
                },
              ],
            };
          }

          const messages = await Promise.all(
            (messageIds || []).map((item) =>
              gmailApi.getMessage(item.id as string, {
                detailLevel,
                format: detailLevel === 'full' ? 'full' : 'metadata',
                fields: detailLevel === 'full'
                  ? undefined
                  : DEFAULT_FIELDS,
                includeHeaders: detailLevel === 'metadata',
              })
            )
          );


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
          const detailLevel = (args?.detailLevel as gmailApi.GmailMessageDetailLevel | undefined) ?? 'metadata';
          const includeHtml = args?.includeHtml === true;
          const maxBodyChars = (args?.maxBodyChars as number | undefined) ?? 2000;
          const message = await gmailApi.getMessage(args?.messageId as string, {
            detailLevel,
            format: detailLevel === 'full' ? 'full' : 'metadata',
            fields: detailLevel === 'full'
              ? undefined
              : DEFAULT_FIELDS,
            includeHeaders: detailLevel === 'metadata',
          });

          if (detailLevel === 'full' && message?.payload && !includeHtml) {
            const stripHtmlParts = (part: any) => {
              if (!part) return;
              if (part.mimeType === 'text/html') {
                part.body = { size: 0, data: '' };
              }
              if (Array.isArray(part.parts)) {
                part.parts.forEach(stripHtmlParts);
              }
            };
            stripHtmlParts(message.payload);
          }

          if (detailLevel === 'full' && maxBodyChars && message?.payload) {
            const payload = message.payload;
            const bodyData = payload.body?.data;
            if (bodyData) {
              const decoded = Buffer.from(bodyData, 'base64').toString('utf8');
              const trimmed = decoded.slice(0, maxBodyChars);
              payload.body = {
                ...payload.body,
                data: Buffer.from(trimmed, 'utf8').toString('base64'),
              };
            }
          }

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
                text: JSON.stringify(draft, null, 2),
              },
            ],
          };
        }

        case 'gmail_get_thread': {
          const detailLevel = (args?.detailLevel as gmailApi.GmailMessageDetailLevel | undefined) ?? 'metadata';
          const thread = await gmailApi.getThread(args?.threadId as string, {
            detailLevel,
            maxMessages: (args?.maxMessages as number | undefined) ?? 5,
            fields: detailLevel === 'full'
              ? undefined
              : THREAD_FIELDS,
            includeHeaders: detailLevel === 'metadata',
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(thread, null, 2),
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
          // OpenCode handles approval permissions.
          // We notify the user that an action is happening.
          await notifications.notify('Sending Email', `To: ${args?.to}`);

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
          await notifications.notify('Replying to Email', `Thread: ${args?.threadId}`);

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
          await notifications.notify('Deleting Email', `ID: ${args?.messageId}`);

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
      const errorMessage = formatToolError(error);
      console.error('[mcp-gmail] Tool error:', errorMessage);
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

/**
 * Notion MCP Tools
 * 
 * Tool definitions for Notion integration.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { notifications } from '@flowstate/core';
import * as notionApi from '../api/index.js';

// Tool definitions with autonomy levels
const NOTION_TOOLS = [
  {
    name: 'notion_search',
    description: 'Search Notion pages and databases by query',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text',
        },
        filter: {
          type: 'string',
          enum: ['page', 'database'],
          description: 'Filter results by type',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'notion_read_page',
    description: 'Read the content of a Notion page',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'The ID of the page to read',
        },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'notion_read_database',
    description: 'Query entries from a Notion database',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: {
          type: 'string',
          description: 'The ID of the database to query',
        },
        filter: {
          type: 'object',
          description: 'Optional filter object for the query',
        },
        sorts: {
          type: 'array',
          description: 'Optional sort configuration',
        },
      },
      required: ['databaseId'],
    },
  },
  {
    name: 'notion_create_page',
    description: 'Create a new Notion page',
    autonomy: 'approval',
    inputSchema: {
      type: 'object',
      properties: {
        parentId: {
          type: 'string',
          description: 'Parent page or database ID',
        },
        title: {
          type: 'string',
          description: 'Page title',
        },
        content: {
          type: 'string',
          description: 'Page content in markdown format',
        },
        properties: {
          type: 'object',
          description: 'Database properties (if parent is a database)',
        },
      },
      required: ['parentId', 'title'],
    },
  },
  {
    name: 'notion_update_page',
    description: 'Update an existing Notion page',
    autonomy: 'approval',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'The ID of the page to update',
        },
        properties: {
          type: 'object',
          description: 'Properties to update',
        },
        content: {
          type: 'string',
          description: 'New content in markdown format',
        },
      },
      required: ['pageId'],
    },
  },
  {
    name: 'notion_create_database_entry',
    description: 'Add a new entry to a Notion database',
    autonomy: 'approval',
    inputSchema: {
      type: 'object',
      properties: {
        databaseId: {
          type: 'string',
          description: 'The ID of the database',
        },
        properties: {
          type: 'object',
          description: 'Properties for the new entry',
        },
      },
      required: ['databaseId', 'properties'],
    },
  },
];

export function registerTools(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: NOTION_TOOLS.map(({ autonomy, ...tool }) => tool),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'notion_search': {
          const results = await notionApi.searchPages(
            args?.query as string,
            args?.filter as 'page' | 'database' | undefined
          );
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        case 'notion_read_page': {
          const page = await notionApi.getPage(args?.pageId as string);
          const content = await notionApi.getPageContent(args?.pageId as string);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ page, content }, null, 2),
              },
            ],
          };
        }

        case 'notion_read_database': {
          const results = await notionApi.queryDatabase(
            args?.databaseId as string,
            args?.filter as object | undefined,
            args?.sorts as object[] | undefined
          );
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2),
              },
            ],
          };
        }

        case 'notion_create_page': {
          const approved = await notifications.requestApproval(
            'Create Notion Page',
            `Create page "${args?.title}" under parent ${args?.parentId}?`
          );

          if (!approved) {
            return {
              content: [{ type: 'text', text: 'Action denied by user.' }],
              isError: true,
            };
          }

          const page = await notionApi.createPage(
            args?.parentId as string,
            args?.title as string,
            args?.properties as object | undefined
          );
          
          return {
            content: [
              {
                type: 'text',
                text: `Created page: ${page.id}\n${JSON.stringify(page, null, 2)}`,
              },
            ],
          };
        }

        case 'notion_update_page': {
          const approved = await notifications.requestApproval(
            'Update Notion Page',
            `Update page ${args?.pageId}?`
          );

          if (!approved) {
            return {
              content: [{ type: 'text', text: 'Action denied by user.' }],
              isError: true,
            };
          }

          const page = await notionApi.updatePage(
            args?.pageId as string,
            args?.properties as object
          );
          
          return {
            content: [
              {
                type: 'text',
                text: `Updated page: ${page.id}\n${JSON.stringify(page, null, 2)}`,
              },
            ],
          };
        }

        case 'notion_create_database_entry': {
          const approved = await notifications.requestApproval(
            'Create Database Entry',
            `Add entry to database ${args?.databaseId}?`
          );

          if (!approved) {
            return {
              content: [{ type: 'text', text: 'Action denied by user.' }],
              isError: true,
            };
          }

          const page = await notionApi.createPage(
            args?.databaseId as string,
            '', // Title will be in properties
            args?.properties as object
          );
          
          return {
            content: [
              {
                type: 'text',
                text: `Created database entry: ${page.id}\n${JSON.stringify(page, null, 2)}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // Return error as text content
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

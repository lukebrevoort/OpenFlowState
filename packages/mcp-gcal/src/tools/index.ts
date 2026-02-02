/**
 * Google Calendar MCP Tools
 * 
 * Tool definitions for Google Calendar integration.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { notifications } from '@flowstate/core';
import * as gcalApi from '../api/index.js';

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
const GCAL_TOOLS = [
  {
    name: 'gcal_list_calendars',
    description: 'List calendars available in the connected Google account',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'gcal_list_events',
    description: 'List calendar events within a time range. By default, queries all calendars selected by the user in FlowState settings. Use calendarId or calendarIds parameters to override and query specific calendars.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        timeMin: {
          type: 'string',
          description: 'Start of time range (ISO 8601 format)',
        },
        timeMax: {
          type: 'string',
          description: 'End of time range (ISO 8601 format)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of events to return per calendar (default: 10)',
        },
        calendarId: {
          type: 'string',
          description: 'Specific calendar ID to query (optional, defaults to user-selected calendars)',
        },
        calendarIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of specific calendar IDs to query (optional, overrides default selection)',
        },
      },
    },
  },
  {
    name: 'gcal_get_event',
    description: 'Get details of a specific calendar event',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event',
        },
        calendarId: {
          type: 'string',
          description: 'Calendar ID (default: primary)',
        },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'gcal_free_busy',
    description: 'Check availability/free-busy times for calendars. By default, checks all calendars selected by the user in FlowState settings.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        timeMin: {
          type: 'string',
          description: 'Start of time range (ISO 8601 format)',
        },
        timeMax: {
          type: 'string',
          description: 'End of time range (ISO 8601 format)',
        },
        calendarIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of specific calendar IDs to check (optional, defaults to user-selected calendars)',
        },
      },
      required: ['timeMin', 'timeMax'],
    },
  },
  {
    name: 'gcal_find_conflicts',
    description: 'Find scheduling conflicts within a time range across all selected calendars. Checks all calendars the user has selected in FlowState settings.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        timeMin: {
          type: 'string',
          description: 'Start of time range (ISO 8601 format)',
        },
        timeMax: {
          type: 'string',
          description: 'End of time range (ISO 8601 format)',
        },
        calendarIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of specific calendar IDs to check (optional, defaults to user-selected calendars)',
        },
      },
      required: ['timeMin', 'timeMax'],
    },
  },
  {
    name: 'gcal_create_event',
    description: 'Create a new calendar event',
    autonomy: 'approval',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Event title',
        },
        description: {
          type: 'string',
          description: 'Event description',
        },
        start: {
          type: 'string',
          description: 'Start time (ISO 8601 format)',
        },
        end: {
          type: 'string',
          description: 'End time (ISO 8601 format)',
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Email addresses of attendees',
        },
        location: {
          type: 'string',
          description: 'Event location',
        },
        calendarId: {
          type: 'string',
          description: 'Calendar ID (default: primary)',
        },
      },
      required: ['summary', 'start', 'end'],
    },
  },
  {
    name: 'gcal_update_event',
    description: 'Update an existing calendar event',
    autonomy: 'approval',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event to update',
        },
        summary: {
          type: 'string',
          description: 'New event title',
        },
        description: {
          type: 'string',
          description: 'New event description',
        },
        start: {
          type: 'string',
          description: 'New start time (ISO 8601 format)',
        },
        end: {
          type: 'string',
          description: 'New end time (ISO 8601 format)',
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated attendee emails',
        },
        calendarId: {
          type: 'string',
          description: 'Calendar ID (default: primary)',
        },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'gcal_delete_event',
    description: 'Delete a calendar event',
    autonomy: 'approval',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: {
          type: 'string',
          description: 'The ID of the event to delete',
        },
        calendarId: {
          type: 'string',
          description: 'Calendar ID (default: primary)',
        },
      },
      required: ['eventId'],
    },
  },
];

export function registerTools(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: GCAL_TOOLS.map(({ autonomy, ...tool }) => tool),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error('[mcp-gcal] Tool call:', name, JSON.stringify(args));

    try {
      switch (name) {
        case 'gcal_list_calendars': {
          const calendars = await gcalApi.listCalendars();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(calendars, null, 2),
              },
            ],
          };
        }

        case 'gcal_list_events': {
          const events = await gcalApi.listEvents({
            calendarId: args?.calendarId as string | undefined,
            calendarIds: args?.calendarIds as string[] | undefined,
            timeMin: args?.timeMin as string | undefined,
            timeMax: args?.timeMax as string | undefined,
            maxResults: args?.maxResults as number | undefined,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(events, null, 2),
              },
            ],
          };
        }

        case 'gcal_get_event': {
          const event = await gcalApi.getEvent(
            args?.eventId as string,
            args?.calendarId as string | undefined
          );
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(event, null, 2),
              },
            ],
          };
        }

        case 'gcal_free_busy': {
          const freeBusy = await gcalApi.getFreeBusy({
            timeMin: args?.timeMin as string,
            timeMax: args?.timeMax as string,
            calendarIds: args?.calendarIds as string[] | undefined,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(freeBusy, null, 2),
              },
            ],
          };
        }

        case 'gcal_find_conflicts': {
          const conflicts = await gcalApi.findConflicts(
            args?.timeMin as string,
            args?.timeMax as string,
            args?.calendarIds as string[] | undefined
          );
          
          if (conflicts.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No conflicts found in the specified time range.',
                },
              ],
            };
          }
          
          return {
            content: [
              {
                type: 'text',
                text: `Found ${conflicts.length} conflict(s):\n${JSON.stringify(conflicts, null, 2)}`,
              },
            ],
          };
        }

        case 'gcal_create_event': {
          await notifications.notify('Creating Event', `Summary: ${args?.summary}`);

          const event = await gcalApi.createEvent({
            summary: args?.summary as string,
            description: args?.description as string | undefined,
            start: args?.start as string,
            end: args?.end as string,
            attendees: args?.attendees as string[] | undefined,
            location: args?.location as string | undefined,
            calendarId: args?.calendarId as string | undefined,
          });
          
          return {
            content: [
              {
                type: 'text',
                text: `Created event: ${event.id}\n${JSON.stringify(event, null, 2)}`,
              },
            ],
          };
        }

        case 'gcal_update_event': {
          await notifications.notify('Updating Event', `ID: ${args?.eventId}`);

          const event = await gcalApi.updateEvent(
            args?.eventId as string,
            {
              summary: args?.summary as string | undefined,
              description: args?.description as string | undefined,
              start: args?.start as string | undefined,
              end: args?.end as string | undefined,
              attendees: args?.attendees as string[] | undefined,
            },
            args?.calendarId as string | undefined
          );
          
          return {
            content: [
              {
                type: 'text',
                text: `Updated event: ${event.id}\n${JSON.stringify(event, null, 2)}`,
              },
            ],
          };
        }

        case 'gcal_delete_event': {
          await notifications.notify('Deleting Event', `ID: ${args?.eventId}`);

          await gcalApi.deleteEvent(
            args?.eventId as string,
            args?.calendarId as string | undefined
          );
          
          return {
            content: [
              {
                type: 'text',
                text: `Deleted event: ${args?.eventId}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = formatToolError(error);
      console.error('[mcp-gcal] Tool error:', errorMessage);
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

/**
 * Canvas LMS MCP Tools
 * 
 * Tool definitions for Canvas LMS integration.
 * Designed for student workflows - assignments, grades, courses, and study planning.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as canvasApi from '../api/index.js';

const formatToolError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

// Helper to format dates for display
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return 'No date set';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// Tool definitions with autonomy levels
const CANVAS_TOOLS = [
  // ========== READ OPERATIONS (Auto) ==========
  {
    name: 'canvas_list_courses',
    description: 'List all enrolled courses for the current student. Returns course names, codes, and enrollment status.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        enrollmentState: {
          type: 'string',
          enum: ['active', 'completed', 'all'],
          description: 'Filter by enrollment state (default: active)',
        },
        includeGrades: {
          type: 'boolean',
          description: 'Include current grades in response',
        },
      },
    },
  },
  {
    name: 'canvas_get_course',
    description: 'Get detailed information about a specific course',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'number',
          description: 'The Canvas course ID',
        },
      },
      required: ['courseId'],
    },
  },
  {
    name: 'canvas_list_assignments',
    description: 'List all assignments for a course, including due dates and point values. Great for understanding workload and planning study time.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'number',
          description: 'The Canvas course ID',
        },
        orderBy: {
          type: 'string',
          enum: ['due_at', 'name', 'position'],
          description: 'How to order assignments (default: due_at)',
        },
        includeSubmission: {
          type: 'boolean',
          description: 'Include submission status for each assignment',
        },
      },
      required: ['courseId'],
    },
  },
  {
    name: 'canvas_get_assignment',
    description: 'Get detailed information about a specific assignment including description, rubric, and requirements',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'number',
          description: 'The Canvas course ID',
        },
        assignmentId: {
          type: 'number',
          description: 'The assignment ID',
        },
      },
      required: ['courseId', 'assignmentId'],
    },
  },
  {
    name: 'canvas_get_upcoming',
    description: 'Get all upcoming assignments and to-do items across all courses. Essential for daily/weekly planning and prioritization.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'canvas_get_grades',
    description: 'Get current grades for all enrolled courses. Useful for tracking academic progress and identifying courses that need attention.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'canvas_get_submission',
    description: 'Get submission status and grade for a specific assignment',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'number',
          description: 'The Canvas course ID',
        },
        assignmentId: {
          type: 'number',
          description: 'The assignment ID',
        },
      },
      required: ['courseId', 'assignmentId'],
    },
  },
  {
    name: 'canvas_list_announcements',
    description: 'Get recent announcements from courses. Helps stay informed about class updates, changes, and important notices.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        courseIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'List of course IDs to get announcements from',
        },
        startDate: {
          type: 'string',
          description: 'Start date for announcements (ISO 8601 format)',
        },
        endDate: {
          type: 'string',
          description: 'End date for announcements (ISO 8601 format)',
        },
      },
      required: ['courseIds'],
    },
  },
  {
    name: 'canvas_list_modules',
    description: 'List course modules/units. Useful for understanding course structure and what content is available.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'number',
          description: 'The Canvas course ID',
        },
      },
      required: ['courseId'],
    },
  },
  {
    name: 'canvas_get_module_items',
    description: 'Get items within a specific module (pages, files, assignments). Helpful for diving into specific course content.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: {
          type: 'number',
          description: 'The Canvas course ID',
        },
        moduleId: {
          type: 'number',
          description: 'The module ID',
        },
      },
      required: ['courseId', 'moduleId'],
    },
  },
  {
    name: 'canvas_get_calendar',
    description: 'Get calendar events and assignment due dates. Perfect for weekly planning and scheduling study sessions.',
    autonomy: 'auto',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date (ISO 8601 format)',
        },
        endDate: {
          type: 'string',
          description: 'End date (ISO 8601 format)',
        },
        type: {
          type: 'string',
          enum: ['event', 'assignment'],
          description: 'Filter by event type',
        },
      },
    },
  },
];

export function registerTools(server: Server): void {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: CANVAS_TOOLS.map(({ autonomy, ...tool }) => tool),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error('[mcp-canvas] Tool call:', name, JSON.stringify(args));

    try {
      switch (name) {
        case 'canvas_list_courses': {
          const courses = await canvasApi.getCourses({
            enrollmentState: args?.enrollmentState as 'active' | 'completed' | 'all' | undefined,
            includeGrades: args?.includeGrades as boolean | undefined,
          });
          
          // Format for better readability
          const formatted = courses.map(course => ({
            id: course.id,
            name: course.name,
            code: course.course_code,
            state: course.workflow_state,
            startDate: formatDate(course.start_at),
            endDate: formatDate(course.end_at),
          }));
          
          return {
            content: [
              {
                type: 'text',
                text: `Found ${courses.length} course(s):\n\n${JSON.stringify(formatted, null, 2)}`,
              },
            ],
          };
        }

        case 'canvas_get_course': {
          const course = await canvasApi.getCourse(args?.courseId as number);
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(course, null, 2),
              },
            ],
          };
        }

        case 'canvas_list_assignments': {
          const assignments = await canvasApi.getAssignments(
            args?.courseId as number,
            {
              orderBy: args?.orderBy as 'due_at' | 'name' | 'position' | undefined,
              includeSubmission: args?.includeSubmission as boolean | undefined,
            }
          );
          
          // Format for study planning
          const formatted = assignments.map(a => ({
            id: a.id,
            name: a.name,
            dueDate: formatDate(a.due_at),
            points: a.points_possible,
            submissionTypes: a.submission_types.join(', '),
            submitted: a.has_submitted_submissions,
            url: a.html_url,
          }));
          
          return {
            content: [
              {
                type: 'text',
                text: `Found ${assignments.length} assignment(s):\n\n${JSON.stringify(formatted, null, 2)}`,
              },
            ],
          };
        }

        case 'canvas_get_assignment': {
          const assignment = await canvasApi.getAssignment(
            args?.courseId as number,
            args?.assignmentId as number
          );
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  id: assignment.id,
                  name: assignment.name,
                  description: assignment.description,
                  dueDate: formatDate(assignment.due_at),
                  unlockDate: formatDate(assignment.unlock_at),
                  lockDate: formatDate(assignment.lock_at),
                  points: assignment.points_possible,
                  submissionTypes: assignment.submission_types,
                  url: assignment.html_url,
                }, null, 2),
              },
            ],
          };
        }

        case 'canvas_get_upcoming': {
          const todos = await canvasApi.getUpcomingAssignments();
          
          if (todos.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No upcoming assignments or to-do items! 🎉',
                },
              ],
            };
          }
          
          const formatted = todos.map(item => ({
            type: item.type,
            course: item.context_name,
            assignment: item.assignment?.name,
            dueDate: item.assignment?.due_at ? formatDate(item.assignment.due_at) : 'No due date',
            points: item.assignment?.points_possible,
            url: item.html_url,
          }));
          
          return {
            content: [
              {
                type: 'text',
                text: `${todos.length} upcoming item(s):\n\n${JSON.stringify(formatted, null, 2)}`,
              },
            ],
          };
        }

        case 'canvas_get_grades': {
          const grades = await canvasApi.getGrades();
          
          // Get course names
          const courses = await canvasApi.getCourses({ enrollmentState: 'active' });
          const courseMap = new Map(courses.map(c => [c.id, c.name]));
          
          const formatted = grades.map(g => ({
            course: courseMap.get(g.course_id) || `Course ${g.course_id}`,
            currentGrade: g.current_grade || 'N/A',
            currentScore: g.current_score !== null ? `${g.current_score}%` : 'N/A',
            finalGrade: g.final_grade || 'N/A',
            finalScore: g.final_score !== null ? `${g.final_score}%` : 'N/A',
          }));
          
          return {
            content: [
              {
                type: 'text',
                text: `Grades for ${grades.length} course(s):\n\n${JSON.stringify(formatted, null, 2)}`,
              },
            ],
          };
        }

        case 'canvas_get_submission': {
          const submission = await canvasApi.getSubmission(
            args?.courseId as number,
            args?.assignmentId as number
          );
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: submission.workflow_state,
                  submittedAt: submission.submitted_at ? formatDate(submission.submitted_at) : 'Not submitted',
                  score: submission.score,
                  grade: submission.grade,
                  late: submission.late,
                  missing: submission.missing,
                  excused: submission.excused,
                  attempt: submission.attempt,
                }, null, 2),
              },
            ],
          };
        }

        case 'canvas_list_announcements': {
          const announcements = await canvasApi.getAnnouncements(
            args?.courseIds as number[],
            {
              startDate: args?.startDate as string | undefined,
              endDate: args?.endDate as string | undefined,
            }
          );
          
          if (announcements.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No announcements found for the specified courses.',
                },
              ],
            };
          }
          
          const formatted = announcements.map(a => ({
            title: a.title,
            author: a.author.display_name,
            postedAt: formatDate(a.posted_at),
            message: a.message.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
          }));
          
          return {
            content: [
              {
                type: 'text',
                text: `${announcements.length} announcement(s):\n\n${JSON.stringify(formatted, null, 2)}`,
              },
            ],
          };
        }

        case 'canvas_list_modules': {
          const modules = await canvasApi.getModules(args?.courseId as number);
          
          const formatted = modules.map(m => ({
            id: m.id,
            name: m.name,
            position: m.position,
            itemsCount: m.items_count,
            state: m.state,
            unlockAt: m.unlock_at ? formatDate(m.unlock_at) : 'Unlocked',
          }));
          
          return {
            content: [
              {
                type: 'text',
                text: `${modules.length} module(s):\n\n${JSON.stringify(formatted, null, 2)}`,
              },
            ],
          };
        }

        case 'canvas_get_module_items': {
          const items = await canvasApi.getModuleItems(
            args?.courseId as number,
            args?.moduleId as number
          );
          
          const formatted = items.map(item => ({
            id: item.id,
            title: item.title,
            type: item.type,
            position: item.position,
            url: item.html_url,
            completed: item.completion_requirement?.completed ?? null,
          }));
          
          return {
            content: [
              {
                type: 'text',
                text: `${items.length} item(s) in module:\n\n${JSON.stringify(formatted, null, 2)}`,
              },
            ],
          };
        }

        case 'canvas_get_calendar': {
          const events = await canvasApi.getCalendarEvents({
            startDate: args?.startDate as string | undefined,
            endDate: args?.endDate as string | undefined,
            type: args?.type as 'event' | 'assignment' | undefined,
          });
          
          if (events.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No calendar events found for the specified date range.',
                },
              ],
            };
          }
          
          const formatted = events.map(e => ({
            title: e.title,
            type: e.type,
            start: formatDate(e.start_at),
            end: formatDate(e.end_at),
            url: e.html_url,
          }));
          
          return {
            content: [
              {
                type: 'text',
                text: `${events.length} calendar event(s):\n\n${JSON.stringify(formatted, null, 2)}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage = formatToolError(error);
      console.error('[mcp-canvas] Tool error:', errorMessage);
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

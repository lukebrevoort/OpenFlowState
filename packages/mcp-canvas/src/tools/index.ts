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
import {
  CANVAS_MAX_FILE_SIZE_BYTES,
  CANVAS_MAX_REDIRECTS,
  SUPPORTED_DOCUMENT_TYPES,
} from '../utils/constants.js';
import { extractDocumentText } from '../utils/documentParsers.js';

const redactSecretsFromString = (input: string): string => {
  return input
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(canvas_session|_csrf_token|csrf_token|session)=[^;\s]+/gi, '$1=[REDACTED]');
};

const redactSecretsDeep = (value: unknown): unknown => {
  if (typeof value === 'string') return redactSecretsFromString(value);
  if (Array.isArray(value)) return value.map(redactSecretsDeep);
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (/token|authorization|cookie|password|secret|key/i.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactSecretsDeep(v);
    }
  }
  return out;
};

const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(redactSecretsDeep(value));
  } catch {
    return '[Unserializable]';
  }
};

const formatToolError = (error: unknown): string => {
  if (error instanceof Error) {
    return redactSecretsFromString(error.message);
  }
  return redactSecretsFromString(String(error));
};

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return `${bytes}`;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)}${units[idx]}`;
};

const normalizeContentType = (contentType: string | undefined | null) => {
  if (!contentType) return 'application/octet-stream';
  return contentType.split(';')[0].trim().toLowerCase();
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

// Tool definitions with annotations for better LLM understanding
const CANVAS_TOOLS = [
  {
    name: 'canvas_auth_browser_login',
    description:
      'Open a browser to log into Canvas and save a Playwright storage state file (for schools that disallow API tokens)',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      properties: {
        storageStatePath: {
          type: 'string',
          description:
            'Where to save the Playwright storage state JSON (defaults to CANVAS_STORAGE_STATE_PATH)',
        },
        loginUrl: {
          type: 'string',
          description:
            'Optional override for the login URL (defaults to CANVAS_LOGIN_URL or {CANVAS_API_URL}/login)',
        },
        timeoutSeconds: {
          type: 'number',
          description: 'Max time to wait for login before failing (default: 300 seconds)',
        },
        headless: {
          type: 'boolean',
          description: 'Run the browser headless (default: false)',
        },
      },
    },
  },
  // ========== READ OPERATIONS (All read-only, safe to auto-execute) ==========
  {
    name: 'canvas_list_courses',
    description: 'List enrolled courses with names, codes, and status',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    description: 'Get detailed course information by ID',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    description: 'List assignments with due dates, points, and submission status',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
          description: 'Order assignments (default: due_at)',
        },
        includeSubmission: {
          type: 'boolean',
          description: 'Include your submission status',
        },
      },
      required: ['courseId'],
    },
  },
  {
    name: 'canvas_get_assignment',
    description: 'Get assignment details: description, requirements, and due date',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    description: 'Get all upcoming assignments and to-do items across all courses',
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
    name: 'canvas_get_grades',
    description: 'Get current grades for all enrolled courses',
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
    name: 'canvas_get_submission',
    description: 'Check your submission status and grade for a specific assignment',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    description: 'Get recent announcements from specified courses',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
          description: 'Start date (ISO 8601)',
        },
        endDate: {
          type: 'string',
          description: 'End date (ISO 8601)',
        },
      },
      required: ['courseIds'],
    },
  },
  {
    name: 'canvas_list_modules',
    description: 'List course modules/units with item counts and states',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    description: 'Get items within a specific module (pages, files, assignments)',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    description: 'Get calendar events and assignment due dates in a date range',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date (ISO 8601)',
        },
        endDate: {
          type: 'string',
          description: 'End date (ISO 8601)',
        },
        type: {
          type: 'string',
          enum: ['event', 'assignment'],
          description: 'Filter by event type',
        },
      },
    },
  },
  {
    name: 'canvas_list_course_files',
    description: 'List files available in a Canvas course (PDF/DOCX/etc.)',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
    name: 'canvas_get_file_info',
    description: 'Get metadata for a Canvas file (name, size, content type)',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'number',
          description: 'The Canvas file ID',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'canvas_read_file_text',
    description:
      'Download a Canvas file and extract its text for the assistant (supports PDF and DOCX).',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'number',
          description: 'The Canvas file ID',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'canvas_read_submission_attachment_text',
    description:
      'Download and extract text from your assignment submission attachment (PDF/DOCX).',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
        attachmentId: {
          type: 'number',
          description: 'Optional attachment id (defaults to first attachment)',
        },
      },
      required: ['courseId', 'assignmentId'],
    },
  },
];

export function registerTools(server: Server): void {
  // List available tools with annotations
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: CANVAS_TOOLS.map(({ annotations, ...tool }) => ({
      ...tool,
      annotations,
    })),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    console.error('[mcp-canvas] Tool call:', name, safeJson(args));

    try {
      switch (name) {
        case 'canvas_auth_browser_login': {
          const result = await canvasApi.browserLoginWithPlaywright({
            storageStatePath: args?.storageStatePath as string | undefined,
            loginUrl: args?.loginUrl as string | undefined,
            timeoutMs:
              typeof args?.timeoutSeconds === 'number'
                ? Math.max(1, Math.floor(args.timeoutSeconds)) * 1000
                : undefined,
            headless: args?.headless as boolean | undefined,
          });

          const userPart =
            result.userName || result.userId
              ? `Logged in as ${result.userName ?? `user ${result.userId}`}. `
              : '';

          return {
            content: [
              {
                type: 'text',
                text:
                  `${userPart}Saved Canvas session to: ${result.storageStatePath}\n` +
                  `Next: set CANVAS_AUTH_MODE=browser and CANVAS_STORAGE_STATE_PATH to this file.`,
              },
            ],
          };
        }

        case 'canvas_list_courses': {
          const courses = await canvasApi.getCourses({
            enrollmentState: args?.enrollmentState as 'active' | 'completed' | 'all' | undefined,
            includeGrades: args?.includeGrades as boolean | undefined,
          });
          
          const showGrades = args?.includeGrades === true;
          
          const formatted = courses.map(course => {
            const result: Record<string, unknown> = {
              id: course.id,
              name: course.name,
              code: course.course_code,
              state: course.workflow_state,
              startDate: formatDate(course.start_at),
              endDate: formatDate(course.end_at),
            };
            
            // Surface grades when requested
            if (showGrades && course.enrollments?.[0]?.grades) {
              const grades = course.enrollments[0].grades;
              result.currentGrade = grades.current_grade ?? 'N/A';
              result.currentScore = grades.current_score !== null ? `${grades.current_score}%` : 'N/A';
              result.finalGrade = grades.final_grade ?? 'N/A';
              result.finalScore = grades.final_score !== null ? `${grades.final_score}%` : 'N/A';
            }
            
            return result;
          });
          
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
                  text: 'No upcoming assignments or to-do items!',
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
          const submission = await canvasApi.getSubmissionDetailed(
            args?.courseId as number,
            args?.assignmentId as number
          );

          const attachments = (submission.attachments ?? []).map((attachment) => ({
            id: attachment.id,
            filename: attachment.filename,
            size: attachment.size,
            sizeHuman: attachment.size ? formatBytes(attachment.size) : undefined,
            contentType: normalizeContentType(attachment.content_type ?? attachment['content-type']),
          }));

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
                  attachments: attachments.length > 0 ? attachments : undefined,
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

        case 'canvas_list_course_files': {
          const files = await canvasApi.listCourseFiles(args?.courseId as number);

          const formatted = files.map((file) => ({
            id: file.id,
            name: file.display_name,
            filename: file.filename,
            size: file.size,
            sizeHuman: formatBytes(file.size),
            contentType: normalizeContentType(file.content_type ?? file['content-type']),
          }));

          return {
            content: [
              {
                type: 'text',
                text: `${files.length} file(s):\n\n${JSON.stringify(formatted, null, 2)}`,
              },
            ],
          };
        }

        case 'canvas_get_file_info': {
          const file = await canvasApi.getFile(args?.fileId as number);
          const contentType = normalizeContentType(file.content_type ?? file['content-type']);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    id: file.id,
                    name: file.display_name,
                    filename: file.filename,
                    size: file.size,
                    sizeHuman: formatBytes(file.size),
                    contentType,
                    supported: SUPPORTED_DOCUMENT_TYPES.has(contentType),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'canvas_read_file_text': {
          const fileId = args?.fileId as number;
          const downloaded = await canvasApi.downloadFileById(fileId);
          const contentType = normalizeContentType(downloaded.contentType);

          if (downloaded.file.size > CANVAS_MAX_FILE_SIZE_BYTES) {
            throw new Error(
              `File too large (${formatBytes(downloaded.file.size)}). Limit is ${formatBytes(CANVAS_MAX_FILE_SIZE_BYTES)}.`
            );
          }

          if (!SUPPORTED_DOCUMENT_TYPES.has(contentType)) {
            throw new Error(`Unsupported file type: ${contentType}. Supported: PDF, DOCX.`);
          }

          const extracted = await extractDocumentText(downloaded.buffer, contentType);

          return {
            content: [
              {
                type: 'text',
                text:
                  `File: ${downloaded.file.display_name} (${formatBytes(downloaded.file.size)}, ${contentType})\n` +
                  `Source: ${downloaded.finalUrl}\n\n` +
                  extracted.text,
              },
            ],
          };
        }

        case 'canvas_read_submission_attachment_text': {
          const courseId = args?.courseId as number;
          const assignmentId = args?.assignmentId as number;
          const attachmentId = args?.attachmentId as number | undefined;
          const submission = await canvasApi.getSubmissionDetailed(courseId, assignmentId);
          const attachments = submission.attachments ?? [];
          if (attachments.length === 0) {
            throw new Error('No attachments found on your submission for this assignment.');
          }

          const attachment =
            typeof attachmentId === 'number'
              ? attachments.find((item) => item.id === attachmentId)
              : attachments[0];

          if (!attachment) {
            throw new Error(`Attachment ${attachmentId} not found on this submission.`);
          }

          const url = attachment.download_url ?? attachment.url;
          if (!url) {
            throw new Error('Submission attachment has no download URL.');
          }

          const size = attachment.size ?? 0;
          if (size && size > CANVAS_MAX_FILE_SIZE_BYTES) {
            throw new Error(
              `Attachment too large (${formatBytes(size)}). Limit is ${formatBytes(CANVAS_MAX_FILE_SIZE_BYTES)}.`
            );
          }

          const downloaded = await canvasApi.downloadFileByUrl(url, { maxRedirects: CANVAS_MAX_REDIRECTS });
          const contentType = normalizeContentType(
            attachment.content_type ?? attachment['content-type'] ?? downloaded.contentType
          );

          if (!SUPPORTED_DOCUMENT_TYPES.has(contentType)) {
            throw new Error(`Unsupported attachment type: ${contentType}. Supported: PDF, DOCX.`);
          }

          const extracted = await extractDocumentText(downloaded.buffer, contentType);

          return {
            content: [
              {
                type: 'text',
                text:
                  `Submission Attachment: ${attachment.filename} (${size ? formatBytes(size) : 'size unknown'}, ${contentType})\n` +
                  `Source: ${downloaded.finalUrl}\n\n` +
                  extracted.text,
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

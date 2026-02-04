/**
 * Response Header Parsing for Renderer
 *
 * The FlowState agent includes status headers at the start of responses.
 * This module provides utilities to parse and display responses with headers.
 */

export type ResponseStatus =
  | 'complete'
  | 'needs_response'
  | 'in_progress'
  | 'blocked'
  | 'unknown';

/**
 * Header patterns we look for at the start of agent responses.
 */
const HEADER_PATTERNS: Record<string, ResponseStatus> = {
  '[TASK_COMPLETE]': 'complete',
  '[NEEDS_RESPONSE]': 'needs_response',
  '[TASK_IN_PROGRESS]': 'in_progress',
  '[TASK_BLOCKED]': 'blocked',
};

/**
 * Result of parsing a response for status headers.
 */
export interface ParsedResponse {
  /** The detected status from the header, or 'unknown' if no header found */
  status: ResponseStatus;
  /** The header that was found, or null if none */
  header: string | null;
  /** The response content with the header stripped out */
  content: string;
  /** Whether a valid header was found */
  hasHeader: boolean;
}

/**
 * Parse a response to extract the status header and clean content.
 *
 * @param text The raw response text from the agent
 * @returns Parsed response with status and cleaned content
 */
export const parseResponseHeader = (text: string): ParsedResponse => {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    return { status: 'unknown', header: null, content: '', hasHeader: false };
  }

  // Check if the response starts with any of our known headers
  for (const [header, status] of Object.entries(HEADER_PATTERNS)) {
    if (trimmed.startsWith(header)) {
      // Remove the header and any trailing newlines after it
      const content = trimmed.slice(header.length).replace(/^\n+/, '').trim();
      return { status, header, content, hasHeader: true };
    }
  }

  // No header found - return original content with unknown status
  return { status: 'unknown', header: null, content: trimmed, hasHeader: false };
};

/**
 * Get the clean content from a response (header stripped).
 *
 * @param text The raw response text from the agent
 * @returns The content without the status header
 */
export const getCleanContent = (text: string): string => {
  return parseResponseHeader(text).content;
};

/**
 * Check if a response needs user input based on headers.
 *
 * @param text The raw response text from the agent
 * @returns True if the response indicates user input is needed
 */
export const needsUserResponse = (text: string): boolean => {
  const parsed = parseResponseHeader(text);
  return parsed.hasHeader && parsed.status === 'needs_response';
};

/**
 * Check if a response indicates task completion.
 *
 * @param text The raw response text from the agent
 * @returns True if the task is marked complete
 */
export const isComplete = (text: string): boolean => {
  const parsed = parseResponseHeader(text);
  return parsed.hasHeader && parsed.status === 'complete';
};

/**
 * Check if a response indicates the task is blocked.
 *
 * @param text The raw response text from the agent
 * @returns True if the task is blocked
 */
export const isBlocked = (text: string): boolean => {
  const parsed = parseResponseHeader(text);
  return parsed.hasHeader && parsed.status === 'blocked';
};

/**
 * Get a human-readable label for the response status.
 *
 * @param status The response status
 * @returns A display label
 */
export const getStatusLabel = (status: ResponseStatus): string => {
  switch (status) {
    case 'complete': return 'Complete';
    case 'needs_response': return 'Needs Response';
    case 'in_progress': return 'In Progress';
    case 'blocked': return 'Blocked';
    default: return 'Processing';
  }
};

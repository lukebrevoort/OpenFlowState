/**
 * Response Status Headers
 *
 * The FlowState agent is instructed to include a status header at the start of each response.
 * These headers allow reliable parsing of task state without regex guessing.
 */

export type ResponseStatus =
  | 'complete'
  | 'needs_response'
  | 'in_progress'
  | 'blocked'
  | 'unknown';

/**
 * Header patterns we look for at the start of agent responses.
 * Format: [HEADER_NAME] on its own line.
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
  const trimmed = text.trim();
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
 * Legacy fallback patterns for responses without headers.
 * These are less reliable but provide backwards compatibility.
 */
const QUESTION_PATTERN = /\?\s*$/;
const FOLLOWUP_PATTERN = /(could you|can you|please\s+(confirm|provide|share|let me know)|what is|which|when|where|timezone)/i;

/**
 * Fallback heuristic to determine if user input is needed.
 * Used when the agent doesn't include a status header.
 *
 * @param text The response text (without header)
 * @returns True if the response appears to need user input
 */
export const requiresUserInputFallback = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (QUESTION_PATTERN.test(trimmed)) return true;
  return FOLLOWUP_PATTERN.test(trimmed);
};

/**
 * Determine if a response requires user input.
 * Prefers header-based detection, falls back to heuristics.
 *
 * @param text The raw response text from the agent
 * @returns True if user input is needed
 */
export const requiresUserInput = (text: string): boolean => {
  const parsed = parseResponseHeader(text);

  // If we have a header, use it as the source of truth
  if (parsed.hasHeader) {
    return parsed.status === 'needs_response';
  }

  // Fall back to heuristics for responses without headers
  return requiresUserInputFallback(parsed.content);
};

/**
 * Determine if a response indicates the task is complete.
 *
 * @param text The raw response text from the agent
 * @returns True if the task is complete
 */
export const isTaskComplete = (text: string): boolean => {
  const parsed = parseResponseHeader(text);

  // If we have a header, use it as the source of truth
  if (parsed.hasHeader) {
    return parsed.status === 'complete';
  }

  // If no header and doesn't seem to need input, assume complete
  return !requiresUserInputFallback(parsed.content);
};

/**
 * Determine if a response indicates the task is blocked.
 *
 * @param text The raw response text from the agent
 * @returns True if the task is blocked
 */
export const isTaskBlocked = (text: string): boolean => {
  const parsed = parseResponseHeader(text);
  return parsed.hasHeader && parsed.status === 'blocked';
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
 * Clamp text to a maximum length, adding ellipsis if truncated.
 *
 * @param value The text to clamp
 * @param maxLen Maximum length
 * @returns The clamped text
 */
export const clampText = (value: string, maxLen: number): string => {
  // Clean the content first (remove header)
  const clean = getCleanContent(value);
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen)}...`;
};

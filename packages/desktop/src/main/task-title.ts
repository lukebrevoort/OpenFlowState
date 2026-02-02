const clamp = (value: string, max: number): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
};

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ');

const stripLeadingPhrases = (value: string): string => {
  let next = value;

  const patterns: RegExp[] = [
    // confirmations / filler
    /^(?:yes|yeah|yep|no|nope|ok|okay|sure|sounds good|alright|cool)[,!.\s-]+/i,
    // politeness
    /^please[,!.\s-]+/i,
    // common request frames
    /^(?:can|could|would|will)\s+you\s+/i,
    /^(?:i\s+need\s+you\s+to|i\s+want\s+you\s+to|help\s+me\s+to?)\s+/i,
  ];

  for (const pattern of patterns) {
    next = next.replace(pattern, '');
  }

  return next;
};

const pickFirstClause = (value: string): string => {
  // Prefer a short, representative clause.
  const breakers = [' and then ', ' then ', ' afterwards ', ' after that '];
  const lowered = value.toLowerCase();
  for (const breaker of breakers) {
    const idx = lowered.indexOf(breaker);
    if (idx > 0) {
      return value.slice(0, idx);
    }
  }

  // If there's a very long comma-separated list, take the first segment.
  const commaIdx = value.indexOf(',');
  if (commaIdx > 0 && commaIdx < 80) {
    return value.slice(0, commaIdx);
  }

  return value;
};

export const sanitizeTaskTitle = (raw: string): string | null => {
  if (typeof raw !== 'string') return null;
  let title = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/^[-*\d.\)\s]+/, '')
    .replace(/^"|"$/g, '')
    .replace(/^'|'$/g, '')
    .trim();

  title = normalizeWhitespace(title);
  title = title.replace(/[.?!]+$/g, '');
  title = normalizeWhitespace(title);

  if (title.length < 3) return null;
  if (title.length > 80) title = clamp(title, 72);

  return title;
};

/**
 * Heuristic fallback to turn a user prompt into a reasonable task title.
 * Intentionally conservative: produces something short + readable.
 */
export const heuristicTaskTitleFromPrompt = (prompt: string): string => {
  const normalized = normalizeWhitespace(prompt);
  if (!normalized) return 'Task';

  let candidate = stripLeadingPhrases(normalized);
  candidate = candidate.replace(/\?+$/g, '').trim();
  candidate = pickFirstClause(candidate);
  candidate = normalizeWhitespace(candidate);

  // If we stripped too much, fall back to the original.
  const fallback = clamp(normalized, 72);
  const sanitized = sanitizeTaskTitle(candidate) ?? sanitizeTaskTitle(fallback) ?? 'Task';
  return sanitized;
};

export const shouldAttemptLlmTitle = (prompt: string, currentTitle: string): boolean => {
  const p = normalizeWhitespace(prompt);
  const t = normalizeWhitespace(currentTitle);

  if (p.length >= 90) return true;
  if (p.includes('?')) return true;
  if (t.includes('…')) return true;
  if (t.length >= 56) return true;
  if (/^(?:yes|no|ok|okay|sure|please|can|could|would|will)\b/i.test(t)) return true;
  return false;
};

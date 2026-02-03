const QUESTION_PATTERN = /\?\s*$/;
const FOLLOWUP_PATTERN = /(could you|can you|please\s+(confirm|provide|share|let me know)|what is|which|when|where|timezone)/i;

export const requiresUserInput = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (QUESTION_PATTERN.test(trimmed)) return true;
  return FOLLOWUP_PATTERN.test(trimmed);
};

export const clampText = (value: string, maxLen: number): string => {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}...`;
};

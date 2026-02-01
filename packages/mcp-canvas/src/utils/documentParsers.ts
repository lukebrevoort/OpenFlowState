import mammoth from 'mammoth';
import pdf from 'pdf-parse';

import { CANVAS_MAX_TEXT_CHARS, SUPPORTED_DOCUMENT_TYPES } from './constants.js';

type ExtractedDocument = {
  text: string;
  truncated: boolean;
  originalLength: number;
};

const normalizeWhitespace = (input: string) =>
  input
    .replace(/\r\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]{3,}/g, '  ')
    .trim();

export const truncateText = (input: string, maxChars = CANVAS_MAX_TEXT_CHARS): ExtractedDocument => {
  const normalized = normalizeWhitespace(input);
  if (normalized.length <= maxChars) {
    return { text: normalized, truncated: false, originalLength: normalized.length };
  }

  const truncated = normalized.slice(0, maxChars);
  return {
    text: `${truncated}\n\n[Truncated: showing first ${maxChars} characters of ${normalized.length}.]`,
    truncated: true,
    originalLength: normalized.length,
  };
};

export const extractPdfText = async (buffer: Buffer): Promise<string> => {
  const data = await pdf(buffer);
  return data.text ?? '';
};

export const extractDocxText = async (buffer: Buffer): Promise<string> => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? '';
};

export const extractDocumentText = async (
  buffer: Buffer,
  contentType: string
): Promise<ExtractedDocument> => {
  if (!SUPPORTED_DOCUMENT_TYPES.has(contentType)) {
    throw new Error(`Unsupported file type: ${contentType}`);
  }

  const raw =
    contentType === 'application/pdf'
      ? await extractPdfText(buffer)
      : await extractDocxText(buffer);

  return truncateText(raw);
};

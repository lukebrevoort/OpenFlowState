import fs from 'node:fs/promises';
import path from 'node:path';

import pdf from 'pdf-parse';

export type StudyMaterialPdfIssueKind = 'scanned_or_image_like_uncertainty';

export type StudyMaterialPdfIssue = {
  pageNumber: number;
  kind: StudyMaterialPdfIssueKind;
  detail: string;
};

export type StudyMaterialPdfPage = {
  pageNumber: number;
  text: string;
  characterCount: number;
};

export type StudyMaterialPdfParseResult = {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  title: string | null;
  author: string | null;
  pdfVersion: string | null;
  pages: StudyMaterialPdfPage[];
  issues: StudyMaterialPdfIssue[];
  totalCharacterCount: number;
  uncertainPageCount: number;
};

export type ParseStudyMaterialPdfInput = {
  filePath: string;
  minCharactersPerPage?: number;
};

const DEFAULT_MIN_CHARACTERS_PER_PAGE = 60;

const normalizeText = (value: string): string => value.replace(/\r\n/g, '\n').trim();

const splitPageText = (text: string, pageCount: number): string[] => {
  const normalized = normalizeText(text);
  if (pageCount <= 1) {
    return [normalized];
  }

  const formFeedSplit = normalized.split('\f').map((segment) => segment.trim());
  if (formFeedSplit.length === pageCount) {
    return formFeedSplit;
  }

  return [normalized, ...Array.from({ length: pageCount - 1 }, () => '')];
};

export const parseStudyMaterialPdf = async (
  input: ParseStudyMaterialPdfInput
): Promise<StudyMaterialPdfParseResult> => {
  const minCharactersPerPage = Math.max(0, input.minCharactersPerPage ?? DEFAULT_MIN_CHARACTERS_PER_PAGE);
  const filePath = path.resolve(input.filePath);
  const buffer = await fs.readFile(filePath);
  const parsed = await pdf(buffer);

  const pageCount = Math.max(1, parsed.numpages ?? 1);
  const pageTexts = splitPageText(parsed.text ?? '', pageCount);

  const pages = pageTexts.map((text, index) => ({
    pageNumber: index + 1,
    text,
    characterCount: text.replace(/\s+/g, '').length,
  }));

  const issues: StudyMaterialPdfIssue[] = pages
    .filter((page) => page.characterCount < minCharactersPerPage)
    .map((page) => ({
      pageNumber: page.pageNumber,
      kind: 'scanned_or_image_like_uncertainty',
      detail:
        'This page has very little extractable text. It may be scanned or image-based content, and OCR is not enabled.',
    }));

  const stats = await fs.stat(filePath);
  const totalCharacterCount = pages.reduce((sum, page) => sum + page.characterCount, 0);

  return {
    filePath,
    fileName: path.basename(filePath),
    fileSizeBytes: stats.size,
    pageCount,
    title: typeof parsed.info?.Title === 'string' && parsed.info.Title.length > 0 ? parsed.info.Title : null,
    author: typeof parsed.info?.Author === 'string' && parsed.info.Author.length > 0 ? parsed.info.Author : null,
    pdfVersion: typeof parsed.version === 'string' ? parsed.version : null,
    pages,
    issues,
    totalCharacterCount,
    uncertainPageCount: issues.length,
  };
};

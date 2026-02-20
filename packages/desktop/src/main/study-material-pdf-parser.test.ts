import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import pdfParse from 'pdf-parse';

import { parseStudyMaterialPdf } from './study-material-pdf-parser';

vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}));

const pdfParseMock = vi.mocked(pdfParse);

describe('parseStudyMaterialPdf', () => {
  let tmpDir: string;

  afterEach(async () => {
    vi.resetAllMocks();
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns structured page-level text and metadata', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-pdf-'));
    const pdfPath = path.join(tmpDir, 'lecture.pdf');
    await fs.writeFile(pdfPath, Buffer.from('%PDF-1.7 test'));

    pdfParseMock.mockResolvedValueOnce({
      text: 'Page one content\fPage two content',
      numpages: 2,
      version: '1.7',
      info: {
        Title: 'Lecture 5',
        Author: 'FlowState',
      },
    } as never);

    const result = await parseStudyMaterialPdf({ filePath: pdfPath, minCharactersPerPage: 4 });

    expect(result.fileName).toBe('lecture.pdf');
    expect(result.pageCount).toBe(2);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].text).toBe('Page one content');
    expect(result.pages[1].text).toBe('Page two content');
    expect(result.title).toBe('Lecture 5');
    expect(result.author).toBe('FlowState');
    expect(result.issues).toHaveLength(0);
  });

  it('emits uncertainty markers for sparse pages', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-pdf-'));
    const pdfPath = path.join(tmpDir, 'sparse.pdf');
    await fs.writeFile(pdfPath, Buffer.from('%PDF-1.7 test'));

    pdfParseMock.mockResolvedValueOnce({
      text: '\f',
      numpages: 2,
      version: '1.7',
      info: {},
    } as never);

    const result = await parseStudyMaterialPdf({ filePath: pdfPath, minCharactersPerPage: 10 });

    expect(result.issues).toHaveLength(2);
    expect(result.uncertainPageCount).toBe(2);
    expect(result.issues[0].kind).toBe('scanned_or_image_like_uncertainty');
  });
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';

import { parseStudyMaterialPptx } from './study-material-pptx-parser';

const createPptxBuffer = async ({
  slideText,
  notesText,
}: {
  slideText: string;
  notesText?: string;
}): Promise<Buffer> => {
  const zip = new JSZip();

  zip.file(
    'ppt/slides/slide1.xml',
    `<p:sld xmlns:p="x" xmlns:a="x"><a:t>${slideText}</a:t></p:sld>`
  );

  if (notesText) {
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml" />' +
        '</Relationships>'
    );
    zip.file(
      'ppt/notesSlides/notesSlide1.xml',
      `<p:notes xmlns:p="x" xmlns:a="x"><a:t>${notesText}</a:t></p:notes>`
    );
  }

  return zip.generateAsync({ type: 'nodebuffer' });
};

describe('parseStudyMaterialPptx', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('extracts slide text and speaker notes', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-pptx-'));
    const pptxPath = path.join(tmpDir, 'lecture.pptx');

    const buffer = await createPptxBuffer({
      slideText: 'Midterm topics',
      notesText: 'Review chapters 1 through 4',
    });
    await fs.writeFile(pptxPath, buffer);

    const result = await parseStudyMaterialPptx({ filePath: pptxPath, minCharactersPerSlide: 5 });

    expect(result.slideCount).toBe(1);
    expect(result.slides[0].text).toContain('Midterm topics');
    expect(result.slides[0].speakerNotes).toContain('Review chapters 1 through 4');
    expect(result.issues).toHaveLength(0);
  });

  it('flags sparse slide text as uncertainty', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-pptx-'));
    const pptxPath = path.join(tmpDir, 'sparse.pptx');

    const buffer = await createPptxBuffer({ slideText: 'A' });
    await fs.writeFile(pptxPath, buffer);

    const result = await parseStudyMaterialPptx({ filePath: pptxPath, minCharactersPerSlide: 10 });

    expect(result.slideCount).toBe(1);
    expect(result.uncertainSlideCount).toBe(1);
    expect(result.issues[0].kind).toBe('sparse_slide_text_uncertainty');
  });
});

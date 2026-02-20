import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateLocalStudyMaterialSource } from './study-material-source-validation.js';

const sha256 = (content: Buffer): string => createHash('sha256').update(content).digest('hex');

describe('validateLocalStudyMaterialSource', () => {
  let tmpDir = '';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flowstate-source-validation-'));
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('accepts a valid PDF source and returns normalized metadata', async () => {
    const filePath = path.join(tmpDir, 'lecture.pdf');
    const content = Buffer.from('%PDF-1.7\nHello PDF\n', 'ascii');
    await fs.writeFile(filePath, content);

    const result = await validateLocalStudyMaterialSource({ filePath });

    expect(result.ok).toBe(true);
    expect(result.issue).toBeNull();
    expect(result.normalizedPath).toBe(path.resolve(filePath));
    expect(result.fileName).toBe('lecture.pdf');
    expect(result.extension).toBe('.pdf');
    expect(result.fileType).toBe('pdf');
    expect(result.sizeBytes).toBe(content.length);
    expect(result.versionHash).toBe(sha256(content));
    expect(result.detectedMime).toBe('application/pdf');
  });

  it('accepts a valid PPTX-like source when ZIP magic is present', async () => {
    const filePath = path.join(tmpDir, 'slides.pptx');
    const content = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    await fs.writeFile(filePath, content);

    const result = await validateLocalStudyMaterialSource({ filePath });

    expect(result.ok).toBe(true);
    expect(result.issue).toBeNull();
    expect(result.extension).toBe('.pptx');
    expect(result.fileType).toBe('pptx');
    expect(result.sizeBytes).toBe(content.length);
    expect(result.versionHash).toBe(sha256(content));
    expect(result.detectedMime).toBe('application/vnd.openxmlformats-officedocument.presentationml.presentation');
  });

  it('rejects unsupported file extensions', async () => {
    const filePath = path.join(tmpDir, 'notes.txt');

    const result = await validateLocalStudyMaterialSource({ filePath });

    expect(result.ok).toBe(false);
    expect(result.issue?.code).toBe('UNSUPPORTED_EXTENSION');
    expect(result.fileName).toBe('notes.txt');
    expect(result.extension).toBeNull();
  });

  it('rejects non-absolute paths', async () => {
    const result = await validateLocalStudyMaterialSource({ filePath: 'relative/lecture.pdf' });

    expect(result.ok).toBe(false);
    expect(result.issue?.code).toBe('NOT_ABSOLUTE_PATH');
  });

  it('rejects missing files', async () => {
    const filePath = path.join(tmpDir, 'missing.pdf');

    const result = await validateLocalStudyMaterialSource({ filePath });

    expect(result.ok).toBe(false);
    expect(result.issue?.code).toBe('NOT_FOUND');
    expect(result.extension).toBe('.pdf');
    expect(result.fileType).toBe('pdf');
  });

  it('rejects directory paths', async () => {
    const dirPath = path.join(tmpDir, 'folder.pdf');
    await fs.mkdir(dirPath);

    const result = await validateLocalStudyMaterialSource({ filePath: dirPath });

    expect(result.ok).toBe(false);
    expect(result.issue?.code).toBe('NOT_FILE');
  });

  it('rejects signature mismatch between extension and file magic', async () => {
    const filePath = path.join(tmpDir, 'mismatch.pdf');
    const content = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]);
    await fs.writeFile(filePath, content);

    const result = await validateLocalStudyMaterialSource({ filePath });

    expect(result.ok).toBe(false);
    expect(result.issue?.code).toBe('SIGNATURE_MISMATCH');
    expect(result.fileType).toBe('pdf');
    expect(result.sizeBytes).toBe(content.length);
  });

  it('rejects files larger than provided maxBytes override', async () => {
    const filePath = path.join(tmpDir, 'large.pdf');
    const content = Buffer.from('%PDF-123456789', 'ascii');
    await fs.writeFile(filePath, content);

    const result = await validateLocalStudyMaterialSource({ filePath, maxBytes: 6 });

    expect(result.ok).toBe(false);
    expect(result.issue?.code).toBe('FILE_TOO_LARGE');
    expect(result.sizeBytes).toBe(content.length);
  });
});

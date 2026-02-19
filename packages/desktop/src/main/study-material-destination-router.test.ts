import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  routeStudyMaterialDestinationWrite,
  type StudyMaterialWritePayload,
} from './study-material-destination-router';

const buildPayload = (): StudyMaterialWritePayload => ({
  run: {
    id: 'run-1',
    courseId: 'course-1',
    mode: 'conservative' as const,
    destinationType: 'local',
    status: 'completed' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  output: {
    summary: '# Summary',
    practiceExam: '# Practice',
    flashcardsCsv: 'front,back',
    metadata: { runId: 'run-1' },
  },
  destination: {
    type: 'local',
  },
});

describe('routeStudyMaterialDestinationWrite', () => {
  let tmpDir: string;

  afterEach(async () => {
    vi.clearAllMocks();
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('writes local output bundle files', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-router-'));
    const payload = buildPayload();
    payload.destination.localDirectoryPath = tmpDir;

    const result = await routeStudyMaterialDestinationWrite(payload);

    expect(result.destinationType).toBe('local');
    expect(result.files).toHaveLength(4);

    const summary = await fs.readFile(path.join(tmpDir, 'summary.md'), 'utf8');
    const exam = await fs.readFile(path.join(tmpDir, 'practice-exam.md'), 'utf8');
    const cards = await fs.readFile(path.join(tmpDir, 'flashcards.csv'), 'utf8');

    expect(summary).toBe('# Summary');
    expect(exam).toBe('# Practice');
    expect(cards).toBe('front,back');
  });

  it('calls notion adapter for notion destination', async () => {
    const payload = buildPayload();
    payload.destination = {
      type: 'notion',
      notionDatabaseId: 'db',
      notionParentPageId: 'page',
    };

    const writeNotion = vi.fn().mockResolvedValue({ reference: 'notion://page/abc' });

    const result = await routeStudyMaterialDestinationWrite(payload, { writeNotion });

    expect(writeNotion).toHaveBeenCalledTimes(1);
    expect(result.destinationType).toBe('notion');
    expect(result.reference).toBe('notion://page/abc');
  });

  it('rejects project source paths for local writes', async () => {
    const payload = buildPayload();
    payload.destination.localDirectoryPath = path.resolve(process.cwd(), 'packages/desktop');

    await expect(routeStudyMaterialDestinationWrite(payload)).rejects.toThrow(
      /cannot point inside project source paths/i,
    );
  });
});

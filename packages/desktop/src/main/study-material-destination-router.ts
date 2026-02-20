import fs from 'node:fs/promises';
import path from 'node:path';

import type { StudyMaterialRunRecord } from './study-material-store';

export type StudyMaterialWritePayload = {
  run: StudyMaterialRunRecord;
  output: {
    summary: string;
    practiceExam: string;
    flashcardsCsv: string;
    metadata: Record<string, unknown>;
  };
  destination: {
    type: 'local' | 'notion' | 'obsidian';
    localDirectoryPath?: string;
    notionDatabaseId?: string;
    notionParentPageId?: string;
    obsidianVaultPath?: string;
    obsidianRelativeDirectory?: string;
  };
};

export type StudyMaterialDestinationWriteResult = {
  destinationType: StudyMaterialWritePayload['destination']['type'];
  files?: string[];
  reference?: string;
};

export type StudyMaterialDestinationRouterDependencies = {
  writeNotion?: (payload: StudyMaterialWritePayload) => Promise<{ reference: string }>;
  writeObsidian?: (payload: StudyMaterialWritePayload) => Promise<{ reference: string }>;
};

const ensureSafeAbsoluteDirectory = (candidatePath: string): string => {
  if (!path.isAbsolute(candidatePath)) {
    throw new Error('Destination directory must be an absolute path.');
  }

  const resolved = path.resolve(candidatePath);
  if (resolved.includes('/flowstate/packages/')) {
    throw new Error('Destination path cannot point inside project source paths.');
  }

  return resolved;
};

const writeLocalBundle = async (
  payload: StudyMaterialWritePayload,
): Promise<StudyMaterialDestinationWriteResult> => {
  const directory = ensureSafeAbsoluteDirectory(
    payload.destination.localDirectoryPath ??
      path.join(process.env.HOME ?? process.cwd(), 'Downloads', 'FlowState Study Packs'),
  );

  await fs.mkdir(directory, { recursive: true });

  const summaryPath = path.join(directory, 'summary.md');
  const practiceExamPath = path.join(directory, 'practice-exam.md');
  const flashcardsPath = path.join(directory, 'flashcards.csv');
  const metadataPath = path.join(directory, 'run-metadata.json');

  await Promise.all([
    fs.writeFile(summaryPath, payload.output.summary, 'utf8'),
    fs.writeFile(practiceExamPath, payload.output.practiceExam, 'utf8'),
    fs.writeFile(flashcardsPath, payload.output.flashcardsCsv, 'utf8'),
    fs.writeFile(metadataPath, JSON.stringify(payload.output.metadata, null, 2), 'utf8'),
  ]);

  return {
    destinationType: 'local',
    files: [summaryPath, practiceExamPath, flashcardsPath, metadataPath],
  };
};

export const routeStudyMaterialDestinationWrite = async (
  payload: StudyMaterialWritePayload,
  dependencies: StudyMaterialDestinationRouterDependencies = {},
): Promise<StudyMaterialDestinationWriteResult> => {
  if (payload.destination.type === 'local') {
    return writeLocalBundle(payload);
  }

  if (payload.destination.type === 'notion') {
    if (!dependencies.writeNotion) {
      throw new Error('Notion destination is not configured.');
    }

    const result = await dependencies.writeNotion(payload);
    return {
      destinationType: 'notion',
      reference: result.reference,
    };
  }

  if (payload.destination.type === 'obsidian') {
    if (!dependencies.writeObsidian) {
      throw new Error('Obsidian destination is not configured.');
    }

    const result = await dependencies.writeObsidian(payload);
    return {
      destinationType: 'obsidian',
      reference: result.reference,
    };
  }

  throw new Error(`Unsupported destination type: ${String(payload.destination.type)}`);
};

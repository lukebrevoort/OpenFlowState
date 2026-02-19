import fs from 'node:fs/promises';
import path from 'node:path';

import yauzl, { type Entry, type ZipFile } from 'yauzl';

const SLIDE_XML_REGEX = /^ppt\/slides\/slide\d+\.xml$/i;
const NOTES_PATH_REGEX = /^ppt\/notesSlides\/notesSlide\d+\.xml$/i;

export type StudyMaterialPptxIssueKind = 'sparse_slide_text_uncertainty';

export type StudyMaterialPptxIssue = {
  slideNumber: number;
  kind: StudyMaterialPptxIssueKind;
  detail: string;
};

export type StudyMaterialPptxSlide = {
  slideNumber: number;
  text: string;
  speakerNotes: string | null;
  characterCount: number;
};

export type StudyMaterialPptxParseResult = {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  slideCount: number;
  slides: StudyMaterialPptxSlide[];
  issues: StudyMaterialPptxIssue[];
  uncertainSlideCount: number;
};

export type ParseStudyMaterialPptxInput = {
  filePath: string;
  minCharactersPerSlide?: number;
};

type PptxArchive = {
  zipFile: ZipFile;
  entriesByPath: Map<string, Entry>;
  slidePaths: string[];
};

const DEFAULT_MIN_CHARACTERS_PER_SLIDE = 40;
const MAX_ZIP_ENTRIES = 3000;
const MAX_XML_ENTRY_BYTES = 2 * 1024 * 1024;

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_match, decimal) => {
      const parsed = Number.parseInt(decimal, 10);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _match;
    })
    .replace(/&#x([a-fA-F\d]+);/g, (_match, hex) => {
      const parsed = Number.parseInt(hex, 16);
      return Number.isFinite(parsed) ? String.fromCharCode(parsed) : _match;
    });

const extractTextFromOpenXml = (xml: string): string => {
  const textRuns = Array.from(xml.matchAll(/<(?:a:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:a:)?t>/g));
  return textRuns
    .map((run) => decodeXmlEntities(run[1]))
    .map((run) => run.trim())
    .filter(Boolean)
    .join('\n');
};

const getSlideOrder = (slidePath: string): number => {
  const match = slidePath.match(/slide(\d+)\.xml$/i);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
};

const resolveOpenXmlPath = (basePath: string, targetPath: string): string =>
  path.posix.normalize(path.posix.join(path.posix.dirname(basePath), targetPath));

const openZipFromBuffer = async (buffer: Buffer): Promise<ZipFile> =>
  new Promise<ZipFile>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, autoClose: false, validateEntrySizes: true }, (error, zipFile) => {
      if (error || !zipFile) {
        reject(error ?? new Error('Unable to open PPTX archive.'));
        return;
      }
      resolve(zipFile);
    });
  });

const buildPptxArchive = async (buffer: Buffer): Promise<PptxArchive> => {
  const zipFile = await openZipFromBuffer(buffer);

  return new Promise<PptxArchive>((resolve, reject) => {
    const entriesByPath = new Map<string, Entry>();
    const slidePaths: string[] = [];
    let fileEntryCount = 0;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      zipFile.close();
      reject(error);
    };

    zipFile.once('error', (error) => {
      fail(error instanceof Error ? error : new Error(String(error)));
    });

    zipFile.on('entry', (entry) => {
      if (settled) {
        return;
      }

      if (/\/$/.test(entry.fileName)) {
        zipFile.readEntry();
        return;
      }

      fileEntryCount += 1;
      if (fileEntryCount > MAX_ZIP_ENTRIES) {
        fail(new Error(`Unsafe PPTX archive: contains more than ${MAX_ZIP_ENTRIES} entries.`));
        return;
      }

      entriesByPath.set(entry.fileName, entry);
      if (SLIDE_XML_REGEX.test(entry.fileName)) {
        slidePaths.push(entry.fileName);
      }

      zipFile.readEntry();
    });

    zipFile.once('end', () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({
        zipFile,
        entriesByPath,
        slidePaths: slidePaths.sort((a, b) => getSlideOrder(a) - getSlideOrder(b)),
      });
    });

    zipFile.readEntry();
  });
};

const readZipEntryText = async (archive: PptxArchive, entryPath: string): Promise<string> => {
  const entry = archive.entriesByPath.get(entryPath);
  if (!entry) {
    return '';
  }

  if (entry.uncompressedSize > MAX_XML_ENTRY_BYTES) {
    throw new Error(`Unsafe PPTX archive: XML entry ${entryPath} exceeds size limits.`);
  }

  const data = await new Promise<Buffer>((resolve, reject) => {
    archive.zipFile.openReadStream(entry, (error, readStream) => {
      if (error || !readStream) {
        reject(error ?? new Error(`Unable to read PPTX entry: ${entryPath}.`));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      readStream.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_XML_ENTRY_BYTES) {
          readStream.destroy(new Error(`Unsafe PPTX archive: XML entry ${entryPath} exceeds size limits.`));
          return;
        }
        chunks.push(chunk);
      });

      readStream.once('error', (streamError) => {
        reject(streamError instanceof Error ? streamError : new Error(String(streamError)));
      });

      readStream.once('end', () => {
        resolve(Buffer.concat(chunks));
      });
    });
  });

  return data.toString('utf8');
};

const extractNotesPathFromRelationship = (slidePath: string, relXml: string): string | null => {
  const notesTargetMatch = relXml.match(
    /<Relationship\b[^>]*Type="[^"]*\/notesSlide"[^>]*Target="([^"]+)"[^>]*\/?\s*>/i
  );
  if (!notesTargetMatch?.[1]) {
    return null;
  }

  const notesPath = resolveOpenXmlPath(slidePath, notesTargetMatch[1]);
  if (!NOTES_PATH_REGEX.test(notesPath)) {
    throw new Error(`Unsafe PPTX archive: invalid notes relationship target (${notesPath}).`);
  }

  return notesPath;
};

export const parseStudyMaterialPptx = async (
  input: ParseStudyMaterialPptxInput
): Promise<StudyMaterialPptxParseResult> => {
  const minCharactersPerSlide = Math.max(0, input.minCharactersPerSlide ?? DEFAULT_MIN_CHARACTERS_PER_SLIDE);
  const filePath = path.resolve(input.filePath);
  const buffer = await fs.readFile(filePath);
  const stats = await fs.stat(filePath);
  const archive = await buildPptxArchive(buffer);

  try {
    const slides: StudyMaterialPptxSlide[] = [];

    for (const [index, slidePath] of archive.slidePaths.entries()) {
      const slideXml = await readZipEntryText(archive, slidePath);
      const slideText = extractTextFromOpenXml(slideXml);

      const relPath = `ppt/slides/_rels/${path.posix.basename(slidePath)}.rels`;
      const relXml = await readZipEntryText(archive, relPath);

      let speakerNotes: string | null = null;
      if (relXml) {
        const notesPath = extractNotesPathFromRelationship(slidePath, relXml);
        if (notesPath) {
          const notesXml = await readZipEntryText(archive, notesPath);
          const notesText = extractTextFromOpenXml(notesXml);
          speakerNotes = notesText || null;
        }
      }

      const characterCount = slideText.replace(/\s+/g, '').length;
      slides.push({
        slideNumber: index + 1,
        text: slideText,
        speakerNotes,
        characterCount,
      });
    }

    const issues: StudyMaterialPptxIssue[] = slides
      .filter((slide) => slide.characterCount < minCharactersPerSlide)
      .map((slide) => ({
        slideNumber: slide.slideNumber,
        kind: 'sparse_slide_text_uncertainty',
        detail:
          'This slide has sparse extractable text. It may be image-heavy content, and OCR is not enabled in MVP.',
      }));

    return {
      filePath,
      fileName: path.basename(filePath),
      fileSizeBytes: stats.size,
      slideCount: slides.length,
      slides,
      issues,
      uncertainSlideCount: issues.length,
    };
  } finally {
    archive.zipFile.close();
  }
};

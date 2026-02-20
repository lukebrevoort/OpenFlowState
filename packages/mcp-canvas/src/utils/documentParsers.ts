import mammoth from 'mammoth';
import path from 'node:path';
import pdf from 'pdf-parse';
import yauzl, { type Entry, type ZipFile } from 'yauzl';

import {
  CANVAS_MAX_TEXT_CHARS,
  CANVAS_PPTX_MAX_EXTRACTED_XML_BYTES,
  CANVAS_PPTX_MAX_SLIDES,
  CANVAS_PPTX_MAX_XML_ENTRY_BYTES,
  CANVAS_PPTX_MAX_ZIP_ENTRIES,
  SUPPORTED_DOCUMENT_TYPE_LABEL,
  SUPPORTED_DOCUMENT_TYPES,
} from './constants.js';

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

const PPTX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const PPTX_NOTES_PATH_REGEX = /^ppt\/notesSlides\/notesSlide\d+\.xml$/i;

type PptxExtractionBudget = {
  extractedXmlBytes: number;
};

type PptxArchive = {
  zipFile: ZipFile;
  entriesByPath: Map<string, Entry>;
  slidePaths: string[];
};

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

const resolveOpenXmlPath = (basePath: string, targetPath: string): string =>
  path.posix.normalize(path.posix.join(path.posix.dirname(basePath), targetPath));

const getSlideOrder = (slidePath: string): number => {
  const match = slidePath.match(/slide(\d+)\.xml$/i);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
};

const openZipFromBuffer = async (buffer: Buffer): Promise<ZipFile> =>
  new Promise<ZipFile>((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, autoClose: false, validateEntrySizes: true },
      (error, zipFile) => {
        if (error || !zipFile) {
          reject(error ?? new Error('Unable to open PPTX archive.'));
          return;
        }
        resolve(zipFile);
      }
    );
  });

const buildPptxArchive = async (buffer: Buffer): Promise<PptxArchive> => {
  const zipFile = await openZipFromBuffer(buffer);

  return new Promise<PptxArchive>((resolve, reject) => {
    const entriesByPath = new Map<string, Entry>();
    const slidePaths: string[] = [];
    let fileEntryCount = 0;
    let settled = false;

    const cleanupAndReject = (error: Error) => {
      if (settled) return;
      settled = true;
      zipFile.close();
      reject(error);
    };

    const resolveArchive = () => {
      if (settled) return;
      const orderedSlides = slidePaths.sort((a, b) => getSlideOrder(a) - getSlideOrder(b));
      if (orderedSlides.length > CANVAS_PPTX_MAX_SLIDES) {
        cleanupAndReject(
          new Error(
            `Unsafe PPTX archive: contains ${orderedSlides.length} slides (limit ${CANVAS_PPTX_MAX_SLIDES}).`
          )
        );
        return;
      }

      settled = true;
      resolve({ zipFile, entriesByPath, slidePaths: orderedSlides });
    };

    zipFile.once('error', (error) => {
      cleanupAndReject(error instanceof Error ? error : new Error(String(error)));
    });

    zipFile.on('entry', (entry) => {
      if (settled) return;
      if (/\/$/.test(entry.fileName)) {
        zipFile.readEntry();
        return;
      }

      fileEntryCount += 1;
      if (fileEntryCount > CANVAS_PPTX_MAX_ZIP_ENTRIES) {
        cleanupAndReject(
          new Error(
            `Unsafe PPTX archive: contains ${fileEntryCount} zip entries (limit ${CANVAS_PPTX_MAX_ZIP_ENTRIES}).`
          )
        );
        return;
      }

      entriesByPath.set(entry.fileName, entry);
      if (/^ppt\/slides\/slide\d+\.xml$/i.test(entry.fileName)) {
        slidePaths.push(entry.fileName);
      }

      zipFile.readEntry();
    });

    zipFile.once('end', resolveArchive);
    zipFile.readEntry();
  });
};

const readZipEntryBuffer = async (zipFile: ZipFile, entry: Entry, filePath: string): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    zipFile.openReadStream(entry, (openError, readStream) => {
      if (openError || !readStream) {
        reject(openError ?? new Error(`Unable to read PPTX entry: ${filePath}.`));
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let done = false;

      const rejectOnce = (error: Error) => {
        if (done) return;
        done = true;
        readStream.destroy(error);
        reject(error);
      };

      readStream.on('data', (chunk: Buffer) => {
        if (done) return;
        totalBytes += chunk.length;
        if (totalBytes > CANVAS_PPTX_MAX_XML_ENTRY_BYTES) {
          rejectOnce(
            new Error(
              `Unsafe PPTX archive: XML entry ${filePath} is larger than limit ${CANVAS_PPTX_MAX_XML_ENTRY_BYTES}.`
            )
          );
          return;
        }

        chunks.push(chunk);
      });

      readStream.once('error', (streamError) => {
        if (done) return;
        done = true;
        reject(streamError instanceof Error ? streamError : new Error(String(streamError)));
      });

      readStream.once('end', () => {
        if (done) return;
        done = true;
        resolve(Buffer.concat(chunks));
      });
    });
  });

const readXmlEntryWithBounds = async (
  archive: PptxArchive,
  filePath: string,
  budget: PptxExtractionBudget
): Promise<string> => {
  const entry = archive.entriesByPath.get(filePath);
  if (!entry) return '';

  if (entry.uncompressedSize > CANVAS_PPTX_MAX_XML_ENTRY_BYTES) {
    throw new Error(
      `Unsafe PPTX archive: XML entry ${filePath} is ${entry.uncompressedSize} bytes (limit ${CANVAS_PPTX_MAX_XML_ENTRY_BYTES}).`
    );
  }

  const projectedTotal = budget.extractedXmlBytes + entry.uncompressedSize;
  if (projectedTotal > CANVAS_PPTX_MAX_EXTRACTED_XML_BYTES) {
    throw new Error(
      `Unsafe PPTX archive: extracted XML bytes exceed limit (${CANVAS_PPTX_MAX_EXTRACTED_XML_BYTES}).`
    );
  }

  const data = await readZipEntryBuffer(archive.zipFile, entry, filePath);

  budget.extractedXmlBytes += data.length;
  if (budget.extractedXmlBytes > CANVAS_PPTX_MAX_EXTRACTED_XML_BYTES) {
    throw new Error(
      `Unsafe PPTX archive: extracted XML bytes exceed limit (${CANVAS_PPTX_MAX_EXTRACTED_XML_BYTES}).`
    );
  }

  return data.toString('utf8');
};

const isSparsePptxText = (raw: string): boolean => {
  const compactChars = raw.replace(/\s+/g, '').length;
  const nonEmptyLines = raw.split('\n').map((line) => line.trim()).filter(Boolean).length;
  return compactChars < 120 || nonEmptyLines < 4;
};

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

export const extractPptxText = async (buffer: Buffer): Promise<string> => {
  const archive = await buildPptxArchive(buffer);

  try {
    const sections: string[] = [];
    const budget: PptxExtractionBudget = { extractedXmlBytes: 0 };

    for (const [index, slidePath] of archive.slidePaths.entries()) {
      const slideXml = await readXmlEntryWithBounds(archive, slidePath, budget);
      const slideText = slideXml ? extractTextFromOpenXml(slideXml) : '';

      const relPath = `ppt/slides/_rels/${path.posix.basename(slidePath)}.rels`;
      const relXml = await readXmlEntryWithBounds(archive, relPath, budget);

      let notesText = '';
      if (relXml) {
        const notesTargetMatch = relXml.match(
          /<Relationship\b[^>]*Type="[^"]*\/notesSlide"[^>]*Target="([^"]+)"[^>]*\/?\s*>/i
        );
        if (notesTargetMatch?.[1]) {
          const notesPath = resolveOpenXmlPath(slidePath, notesTargetMatch[1]);
          if (!PPTX_NOTES_PATH_REGEX.test(notesPath)) {
            throw new Error(`Unsafe PPTX archive: invalid notes relationship target (${notesPath}).`);
          }

          const notesXml = await readXmlEntryWithBounds(archive, notesPath, budget);
          notesText = notesXml ? extractTextFromOpenXml(notesXml) : '';
        }
      }

      if (slideText) {
        sections.push(`[Slide ${index + 1}]\n${slideText}`);
      }
      if (notesText) {
        sections.push(`[Slide ${index + 1} Speaker Notes]\n${notesText}`);
      }
    }

    return sections.join('\n\n');
  } finally {
    archive.zipFile.close();
  }
};

export const extractDocumentText = async (
  buffer: Buffer,
  contentType: string
): Promise<ExtractedDocument> => {
  if (!SUPPORTED_DOCUMENT_TYPES.has(contentType)) {
    throw new Error(`Unsupported file type: ${contentType}. Supported: ${SUPPORTED_DOCUMENT_TYPE_LABEL}.`);
  }

  const raw =
    contentType === 'application/pdf'
      ? await extractPdfText(buffer)
      : contentType === PPTX_CONTENT_TYPE
        ? await extractPptxText(buffer)
        : await extractDocxText(buffer);

  const extracted = truncateText(raw);

  if (contentType === PPTX_CONTENT_TYPE && isSparsePptxText(raw)) {
    extracted.text =
      `${extracted.text}\n\n` +
      '[Uncertainty: PPTX text extraction may be incomplete. This deck appears to have sparse extractable text (for example, image-only slides). FlowState does not run OCR, so embedded text in images may be missing.]';
  }

  return extracted;
};

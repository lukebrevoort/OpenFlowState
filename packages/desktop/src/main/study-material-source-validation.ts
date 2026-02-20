import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type LocalSourceFileType = 'pdf' | 'pptx';

export type LocalSourceValidationIssueCode =
  | 'INVALID_PATH'
  | 'NOT_ABSOLUTE_PATH'
  | 'NOT_FOUND'
  | 'NOT_FILE'
  | 'UNSUPPORTED_EXTENSION'
  | 'FILE_TOO_LARGE'
  | 'SIGNATURE_MISMATCH'
  | 'READ_FAILED'
  | 'INVALID_SIZE_LIMIT';

export interface LocalSourceValidationIssue {
  code: LocalSourceValidationIssueCode;
  message: string;
}

export interface LocalSourceValidationInput {
  filePath: string;
  maxBytes?: number;
}

export interface LocalSourceValidationResult {
  ok: boolean;
  normalizedPath: string | null;
  fileName: string | null;
  extension: '.pdf' | '.pptx' | null;
  fileType: LocalSourceFileType | null;
  sizeBytes: number | null;
  versionHash: string | null;
  detectedMime: string | null;
  issue: LocalSourceValidationIssue | null;
}

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const MAX_OVERRIDE_BYTES = 500 * 1024 * 1024;

const MIME_BY_FILE_TYPE: Record<LocalSourceFileType, string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const EXTENSION_TO_FILE_TYPE: Record<'.pdf' | '.pptx', LocalSourceFileType> = {
  '.pdf': 'pdf',
  '.pptx': 'pptx',
};

const invalidResult = (
  issue: LocalSourceValidationIssue,
  fields?: Partial<Omit<LocalSourceValidationResult, 'ok' | 'issue'>>,
): LocalSourceValidationResult => ({
  ok: false,
  normalizedPath: fields?.normalizedPath ?? null,
  fileName: fields?.fileName ?? null,
  extension: fields?.extension ?? null,
  fileType: fields?.fileType ?? null,
  sizeBytes: fields?.sizeBytes ?? null,
  versionHash: fields?.versionHash ?? null,
  detectedMime: fields?.detectedMime ?? null,
  issue,
});

const parseSizeLimit = (maxBytes: number | undefined): { ok: true; limit: number } | { ok: false; issue: LocalSourceValidationIssue } => {
  if (maxBytes === undefined) {
    return { ok: true, limit: DEFAULT_MAX_BYTES };
  }

  if (typeof maxBytes !== 'number' || !Number.isFinite(maxBytes)) {
    return {
      ok: false,
      issue: {
        code: 'INVALID_SIZE_LIMIT',
        message: 'maxBytes must be a finite number when provided.',
      },
    };
  }

  const candidate = Math.floor(maxBytes);
  if (candidate < 1) {
    return {
      ok: false,
      issue: {
        code: 'INVALID_SIZE_LIMIT',
        message: 'maxBytes must be at least 1 byte.',
      },
    };
  }

  return { ok: true, limit: Math.min(candidate, MAX_OVERRIDE_BYTES) };
};

const readHeaderBytes = async (filePath: string, length: number): Promise<Buffer> => {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

const hashFileSha256 = async (filePath: string): Promise<string> => {
  const hash = createHash('sha256');

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', (error) => reject(error));
  });

  return hash.digest('hex');
};

export const validateLocalStudyMaterialSource = async (
  input: LocalSourceValidationInput,
): Promise<LocalSourceValidationResult> => {
  const rawPath = typeof input?.filePath === 'string' ? input.filePath.trim() : '';
  if (!rawPath) {
    return invalidResult({
      code: 'INVALID_PATH',
      message: 'filePath must be a non-empty string.',
    });
  }

  if (!path.isAbsolute(rawPath)) {
    return invalidResult({
      code: 'NOT_ABSOLUTE_PATH',
      message: 'filePath must be an absolute path.',
    });
  }

  const normalizedPath = path.normalize(path.resolve(rawPath));
  const fileName = path.basename(normalizedPath);
  const extension = path.extname(fileName).toLowerCase();

  if (extension !== '.pdf' && extension !== '.pptx') {
    return invalidResult(
      {
        code: 'UNSUPPORTED_EXTENSION',
        message: 'Only PDF and PPTX files are supported.',
      },
      {
        normalizedPath,
        fileName,
      },
    );
  }

  const parsedLimit = parseSizeLimit(input?.maxBytes);
  if (!parsedLimit.ok) {
    return invalidResult(parsedLimit.issue, {
      normalizedPath,
      fileName,
      extension,
      fileType: EXTENSION_TO_FILE_TYPE[extension],
    });
  }

  let stats: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stats = await fs.stat(normalizedPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return invalidResult(
        {
          code: 'NOT_FOUND',
          message: 'File does not exist.',
        },
        {
          normalizedPath,
          fileName,
          extension,
          fileType: EXTENSION_TO_FILE_TYPE[extension],
        },
      );
    }

    return invalidResult(
      {
        code: 'READ_FAILED',
        message: 'Unable to access file metadata.',
      },
      {
        normalizedPath,
        fileName,
        extension,
        fileType: EXTENSION_TO_FILE_TYPE[extension],
      },
    );
  }

  if (!stats.isFile()) {
    return invalidResult(
      {
        code: 'NOT_FILE',
        message: 'Path must point to a regular file.',
      },
      {
        normalizedPath,
        fileName,
        extension,
        fileType: EXTENSION_TO_FILE_TYPE[extension],
      },
    );
  }

  if (stats.size > parsedLimit.limit) {
    return invalidResult(
      {
        code: 'FILE_TOO_LARGE',
        message: `File exceeds the size limit of ${parsedLimit.limit} bytes.`,
      },
      {
        normalizedPath,
        fileName,
        extension,
        fileType: EXTENSION_TO_FILE_TYPE[extension],
        sizeBytes: stats.size,
      },
    );
  }

  const fileType = EXTENSION_TO_FILE_TYPE[extension];

  let header: Buffer;
  try {
    header = await readHeaderBytes(normalizedPath, 5);
  } catch {
    return invalidResult(
      {
        code: 'READ_FAILED',
        message: 'Unable to read file signature.',
      },
      {
        normalizedPath,
        fileName,
        extension,
        fileType,
        sizeBytes: stats.size,
      },
    );
  }

  const isPdfMagic = header.length >= 5 && header.subarray(0, 5).toString('ascii') === '%PDF-';
  const isZipMagic = header.length >= 2 && header[0] === 0x50 && header[1] === 0x4b;

  if ((fileType === 'pdf' && !isPdfMagic) || (fileType === 'pptx' && !isZipMagic)) {
    return invalidResult(
      {
        code: 'SIGNATURE_MISMATCH',
        message: 'File signature does not match its extension.',
      },
      {
        normalizedPath,
        fileName,
        extension,
        fileType,
        sizeBytes: stats.size,
      },
    );
  }

  let versionHash: string;
  try {
    versionHash = await hashFileSha256(normalizedPath);
  } catch {
    return invalidResult(
      {
        code: 'READ_FAILED',
        message: 'Unable to hash file contents.',
      },
      {
        normalizedPath,
        fileName,
        extension,
        fileType,
        sizeBytes: stats.size,
      },
    );
  }

  return {
    ok: true,
    normalizedPath,
    fileName,
    extension,
    fileType,
    sizeBytes: stats.size,
    versionHash,
    detectedMime: MIME_BY_FILE_TYPE[fileType],
    issue: null,
  };
};

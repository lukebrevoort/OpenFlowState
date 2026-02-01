export const CANVAS_MAX_FILE_SIZE_BYTES =
  Math.max(
    1,
    Number.parseInt(process.env.CANVAS_MAX_FILE_SIZE_MB ?? '10', 10) || 10
  ) * 1024 * 1024;

export const CANVAS_MAX_TEXT_CHARS = Math.max(
  1000,
  Number.parseInt(process.env.CANVAS_MAX_TEXT_CHARS ?? '150000', 10) || 150000
);

export const CANVAS_MAX_REDIRECTS = Math.max(
  1,
  Number.parseInt(process.env.CANVAS_MAX_REDIRECTS ?? '10', 10) || 10
);

export const SUPPORTED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

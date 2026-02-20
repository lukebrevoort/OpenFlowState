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

export const CANVAS_PPTX_MAX_ZIP_ENTRIES = Math.max(
  10,
  Number.parseInt(process.env.CANVAS_PPTX_MAX_ZIP_ENTRIES ?? '2000', 10) || 2000
);

export const CANVAS_PPTX_MAX_SLIDES = Math.max(
  1,
  Number.parseInt(process.env.CANVAS_PPTX_MAX_SLIDES ?? '500', 10) || 500
);

export const CANVAS_PPTX_MAX_XML_ENTRY_BYTES = Math.max(
  1024,
  Number.parseInt(process.env.CANVAS_PPTX_MAX_XML_ENTRY_BYTES ?? '2097152', 10) || 2097152
);

export const CANVAS_PPTX_MAX_EXTRACTED_XML_BYTES = Math.max(
  1024,
  Number.parseInt(process.env.CANVAS_PPTX_MAX_EXTRACTED_XML_BYTES ?? '20971520', 10) || 20971520
);

export const SUPPORTED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export const SUPPORTED_DOCUMENT_TYPE_LABEL = 'PDF, DOCX, PPTX';

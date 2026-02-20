import type { SourceDocumentRecord } from './study-material-store';

export type InlineCitationInput = {
  sourceDocumentId: string;
  sourceLocator: string;
  confidence?: number;
};

export const buildCitationTag = (
  citation: InlineCitationInput,
  sourceById: Map<string, SourceDocumentRecord>,
): string => {
  const source = sourceById.get(citation.sourceDocumentId);
  const sourceTitle = source?.title ?? citation.sourceDocumentId;
  const confidence =
    typeof citation.confidence === 'number'
      ? `; conf ${Math.round(Math.max(0, Math.min(1, citation.confidence)) * 100)}%`
      : '';
  return `[Source: ${sourceTitle} - ${citation.sourceLocator}${confidence}]`;
};

export const appendInlineCitationsToArtifact = (
  content: string,
  citations: InlineCitationInput[],
  sourceById: Map<string, SourceDocumentRecord>,
): string => {
  if (citations.length === 0) {
    return content;
  }

  const uniqueTags = Array.from(
    new Set(citations.map((citation) => buildCitationTag(citation, sourceById))),
  );

  return `${content.trim()}\n\n${uniqueTags.join(' ')}`;
};

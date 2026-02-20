export type StudyMaterialFallbackClassification =
  | 'auth_expired'
  | 'external_host'
  | 'inaccessible'
  | 'timeout'
  | 'unknown';

export type StudyMaterialFallbackClassificationInput = {
  message?: string;
  status?: number | string;
  code?: string;
  url?: string;
};

export type StudyMaterialFallbackClassificationResult = {
  classification: StudyMaterialFallbackClassification;
  recommendation: string;
  localUploadPrimaryAction: boolean;
};

const AUTH_STATUS_CODES = new Set([401, 403]);
const TIMEOUT_STATUS_CODES = new Set([408, 504]);
const INACCESSIBLE_STATUS_CODES = new Set([404, 410, 451]);

const parseStatusCode = (status: number | string | undefined): number | null => {
  if (typeof status === 'number' && Number.isFinite(status)) {
    return Math.trunc(status);
  }

  if (typeof status === 'string') {
    const trimmed = status.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
};

const normalizeText = (...values: Array<string | undefined>): string => {
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
};

const isAuthExpired = (statusCode: number | null, text: string): boolean => {
  if (statusCode !== null && AUTH_STATUS_CODES.has(statusCode)) {
    return true;
  }

  return /(auth|oauth|token|credential|unauthori[sz]ed|forbidden|login|reauth|session).*(expired|invalid|missing|required)?/.test(
    text,
  );
};

const isTimeout = (statusCode: number | null, text: string): boolean => {
  if (statusCode !== null && TIMEOUT_STATUS_CODES.has(statusCode)) {
    return true;
  }

  return /(time[ -]?out|timed out|deadline exceeded|etimedout|econnaborted|aborterror|request timeout)/.test(text);
};

const isExternalHost = (text: string): boolean => {
  return /(external[ _-]?host|external[ _-]?url|off[ -]?domain|outside canvas|cross[ -]?origin|third[ -]?party host)/.test(
    text,
  );
};

const isInaccessible = (statusCode: number | null, text: string): boolean => {
  if (statusCode !== null && INACCESSIBLE_STATUS_CODES.has(statusCode)) {
    return true;
  }

  return /(not found|unreachable|access denied|cannot access|permission denied|private resource|unavailable|gone)/.test(text);
};

const resultFor = (
  classification: StudyMaterialFallbackClassification,
): StudyMaterialFallbackClassificationResult => {
  switch (classification) {
    case 'auth_expired':
      return {
        classification,
        recommendation: 'Reconnect Canvas and retry ingestion. If this keeps happening, refresh your Canvas token/session first.',
        localUploadPrimaryAction: false,
      };
    case 'external_host':
      return {
        classification,
        recommendation: 'This file is hosted outside Canvas. Upload a local copy to continue immediately.',
        localUploadPrimaryAction: true,
      };
    case 'inaccessible':
      return {
        classification,
        recommendation: 'The source could not be accessed. Check link permissions, then use local upload if access cannot be restored.',
        localUploadPrimaryAction: true,
      };
    case 'timeout':
      return {
        classification,
        recommendation: 'The request timed out. Retry once, then switch to local upload if network issues continue.',
        localUploadPrimaryAction: false,
      };
    case 'unknown':
    default:
      return {
        classification: 'unknown',
        recommendation: 'We could not determine the exact failure reason. Retry, or use local upload to continue now.',
        localUploadPrimaryAction: false,
      };
  }
};

export const classifyStudyMaterialFallback = (
  input: StudyMaterialFallbackClassificationInput = {},
): StudyMaterialFallbackClassificationResult => {
  const statusCode = parseStatusCode(input.status);
  const combinedText = normalizeText(input.message, input.code, input.url);

  if (isAuthExpired(statusCode, combinedText)) {
    return resultFor('auth_expired');
  }

  if (isExternalHost(combinedText)) {
    return resultFor('external_host');
  }

  if (isInaccessible(statusCode, combinedText)) {
    return resultFor('inaccessible');
  }

  if (isTimeout(statusCode, combinedText)) {
    return resultFor('timeout');
  }

  return resultFor('unknown');
};

import fs from 'fs/promises';
import { createRequire } from 'node:module';
import { authManager } from './auth-manager.js';
import { oauthServer } from './oauth-server.js';

export type IntegrationHealthCheckResult = {
  ok: boolean;
  checkedAt: string;
  message?: string;
  email?: string;
};

export type OAuthIntegrationService = 'gmail' | 'gcal' | 'notion' | 'outlook';

export type OAuthBatchHealthCheckResult = Record<OAuthIntegrationService, IntegrationHealthCheckResult>;

const NOTION_VERSION = '2022-06-28';
const OAUTH_SERVICES: readonly OAuthIntegrationService[] = ['gmail', 'gcal', 'notion', 'outlook'];

const done = (result: Omit<IntegrationHealthCheckResult, 'checkedAt'>): IntegrationHealthCheckResult => ({
  ...result,
  checkedAt: new Date().toISOString(),
});

const fail = (message: string): IntegrationHealthCheckResult => done({ ok: false, message });

const normalizeBaseUrl = (rawUrl: string): string => rawUrl.trim().replace(/\/+$/, '');

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'Unexpected error while checking integration.';
};

const summarizeHttpFailure = (serviceLabel: string, status: number): string => {
  if (status === 401 || status === 403) {
    return `${serviceLabel} authorization failed. Please reconnect.`;
  }

  if (status === 404) {
    return `${serviceLabel} endpoint not found. Verify integration settings.`;
  }

  if (status >= 500) {
    return `${serviceLabel} is temporarily unavailable. Try again shortly.`;
  }

  return `${serviceLabel} check failed (HTTP ${status}).`;
};

const safeJson = async (response: Response): Promise<unknown | null> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const extractNotionEmail = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const directEmail = (payload as { person?: { email?: unknown } }).person?.email;
  if (typeof directEmail === 'string' && directEmail.length > 0) {
    return directEmail;
  }

  const ownerEmail = (payload as { bot?: { owner?: { user?: { person?: { email?: unknown } } } } }).bot?.owner?.user
    ?.person?.email;
  if (typeof ownerEmail === 'string' && ownerEmail.length > 0) {
    return ownerEmail;
  }

  return undefined;
};

const extractCanvasEmail = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const profile = payload as { primary_email?: unknown; email?: unknown; login_id?: unknown };
  if (typeof profile.primary_email === 'string' && profile.primary_email.length > 0) {
    return profile.primary_email;
  }
  if (typeof profile.email === 'string' && profile.email.length > 0) {
    return profile.email;
  }
  if (typeof profile.login_id === 'string' && profile.login_id.includes('@')) {
    return profile.login_id;
  }

  return undefined;
};

const extractOutlookEmail = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const profile = payload as { mail?: unknown; userPrincipalName?: unknown };
  if (typeof profile.mail === 'string' && profile.mail.length > 0) {
    return profile.mail;
  }
  if (typeof profile.userPrincipalName === 'string' && profile.userPrincipalName.length > 0) {
    return profile.userPrincipalName;
  }

  return undefined;
};

async function checkGoogle(service: 'gmail' | 'gcal'): Promise<IntegrationHealthCheckResult> {
  const token = await authManager.getToken(service);
  if (!token?.accessToken) {
    return fail('No Google token found. Connect this integration first.');
  }

  let accessToken = token.accessToken;
  let storedEmail = token.email;

  if (authManager.isTokenExpired(token)) {
    if (!token.refreshToken) {
      return fail('Google token expired and cannot be refreshed. Reconnect to continue.');
    }

    const refreshed = await oauthServer.refreshToken(service);
    if (!refreshed?.accessToken) {
      return fail('Google token refresh failed. Reconnect this integration.');
    }

    accessToken = refreshed.accessToken;
    storedEmail = refreshed.email ?? storedEmail;
  }

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return fail(summarizeHttpFailure('Google', response.status));
    }

    const payload = await safeJson(response);
    const emailFromResponse =
      typeof (payload as { email?: unknown } | null)?.email === 'string'
        ? ((payload as { email: string }).email || undefined)
        : undefined;

    return done({ ok: true, email: emailFromResponse ?? storedEmail });
  } catch (error) {
    return fail(`Google health check failed: ${extractErrorMessage(error)}`);
  }
}

async function checkNotion(): Promise<IntegrationHealthCheckResult> {
  const token = await authManager.getToken('notion');
  if (!token?.accessToken) {
    return fail('No Notion token found. Connect this integration first.');
  }

  try {
    const response = await fetch('https://api.notion.com/v1/users/me', {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Notion-Version': NOTION_VERSION,
      },
    });

    if (!response.ok) {
      return fail(summarizeHttpFailure('Notion', response.status));
    }

    const payload = await safeJson(response);
    return done({ ok: true, email: extractNotionEmail(payload) ?? token.email });
  } catch (error) {
    return fail(`Notion health check failed: ${extractErrorMessage(error)}`);
  }
}

async function checkOutlook(): Promise<IntegrationHealthCheckResult> {
  const token = await authManager.getToken('outlook');
  if (!token?.accessToken) {
    return fail('No Outlook token found. Connect this integration first.');
  }

  let accessToken = token.accessToken;
  let storedEmail = token.email;

  if (authManager.isTokenExpired(token)) {
    if (!token.refreshToken) {
      return fail('Outlook token expired and cannot be refreshed. Reconnect to continue.');
    }

    const refreshed = await oauthServer.refreshToken('outlook');
    if (!refreshed?.accessToken) {
      return fail('Outlook token refresh failed. Reconnect this integration.');
    }

    accessToken = refreshed.accessToken;
    storedEmail = refreshed.email ?? storedEmail;
  }

  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return fail(summarizeHttpFailure('Outlook', response.status));
    }

    const payload = await safeJson(response);
    const email = extractOutlookEmail(payload) ?? storedEmail;
    return done({ ok: true, message: 'Outlook is connected.', email });
  } catch (error) {
    return fail(`Outlook health check failed: ${extractErrorMessage(error)}`);
  }
}

async function checkCanvasToken(): Promise<IntegrationHealthCheckResult> {
  const token = await authManager.getToken('canvas');
  const canvasApiUrl = token?.additionalData?.canvasApiUrl;

  if (!token) {
    return fail('No Canvas credentials found. Connect this integration first.');
  }

  if (!canvasApiUrl || canvasApiUrl.trim().length === 0) {
    return fail('Canvas URL is missing. Reconnect Canvas with a valid URL.');
  }

  if (!token.accessToken) {
    return fail('Canvas API token is missing. Reconnect Canvas with token mode.');
  }

  const baseUrl = normalizeBaseUrl(canvasApiUrl);
  const profileUrl = `${baseUrl}/api/v1/users/self/profile`;

  try {
    const response = await fetch(profileUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token.accessToken}`,
      },
    });

    if (!response.ok) {
      return fail(summarizeHttpFailure('Canvas', response.status));
    }

    const payload = await safeJson(response);
    return done({ ok: true, email: extractCanvasEmail(payload) ?? token.email });
  } catch (error) {
    return fail(`Canvas health check failed: ${extractErrorMessage(error)}`);
  }
}

async function checkCanvasBrowser(): Promise<IntegrationHealthCheckResult> {
  const token = await authManager.getToken('canvas');
  const canvasApiUrl = token?.additionalData?.canvasApiUrl;
  const storageStatePath = token?.additionalData?.canvasStorageStatePath;

  if (!token) {
    return fail('No Canvas credentials found. Connect this integration first.');
  }

  if (!canvasApiUrl || canvasApiUrl.trim().length === 0) {
    return fail('Canvas URL is missing. Reconnect Canvas with a valid URL.');
  }

  if (!storageStatePath || storageStatePath.trim().length === 0) {
    return fail('Canvas browser session file path is missing. Reconnect Canvas browser login.');
  }

  try {
    await fs.access(storageStatePath);
  } catch {
    return fail('Canvas browser session file is missing. Run browser login again.');
  }

  try {
    const raw = await fs.readFile(storageStatePath, 'utf8');
    JSON.parse(raw);
  } catch {
    return fail('Canvas browser session file is invalid. Run browser login again.');
  }

  const require = createRequire(import.meta.url);
  let chromium: any;
  try {
    const playwright = require('playwright');
    chromium = playwright?.chromium;
  } catch {
    return fail("Playwright is required for Canvas browser checks but isn't installed.");
  }

  if (!chromium) {
    return fail('Playwright chromium runtime is unavailable for Canvas checks.');
  }

  const baseUrl = normalizeBaseUrl(canvasApiUrl);
  const profileUrl = `${baseUrl}/api/v1/users/self/profile`;
  let browser: any | null = null;
  let context: any | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ storageState: storageStatePath });
    const response = await context.request.get(profileUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok()) {
      return fail(summarizeHttpFailure('Canvas', response.status()));
    }

    const payload = await response.json().catch(() => null);
    return done({ ok: true, email: extractCanvasEmail(payload) ?? token.email });
  } catch (error) {
    return fail(`Canvas browser health check failed: ${extractErrorMessage(error)}`);
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

export async function runIntegrationHealthCheck(service: string): Promise<IntegrationHealthCheckResult> {
  try {
    switch (service) {
      case 'gmail':
      case 'gcal':
        return await checkGoogle(service);
      case 'notion':
        return await checkNotion();
      case 'outlook':
        return await checkOutlook();
      case 'canvas': {
        const token = await authManager.getToken('canvas');
        const mode = token?.additionalData?.canvasAuthMode;
        if (mode === 'browser') {
          return await checkCanvasBrowser();
        }
        return await checkCanvasToken();
      }
      default:
        return fail(`Unsupported integration service: ${service}`);
    }
  } catch (error) {
    return fail(`Health check failed: ${extractErrorMessage(error)}`);
  }
}

export async function runOAuthBatchHealthCheck(): Promise<OAuthBatchHealthCheckResult> {
  const checks = await Promise.all(
    OAUTH_SERVICES.map(async (service) => {
      try {
        return [service, await runIntegrationHealthCheck(service)] as const;
      } catch (error) {
        return [service, fail(`Health check failed: ${extractErrorMessage(error)}`)] as const;
      }
    }),
  );

  return Object.fromEntries(checks) as OAuthBatchHealthCheckResult;
}

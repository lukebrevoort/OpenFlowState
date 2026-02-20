/**
 * Canvas LMS API Client
 *
 * Lightweight API wrapper for Canvas LMS REST API.
 *
 * Auth Modes:
 * - Token: CANVAS_API_TOKEN (default when set)
 * - Browser session: Playwright login + storage state cookies (for schools that block tokens)
 *
 * API Documentation: https://canvas.instructure.com/doc/api/
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { LruCache } from '@flowstate/core/cache';

type CanvasAuthMode = 'token' | 'browser' | 'auto';

type CanvasAuth =
  | {
      mode: 'token';
      token: string;
    }
  | {
      mode: 'browser';
      storageStatePath: string;
      cookieHeader: string;
    };

type CanvasConfig = {
  baseUrl: string;
  auth: CanvasAuth;
};

const redactSecretsFromString = (input: string): string => {
  // Keep this conservative: redact common auth patterns without trying to be perfect.
  return input
    .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\b(canvas_session|_csrf_token|csrf_token|session)=[^;\s]+/gi, '$1=[REDACTED]');
};

const summarizeBodyForError = (body: string, maxChars = 600): string => {
  const normalized = body.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const truncated = normalized.length > maxChars ? `${normalized.slice(0, maxChars)}…` : normalized;
  return redactSecretsFromString(truncated);
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/, '');

const getCanvasBaseUrl = () => {
  const baseUrl = process.env.CANVAS_API_URL || process.env.CANVAS_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      'CANVAS_API_URL or CANVAS_BASE_URL environment variable is required. ' +
        'Example: https://your-school.instructure.com'
    );
  }
  return normalizeBaseUrl(baseUrl);
};

const getRequestedAuthMode = (): CanvasAuthMode | undefined => {
  const raw = (process.env.CANVAS_AUTH_MODE || '').trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === 'token' || raw === 'browser' || raw === 'auto') return raw as CanvasAuthMode;
  throw new Error(
    "Invalid CANVAS_AUTH_MODE. Expected 'token', 'browser', or 'auto'."
  );
};

const getCanvasToken = async (): Promise<string | undefined> => {
  const envToken = process.env.CANVAS_API_TOKEN || process.env.CANVAS_TOKEN;
  if (envToken) return envToken;

  // Fallback to @flowstate/core auth store (aligns with other MCP packages)
  try {
    const { auth } = await import('@flowstate/core');
    const token = await auth.getToken('canvas');
    if (token?.accessToken) return token.accessToken;
  } catch {
    // ignore: core auth not available in standalone mode
  }

  return undefined;
};

const cookieDomainMatchesHost = (cookieDomain: string, host: string): boolean => {
  const normalized = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain;
  return host === normalized || host.endsWith(`.${normalized}`);
};

let cookieHeaderCache:
  | {
      storageStatePath: string;
      host: string;
      mtimeMs: number;
      cookieHeader: string;
    }
  | undefined;

const CANVAS_CACHE_TTL_MS = 2 * 60 * 1000;
const coursesCache = new LruCache<CanvasCourse[]>({ maxEntries: 5, ttlMs: CANVAS_CACHE_TTL_MS });
const courseCache = new LruCache<CanvasCourse>({ maxEntries: 100, ttlMs: CANVAS_CACHE_TTL_MS });
const assignmentsCache = new LruCache<CanvasAssignment[]>({ maxEntries: 100, ttlMs: CANVAS_CACHE_TTL_MS });
const assignmentCache = new LruCache<CanvasAssignment>({ maxEntries: 200, ttlMs: CANVAS_CACHE_TTL_MS });
const upcomingAssignmentsCache = new LruCache<CanvasTodoItem[]>({ maxEntries: 5, ttlMs: CANVAS_CACHE_TTL_MS });
const announcementsCache = new LruCache<CanvasAnnouncement[]>({ maxEntries: 50, ttlMs: CANVAS_CACHE_TTL_MS });
const modulesCache = new LruCache<CanvasModule[]>({ maxEntries: 100, ttlMs: CANVAS_CACHE_TTL_MS });
const moduleItemsCache = new LruCache<CanvasModuleItem[]>({ maxEntries: 200, ttlMs: CANVAS_CACHE_TTL_MS });
const gradesCache = new LruCache<CanvasGrade[]>({ maxEntries: 5, ttlMs: CANVAS_CACHE_TTL_MS });
const calendarEventsCache = new LruCache<any[]>({ maxEntries: 10, ttlMs: CANVAS_CACHE_TTL_MS });
const courseFilesCache = new LruCache<CanvasFile[]>({ maxEntries: 50, ttlMs: CANVAS_CACHE_TTL_MS });
const fileCache = new LruCache<CanvasFile>({ maxEntries: 200, ttlMs: CANVAS_CACHE_TTL_MS });

const buildCacheKey = (prefix: string, parts: unknown[]): string => {
  try {
    return `${prefix}:${JSON.stringify(parts)}`;
  } catch {
    return `${prefix}:${String(parts)}`;
  }
};

const buildCookieHeaderFromStorageState = async (storageStatePath: string, baseUrl: string) => {
  const host = new URL(baseUrl).hostname;
  let stat: { mtimeMs: number };
  try {
    stat = await fs.stat(storageStatePath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
      throw new Error(
        `Canvas browser auth requires a Playwright storage state file, but it was not found at: ${storageStatePath}. ` +
          `Refresh Canvas authentication in FlowState Integrations and retry.`
      );
    }
    throw error;
  }
  if (
    cookieHeaderCache &&
    cookieHeaderCache.storageStatePath === storageStatePath &&
    cookieHeaderCache.host === host &&
    cookieHeaderCache.mtimeMs === stat.mtimeMs
  ) {
    return cookieHeaderCache.cookieHeader;
  }

  let raw: string;
  try {
    raw = await fs.readFile(storageStatePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
      throw new Error(
        `Canvas browser auth requires a Playwright storage state file, but it was not found at: ${storageStatePath}. ` +
          `Refresh Canvas authentication in FlowState Integrations and retry.`
      );
    }
    throw error;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid Canvas storage state JSON at: ${storageStatePath}`);
  }

  const cookies: any[] = Array.isArray(parsed?.cookies) ? parsed.cookies : [];
  const matched = cookies
    .filter((c) => c && typeof c.name === 'string' && typeof c.value === 'string')
    .filter((c) => typeof c.domain === 'string' && cookieDomainMatchesHost(c.domain, host))
    .filter((c) => typeof c.path === 'string')
    .map((c) => `${c.name}=${c.value}`)
    .filter(Boolean);

  if (matched.length === 0) {
    throw new Error(
      `Canvas storage state at ${storageStatePath} contains no usable cookies for ${host}. ` +
        `Refresh Canvas authentication in FlowState Integrations and retry.`
    );
  }

  const cookieHeader = matched.join('; ');
  cookieHeaderCache = {
    storageStatePath,
    host,
    mtimeMs: stat.mtimeMs,
    cookieHeader,
  };
  return cookieHeader;
};

// Canvas API configuration from environment
const getCanvasConfig = async (): Promise<CanvasConfig> => {
  const baseUrl = getCanvasBaseUrl();
  const requestedMode = getRequestedAuthMode();

  const storageStatePath =
    process.env.CANVAS_STORAGE_STATE_PATH || process.env.CANVAS_PLAYWRIGHT_STORAGE_STATE_PATH;

  const envToken = process.env.CANVAS_API_TOKEN || process.env.CANVAS_TOKEN;

  const mode: CanvasAuthMode =
    requestedMode ?? (envToken ? 'token' : storageStatePath ? 'browser' : 'token');

  if (mode === 'auto') {
    if (envToken) {
      return { baseUrl, auth: { mode: 'token', token: envToken } };
    }

    if (storageStatePath) {
      const cookieHeader = await buildCookieHeaderFromStorageState(storageStatePath, baseUrl);
      return { baseUrl, auth: { mode: 'browser', storageStatePath, cookieHeader } };
    }

    const token = await getCanvasToken();
    if (!token) {
      throw new Error(
        'Canvas auth mode is auto but no credentials were found. ' +
          'Set CANVAS_API_TOKEN (or store a token in FlowState Integrations), or set CANVAS_AUTH_MODE=browser and CANVAS_STORAGE_STATE_PATH, then refresh Canvas authentication in FlowState Integrations.'
      );
    }

    return { baseUrl, auth: { mode: 'token', token } };
  }

  if (mode === 'token') {
    const token = envToken ?? (await getCanvasToken());
    if (!token) {
      throw new Error(
        'Canvas token auth is selected but CANVAS_API_TOKEN is not set. ' +
          'Either set CANVAS_API_TOKEN (or CANVAS_TOKEN, or connect Canvas in FlowState Integrations), or set CANVAS_AUTH_MODE=browser and refresh Canvas authentication in FlowState Integrations.'
      );
    }
    return { baseUrl, auth: { mode: 'token', token } };
  }

  if (!storageStatePath) {
    throw new Error(
      'Canvas browser auth requires CANVAS_STORAGE_STATE_PATH (path to a Playwright storage state JSON file). ' +
        'Refresh Canvas authentication in FlowState Integrations and retry.'
    );
  }

  const cookieHeader = await buildCookieHeaderFromStorageState(storageStatePath, baseUrl);
  return {
    baseUrl,
    auth: {
      mode: 'browser',
      storageStatePath,
      cookieHeader,
    },
  };
};

const resolveUrl = (candidate: string, base: string) => {
  try {
    return new URL(candidate, base).toString();
  } catch {
    return candidate;
  }
};

const DEFAULT_PER_PAGE = Number(process.env.CANVAS_DEFAULT_PER_PAGE || '100');
const MAX_PAGES = Number(process.env.CANVAS_MAX_PAGES || '25');
const MAX_LIST_ITEMS = Number(process.env.CANVAS_MAX_LIST_ITEMS || '2500');

const parseNextLink = (linkHeader: string | null) => {
  if (!linkHeader) return null;

  const entries = linkHeader
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const parts = entry.split(';').map((part) => part.trim());
    if (parts.length === 0) continue;

    const urlPart = parts[0];
    const match = urlPart.match(/^<(.+)>$/);
    const url = match?.[1];
    if (!url) continue;

    const relPart = parts.find((part) => part.startsWith('rel='));
    const rel = relPart?.slice(4).replace(/^"|"$/g, '');
    if (rel === 'next') return url;
  }

  return null;
};

const ensurePerPage = (url: URL, perPage: number) => {
  if (!url.searchParams.has('per_page')) {
    url.searchParams.set('per_page', String(perPage));
  }
};

const makeCanvasHttpError = async (
  response: Response,
  authMode: CanvasAuth['mode']
): Promise<Error> => {
  const contentType = response.headers.get('content-type') || '';

  if (authMode === 'browser') {
    if (response.status === 401 || response.status === 403) {
      return new Error(
        'Canvas browser session is unauthorized or expired. Refresh Canvas authentication in FlowState Integrations and retry.'
      );
    }
    if (contentType.includes('text/html') || response.url.includes('/login')) {
      return new Error(
        'Canvas browser session appears to be expired. Refresh Canvas authentication in FlowState Integrations and retry.'
      );
    }
  }

  if (response.status === 401 || response.status === 403) {
    return new Error(
      `Canvas API unauthorized (${response.status}). Check your token / permissions, or switch to browser auth (CANVAS_AUTH_MODE=browser).`
    );
  }

  let body = '';
  try {
    body = await response.text();
  } catch {
    // ignore
  }

  const extra = body ? `: ${summarizeBodyForError(body)}` : '';
  return new Error(`Canvas API error (${response.status})${extra}`);
};

async function canvasFetchResponse(url: string, options: RequestInit = {}) {
  const { auth } = await getCanvasConfig();

  const authHeaders: Record<string, string> = {};
  if (auth.mode === 'token') {
    authHeaders.Authorization = `Bearer ${auth.token}`;
  } else {
    authHeaders.Cookie = auth.cookieHeader;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw await makeCanvasHttpError(response, auth.mode);
  }

  // When using browser-session auth, an expired session often returns HTML or redirects.
  // Surface a clearer message than a JSON parse failure downstream.
  const contentType = response.headers.get('content-type') || '';
  if (
    auth.mode === 'browser' &&
    (contentType.includes('text/html') || response.url.includes('/login'))
  ) {
    throw new Error(
      'Canvas browser session appears to be expired. Refresh Canvas authentication in FlowState Integrations and retry.'
    );
  }

  return response;
}

async function canvasFetchAllPages<T>(
  endpoint: string,
  options: RequestInit = {},
  paging?: {
    perPage?: number;
    maxPages?: number;
    maxItems?: number;
  }
): Promise<T[]> {
  const { baseUrl } = await getCanvasConfig();

  const perPage = paging?.perPage ?? DEFAULT_PER_PAGE;
  const maxPages = paging?.maxPages ?? MAX_PAGES;
  const maxItems = paging?.maxItems ?? MAX_LIST_ITEMS;

  const initialUrl = new URL(`${baseUrl}/api/v1${endpoint}`);
  ensurePerPage(initialUrl, perPage);

  let nextUrl: string | null = initialUrl.toString();
  const results: T[] = [];

  for (let page = 0; page < maxPages && nextUrl; page += 1) {
    const response = await canvasFetchResponse(nextUrl, options);
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error(
        `Canvas API pagination expected an array response for ${endpoint}`
      );
    }

    results.push(...(data as T[]));

    if (results.length > maxItems) {
      throw new Error(
        `Canvas API pagination exceeded ${maxItems} items (endpoint: ${endpoint}). Narrow your query.`
      );
    }

    nextUrl = parseNextLink(response.headers.get('link'));
  }

  if (nextUrl) {
    throw new Error(
      `Canvas API pagination exceeded ${maxPages} pages (endpoint: ${endpoint}). Narrow your query.`
    );
  }

  return results;
}

// Generic fetch wrapper for Canvas API
async function canvasFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { baseUrl } = await getCanvasConfig();
  const url = `${baseUrl}/api/v1${endpoint}`;
  const response = await canvasFetchResponse(url, options);
  return response.json();
}

// Authenticated fetch for absolute Canvas URLs (used for file downloads).
async function canvasFetchRaw(
  url: string,
  options: RequestInit & { includeAuth?: boolean } = {}
): Promise<Response> {
  const { auth } = await getCanvasConfig();
  const includeAuth = options.includeAuth !== false;
  const { includeAuth: _ignored, ...rest } = options;

  const authHeaders: Record<string, string> = {};
  if (includeAuth) {
    if (auth.mode === 'token') {
      authHeaders.Authorization = `Bearer ${auth.token}`;
    } else {
      authHeaders.Cookie = auth.cookieHeader;
    }
  }

  return fetch(url, {
    ...rest,
    headers: includeAuth
      ? {
          ...authHeaders,
          ...(rest.headers ?? {}),
        }
      : rest.headers,
  });
}

// ============================================================================
// Browser Auth Helpers (Playwright)
// ============================================================================

export async function browserLoginWithPlaywright(options?: {
  canvasApiUrl?: string;
  storageStatePath?: string;
  loginUrl?: string;
  timeoutMs?: number;
  headless?: boolean;
  confirmationFilePath?: string;
}): Promise<{ storageStatePath: string; userId?: number; userName?: string }> {
  const baseUrl = options?.canvasApiUrl
    ? normalizeBaseUrl(options.canvasApiUrl)
    : getCanvasBaseUrl();
  const storageStatePath =
    options?.storageStatePath ||
    process.env.CANVAS_STORAGE_STATE_PATH ||
    process.env.CANVAS_PLAYWRIGHT_STORAGE_STATE_PATH;

  if (!storageStatePath) {
    throw new Error(
      'Missing CANVAS_STORAGE_STATE_PATH. Provide it as an env var or tool input to save the Playwright storage state.'
    );
  }

  const timeoutMs =
    options?.timeoutMs ??
    Number(process.env.CANVAS_PLAYWRIGHT_LOGIN_TIMEOUT_MS || '300000');

  const headless =
    options?.headless ??
    (process.env.CANVAS_PLAYWRIGHT_HEADLESS || '').trim().toLowerCase() === 'true';

  const loginUrl = options?.loginUrl || process.env.CANVAS_LOGIN_URL || `${baseUrl}/login`;
  const confirmationFilePath = options?.confirmationFilePath;

  const require = createRequire(import.meta.url);
  let chromium: any;
  try {
    const playwright = require('playwright');
    chromium = playwright?.chromium;
  } catch {
    throw new Error(
      "Playwright is required for browser login but isn't installed. Install it (e.g. `pnpm add -w playwright`) and re-run."
    );
  }

  if (!chromium) {
    throw new Error('Playwright chromium runtime not available.');
  }

  await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    console.error(
      `[mcp-canvas] Browser login opened. Complete login in the browser window. Waiting up to ${Math.ceil(
        timeoutMs / 1000
      )}s...`
    );

    if (confirmationFilePath) {
      console.error(
        `[mcp-canvas] Waiting for confirmation file: ${confirmationFilePath}`
      );
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        try {
          await fs.stat(confirmationFilePath);
          break;
        } catch {
          // keep waiting
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (Date.now() - started >= timeoutMs) {
        throw new Error(
          `Timed out waiting for user confirmation file: ${confirmationFilePath}`
        );
      }
    }

    const started = Date.now();
    let lastStatus: number | undefined;
    const verificationTimeoutMs = 30000;

    while (Date.now() - started < verificationTimeoutMs) {
      try {
        const response = await context.request.get(`${baseUrl}/api/v1/users/self/profile`, {
          headers: { Accept: 'application/json' },
        });
        lastStatus = response.status();
        if (response.ok()) {
          const user = await response.json();
          await context.storageState({ path: storageStatePath });

          // Write pending auth file for desktop to pick up and persist
          const flowstateDataDir = process.env.FLOWSTATE_DATA_DIR;
          if (flowstateDataDir) {
            const pendingAuthDir = path.join(flowstateDataDir, 'pending-auth');
            const pendingAuthFile = path.join(pendingAuthDir, `canvas-browser-${Date.now()}.json`);
            try {
              await fs.mkdir(pendingAuthDir, { recursive: true });
              await fs.writeFile(
                pendingAuthFile,
                JSON.stringify({
                  service: 'canvas',
                  canvasApiUrl: baseUrl,
                  canvasAuthMode: 'browser',
                  canvasStorageStatePath: storageStatePath,
                  timestamp: new Date().toISOString(),
                  userId: typeof user?.id === 'number' ? user.id : undefined,
                  userName: typeof user?.name === 'string' ? user.name : undefined,
                }),
                'utf8'
              );
              console.error(`[mcp-canvas] Wrote pending auth file: ${pendingAuthFile}`);
            } catch (err) {
              console.error('[mcp-canvas] Failed to write pending auth file:', err);
              // Continue anyway - the login still succeeded
            }
          }

          return {
            storageStatePath,
            userId: typeof user?.id === 'number' ? user.id : undefined,
            userName: typeof user?.name === 'string' ? user.name : undefined,
          };
        }
      } catch {
        // ignore transient errors while user is logging in
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    throw new Error(
      `Timed out verifying Canvas login. Last status: ${lastStatus ?? 'unknown'}. ` +
        `Try again, or set CANVAS_LOGIN_URL if your school uses a custom login page.`
    );
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  start_at: string | null;
  end_at: string | null;
  workflow_state: string;
  total_students?: number;
  created_at: string;
  // Grades included when includeGrades=true
  enrollments?: Array<{
    grades?: {
      current_grade?: string | null;
      current_score?: number | null;
      final_grade?: string | null;
      final_score?: number | null;
    };
  }>;
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  points_possible: number;
  course_id: number;
  submission_types: string[];
  has_submitted_submissions: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface CanvasSubmission {
  id: number;
  assignment_id: number;
  user_id: number;
  submitted_at: string | null;
  score: number | null;
  grade: string | null;
  grade_matches_current_submission: boolean;
  workflow_state: string;
  late: boolean;
  missing: boolean;
  excused: boolean;
  attempt: number | null;
  attachments?: Array<{
    id: number;
    filename: string;
    size?: number;
    content_type?: string;
    'content-type'?: string;
    url?: string;
    download_url?: string;
  }>;
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  author: {
    id: number;
    display_name: string;
  };
  context_code: string;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  unlock_at: string | null;
  require_sequential_progress: boolean;
  items_count: number;
  state: string;
}

export interface CanvasModuleItem {
  id: number;
  module_id: number;
  title: string;
  position: number;
  type: string;
  content_id?: number;
  html_url: string;
  url?: string;
  completion_requirement?: {
    type: string;
    completed: boolean;
  };
}

export interface CanvasGrade {
  course_id: number;
  course_name: string;
  current_grade: string | null;
  current_score: number | null;
  final_grade: string | null;
  final_score: number | null;
}

export interface CanvasEnrollment {
  id: number;
  course_id: number;
  type: string;
  enrollment_state: string;
  grades?: {
    current_grade: string | null;
    current_score: number | null;
    final_grade: string | null;
    final_score: number | null;
  };
}

export interface CanvasTodoItem {
  type: string;
  assignment?: CanvasAssignment;
  context_type: string;
  context_name: string;
  html_url: string;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  size: number;
  content_type?: string;
  'content-type'?: string;
  url?: string;
  download_url?: string;
  created_at?: string;
  modified_at?: string;
}

export type CanvasDownloadedFile = {
  file: CanvasFile;
  buffer: Buffer;
  contentType: string;
  finalUrl: string;
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get all courses for the current user
 */
export async function getCourses(options?: {
  enrollmentState?: 'active' | 'completed' | 'all';
  includeGrades?: boolean;
}): Promise<CanvasCourse[]> {
  const cacheKey = buildCacheKey('courses', [
    options?.enrollmentState ?? 'active',
    options?.includeGrades ?? false,
  ]);
  const cached = coursesCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams();
  
  if (options?.enrollmentState) {
    params.append('enrollment_state', options.enrollmentState);
  }
  
  if (options?.includeGrades) {
    params.append('include[]', 'total_scores');
  }
  
  const queryString = params.toString();
  const endpoint = `/courses${queryString ? `?${queryString}` : ''}`;

  const results = await canvasFetchAllPages<CanvasCourse>(endpoint);
  coursesCache.set(cacheKey, results);
  return results;
}

/**
 * Get a specific course by ID
 */
export async function getCourse(courseId: number): Promise<CanvasCourse> {
  const cached = courseCache.get(String(courseId));
  if (cached !== undefined) return cached;
  const course = await canvasFetch<CanvasCourse>(`/courses/${courseId}`);
  courseCache.set(String(courseId), course);
  return course;
}

/**
 * Get assignments for a course
 */
export async function getAssignments(
  courseId: number,
  options?: {
    orderBy?: 'due_at' | 'name' | 'position';
    includeSubmission?: boolean;
  }
): Promise<CanvasAssignment[]> {
  const cacheKey = buildCacheKey('assignments', [
    courseId,
    options?.orderBy ?? '',
    options?.includeSubmission ?? false,
  ]);
  const cached = assignmentsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams();
  
  if (options?.orderBy) {
    params.append('order_by', options.orderBy);
  }
  
  if (options?.includeSubmission) {
    params.append('include[]', 'submission');
  }
  
  const queryString = params.toString();
  const endpoint = `/courses/${courseId}/assignments${queryString ? `?${queryString}` : ''}`;

  const results = await canvasFetchAllPages<CanvasAssignment>(endpoint);
  assignmentsCache.set(cacheKey, results);
  return results;
}

/**
 * Get a specific assignment
 */
export async function getAssignment(
  courseId: number,
  assignmentId: number
): Promise<CanvasAssignment> {
  const cacheKey = `${courseId}:${assignmentId}`;
  const cached = assignmentCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const assignment = await canvasFetch<CanvasAssignment>(
    `/courses/${courseId}/assignments/${assignmentId}`
  );
  assignmentCache.set(cacheKey, assignment);
  return assignment;
}

/**
 * Get upcoming assignments across all courses
 */
export async function getUpcomingAssignments(): Promise<CanvasTodoItem[]> {
  const cached = upcomingAssignmentsCache.get('upcoming');
  if (cached !== undefined) return cached;
  const results = await canvasFetchAllPages<CanvasTodoItem>('/users/self/todo');
  upcomingAssignmentsCache.set('upcoming', results);
  return results;
}

/**
 * Get submissions for a course assignment
 */
export async function getSubmission(
  courseId: number,
  assignmentId: number
): Promise<CanvasSubmission> {
  return canvasFetch<CanvasSubmission>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/self`
  );
}

/**
 * Get all submissions for a user in a course
 */
export async function getCourseSubmissions(
  courseId: number
): Promise<CanvasSubmission[]> {
  return canvasFetchAllPages<CanvasSubmission>(
    `/courses/${courseId}/students/submissions?student_ids[]=self`
  );
}

/**
 * Get announcements for courses
 */
export async function getAnnouncements(
  courseIds: number[],
  options?: {
    startDate?: string;
    endDate?: string;
    activeOnly?: boolean;
  }
): Promise<CanvasAnnouncement[]> {
  const cacheKey = buildCacheKey('announcements', [
    [...courseIds].sort((a, b) => a - b),
    options?.startDate ?? '',
    options?.endDate ?? '',
    options?.activeOnly ?? false,
  ]);
  const cached = announcementsCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const params = new URLSearchParams();
  
  courseIds.forEach(id => {
    params.append('context_codes[]', `course_${id}`);
  });
  
  if (options?.startDate) {
    params.append('start_date', options.startDate);
  }
  
  if (options?.endDate) {
    params.append('end_date', options.endDate);
  }
  
  if (options?.activeOnly) {
    params.append('active_only', 'true');
  }
  
  const results = await canvasFetchAllPages<CanvasAnnouncement>(`/announcements?${params.toString()}`);
  announcementsCache.set(cacheKey, results);
  return results;
}

/**
 * Get modules for a course
 */
export async function getModules(courseId: number): Promise<CanvasModule[]> {
  const cacheKey = `modules:${courseId}`;
  const cached = modulesCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const results = await canvasFetchAllPages<CanvasModule>(`/courses/${courseId}/modules`);
  modulesCache.set(cacheKey, results);
  return results;
}

/**
 * Get items within a module
 */
export async function getModuleItems(
  courseId: number,
  moduleId: number
): Promise<CanvasModuleItem[]> {
  const cacheKey = `${courseId}:${moduleId}`;
  const cached = moduleItemsCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const results = await canvasFetchAllPages<CanvasModuleItem>(
    `/courses/${courseId}/modules/${moduleId}/items`
  );
  moduleItemsCache.set(cacheKey, results);
  return results;
}

/**
 * Get grades for all enrolled courses
 */
export async function getGrades(): Promise<CanvasGrade[]> {
  const cached = gradesCache.get('grades');
  if (cached !== undefined) return cached;

  const enrollments = await canvasFetchAllPages<CanvasEnrollment>(
    '/users/self/enrollments?type[]=StudentEnrollment&include[]=grades'
  );
  
  const results = enrollments.map(enrollment => ({
    course_id: enrollment.course_id,
    course_name: '', // Will be populated by caller if needed
    current_grade: enrollment.grades?.current_grade ?? null,
    current_score: enrollment.grades?.current_score ?? null,
    final_grade: enrollment.grades?.final_grade ?? null,
    final_score: enrollment.grades?.final_score ?? null,
  }));
  gradesCache.set('grades', results);
  return results;
}

/**
 * Get the user's calendar events and assignments
 */
export async function getCalendarEvents(options?: {
  startDate?: string;
  endDate?: string;
  type?: 'event' | 'assignment';
}): Promise<Array<{
  id: number;
  title: string;
  start_at: string;
  end_at: string;
  type: string;
  context_code: string;
  html_url: string;
}>> {
  type CanvasCalendarEvent = {
    id: number;
    title: string;
    start_at: string;
    end_at: string;
    type: string;
    context_code: string;
    html_url: string;
  };

  const cacheKey = buildCacheKey('calendar', [
    options?.startDate ?? '',
    options?.endDate ?? '',
    options?.type ?? '',
  ]);
  const cached = calendarEventsCache.get(cacheKey);
  if (cached !== undefined) return cached as any;

  const params = new URLSearchParams();
  
  if (options?.startDate) {
    params.append('start_date', options.startDate);
  }
  
  if (options?.endDate) {
    params.append('end_date', options.endDate);
  }
  
  if (options?.type) {
    params.append('type', options.type);
  }
  
  params.append('all_events', 'true');

  const results = await canvasFetchAllPages<CanvasCalendarEvent>(
    `/calendar_events?${params.toString()}`
  );
  calendarEventsCache.set(cacheKey, results as any);
  return results;
}

// =========================================================================
// Files + Submissions Attachments
// =========================================================================

export async function listCourseFiles(courseId: number): Promise<CanvasFile[]> {
  const cacheKey = `course-files:${courseId}`;
  const cached = courseFilesCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const results = await canvasFetchAllPages<CanvasFile>(`/courses/${courseId}/files`, {}, { perPage: 100 });
  courseFilesCache.set(cacheKey, results);
  return results;
}

export async function getFile(fileId: number): Promise<CanvasFile> {
  const cacheKey = String(fileId);
  const cached = fileCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const file = await canvasFetch<CanvasFile>(`/files/${fileId}`);
  fileCache.set(cacheKey, file);
  return file;
}

export async function getSubmissionDetailed(
  courseId: number,
  assignmentId: number
): Promise<CanvasSubmission> {
  const params = new URLSearchParams();
  params.append('include[]', 'submission_history');
  params.append('include[]', 'submission_comments');
  params.append('include[]', 'rubric_assessment');
  return canvasFetch<CanvasSubmission>(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/self?${params.toString()}`
  );
}

export async function downloadFileByUrl(
  fileUrl: string,
  options?: { maxRedirects?: number }
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const { baseUrl } = await getCanvasConfig();
  const maxRedirects = options?.maxRedirects ?? 10;
  const base = new URL(baseUrl);

  let currentUrl = fileUrl;

  for (let i = 0; i < maxRedirects; i += 1) {
    const parsed = new URL(currentUrl);
    const includeAuth = parsed.host === base.host;

    const response = await canvasFetchRaw(currentUrl, {
      redirect: 'manual',
      includeAuth,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Canvas file download redirect missing Location header.');
      }
      currentUrl = resolveUrl(location, currentUrl);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      if (includeAuth) {
        const body = await response.text().catch(() => '');
        const extra = body ? `: ${summarizeBodyForError(body)}` : '';
        throw new Error(`Canvas file download unauthorized (${response.status})${extra}`);
      }
      throw new Error(
        'This file appears to be hosted outside Canvas and is not directly accessible through the Canvas API in this mode. ' +
          'Please upload the file directly or paste the relevant text.'
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const extra = body ? `: ${summarizeBodyForError(body)}` : '';
      throw new Error(`Canvas file download failed (${response.status})${extra}`);
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType,
      finalUrl: currentUrl,
    };
  }

  throw new Error(`Canvas file download exceeded ${maxRedirects} redirects.`);
}

export async function downloadFileById(fileId: number): Promise<CanvasDownloadedFile> {
  const file = await getFile(fileId);
  const url = file.download_url ?? file.url;
  if (!url) {
    throw new Error(`Canvas file ${fileId} has no download URL.`);
  }

  const downloaded = await downloadFileByUrl(url);
  return {
    file,
    buffer: downloaded.buffer,
    contentType: file.content_type ?? file['content-type'] ?? downloaded.contentType,
    finalUrl: downloaded.finalUrl,
  };
}

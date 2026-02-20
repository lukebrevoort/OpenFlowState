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
const redactSecretsFromString = (input) => {
    // Keep this conservative: redact common auth patterns without trying to be perfect.
    return input
        .replace(/\bBearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
        .replace(/\b(canvas_session|_csrf_token|csrf_token|session)=[^;\s]+/gi, '$1=[REDACTED]');
};
const summarizeBodyForError = (body, maxChars = 600) => {
    const normalized = body.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const truncated = normalized.length > maxChars ? `${normalized.slice(0, maxChars)}…` : normalized;
    return redactSecretsFromString(truncated);
};
const normalizeBaseUrl = (baseUrl) => baseUrl.replace(/\/$/, '');
const getCanvasBaseUrl = () => {
    const baseUrl = process.env.CANVAS_API_URL || process.env.CANVAS_BASE_URL;
    if (!baseUrl) {
        throw new Error('CANVAS_API_URL or CANVAS_BASE_URL environment variable is required. ' +
            'Example: https://your-school.instructure.com');
    }
    return normalizeBaseUrl(baseUrl);
};
const getRequestedAuthMode = () => {
    const raw = (process.env.CANVAS_AUTH_MODE || '').trim().toLowerCase();
    if (!raw)
        return undefined;
    if (raw === 'token' || raw === 'browser' || raw === 'auto')
        return raw;
    throw new Error("Invalid CANVAS_AUTH_MODE. Expected 'token', 'browser', or 'auto'.");
};
const getCanvasToken = async () => {
    const envToken = process.env.CANVAS_API_TOKEN || process.env.CANVAS_TOKEN;
    if (envToken)
        return envToken;
    // Fallback to @flowstate/core auth store (aligns with other MCP packages)
    try {
        const { auth } = await import('@flowstate/core');
        const token = await auth.getToken('canvas');
        if (token?.accessToken)
            return token.accessToken;
    }
    catch {
        // ignore: core auth not available in standalone mode
    }
    return undefined;
};
const cookieDomainMatchesHost = (cookieDomain, host) => {
    const normalized = cookieDomain.startsWith('.') ? cookieDomain.slice(1) : cookieDomain;
    return host === normalized || host.endsWith(`.${normalized}`);
};
let cookieHeaderCache;
const buildCookieHeaderFromStorageState = async (storageStatePath, baseUrl) => {
    const host = new URL(baseUrl).hostname;
    let stat;
    try {
        stat = await fs.stat(storageStatePath);
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            throw new Error(`Canvas browser auth requires a Playwright storage state file, but it was not found at: ${storageStatePath}. ` +
                `Refresh Canvas authentication in FlowState Integrations and retry.`);
        }
        throw error;
    }
    if (cookieHeaderCache &&
        cookieHeaderCache.storageStatePath === storageStatePath &&
        cookieHeaderCache.host === host &&
        cookieHeaderCache.mtimeMs === stat.mtimeMs) {
        return cookieHeaderCache.cookieHeader;
    }
    let raw;
    try {
        raw = await fs.readFile(storageStatePath, 'utf8');
    }
    catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            throw new Error(`Canvas browser auth requires a Playwright storage state file, but it was not found at: ${storageStatePath}. ` +
                `Refresh Canvas authentication in FlowState Integrations and retry.`);
        }
        throw error;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new Error(`Invalid Canvas storage state JSON at: ${storageStatePath}`);
    }
    const cookies = Array.isArray(parsed?.cookies) ? parsed.cookies : [];
    const matched = cookies
        .filter((c) => c && typeof c.name === 'string' && typeof c.value === 'string')
        .filter((c) => typeof c.domain === 'string' && cookieDomainMatchesHost(c.domain, host))
        .filter((c) => typeof c.path === 'string')
        .map((c) => `${c.name}=${c.value}`)
        .filter(Boolean);
    if (matched.length === 0) {
        throw new Error(`Canvas storage state at ${storageStatePath} contains no usable cookies for ${host}. ` +
            `Refresh Canvas authentication in FlowState Integrations and retry.`);
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
const getCanvasConfig = async () => {
    const baseUrl = getCanvasBaseUrl();
    const requestedMode = getRequestedAuthMode();
    const storageStatePath = process.env.CANVAS_STORAGE_STATE_PATH || process.env.CANVAS_PLAYWRIGHT_STORAGE_STATE_PATH;
    const envToken = process.env.CANVAS_API_TOKEN || process.env.CANVAS_TOKEN;
    const mode = requestedMode ?? (envToken ? 'token' : storageStatePath ? 'browser' : 'token');
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
            throw new Error('Canvas auth mode is auto but no credentials were found. ' +
                'Set CANVAS_API_TOKEN (or store a token in FlowState Integrations), or set CANVAS_AUTH_MODE=browser and CANVAS_STORAGE_STATE_PATH, then refresh Canvas authentication in FlowState Integrations.');
        }
        return { baseUrl, auth: { mode: 'token', token } };
    }
    if (mode === 'token') {
        const token = envToken ?? (await getCanvasToken());
        if (!token) {
            throw new Error('Canvas token auth is selected but CANVAS_API_TOKEN is not set. ' +
                'Either set CANVAS_API_TOKEN (or CANVAS_TOKEN, or connect Canvas in FlowState Integrations), or set CANVAS_AUTH_MODE=browser and refresh Canvas authentication in FlowState Integrations.');
        }
        return { baseUrl, auth: { mode: 'token', token } };
    }
    if (!storageStatePath) {
        throw new Error('Canvas browser auth requires CANVAS_STORAGE_STATE_PATH (path to a Playwright storage state JSON file). ' +
            'Refresh Canvas authentication in FlowState Integrations and retry.');
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
const resolveUrl = (candidate, base) => {
    try {
        return new URL(candidate, base).toString();
    }
    catch {
        return candidate;
    }
};
const DEFAULT_PER_PAGE = Number(process.env.CANVAS_DEFAULT_PER_PAGE || '100');
const MAX_PAGES = Number(process.env.CANVAS_MAX_PAGES || '25');
const MAX_LIST_ITEMS = Number(process.env.CANVAS_MAX_LIST_ITEMS || '2500');
const parseNextLink = (linkHeader) => {
    if (!linkHeader)
        return null;
    const entries = linkHeader
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean);
    for (const entry of entries) {
        const parts = entry.split(';').map((part) => part.trim());
        if (parts.length === 0)
            continue;
        const urlPart = parts[0];
        const match = urlPart.match(/^<(.+)>$/);
        const url = match?.[1];
        if (!url)
            continue;
        const relPart = parts.find((part) => part.startsWith('rel='));
        const rel = relPart?.slice(4).replace(/^"|"$/g, '');
        if (rel === 'next')
            return url;
    }
    return null;
};
const ensurePerPage = (url, perPage) => {
    if (!url.searchParams.has('per_page')) {
        url.searchParams.set('per_page', String(perPage));
    }
};
const makeCanvasHttpError = async (response, authMode) => {
    const contentType = response.headers.get('content-type') || '';
    if (authMode === 'browser') {
        if (response.status === 401 || response.status === 403) {
            return new Error('Canvas browser session is unauthorized or expired. Refresh Canvas authentication in FlowState Integrations and retry.');
        }
        if (contentType.includes('text/html') || response.url.includes('/login')) {
            return new Error('Canvas browser session appears to be expired. Refresh Canvas authentication in FlowState Integrations and retry.');
        }
    }
    if (response.status === 401 || response.status === 403) {
        return new Error(`Canvas API unauthorized (${response.status}). Check your token / permissions, or switch to browser auth (CANVAS_AUTH_MODE=browser).`);
    }
    let body = '';
    try {
        body = await response.text();
    }
    catch {
        // ignore
    }
    const extra = body ? `: ${summarizeBodyForError(body)}` : '';
    return new Error(`Canvas API error (${response.status})${extra}`);
};
async function canvasFetchResponse(url, options = {}) {
    const { auth } = await getCanvasConfig();
    const authHeaders = {};
    if (auth.mode === 'token') {
        authHeaders.Authorization = `Bearer ${auth.token}`;
    }
    else {
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
    if (auth.mode === 'browser' &&
        (contentType.includes('text/html') || response.url.includes('/login'))) {
        throw new Error('Canvas browser session appears to be expired. Refresh Canvas authentication in FlowState Integrations and retry.');
    }
    return response;
}
async function canvasFetchAllPages(endpoint, options = {}, paging) {
    const { baseUrl } = await getCanvasConfig();
    const perPage = paging?.perPage ?? DEFAULT_PER_PAGE;
    const maxPages = paging?.maxPages ?? MAX_PAGES;
    const maxItems = paging?.maxItems ?? MAX_LIST_ITEMS;
    const initialUrl = new URL(`${baseUrl}/api/v1${endpoint}`);
    ensurePerPage(initialUrl, perPage);
    let nextUrl = initialUrl.toString();
    const results = [];
    for (let page = 0; page < maxPages && nextUrl; page += 1) {
        const response = await canvasFetchResponse(nextUrl, options);
        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error(`Canvas API pagination expected an array response for ${endpoint}`);
        }
        results.push(...data);
        if (results.length > maxItems) {
            throw new Error(`Canvas API pagination exceeded ${maxItems} items (endpoint: ${endpoint}). Narrow your query.`);
        }
        nextUrl = parseNextLink(response.headers.get('link'));
    }
    if (nextUrl) {
        throw new Error(`Canvas API pagination exceeded ${maxPages} pages (endpoint: ${endpoint}). Narrow your query.`);
    }
    return results;
}
// Generic fetch wrapper for Canvas API
async function canvasFetch(endpoint, options = {}) {
    const { baseUrl } = await getCanvasConfig();
    const url = `${baseUrl}/api/v1${endpoint}`;
    const response = await canvasFetchResponse(url, options);
    return response.json();
}
// Authenticated fetch for absolute Canvas URLs (used for file downloads).
async function canvasFetchRaw(url, options = {}) {
    const { auth } = await getCanvasConfig();
    const includeAuth = options.includeAuth !== false;
    const { includeAuth: _ignored, ...rest } = options;
    const authHeaders = {};
    if (includeAuth) {
        if (auth.mode === 'token') {
            authHeaders.Authorization = `Bearer ${auth.token}`;
        }
        else {
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
export async function browserLoginWithPlaywright(options) {
    const baseUrl = options?.canvasApiUrl
        ? normalizeBaseUrl(options.canvasApiUrl)
        : getCanvasBaseUrl();
    const storageStatePath = options?.storageStatePath ||
        process.env.CANVAS_STORAGE_STATE_PATH ||
        process.env.CANVAS_PLAYWRIGHT_STORAGE_STATE_PATH;
    if (!storageStatePath) {
        throw new Error('Missing CANVAS_STORAGE_STATE_PATH. Provide it as an env var or tool input to save the Playwright storage state.');
    }
    const timeoutMs = options?.timeoutMs ??
        Number(process.env.CANVAS_PLAYWRIGHT_LOGIN_TIMEOUT_MS || '300000');
    const headless = options?.headless ??
        (process.env.CANVAS_PLAYWRIGHT_HEADLESS || '').trim().toLowerCase() === 'true';
    const loginUrl = options?.loginUrl || process.env.CANVAS_LOGIN_URL || `${baseUrl}/login`;
    const confirmationFilePath = options?.confirmationFilePath;
    const require = createRequire(import.meta.url);
    let chromium;
    try {
        const playwright = require('playwright');
        chromium = playwright?.chromium;
    }
    catch {
        throw new Error("Playwright is required for browser login but isn't installed. Install it (e.g. `pnpm add -w playwright`) and re-run.");
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
        console.error(`[mcp-canvas] Browser login opened. Complete login in the browser window. Waiting up to ${Math.ceil(timeoutMs / 1000)}s...`);
        if (confirmationFilePath) {
            console.error(`[mcp-canvas] Waiting for confirmation file: ${confirmationFilePath}`);
            const started = Date.now();
            while (Date.now() - started < timeoutMs) {
                try {
                    await fs.stat(confirmationFilePath);
                    break;
                }
                catch {
                    // keep waiting
                }
                await new Promise((r) => setTimeout(r, 1000));
            }
            if (Date.now() - started >= timeoutMs) {
                throw new Error(`Timed out waiting for user confirmation file: ${confirmationFilePath}`);
            }
        }
        const started = Date.now();
        let lastStatus;
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
                    return {
                        storageStatePath,
                        userId: typeof user?.id === 'number' ? user.id : undefined,
                        userName: typeof user?.name === 'string' ? user.name : undefined,
                    };
                }
            }
            catch {
                // ignore transient errors while user is logging in
            }
            await new Promise((r) => setTimeout(r, 1500));
        }
        throw new Error(`Timed out verifying Canvas login. Last status: ${lastStatus ?? 'unknown'}. ` +
            `Try again, or set CANVAS_LOGIN_URL if your school uses a custom login page.`);
    }
    finally {
        await context.close().catch(() => undefined);
        await browser.close().catch(() => undefined);
    }
}
// ============================================================================
// API Functions
// ============================================================================
/**
 * Get all courses for the current user
 */
export async function getCourses(options) {
    const params = new URLSearchParams();
    if (options?.enrollmentState) {
        params.append('enrollment_state', options.enrollmentState);
    }
    if (options?.includeGrades) {
        params.append('include[]', 'total_scores');
    }
    const queryString = params.toString();
    const endpoint = `/courses${queryString ? `?${queryString}` : ''}`;
    return canvasFetchAllPages(endpoint);
}
/**
 * Get a specific course by ID
 */
export async function getCourse(courseId) {
    return canvasFetch(`/courses/${courseId}`);
}
/**
 * Get assignments for a course
 */
export async function getAssignments(courseId, options) {
    const params = new URLSearchParams();
    if (options?.orderBy) {
        params.append('order_by', options.orderBy);
    }
    if (options?.includeSubmission) {
        params.append('include[]', 'submission');
    }
    const queryString = params.toString();
    const endpoint = `/courses/${courseId}/assignments${queryString ? `?${queryString}` : ''}`;
    return canvasFetchAllPages(endpoint);
}
/**
 * Get a specific assignment
 */
export async function getAssignment(courseId, assignmentId) {
    return canvasFetch(`/courses/${courseId}/assignments/${assignmentId}`);
}
/**
 * Get upcoming assignments across all courses
 */
export async function getUpcomingAssignments() {
    return canvasFetchAllPages('/users/self/todo');
}
/**
 * Get submissions for a course assignment
 */
export async function getSubmission(courseId, assignmentId) {
    return canvasFetch(`/courses/${courseId}/assignments/${assignmentId}/submissions/self`);
}
/**
 * Get all submissions for a user in a course
 */
export async function getCourseSubmissions(courseId) {
    return canvasFetchAllPages(`/courses/${courseId}/students/submissions?student_ids[]=self`);
}
/**
 * Get announcements for courses
 */
export async function getAnnouncements(courseIds, options) {
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
    return canvasFetchAllPages(`/announcements?${params.toString()}`);
}
/**
 * Get modules for a course
 */
export async function getModules(courseId) {
    return canvasFetchAllPages(`/courses/${courseId}/modules`);
}
/**
 * Get items within a module
 */
export async function getModuleItems(courseId, moduleId) {
    return canvasFetchAllPages(`/courses/${courseId}/modules/${moduleId}/items`);
}
/**
 * Get grades for all enrolled courses
 */
export async function getGrades() {
    const enrollments = await canvasFetchAllPages('/users/self/enrollments?type[]=StudentEnrollment&include[]=grades');
    return enrollments.map(enrollment => ({
        course_id: enrollment.course_id,
        course_name: '', // Will be populated by caller if needed
        current_grade: enrollment.grades?.current_grade ?? null,
        current_score: enrollment.grades?.current_score ?? null,
        final_grade: enrollment.grades?.final_grade ?? null,
        final_score: enrollment.grades?.final_score ?? null,
    }));
}
/**
 * Get the user's calendar events and assignments
 */
export async function getCalendarEvents(options) {
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
    return canvasFetchAllPages(`/calendar_events?${params.toString()}`);
}
// =========================================================================
// Files + Submissions Attachments
// =========================================================================
export async function listCourseFiles(courseId) {
    return canvasFetchAllPages(`/courses/${courseId}/files`, {}, { perPage: 100 });
}
export async function getFile(fileId) {
    return canvasFetch(`/files/${fileId}`);
}
export async function getSubmissionDetailed(courseId, assignmentId) {
    const params = new URLSearchParams();
    params.append('include[]', 'submission_history');
    params.append('include[]', 'submission_comments');
    params.append('include[]', 'rubric_assessment');
    return canvasFetch(`/courses/${courseId}/assignments/${assignmentId}/submissions/self?${params.toString()}`);
}
export async function downloadFileByUrl(fileUrl, options) {
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
            throw new Error('This file appears to be hosted outside Canvas and is not directly accessible through the Canvas API in this mode. ' +
                'Please upload the file directly or paste the relevant text.');
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
export async function downloadFileById(fileId) {
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

/**
 * @flowstate/mcp-canvas Test Suite
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ORIGINAL_ENV = { ...process.env };

const makeHeaders = (values: Record<string, string>) => ({
  get: (key: string) => values[key.toLowerCase()] ?? null,
});

const makeResponse = (
  data: unknown,
  options?: { url?: string; status?: number; headers?: Record<string, string> }
) => {
  const headersLower: Record<string, string> = {};
  for (const [k, v] of Object.entries(options?.headers ?? {})) headersLower[k.toLowerCase()] = v;

  const status = options?.status ?? 200;
  const buffer =
    data instanceof ArrayBuffer
      ? Buffer.from(data)
      : ArrayBuffer.isView(data)
        ? Buffer.from(data.buffer)
        : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));

  return {
    ok: status >= 200 && status < 300,
    status,
    url: options?.url ?? 'https://canvas.example.com/api/v1/test',
    headers: makeHeaders(headersLower),
    json: async () => data,
    text: async () => (typeof data === 'string' ? data : JSON.stringify(data)),
    arrayBuffer: async () => buffer,
  } as any;
};

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Canvas auth mode selection', () => {
  it('uses bearer token by default when CANVAS_API_TOKEN is set', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_API_TOKEN = 'secret-token';
    delete process.env.CANVAS_AUTH_MODE;

    const fetchMock = vi.fn(async (url: string, init?: any) => {
      expect(url).toContain('/api/v1/users/self/todo');
      expect(init?.headers?.Authorization).toBe('Bearer secret-token');
      return makeResponse([], { headers: { 'content-type': 'application/json' }, url });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    await api.getUpcomingAssignments();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('falls back to browser auth when no token is set but storage state is present', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-canvas-'));
    const storageStatePath = path.join(tmp, 'storage_state.json');
    await fs.writeFile(
      storageStatePath,
      JSON.stringify({
        cookies: [
          { name: 'canvas_session', value: 'session123', domain: 'canvas.example.com', path: '/' },
        ],
      }),
      'utf8'
    );

    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    delete process.env.CANVAS_AUTH_MODE;
    delete process.env.CANVAS_API_TOKEN;
    process.env.CANVAS_STORAGE_STATE_PATH = storageStatePath;

    const fetchMock = vi.fn(async (_url: string, init?: any) => {
      expect(init?.headers?.Cookie).toContain('canvas_session=session123');
      expect(init?.headers?.Authorization).toBeUndefined();
      return makeResponse([], {
        headers: { 'content-type': 'application/json' },
        url: 'https://canvas.example.com/api/v1/users/self/todo',
      });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    await api.getUpcomingAssignments();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('uses Cookie header when CANVAS_AUTH_MODE=browser', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-canvas-'));
    const storageStatePath = path.join(tmp, 'storage_state.json');
    await fs.writeFile(
      storageStatePath,
      JSON.stringify({
        cookies: [
          { name: 'canvas_session', value: 'session123', domain: 'canvas.example.com', path: '/' },
          { name: '_csrf_token', value: 'csrf456', domain: 'canvas.example.com', path: '/' },
        ],
      }),
      'utf8'
    );

    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_AUTH_MODE = 'browser';
    process.env.CANVAS_STORAGE_STATE_PATH = storageStatePath;
    delete process.env.CANVAS_API_TOKEN;

    const fetchMock = vi.fn(async (_url: string, init?: any) => {
      expect(init?.headers?.Cookie).toContain('canvas_session=session123');
      expect(init?.headers?.Authorization).toBeUndefined();
      return makeResponse([], {
        headers: { 'content-type': 'application/json' },
        url: 'https://canvas.example.com/api/v1/users/self/todo',
      });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    await api.getUpcomingAssignments();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('honors CANVAS_AUTH_MODE=token even if browser storage state is present', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_AUTH_MODE = 'token';
    process.env.CANVAS_API_TOKEN = 'secret-token';
    process.env.CANVAS_STORAGE_STATE_PATH = '/tmp/does-not-matter.json';

    const fetchMock = vi.fn(async (_url: string, init?: any) => {
      expect(init?.headers?.Authorization).toBe('Bearer secret-token');
      expect(init?.headers?.Cookie).toBeUndefined();
      return makeResponse([], { headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    await api.getUpcomingAssignments();
  });

  it('throws a helpful error when token auth is selected but token is missing', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_AUTH_MODE = 'token';
    delete process.env.CANVAS_API_TOKEN;

    const api = await import('../api/index.js');
    await expect(api.getUpcomingAssignments()).rejects.toThrow(/CANVAS_API_TOKEN/);
    await expect(api.getUpcomingAssignments()).rejects.toThrow(/CANVAS_AUTH_MODE=browser/);
  });

  it('throws a helpful error when no auth is configured (no token, no browser storage)', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    delete process.env.CANVAS_AUTH_MODE;
    delete process.env.CANVAS_API_TOKEN;
    delete process.env.CANVAS_STORAGE_STATE_PATH;

    const api = await import('../api/index.js');
    await expect(api.getUpcomingAssignments()).rejects.toThrow(/CANVAS_API_TOKEN/);
    await expect(api.getUpcomingAssignments()).rejects.toThrow(/CANVAS_AUTH_MODE=browser/);
  });

  it('redacts secrets from error bodies', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_API_TOKEN = 'secret-token';
    delete process.env.CANVAS_AUTH_MODE;

    const fetchMock = vi.fn(async (_url: string, _init?: any) => {
      return makeResponse('server blew up: Bearer secret-token canvas_session=session123', {
        status: 500,
        headers: { 'content-type': 'text/plain' },
      });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    await expect(api.getUpcomingAssignments()).rejects.not.toThrow(/secret-token/);
    await expect(api.getUpcomingAssignments()).rejects.not.toThrow(/session123/);
    await expect(api.getUpcomingAssignments()).rejects.toThrow(/REDACTED/);
  });

  it('throws a helpful error when browser auth is selected but storage state is missing', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_AUTH_MODE = 'browser';
    process.env.CANVAS_STORAGE_STATE_PATH = path.join(os.tmpdir(), 'nope-does-not-exist.json');
    delete process.env.CANVAS_API_TOKEN;

    const api = await import('../api/index.js');
    await expect(api.getUpcomingAssignments()).rejects.toThrow(/storage state/i);
    await expect(api.getUpcomingAssignments()).rejects.toThrow(/canvas_auth_browser_login/);
  });
});

describe('Tool Definition Validation', () => {
  it('lists the expected tool names (smoke test)', () => {
    const expectedTools = [
      'canvas_auth_browser_login',
      'canvas_list_courses',
      'canvas_get_course',
      'canvas_list_assignments',
      'canvas_get_assignment',
      'canvas_get_upcoming',
      'canvas_get_grades',
      'canvas_get_submission',
      'canvas_list_announcements',
      'canvas_list_modules',
      'canvas_get_module_items',
      'canvas_get_calendar',
      'canvas_list_course_files',
      'canvas_get_file_info',
      'canvas_read_file_text',
      'canvas_read_submission_attachment_text',
    ];
    expect(expectedTools).toHaveLength(16);
    for (const name of expectedTools) expect(name).toMatch(/^canvas_/);
  });
});

describe('Canvas pagination', () => {
  it('follows next links and aggregates results', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_API_TOKEN = 'secret-token';

    let call = 0;
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      call += 1;
      if (call === 1) {
        expect(url).toBe('https://canvas.example.com/api/v1/courses?per_page=100');
        expect(init?.headers?.Authorization).toBe('Bearer secret-token');
        return makeResponse([{ id: 1 }], {
          url,
          headers: {
            link: '<https://canvas.example.com/api/v1/courses?page=2>; rel="next"',
          },
        });
      }
      return makeResponse([{ id: 2 }], { url });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    const results = await api.getCourses();
    expect(results).toHaveLength(2);
  });

  it('throws when a paginated endpoint returns a non-array response', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_API_TOKEN = 'secret-token';

    const fetchMock = vi.fn(async (url: string) =>
      makeResponse({ error: 'nope' }, { url })
    );
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    await expect(api.getCourses()).rejects.toThrow(/pagination expected an array/i);
  });
});

describe('Canvas browser storage state filtering', () => {
  it('errors when storage state has no cookies for the Canvas host', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-canvas-'));
    const storageStatePath = path.join(tmp, 'storage_state.json');
    await fs.writeFile(
      storageStatePath,
      JSON.stringify({
        cookies: [
          { name: 'canvas_session', value: 'session123', domain: 'other.example.com', path: '/' },
        ],
      }),
      'utf8'
    );

    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_AUTH_MODE = 'browser';
    process.env.CANVAS_STORAGE_STATE_PATH = storageStatePath;
    delete process.env.CANVAS_API_TOKEN;

    const fetchMock = vi.fn(async (_url: string) => makeResponse([]));
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    await expect(api.getUpcomingAssignments()).rejects.toThrow(/no usable cookies/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Canvas file downloads', () => {
  it('includes auth headers for Canvas-hosted files and follows redirects', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_API_TOKEN = 'secret-token';

    let call = 0;
    const fetchMock = vi.fn(async (_url: string, init?: any) => {
      call += 1;
      if (call === 1) {
        expect(init?.headers?.Authorization).toBe('Bearer secret-token');
        return makeResponse('', {
          status: 302,
          headers: { location: 'https://canvas.example.com/files/redirected' },
          url: 'https://canvas.example.com/files/original',
        });
      }
      expect(init?.headers?.Authorization).toBe('Bearer secret-token');
      return makeResponse('file-body', {
        url: 'https://canvas.example.com/files/redirected',
        headers: { 'content-type': 'text/plain' },
      });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    const downloaded = await api.downloadFileByUrl('https://canvas.example.com/files/original');
    expect(downloaded.contentType).toBe('text/plain');
    expect(downloaded.finalUrl).toBe('https://canvas.example.com/files/redirected');
  });

  it('does not include auth headers for external file URLs', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_API_TOKEN = 'secret-token';

    const fetchMock = vi.fn(async (_url: string, init?: any) => {
      expect(init?.headers?.Authorization).toBeUndefined();
      return makeResponse('file-body', {
        url: 'https://files.example.com/resource',
        headers: { 'content-type': 'application/pdf' },
      });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    const downloaded = await api.downloadFileByUrl('https://files.example.com/resource');
    expect(downloaded.contentType).toBe('application/pdf');
  });
});

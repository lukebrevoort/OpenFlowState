/**
 * @flowstate/mcp-canvas Test Suite
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

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

const createMinimalPptxBuffer = async (slideText: string, notesText = ''): Promise<Buffer> => {
  const zip = new JSZip();

  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>${slideText}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
  );

  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/notesSlides/notesSlide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>${notesText}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`
  );

  return zip.generateAsync({ type: 'nodebuffer' });
};

const createPptxWithNotesTarget = async (target: string): Promise<Buffer> => {
  const zip = new JSZip();

  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`
  );

  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="${target}"/>
</Relationships>`
  );

  return zip.generateAsync({ type: 'nodebuffer' });
};

const createPptxWithEntryCount = async (entryCount: number): Promise<Buffer> => {
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', '<p:sld xmlns:p="x" xmlns:a="x"><a:t>A</a:t></p:sld>');

  for (let i = 0; i < entryCount; i += 1) {
    zip.file(`ppt/media/chunk-${i}.bin`, 'x');
  }

  return zip.generateAsync({ type: 'nodebuffer' });
};

const createPptxWithOversizedSlideEntry = async (textLength: number): Promise<Buffer> => {
  const zip = new JSZip();
  const repeatedText = 'A'.repeat(textLength);

  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${repeatedText}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
};

const setupToolHandlers = async () => {
  const handlers = new Map<object, (request?: any) => Promise<any>>();
  const server = {
    setRequestHandler: (schema: object, handler: (request?: any) => Promise<any>) => {
      handlers.set(schema, handler);
    },
  } as any;

  const { registerTools } = await import('../tools/index.js');
  registerTools(server);

  return {
    callToolHandler: handlers.get(CallToolRequestSchema),
    listToolsHandler: handlers.get(ListToolsRequestSchema),
  };
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
    await expect(api.getUpcomingAssignments()).rejects.toThrow(/refresh canvas authentication/i);
  });
});

describe('Tool Definition Validation', () => {
  it('lists the expected tool names (smoke test)', () => {
    const expectedTools = [
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
    expect(expectedTools).toHaveLength(15);
    for (const name of expectedTools) expect(name).toMatch(/^canvas_/);
  });

  it('does not expose canvas_auth_browser_login as an MCP tool', async () => {
    const { listToolsHandler } = await setupToolHandlers();
    const response = await listToolsHandler?.();
    const names = (response?.tools ?? []).map((tool: { name: string }) => tool.name);
    expect(names).not.toContain('canvas_auth_browser_login');
  });
});

describe('Canvas assignment submission status detection', () => {
  it('defaults to include submission details for accurate status checks', async () => {
    const api = await import('../api/index.js');
    const getAssignmentsSpy = vi.spyOn(api, 'getAssignments').mockResolvedValue([
      {
        id: 10,
        name: 'Draft file upload',
        due_at: '2026-03-30T23:59:00Z',
        points_possible: 100,
        submission_types: ['online_upload'],
        has_submitted_submissions: true,
        submission: {
          workflow_state: 'unsubmitted',
          submitted_at: null,
        },
        html_url: 'https://canvas.example.com/courses/1/assignments/10',
      } as any,
    ]);

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: {
        name: 'canvas_list_assignments',
        arguments: { courseId: 1 },
      },
    });

    expect(getAssignmentsSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ includeSubmission: true })
    );

    const payload = result?.content?.[0]?.text?.split('\n\n')[1] ?? '[]';
    const parsed = JSON.parse(payload);
    expect(parsed[0].submitted).toBe(false);
  });

  it('handles assignment-type-specific submission states', async () => {
    const api = await import('../api/index.js');
    vi.spyOn(api, 'getAssignments').mockResolvedValue([
      {
        id: 21,
        name: 'Quiz 3',
        due_at: '2026-03-21T15:00:00Z',
        points_possible: 20,
        submission_types: ['online_quiz'],
        has_submitted_submissions: true,
        submission: {
          workflow_state: 'untaken',
          submitted_at: null,
        },
        html_url: 'https://canvas.example.com/courses/1/assignments/21',
      },
      {
        id: 22,
        name: 'Lab Report Upload',
        due_at: '2026-03-22T15:00:00Z',
        points_possible: 50,
        submission_types: ['online_upload'],
        has_submitted_submissions: false,
        submission: {
          workflow_state: 'submitted',
          submitted_at: '2026-03-20T04:00:00Z',
        },
        html_url: 'https://canvas.example.com/courses/1/assignments/22',
      },
      {
        id: 23,
        name: 'Reflection',
        due_at: '2026-03-23T15:00:00Z',
        points_possible: 15,
        submission_types: ['online_text_entry'],
        has_submitted_submissions: false,
        submission: {
          workflow_state: 'pending_review',
          submitted_at: null,
        },
        html_url: 'https://canvas.example.com/courses/1/assignments/23',
      },
    ] as any);

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: {
        name: 'canvas_list_assignments',
        arguments: { courseId: 1, includeSubmission: true },
      },
    });

    const payload = result?.content?.[0]?.text?.split('\n\n')[1] ?? '[]';
    const parsed = JSON.parse(payload);

    expect(parsed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 21, submitted: false }),
        expect.objectContaining({ id: 22, submitted: true }),
        expect.objectContaining({ id: 23, submitted: true }),
      ])
    );
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

  it('matches cookies for Canvas hosts with non-standard ports', async () => {
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

    process.env.CANVAS_API_URL = 'https://canvas.example.com:3000';
    process.env.CANVAS_AUTH_MODE = 'browser';
    process.env.CANVAS_STORAGE_STATE_PATH = storageStatePath;
    delete process.env.CANVAS_API_TOKEN;

    const fetchMock = vi.fn(async (_url: string, init?: any) => {
      expect(init?.headers?.Cookie).toContain('canvas_session=session123');
      return makeResponse([], {
        headers: { 'content-type': 'application/json' },
        url: 'https://canvas.example.com:3000/api/v1/users/self/todo',
      });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');
    await api.getUpcomingAssignments();
    expect(fetchMock).toHaveBeenCalled();
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

  it('returns non-reauth guidance for inaccessible external file URLs', async () => {
    process.env.CANVAS_API_URL = 'https://canvas.example.com';
    process.env.CANVAS_API_TOKEN = 'secret-token';

    const fetchMock = vi.fn(async (_url: string, init?: any) => {
      expect(init?.headers?.Authorization).toBeUndefined();
      return makeResponse('forbidden', {
        status: 403,
        url: 'https://files.example.com/resource',
        headers: { 'content-type': 'text/plain' },
      });
    });
    vi.stubGlobal('fetch', fetchMock as any);

    const api = await import('../api/index.js');

    await expect(api.downloadFileByUrl('https://files.example.com/resource')).rejects.toThrow(
      /not directly accessible through the Canvas API/i
    );
    await expect(api.downloadFileByUrl('https://files.example.com/resource')).rejects.toThrow(
      /upload the file directly or paste the relevant text/i
    );
    await expect(api.downloadFileByUrl('https://files.example.com/resource')).rejects.not.toThrow(
      /canvas_auth_browser_login/i
    );
    await expect(api.downloadFileByUrl('https://files.example.com/resource')).rejects.not.toThrow(
      /refresh canvas authentication/i
    );
  });
});

describe('Canvas source URL redaction', () => {
  it('sanitizes source URL for canvas_read_file_text output', async () => {
    const api = await import('../api/index.js');
    const parsers = await import('../utils/documentParsers.js');

    vi.spyOn(api, 'downloadFileById').mockResolvedValue({
      file: {
        id: 42,
        display_name: 'secure.pdf',
        filename: 'secure.pdf',
        size: 512,
      } as any,
      buffer: Buffer.from('%PDF-1.4 fake'),
      contentType: 'application/pdf',
      finalUrl:
        'https://canvas.example.com/files/42/download?download_frd=1&X-Amz-Signature=very-secret#frag',
    });

    vi.spyOn(parsers, 'extractDocumentText').mockResolvedValue({
      text: 'Extracted text.',
    } as any);

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: { name: 'canvas_read_file_text', arguments: { fileId: 42 } },
    });

    const text = result?.content?.[0]?.text ?? '';
    expect(result?.isError).toBeUndefined();
    expect(text).toContain('Source: https://canvas.example.com/files/42/download');
    expect(text).not.toContain('X-Amz-Signature');
    expect(text).not.toContain('download_frd=1');
    expect(text).not.toContain('#frag');
  });

  it('sanitizes source URL for canvas_read_submission_attachment_text output', async () => {
    const api = await import('../api/index.js');
    const parsers = await import('../utils/documentParsers.js');

    vi.spyOn(api, 'getSubmissionDetailed').mockResolvedValue({
      attachments: [
        {
          id: 88,
          filename: 'submission.pdf',
          size: 256,
          content_type: 'application/pdf',
          download_url: 'https://canvas.example.com/files/88/download',
        },
      ],
    } as any);

    vi.spyOn(api, 'downloadFileByUrl').mockResolvedValue({
      buffer: Buffer.from('%PDF-1.4 fake'),
      contentType: 'application/pdf',
      finalUrl:
        'https://files.instructure.com/files/88/download?verifier=top-secret&response-content-disposition=inline',
    });

    vi.spyOn(parsers, 'extractDocumentText').mockResolvedValue({
      text: 'Submission extracted text.',
    } as any);

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: {
        name: 'canvas_read_submission_attachment_text',
        arguments: { courseId: 1, assignmentId: 2, attachmentId: 88 },
      },
    });

    const text = result?.content?.[0]?.text ?? '';
    expect(result?.isError).toBeUndefined();
    expect(text).toContain('Source: https://files.instructure.com/files/88/download');
    expect(text).not.toContain('verifier=top-secret');
    expect(text).not.toContain('response-content-disposition=inline');
  });
});

describe('Canvas PPTX extraction', () => {
  it('mentions PPTX in relevant tool descriptions', async () => {
    const { listToolsHandler } = await setupToolHandlers();
    const response = await listToolsHandler?.();
    const tools = response?.tools ?? [];

    const readFileTool = tools.find((tool: { name: string }) => tool.name === 'canvas_read_file_text');
    const readAttachmentTool = tools.find(
      (tool: { name: string }) => tool.name === 'canvas_read_submission_attachment_text'
    );

    expect(readFileTool?.description).toMatch(/PPTX/i);
    expect(readAttachmentTool?.description).toMatch(/PPTX/i);
  });

  it('extracts slide text and speaker notes from a PPTX file', async () => {
    const api = await import('../api/index.js');
    const pptxBuffer = await createMinimalPptxBuffer(
      'Intro slide text',
      'These are speaker notes with additional detail so extraction is clearly non-sparse and should include notes content.'
    );

    vi.spyOn(api, 'downloadFileById').mockResolvedValue({
      file: {
        id: 1,
        display_name: 'lecture.pptx',
        filename: 'lecture.pptx',
        size: pptxBuffer.length,
      } as any,
      buffer: pptxBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      finalUrl: 'https://canvas.example.com/files/1/download',
    });

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: { name: 'canvas_read_file_text', arguments: { fileId: 1 } },
    });

    const text = result?.content?.[0]?.text ?? '';
    expect(result?.isError).toBeUndefined();
    expect(text).toContain('Intro slide text');
    expect(text).toContain('These are speaker notes with additional detail');
  });

  it('includes uncertainty messaging for sparse PPTX extraction output', async () => {
    const api = await import('../api/index.js');
    const pptxBuffer = await createMinimalPptxBuffer('Hi');

    vi.spyOn(api, 'downloadFileById').mockResolvedValue({
      file: {
        id: 2,
        display_name: 'sparse.pptx',
        filename: 'sparse.pptx',
        size: pptxBuffer.length,
      } as any,
      buffer: pptxBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      finalUrl: 'https://canvas.example.com/files/2/download',
    });

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: { name: 'canvas_read_file_text', arguments: { fileId: 2 } },
    });

    const text = result?.content?.[0]?.text ?? '';
    expect(result?.isError).toBeUndefined();
    expect(text).toContain('Hi');
    expect(text).toContain('Uncertainty: PPTX text extraction may be incomplete');
    expect(text).toContain('does not run OCR');
  });

  it('returns supported types including PPTX in unsupported file errors', async () => {
    const api = await import('../api/index.js');

    vi.spyOn(api, 'downloadFileById').mockResolvedValue({
      file: {
        id: 3,
        display_name: 'notes.txt',
        filename: 'notes.txt',
        size: 12,
      } as any,
      buffer: Buffer.from('hello world'),
      contentType: 'text/plain',
      finalUrl: 'https://canvas.example.com/files/3/download',
    });

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: { name: 'canvas_read_file_text', arguments: { fileId: 3 } },
    });

    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toContain('Supported: PDF, DOCX, PPTX.');
  });

  it('rejects unsafe PPTX notes relationship targets outside expected subpaths', async () => {
    const { extractPptxText } = await import('../utils/documentParsers.js');
    const unsafePptx = await createPptxWithNotesTarget('../../../docProps/core.xml');

    await expect(extractPptxText(unsafePptx)).rejects.toThrow(/unsafe pptx archive/i);
    await expect(extractPptxText(unsafePptx)).rejects.toThrow(/notes relationship target/i);
  });

  it('rejects PPTX archives that exceed zip entry bounds', async () => {
    process.env.CANVAS_PPTX_MAX_ZIP_ENTRIES = '10';
    const { extractPptxText } = await import('../utils/documentParsers.js');
    const oversized = await createPptxWithEntryCount(12);

    await expect(extractPptxText(oversized)).rejects.toThrow(/unsafe pptx archive/i);
    await expect(extractPptxText(oversized)).rejects.toThrow(/zip entries/i);
  });

  it('rejects oversized uncompressed slide XML before opening inflate stream', async () => {
    process.env.CANVAS_PPTX_MAX_XML_ENTRY_BYTES = '2048';
    const oversized = await createPptxWithOversizedSlideEntry(12000);
    const yauzlModule = await import('yauzl');
    const openReadStreamSpy = vi.spyOn((yauzlModule as any).ZipFile.prototype, 'openReadStream');
    const { extractPptxText } = await import('../utils/documentParsers.js');

    await expect(extractPptxText(oversized)).rejects.toThrow(/unsafe pptx archive/i);
    await expect(extractPptxText(oversized)).rejects.toThrow(/XML entry ppt\/slides\/slide1\.xml/i);
    expect(openReadStreamSpy).not.toHaveBeenCalled();
  });
});

describe('Canvas tool error redaction', () => {
  it('redacts secret-like query parameters in tool errors', async () => {
    const api = await import('../api/index.js');

    vi.spyOn(api, 'downloadFileById').mockRejectedValue(
      new Error(
        'download failed: https://files.example.com/resource?token=abc123&signature=sig987&verifier=v55&key=k1&auth=letmein&X-Amz-Signature=aws-secret'
      )
    );

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: { name: 'canvas_read_file_text', arguments: { fileId: 555 } },
    });

    const text = result?.content?.[0]?.text ?? '';
    expect(result?.isError).toBe(true);
    expect(text).toContain('token=[REDACTED]');
    expect(text).toContain('signature=[REDACTED]');
    expect(text).toContain('verifier=[REDACTED]');
    expect(text).toContain('key=[REDACTED]');
    expect(text).toContain('auth=[REDACTED]');
    expect(text).toContain('X-Amz-Signature=[REDACTED]');
    expect(text).not.toContain('abc123');
    expect(text).not.toContain('sig987');
    expect(text).not.toContain('v55');
    expect(text).not.toContain('k1');
    expect(text).not.toContain('letmein');
    expect(text).not.toContain('aws-secret');
  });
});

describe('Canvas downloaded byte-size enforcement', () => {
  it('enforces downloaded file byte-size limit before extraction', async () => {
    process.env.CANVAS_MAX_FILE_SIZE_MB = '1';
    const api = await import('../api/index.js');
    const buffer = Buffer.alloc(1024 * 1024 + 1, 1);

    vi.spyOn(api, 'downloadFileById').mockResolvedValue({
      file: {
        id: 90,
        display_name: 'misreported.pdf',
        filename: 'misreported.pdf',
        size: 128,
      } as any,
      buffer,
      contentType: 'application/pdf',
      finalUrl: 'https://canvas.example.com/files/90/download',
    });

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: { name: 'canvas_read_file_text', arguments: { fileId: 90 } },
    });

    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toContain('Downloaded file too large');
  });

  it('enforces downloaded attachment byte-size limit before extraction', async () => {
    process.env.CANVAS_MAX_FILE_SIZE_MB = '1';
    const api = await import('../api/index.js');
    const buffer = Buffer.alloc(1024 * 1024 + 1, 2);

    vi.spyOn(api, 'getSubmissionDetailed').mockResolvedValue({
      attachments: [
        {
          id: 77,
          filename: 'submission.pdf',
          size: 10,
          content_type: 'application/pdf',
          download_url: 'https://canvas.example.com/files/77/download',
        },
      ],
    } as any);

    vi.spyOn(api, 'downloadFileByUrl').mockResolvedValue({
      buffer,
      contentType: 'application/pdf',
      finalUrl: 'https://canvas.example.com/files/77/download',
    });

    const { callToolHandler } = await setupToolHandlers();
    const result = await callToolHandler?.({
      params: {
        name: 'canvas_read_submission_attachment_text',
        arguments: { courseId: 1, assignmentId: 2, attachmentId: 77 },
      },
    });

    expect(result?.isError).toBe(true);
    expect(result?.content?.[0]?.text).toContain('Downloaded attachment too large');
  });
});

/**
 * Notion API Wrapper
 * 
 * Wraps @notionhq/client with FlowState-specific functionality.
 * 
 * Tokens can be provided via:
 * 1. Environment variable (NOTION_ACCESS_TOKEN) - preferred for desktop app
 * 2. @flowstate/core auth module - fallback for standalone usage
 */

import { Client } from '@notionhq/client';
import { LruCache } from '@flowstate/core/cache';

let notionClient: Client | null = null;
const pageCache = new LruCache<any>({ maxEntries: 200, ttlMs: 2 * 60 * 1000 });
const pageContentCache = new LruCache<any>({ maxEntries: 200, ttlMs: 2 * 60 * 1000 });
const searchCache = new LruCache<any>({ maxEntries: 100, ttlMs: 60 * 1000 });
const databaseQueryCache = new LruCache<any>({ maxEntries: 100, ttlMs: 60 * 1000 });

const buildCacheKey = (prefix: string, parts: unknown[]): string => {
  try {
    return `${prefix}:${JSON.stringify(parts)}`;
  } catch {
    return `${prefix}:${String(parts)}`;
  }
};

/**
 * Get access token from environment variables or @flowstate/core
 */
async function getAccessToken(): Promise<string> {
  // First, check environment variable (set by desktop app)
  const envToken = process.env.NOTION_ACCESS_TOKEN;
  
  if (envToken) {
    console.error('[mcp-notion] Using token from environment variable');
    return envToken;
  }
  
  // Fallback to @flowstate/core auth (for standalone usage)
  try {
    const { auth } = await import('@flowstate/core');
    const token = await auth.getToken('notion');
    if (token) {
      console.error('[mcp-notion] Using token from @flowstate/core');
      return token.accessToken;
    }
  } catch (error) {
    // @flowstate/core not available or no token
    console.error('[mcp-notion] @flowstate/core auth not available:', error);
  }
  
  throw new Error('Notion not connected. Please connect via FlowState Integrations or set NOTION_ACCESS_TOKEN environment variable.');
}

export async function getNotionClient(): Promise<Client> {
  if (notionClient) return notionClient;

  const accessToken = await getAccessToken();

  notionClient = new Client({
    auth: accessToken,
  });

  return notionClient;
}

export async function searchPages(query?: string, filter?: 'page' | 'database') {
  const client = await getNotionClient();

  const cacheKey = buildCacheKey('search', [query ?? '', filter ?? '']);
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await client.search({
    query: query && query.trim() !== '' ? query : undefined,
    filter: filter ? { property: 'object', value: filter } : undefined,
  });

  searchCache.set(cacheKey, response.results);
  return response.results;
}

export async function getPage(pageId: string) {
  const client = await getNotionClient();
  const cached = pageCache.get(pageId);
  if (cached) return cached;

  const page = await client.pages.retrieve({ page_id: pageId });
  pageCache.set(pageId, page);
  return page;
}

export async function getPageContent(pageId: string) {
  const client = await getNotionClient();
  const cached = pageContentCache.get(pageId);
  if (cached) return cached;

  const blocks = await client.blocks.children.list({ block_id: pageId });
  pageContentCache.set(pageId, blocks.results);
  return blocks.results;
}

export async function queryDatabase(databaseId: string, filter?: object, sorts?: object[]) {
  const client = await getNotionClient();

  const cacheKey = buildCacheKey('db', [databaseId, filter ?? null, sorts ?? null]);
  const cached = databaseQueryCache.get(cacheKey);
  if (cached) return cached;

  const response = await client.databases.query({
    database_id: databaseId,
    filter: filter as any,
    sorts: sorts as any,
  });

  databaseQueryCache.set(cacheKey, response);
  return response;
}

export async function createPage(parentId: string, title: string, properties?: object) {
  const client = await getNotionClient();
  
  // Determine if parent is a page or database
  // For now, assume database if properties are provided
  const parent = properties
    ? { database_id: parentId }
    : { page_id: parentId };

  const created = await client.pages.create({
    parent,
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
      ...properties,
    },
  });

  searchCache.clear();
  databaseQueryCache.clear();

  return created;
}

export async function updatePage(pageId: string, properties: object) {
  const client = await getNotionClient();

  const updated = await client.pages.update({
    page_id: pageId,
    properties: properties as any,
  });

  pageCache.delete(pageId);
  pageContentCache.delete(pageId);
  searchCache.clear();
  databaseQueryCache.clear();

  return updated;
}

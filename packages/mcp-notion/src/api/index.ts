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

let notionClient: Client | null = null;

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
  
  const response = await client.search({
    query: query && query.trim() !== '' ? query : undefined,
    filter: filter ? { property: 'object', value: filter } : undefined,
  });

  return response.results;
}

export async function getPage(pageId: string) {
  const client = await getNotionClient();
  return client.pages.retrieve({ page_id: pageId });
}

export async function getPageContent(pageId: string) {
  const client = await getNotionClient();
  const blocks = await client.blocks.children.list({ block_id: pageId });
  return blocks.results;
}

export async function queryDatabase(databaseId: string, filter?: object, sorts?: object[]) {
  const client = await getNotionClient();
  
  return client.databases.query({
    database_id: databaseId,
    filter: filter as any,
    sorts: sorts as any,
  });
}

export async function createPage(parentId: string, title: string, properties?: object) {
  const client = await getNotionClient();
  
  // Determine if parent is a page or database
  // For now, assume database if properties are provided
  const parent = properties
    ? { database_id: parentId }
    : { page_id: parentId };

  return client.pages.create({
    parent,
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
      ...properties,
    },
  });
}

export async function updatePage(pageId: string, properties: object) {
  const client = await getNotionClient();
  
  return client.pages.update({
    page_id: pageId,
    properties: properties as any,
  });
}

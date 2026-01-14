/**
 * Notion API Wrapper
 * 
 * Wraps @notionhq/client with FlowState-specific functionality.
 */

import { Client } from '@notionhq/client';
import { auth } from '@flowstate/core';

let notionClient: Client | null = null;

export async function getNotionClient(): Promise<Client> {
  if (notionClient) return notionClient;

  const token = await auth.getToken('notion');
  if (!token) {
    throw new Error('Notion not connected. Please connect via the FlowState dashboard.');
  }

  notionClient = new Client({
    auth: token.accessToken,
  });

  return notionClient;
}

export async function searchPages(query: string, filter?: 'page' | 'database') {
  const client = await getNotionClient();
  
  const response = await client.search({
    query,
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

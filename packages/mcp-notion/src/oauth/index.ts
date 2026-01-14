/**
 * Notion OAuth Flow
 * 
 * Handles OAuth authentication with Notion.
 */

import { auth } from '@flowstate/core';

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3847/callback/notion';

export interface NotionOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getAuthorizationUrl(state: string): string {
  if (!NOTION_CLIENT_ID) {
    throw new Error('NOTION_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: NOTION_CLIENT_ID,
    response_type: 'code',
    owner: 'user',
    redirect_uri: REDIRECT_URI,
    state,
  });

  return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<void> {
  if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
    throw new Error('Notion OAuth not configured');
  }

  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(
        `${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OAuth token exchange failed: ${error}`);
  }

  const data = await response.json() as { access_token: string };

  await auth.storeToken({
    service: 'notion',
    accessToken: data.access_token,
    scopes: ['read', 'write'],
    // Notion tokens don't expire
  });
}

export async function disconnect(): Promise<void> {
  await auth.removeToken('notion');
}

export async function isConnected(): Promise<boolean> {
  const token = await auth.getToken('notion');
  return token !== null;
}

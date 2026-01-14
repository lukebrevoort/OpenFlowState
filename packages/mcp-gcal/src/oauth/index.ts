/**
 * Google OAuth Flow (Calendar)
 * 
 * Handles OAuth authentication with Google for Calendar access.
 */

import { google, Auth } from 'googleapis';
import { auth } from '@flowstate/core';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3847/callback/google';

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

export function getOAuth2Client(): Auth.OAuth2Client {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

export function getAuthorizationUrl(state: string): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID not configured');
  }

  const oauth2Client = getOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: CALENDAR_SCOPES,
    state,
    prompt: 'consent',
  });
}

export async function exchangeCodeForToken(code: string): Promise<void> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth not configured');
  }

  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token) {
    throw new Error('Failed to get access token');
  }

  await auth.storeToken({
    service: 'gcal',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? undefined,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    scopes: CALENDAR_SCOPES,
  });
}

export async function refreshAccessToken(): Promise<string> {
  const token = await auth.getToken('gcal');
  if (!token?.refreshToken) {
    throw new Error('No refresh token available');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: token.refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  await auth.storeToken({
    service: 'gcal',
    accessToken: credentials.access_token,
    refreshToken: token.refreshToken,
    expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    scopes: CALENDAR_SCOPES,
  });

  return credentials.access_token;
}

export async function disconnect(): Promise<void> {
  await auth.removeToken('gcal');
}

export async function isConnected(): Promise<boolean> {
  const token = await auth.getToken('gcal');
  return token !== null;
}

import { authManager } from './auth-manager.js';
import { oauthServer } from './oauth-server.js';

export type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
  timeZone?: string;
  backgroundColor?: string;
};

type CalendarListResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    primary?: boolean;
    selected?: boolean;
    accessRole?: string;
    timeZone?: string;
    backgroundColor?: string;
  }>;
  nextPageToken?: string;
};

const fetchCalendarListPage = async (accessToken: string, pageToken?: string) => {
  const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
  url.searchParams.set('maxResults', '250');
  if (pageToken) url.searchParams.set('pageToken', pageToken);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  const json = text ? (JSON.parse(text) as CalendarListResponse) : ({} as CalendarListResponse);

  return { ok: response.ok, status: response.status, json };
};

export async function listGoogleCalendars(): Promise<GoogleCalendarListEntry[]> {
  await authManager.initialize();

  const token = await authManager.getToken('gcal');
  if (!token) {
    throw new Error('Google Calendar is not connected');
  }

  const attemptWithToken = async (accessToken: string) => {
    const calendars: GoogleCalendarListEntry[] = [];
    let pageToken: string | undefined;

    do {
      const page = await fetchCalendarListPage(accessToken, pageToken);
      if (!page.ok) {
        const error = new Error(
          `Failed to list calendars (status: ${page.status})`
        ) as Error & { status?: number };
        error.status = page.status;
        throw error;
      }

      const items = page.json.items ?? [];
      for (const item of items) {
        if (!item.id) continue;
        calendars.push({
          id: item.id,
          summary: item.summary ?? undefined,
          primary: item.primary ?? undefined,
          selected: item.selected ?? undefined,
          accessRole: item.accessRole ?? undefined,
          timeZone: item.timeZone ?? undefined,
          backgroundColor: item.backgroundColor ?? undefined,
        });
      }

      pageToken = page.json.nextPageToken ?? undefined;
    } while (pageToken);

    calendars.sort((a, b) => {
      const ap = a.primary ? 0 : 1;
      const bp = b.primary ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.summary ?? a.id).localeCompare(b.summary ?? b.id);
    });

    return calendars;
  };

  try {
    return await attemptWithToken(token.accessToken);
  } catch (error) {
    const status = (error as any)?.status;
    if (status !== 401) throw error;
  }

  const refreshed = await oauthServer.refreshToken('gcal');
  if (!refreshed) {
    throw new Error('Google Calendar token refresh failed');
  }

  return attemptWithToken(refreshed.accessToken);
}

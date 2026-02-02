/**
 * Google Calendar API Wrapper
 * 
 * Wraps googleapis Calendar client with FlowState-specific functionality.
 * 
 * Tokens can be provided via:
 * 1. Environment variables (GCAL_ACCESS_TOKEN, GCAL_REFRESH_TOKEN) - preferred for desktop app
 * 2. @flowstate/core auth module - fallback for standalone usage
 */

import { google, calendar_v3 } from 'googleapis';
import { getGcalDefaults, parseCalendarIdsEnv, isReadAllCalendarsEnv } from '../config.js';

let calendarClient: calendar_v3.Calendar | null = null;

/**
 * Get OAuth tokens and credentials from environment variables or @flowstate/core
 */
async function getTokens(): Promise<{ 
  accessToken: string; 
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}> {
  // First, check environment variables (set by desktop app)
  const envAccessToken = process.env.GCAL_ACCESS_TOKEN;
  const envRefreshToken = process.env.GCAL_REFRESH_TOKEN;
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (envAccessToken) {
    console.error('[mcp-gcal] Using tokens from environment variables');
    return {
      accessToken: envAccessToken,
      refreshToken: envRefreshToken,
      clientId: envClientId,
      clientSecret: envClientSecret,
    };
  }
  
  // Fallback to @flowstate/core auth (for standalone usage)
  try {
    const { auth } = await import('@flowstate/core');
    const token = await auth.getToken('gcal');
    if (token) {
      console.error('[mcp-gcal] Using tokens from @flowstate/core');
      return {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
      };
    }
  } catch (error) {
    // @flowstate/core not available or no token
    console.error('[mcp-gcal] @flowstate/core auth not available:', error);
  }
  
  throw new Error('Google Calendar not connected. Please connect via FlowState Integrations or set GCAL_ACCESS_TOKEN environment variable.');
}

export async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  if (calendarClient) return calendarClient;

  const tokens = await getTokens();

  const oauth2Client = new google.auth.OAuth2(
    tokens.clientId,
    tokens.clientSecret
  );
  
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  calendarClient = google.calendar({ version: 'v3', auth: oauth2Client });
  return calendarClient;
}

const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedCalendarIds: string[] | null = null;
let cachedCalendarIdsAt = 0;

const normalizeCalendarIds = (ids: string[]): string[] =>
  ids.map((id) => id.trim()).filter((id) => id.length > 0);

const getCachedCalendarIds = (): string[] | null => {
  if (!cachedCalendarIds) return null;
  if (Date.now() - cachedCalendarIdsAt > CALENDAR_CACHE_TTL_MS) return null;
  return cachedCalendarIds;
};

const setCachedCalendarIds = (ids: string[]): void => {
  cachedCalendarIds = ids;
  cachedCalendarIdsAt = Date.now();
};

const resolveReadCalendarIds = async (explicit?: string[]): Promise<string[]> => {
  if (explicit && explicit.length > 0) return normalizeCalendarIds(explicit);

  const defaults = getGcalDefaults();
  
  // If user explicitly selected "All Calendars", return all available calendars
  if (defaults.readAllCalendars) {
    try {
      const calendars = await listCalendars();
      const ids = normalizeCalendarIds(calendars.map((c) => c.id));
      if (ids.length > 0) {
        return ids;
      }
    } catch (error) {
      console.error('[mcp-gcal] Failed to list all calendars:', error);
    }
    return ['primary'];
  }

  // Use configured calendar IDs from environment
  const envSelection = parseCalendarIdsEnv(process.env.GCAL_READ_CALENDAR_IDS);
  if (envSelection && envSelection.length > 0) return envSelection;

  // Fall back to primary if nothing configured
  return ['primary'];
};

export async function listEvents(options: {
  calendarId?: string;
  calendarIds?: string[];
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}) {
  if (Array.isArray(options.calendarIds) && options.calendarIds.length > 0) {
    return listEventsMulti({
      calendarIds: options.calendarIds,
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      maxResultsPerCalendar: options.maxResults,
    });
  }

  if (!options.calendarId || options.calendarId === 'primary') {
    const defaultIds = await resolveReadCalendarIds();
    if (defaultIds.length > 1) {
      return listEventsMulti({
        calendarIds: defaultIds,
        timeMin: options.timeMin,
        timeMax: options.timeMax,
        maxResultsPerCalendar: options.maxResults,
      });
    }
    if (defaultIds.length === 1 && !options.calendarId) {
      return listEvents({
        ...options,
        calendarId: defaultIds[0],
        calendarIds: undefined,
      });
    }
  }

  const client = await getCalendarClient();
  const defaults = getGcalDefaults();

  // Clean up parameters to avoid "invalid_request"
  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId: options.calendarId || defaults.readCalendarIds[0] || 'primary',
    maxResults: options.maxResults || 10,
    singleEvents: true,
    orderBy: 'startTime',
  };

  if (options.timeMin) {
    params.timeMin = options.timeMin;
  } else {
    params.timeMin = new Date().toISOString();
  }

  if (options.timeMax) {
    params.timeMax = options.timeMax;
  }

  const response = await client.events.list(params);

  return response.data.items || [];
}

export type GcalCalendarListEntry = {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
  accessRole?: string;
  timeZone?: string;
  backgroundColor?: string;
};

export async function listCalendars(): Promise<GcalCalendarListEntry[]> {
  const client = await getCalendarClient();

  const calendars: GcalCalendarListEntry[] = [];
  let pageToken: string | undefined;

  do {
    const response = await client.calendarList.list({
      maxResults: 250,
      pageToken,
    });

    const items = response.data.items ?? [];
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

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  calendars.sort((a, b) => {
    const ap = a.primary ? 0 : 1;
    const bp = b.primary ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return (a.summary ?? a.id).localeCompare(b.summary ?? b.id);
  });

  const ids = normalizeCalendarIds(calendars.map((c) => c.id));
  if (ids.length > 0) setCachedCalendarIds(ids);

  return calendars;
}

type EventWithCalendar = calendar_v3.Schema$Event & { calendarId?: string };

const getEventStartIso = (event: calendar_v3.Schema$Event): string | null => {
  const start = event.start?.dateTime ?? event.start?.date;
  if (!start) return null;
  try {
    return new Date(start).toISOString();
  } catch {
    return null;
  }
};

export async function listEventsMulti(options: {
  calendarIds: string[];
  timeMin?: string;
  timeMax?: string;
  maxResultsPerCalendar?: number;
}): Promise<EventWithCalendar[]> {
  const client = await getCalendarClient();

  const timeMin = options.timeMin ?? new Date().toISOString();
  const maxResults = options.maxResultsPerCalendar ?? 10;
  const calendarIds = normalizeCalendarIds(options.calendarIds);

  const results = await Promise.all(
    calendarIds.map(async (calendarId) => {
      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin,
      };
      if (options.timeMax) params.timeMax = options.timeMax;

      const response = await client.events.list(params);
      const items = response.data.items ?? [];
      return items.map((event) => ({ ...event, calendarId }));
    })
  );

  const flattened = results.flat();
  flattened.sort((a, b) => {
    const as = getEventStartIso(a) ?? '';
    const bs = getEventStartIso(b) ?? '';
    return as.localeCompare(bs);
  });

  return flattened;
}

export async function getEvent(eventId: string, calendarId: string = 'primary') {
  const client = await getCalendarClient();
  
  const response = await client.events.get({
    calendarId,
    eventId,
  });

  return response.data;
}

export async function getFreeBusy(options: {
  timeMin: string;
  timeMax: string;
  calendarIds?: string[];
}) {
  const client = await getCalendarClient();
  const defaults = getGcalDefaults();
  const calendarIds = await resolveReadCalendarIds(options.calendarIds);
  
  const response = await client.freebusy.query({
    requestBody: {
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      items: (calendarIds.length > 0 ? calendarIds : defaults.readCalendarIds || ['primary']).map((id) => ({ id })),
    },
  });

  return response.data.calendars;
}

export async function findConflicts(timeMin: string, timeMax: string, calendarIds?: string[]) {
  const defaults = getGcalDefaults();
  const ids = await resolveReadCalendarIds(calendarIds && calendarIds.length > 0 ? calendarIds : undefined);

  const events = await listEventsMulti({
    calendarIds: ids.length > 0 ? ids : defaults.readCalendarIds,
    timeMin,
    timeMax,
    maxResultsPerCalendar: 2500,
  });
  
  const conflicts: Array<{ event1: any; event2: any }> = [];
  
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const event1 = events[i];
      const event2 = events[j];
      
      if (event1.status === 'cancelled' || event2.status === 'cancelled') continue;

      const start1 = new Date(event1.start?.dateTime || event1.start?.date || '');
      const end1 = new Date(event1.end?.dateTime || event1.end?.date || '');
      const start2 = new Date(event2.start?.dateTime || event2.start?.date || '');
      const end2 = new Date(event2.end?.dateTime || event2.end?.date || '');
      
      // Check for overlap
      if (start1 < end2 && start2 < end1) {
        conflicts.push({ event1, event2 });
      }
    }
  }
  
  return conflicts;
}

export async function createEvent(event: {
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
  calendarId?: string;
}) {
  const client = await getCalendarClient();
  const defaults = getGcalDefaults();
  
  const response = await client.events.insert({
    calendarId: event.calendarId || defaults.writeCalendarId || 'primary',
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start },
      end: { dateTime: event.end },
      attendees: event.attendees?.map(email => ({ email })),
      location: event.location,
    },
  });

  return response.data;
}

export async function updateEvent(
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    start?: string;
    end?: string;
    attendees?: string[];
    location?: string;
  },
  calendarId: string = getGcalDefaults().writeCalendarId || 'primary'
) {
  const client = await getCalendarClient();
  
  const requestBody: calendar_v3.Schema$Event = {};
  if (updates.summary) requestBody.summary = updates.summary;
  if (updates.description) requestBody.description = updates.description;
  if (updates.start) requestBody.start = { dateTime: updates.start };
  if (updates.end) requestBody.end = { dateTime: updates.end };
  if (updates.attendees) requestBody.attendees = updates.attendees.map(email => ({ email }));
  if (updates.location) requestBody.location = updates.location;
  
  const response = await client.events.patch({
    calendarId,
    eventId,
    requestBody,
  });

  return response.data;
}

export async function deleteEvent(
  eventId: string,
  calendarId: string = getGcalDefaults().writeCalendarId || 'primary'
) {
  const client = await getCalendarClient();
  
  await client.events.delete({
    calendarId,
    eventId,
  });
}

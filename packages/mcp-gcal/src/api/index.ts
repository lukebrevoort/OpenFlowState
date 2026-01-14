/**
 * Google Calendar API Wrapper
 * 
 * Wraps googleapis Calendar client with FlowState-specific functionality.
 */

import { google, calendar_v3 } from 'googleapis';
import { auth } from '@flowstate/core';

let calendarClient: calendar_v3.Calendar | null = null;

export async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  if (calendarClient) return calendarClient;

  const token = await auth.getToken('gcal');
  if (!token) {
    throw new Error('Google Calendar not connected. Please connect at http://localhost:3847/integrations');
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
  });

  calendarClient = google.calendar({ version: 'v3', auth: oauth2Client });
  return calendarClient;
}

export async function listEvents(options: {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}) {
  const client = await getCalendarClient();
  
  const response = await client.events.list({
    calendarId: options.calendarId || 'primary',
    timeMin: options.timeMin || new Date().toISOString(),
    timeMax: options.timeMax,
    maxResults: options.maxResults || 10,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
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
  
  const response = await client.freebusy.query({
    requestBody: {
      timeMin: options.timeMin,
      timeMax: options.timeMax,
      items: (options.calendarIds || ['primary']).map(id => ({ id })),
    },
  });

  return response.data.calendars;
}

export async function findConflicts(timeMin: string, timeMax: string) {
  const events = await listEvents({ timeMin, timeMax, maxResults: 100 });
  
  const conflicts: Array<{ event1: any; event2: any }> = [];
  
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const event1 = events[i];
      const event2 = events[j];
      
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
  
  const response = await client.events.insert({
    calendarId: event.calendarId || 'primary',
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
  calendarId: string = 'primary'
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

export async function deleteEvent(eventId: string, calendarId: string = 'primary') {
  const client = await getCalendarClient();
  
  await client.events.delete({
    calendarId,
    eventId,
  });
}

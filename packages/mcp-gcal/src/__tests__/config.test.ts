import { describe, it, expect } from 'vitest';
import { getGcalDefaults, parseCalendarIdsEnv, isReadAllCalendarsEnv } from '../config.js';

describe('parseCalendarIdsEnv', () => {
  it('returns null for empty input', () => {
    expect(parseCalendarIdsEnv(undefined)).toBeNull();
    expect(parseCalendarIdsEnv(null)).toBeNull();
    expect(parseCalendarIdsEnv('')).toBeNull();
    expect(parseCalendarIdsEnv('   ')).toBeNull();
    expect(parseCalendarIdsEnv(', , ,')).toBeNull();
  });

  it('splits by comma, trims, and removes empties', () => {
    expect(parseCalendarIdsEnv(' primary , a@group.calendar.google.com ,  ')).toEqual([
      'primary',
      'a@group.calendar.google.com',
    ]);
  });

  it('dedupes while preserving order', () => {
    expect(parseCalendarIdsEnv('a,b,a,a,c,b')).toEqual(['a', 'b', 'c']);
  });
});

describe('isReadAllCalendarsEnv', () => {
  it('returns true for * marker', () => {
    expect(isReadAllCalendarsEnv('*')).toBe(true);
    expect(isReadAllCalendarsEnv(' * ')).toBe(true);
  });

  it('returns false for other values', () => {
    expect(isReadAllCalendarsEnv(undefined)).toBe(false);
    expect(isReadAllCalendarsEnv(null)).toBe(false);
    expect(isReadAllCalendarsEnv('')).toBe(false);
    expect(isReadAllCalendarsEnv('primary')).toBe(false);
    expect(isReadAllCalendarsEnv('a,b,c')).toBe(false);
    expect(isReadAllCalendarsEnv('*,primary')).toBe(false);
  });
});

describe('getGcalDefaults', () => {
  it('defaults to primary for read and write', () => {
    const defaults = getGcalDefaults({} as any);
    expect(defaults.readCalendarIds).toEqual(['primary']);
    expect(defaults.writeCalendarId).toBe('primary');
    expect(defaults.readAllCalendars).toBe(false);
  });

  it('uses GCAL_READ_CALENDAR_IDS for read defaults', () => {
    const defaults = getGcalDefaults({ GCAL_READ_CALENDAR_IDS: 'a,b' } as any);
    expect(defaults.readCalendarIds).toEqual(['a', 'b']);
    expect(defaults.readAllCalendars).toBe(false);
  });

  it('detects "all calendars" marker (*)', () => {
    const defaults = getGcalDefaults({ GCAL_READ_CALENDAR_IDS: '*' } as any);
    expect(defaults.readCalendarIds).toEqual(['primary']); // fallback when all calendars selected
    expect(defaults.readAllCalendars).toBe(true);
  });

  it('prefers GCAL_WRITE_CALENDAR_ID for write defaults', () => {
    const defaults = getGcalDefaults({
      GCAL_READ_CALENDAR_IDS: 'a,b',
      GCAL_WRITE_CALENDAR_ID: 'schedule',
    } as any);
    expect(defaults.writeCalendarId).toBe('schedule');
  });

  it('falls back to the single read calendar for write when only one is selected', () => {
    const defaults = getGcalDefaults({ GCAL_READ_CALENDAR_IDS: 'schedule' } as any);
    expect(defaults.writeCalendarId).toBe('schedule');
  });

  it('falls back to primary for write when multiple read calendars are selected', () => {
    const defaults = getGcalDefaults({ GCAL_READ_CALENDAR_IDS: 'schedule,meetings' } as any);
    expect(defaults.writeCalendarId).toBe('primary');
  });

  it('falls back to primary for write when all calendars selected', () => {
    const defaults = getGcalDefaults({ GCAL_READ_CALENDAR_IDS: '*' } as any);
    expect(defaults.writeCalendarId).toBe('primary');
    expect(defaults.readAllCalendars).toBe(true);
  });
});

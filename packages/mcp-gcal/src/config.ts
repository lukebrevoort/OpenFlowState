export type GcalDefaults = {
  readCalendarIds: string[];
  writeCalendarId: string;
  /**
   * When true, indicates that all calendars should be queried.
   * This is set when the user explicitly selects "All Calendars" in the UI.
   */
  readAllCalendars: boolean;
};

export function parseCalendarIdsEnv(value: string | undefined | null): string[] | null {
  if (!value) return null;

  const parts = value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  if (parts.length === 0) return null;

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of parts) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }

  return unique.length > 0 ? unique : null;
}

/**
 * Check if the calendar IDs env var indicates "all calendars" should be read.
 * This happens when the user explicitly clears the selection in the UI,
 * which sends '*' as the marker.
 */
export function isReadAllCalendarsEnv(value: string | undefined | null): boolean {
  if (!value) return false;
  return value.trim() === '*';
}

export function getGcalDefaults(env: NodeJS.ProcessEnv = process.env): GcalDefaults {
  const readEnv = env.GCAL_READ_CALENDAR_IDS;
  
  // Check for "all calendars" marker first
  const readAllCalendars = isReadAllCalendarsEnv(readEnv);
  
  // Parse specific calendar IDs (null if not set or "all calendars" marker)
  const readFromEnv = readAllCalendars ? null : parseCalendarIdsEnv(readEnv);
  const readCalendarIds = readFromEnv ?? ['primary'];

  const writeEnv = (env.GCAL_WRITE_CALENDAR_ID ?? '').trim();
  const writeCalendarId =
    writeEnv.length > 0
      ? writeEnv
      : readCalendarIds.length === 1
        ? readCalendarIds[0]
        : 'primary';

  return { readCalendarIds, writeCalendarId, readAllCalendars };
}

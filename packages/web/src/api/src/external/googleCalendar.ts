import { google, calendar_v3 } from 'googleapis';
import type { PrismaClient } from '@prisma/client';

let calendarClient: calendar_v3.Calendar | null = null;

function getCalendarClient(): calendar_v3.Calendar {
  if (calendarClient) return calendarClient;

  const credentialsBase64 = process.env.GCAL_CREDENTIALS_BASE64;
  let credentials: any;

  if (credentialsBase64) {
    credentials = JSON.parse(
      Buffer.from(credentialsBase64, 'base64').toString('utf-8'),
    );
  } else {
    // Fallback: try loading from file
    console.warn('GCAL_CREDENTIALS_BASE64 not set, Google Calendar disabled');
    throw new Error('Google Calendar not configured');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });

  calendarClient = google.calendar({ version: 'v3', auth });
  return calendarClient;
}

const CALENDAR_ID = process.env.GCAL_CALENDAR_ID || 'primary';

/**
 * Create a Google Calendar event and return the gcaleventid.
 */
export async function createCalendarEvent(event: {
  id: number;
  name: string;
  description?: string | null;
  loc?: string | null;
  from: Date;
  to: Date;
}): Promise<string | null> {
  try {
    const cal = getCalendarClient();
    const resp = await cal.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: event.name,
        description: event.description ?? '',
        location: event.loc ?? undefined,
        start: { dateTime: event.from.toISOString(), timeZone: 'Europe/Prague' },
        end: { dateTime: event.to.toISOString(), timeZone: 'Europe/Prague' },
      },
    });

    return resp.data.id ?? null;
  } catch (err) {
    console.error('Google Calendar create error:', err);
    return null;
  }
}

/**
 * Update a Google Calendar event using the stored gcaleventid.
 */
export async function updateCalendarEvent(
  gcalEventId: string,
  event: {
    name: string;
    description?: string | null;
    loc?: string | null;
    from: Date;
    to: Date;
  },
): Promise<void> {
  try {
    const cal = getCalendarClient();
    await cal.events.update({
      calendarId: CALENDAR_ID,
      eventId: gcalEventId,
      requestBody: {
        summary: event.name,
        description: event.description ?? '',
        location: event.loc ?? undefined,
        start: { dateTime: event.from.toISOString(), timeZone: 'Europe/Prague' },
        end: { dateTime: event.to.toISOString(), timeZone: 'Europe/Prague' },
      },
    });
  } catch (err) {
    console.error('Google Calendar update error:', err);
  }
}

/**
 * Delete a Google Calendar event using the stored gcaleventid.
 */
export async function deleteCalendarEvent(gcalEventId: string): Promise<void> {
  try {
    const cal = getCalendarClient();
    await cal.events.delete({
      calendarId: CALENDAR_ID,
      eventId: gcalEventId,
    });
  } catch (err: any) {
    // 410 = already deleted — not an error
    if (err?.code !== 410) {
      console.error('Google Calendar delete error:', err);
    }
  }
}

/**
 * Sync an event to Google Calendar: create if no gcaleventid, update if exists.
 * Returns the gcaleventid to store in the database.
 */
export async function syncEventToCalendar(
  db: PrismaClient,
  eventId: number,
): Promise<void> {
  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event || !event.from) return;

  try {
    if (event.gcaleventid) {
      await updateCalendarEvent(event.gcaleventid, {
        name: event.name ?? '',
        description: event.description,
        loc: event.loc,
        from: event.from,
        to: event.to ?? event.from,
      });
    } else {
      const gcalId = await createCalendarEvent({
        id: event.id,
        name: event.name ?? '',
        description: event.description,
        loc: event.loc,
        from: event.from,
        to: event.to ?? event.from,
      });
      if (gcalId) {
        await db.event.update({
          where: { id: event.id },
          data: { gcaleventid: gcalId },
        });
      }
    }
  } catch {
    // Google Calendar not configured — skip
  }
}

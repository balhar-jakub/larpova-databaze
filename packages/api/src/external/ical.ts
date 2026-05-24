import ical, { type ICalCalendarMethod } from 'ical-generator';
import type { PrismaClient } from '@prisma/client';

/**
 * Generate iCal feed for events.
 * 
 * If no userId is provided or id='all', returns all events in the next 2 years.
 * If a userId is provided, returns events for games the user wants to play (state=1).
 */
export async function generateIcal(db: PrismaClient, userId?: number): Promise<string> {
  const now = new Date();
  const twoYearsLater = new Date(now);
  twoYearsLater.setFullYear(now.getFullYear() + 2);

  let events;

  if (!userId) {
    // All events in the next 2 years
    events = await db.event.findMany({
      where: {
        deleted: false,
        from: { gte: now, lte: twoYearsLater },
      },
      orderBy: { from: 'asc' },
    });
  } else {
    // Personalized: events for games the user wants to play (state=1)
    const userRatings = await db.csld_rating.findMany({
      where: {
        user_id: userId,
        state: 1, // WANT_TO_PLAY
      },
      select: { game_id: true },
    });

    const gameIds = userRatings.map((r) => r.game_id);

    if (gameIds.length === 0) {
      return buildCalendar([]);
    }

    events = await db.event.findMany({
      where: {
        deleted: false,
        from: { gte: now, lte: twoYearsLater },
        csld_game_has_event: {
          some: {
            game_id: { in: gameIds },
          },
        },
      },
      orderBy: { from: 'asc' },
    });
  }

  return buildCalendar(events);
}

function buildCalendar(events: any[]): string {
  const cal = ical({ name: 'CSLD Events' });

  for (const event of events) {
    cal.createEvent({
      start: event.from,
      end: event.to || event.from,
      summary: event.name || 'LARP Event',
      description: event.description ?? '',
      url: event.web ?? undefined,
      location: event.loc ?? undefined,
    });
  }

  return cal.toString();
}

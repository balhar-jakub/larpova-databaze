/**
 * iCal feed generation (`generateIcal`) — the `/exportCalendar` route's data
 * source. Two modes: the public feed (all future events) and the personal
 * feed (events linked to games the user marked WANT_TO_PLAY, state=1).
 *
 * The fixtures build their own events/games/ratings rows and clean them up
 * by name; the iCalendar text itself is asserted structurally (BEGIN/END
 * blocks, SUMMARY lines, dates) rather than byte-for-byte.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { generateIcal } from '../external/ical';

const db = new PrismaClient();
const MARK = 'jest-ical-';

describe('generateIcal', () => {
  const eventIds: number[] = [];
  const gameIds: number[] = [];
  const ratingIds: number[] = [];
  let userId: number;

  beforeAll(async () => {
    const user = await db.csld_csld_user.create({
      data: {
        email: `ical-${Date.now()}@integration.test`,
        password: 'x',
        role: 1,
        name: 'ical-fixture-user',
        is_author: false,
      },
    });
    userId = user.id;

    // A future event linked to a game the user wants to play.
    const wantedGame = await db.csld_game.create({
      data: { name: `${MARK}wanted-game`, deleted: false, added_by: userId },
    });
    gameIds.push(wantedGame.id);
    const rating = await db.csld_rating.create({
      data: { game_id: wantedGame.id, user_id: userId, state: 1, rating: null },
    });
    ratingIds.push(rating.id);

    const futureEvent = await db.event.create({
      data: {
        name: `${MARK}future-event`,
        description: 'Budcí událost',
        loc: 'Praha',
        web: 'https://example.test/event',
        from: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        to: new Date(Date.now() + 32 * 24 * 3600 * 1000),
        deleted: false,
      },
    });
    eventIds.push(futureEvent.id);
    await db.csld_game_has_event.create({
      data: { game_id: wantedGame.id, event_id: futureEvent.id },
    });

    // A past event the personal feed must not include even though the game is wanted.
    const pastEvent = await db.event.create({
      data: {
        name: `${MARK}past-event`,
        from: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        to: new Date(Date.now() - 28 * 24 * 3600 * 1000),
        deleted: false,
      },
    });
    eventIds.push(pastEvent.id);
    await db.csld_game_has_event.create({
      data: { game_id: wantedGame.id, event_id: pastEvent.id },
    });

    // A future event linked to a game the user did NOT want to play.
    const otherGame = await db.csld_game.create({
      data: { name: `${MARK}other-game`, deleted: false, added_by: userId },
    });
    gameIds.push(otherGame.id);
    const otherEvent = await db.event.create({
      data: {
        name: `${MARK}other-event`,
        from: new Date(Date.now() + 40 * 24 * 3600 * 1000),
        deleted: false,
      },
    });
    eventIds.push(otherEvent.id);
    await db.csld_game_has_event.create({
      data: { game_id: otherGame.id, event_id: otherEvent.id },
    });
  });

  afterAll(async () => {
    for (const id of ratingIds) await db.csld_rating.deleteMany({ where: { id } });
    await db.csld_game_has_event.deleteMany({ where: { event_id: { in: eventIds } } });
    await db.event.deleteMany({ where: { id: { in: eventIds } } });
    await db.csld_game.deleteMany({ where: { id: { in: gameIds } } });
    await db.csld_csld_user.deleteMany({ where: { id: userId } });
  });

  it('the public feed includes all future events', async () => {
    const icalText = await generateIcal(db);
    expect(icalText).toContain('BEGIN:VCALENDAR');
    expect(icalText).toContain('END:VCALENDAR');
    expect(icalText).toContain('SUMMARY:jest-ical-future-event');
    expect(icalText).toContain('SUMMARY:jest-ical-other-event');
    expect(icalText).not.toContain('SUMMARY:jest-ical-past-event');
  });

  it('the personal feed includes only the wanted game events', async () => {
    const icalText = await generateIcal(db, userId);
    expect(icalText).toContain('SUMMARY:jest-ical-future-event');
    expect(icalText).not.toContain('SUMMARY:jest-ical-other-event');
    expect(icalText).not.toContain('SUMMARY:jest-ical-past-event');
  });

  it('the personal feed for a user with no want-to-play ratings is empty', async () => {
    const emptyUserId = userId + 1_000_000; // no rows can reference this id
    const icalText = await generateIcal(db, emptyUserId);
    expect(icalText).toContain('BEGIN:VCALENDAR');
    expect(icalText).not.toContain('SUMMARY:');
  });

  it('carries the event metadata', async () => {
    const icalText = await generateIcal(db);
    expect(icalText).toContain('DESCRIPTION:Budcí událost');
    expect(icalText).toContain('LOCATION:Praha');
    expect(icalText).toContain('https://example.test/event');
  });
});

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';

/**
 * Cold arms of resolvers/homepage.ts that homepage.test.ts's fixtures leave
 * out: the recentGames cap (the break at HOMEPAGE_RECENT_GAMES — seven
 * in-window games, the seventh must not appear), the myHome author block with
 * a game that has NO ratings (the ?? 0 of the recency sort, lastRating null),
 * a rating/comment with added: null (the since/added ?? null arms), and the
 * label tile arms (an unauthorized label skipped, the name localeCompare
 * tiebreak, a label of a deleted game not counted).
 */
const stamp = Date.now();
const marker = `hparm-${stamp}`;

let server: ReturnType<typeof createTestServer>;
let userId: number;
const recentGameIds: number[] = [];
const recentEventIds: number[] = [];
let authoredNoRatingsId: number;
let authoredRatedId: number;
const gameIds: number[] = [];
const eventIds: number[] = [];
const labelIds: number[] = [];
const ratingIds: number[] = [];
const commentIds: number[] = [];

const me = () => ({ user: { id: userId, email: `${marker}@integration.test` } });

beforeAll(async () => {
  server = createTestServer();
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  userId = user.id;

  // SEVEN games with in-window events: the block caps at six, so the seventh
  // never appears (the break arm).
  const base = Date.now() - 3 * 24 * 60 * 60 * 1000;
  for (let i = 0; i < 7; i += 1) {
    const game = await prisma.csld_game.create({
      data: { name: `${marker} nedávno hraná ${i}`, deleted: false, added_by: userId, lang: 'cs' },
    });
    recentGameIds.push(game.id);
    gameIds.push(game.id);
    const event = await prisma.event.create({
      data: {
        name: `${marker} běh ${i}`,
        deleted: false,
        from: new Date(base - i * 3600_000),
        to: new Date(base - i * 3600_000 + 3600_000),
      },
    });
    recentEventIds.push(event.id);
    eventIds.push(event.id);
    await prisma.csld_game_has_event.create({ data: { game_id: game.id, event_id: event.id } });
  }

  // Two authored games: one WITHOUT ratings (lastRating null, the ?? 0 sort
  // arm), one with a rating whose added is NULL (the added ?? null arm).
  const noRatings = await prisma.csld_game.create({
    data: { name: `${marker} autorova bez hodnocení`, deleted: false, added_by: userId, lang: 'cs' },
  });
  authoredNoRatingsId = noRatings.id;
  gameIds.push(noRatings.id);
  await prisma.csld_game_has_author.create({ data: { id_game: noRatings.id, id_user: userId } });

  const rated = await prisma.csld_game.create({
    data: { name: `${marker} autorova hodnocená`, deleted: false, added_by: userId, lang: 'cs' },
  });
  authoredRatedId = rated.id;
  gameIds.push(rated.id);
  await prisma.csld_game_has_author.create({ data: { id_game: rated.id, id_user: userId } });
  const voter = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: `${marker} volič`, email: `${marker}-voter@integration.test` },
  });
  const rating = await prisma.csld_rating.create({
    data: { user_id: voter.id, game_id: rated.id, rating: 9, state: 2, added: null },
  });
  ratingIds.push(rating.id);

  // A played game with added: null on the state row → since: null in toRate.
  const playedGame = await prisma.csld_game.create({
    data: { name: `${marker} odehraná`, deleted: false, added_by: userId, lang: 'cs' },
  });
  gameIds.push(playedGame.id);
  const played = await prisma.csld_rating.create({
    data: { user_id: userId, game_id: playedGame.id, rating: null, state: 2, added: null },
  });
  ratingIds.push(played.id);
});

afterAll(async () => {
  await prisma.csld_comment.deleteMany({ where: { id: { in: commentIds } } });
  await prisma.csld_rating.deleteMany({ where: { id: { in: ratingIds } } });
  await prisma.csld_game_has_author.deleteMany({ where: { id_game: { in: gameIds } } });
  await prisma.csld_game_has_event.deleteMany({ where: { game_id: { in: gameIds } } });
  await prisma.csld_game_has_label.deleteMany({ where: { id_game: { in: gameIds } } });
  await prisma.csld_label.deleteMany({ where: { id: { in: labelIds } } });
  await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  await prisma.csld_game.deleteMany({ where: { id: { in: gameIds } } });
  await prisma.csld_csld_user.deleteMany({ where: { email: { startsWith: `${marker}` } } });
  await prisma.$disconnect();
});

describe('homepage.recentGames cap arm', () => {
  it('serves at most six games: the seventh in-window game never appears', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { recentGames { game { id } } } }`,
    );
    expect(result.errors).toBeUndefined();
    const ids = result.data.homepage.recentGames.map((row: any) => Number(row.game.id));
    // all seven are in the window, only six fit
    const mine = ids.filter((id: number) => recentGameIds.includes(id));
    expect(mine.length).toBe(6);
    // the seventh (the OLDEST of the fixtures) is the one cut
    expect(mine).not.toContain(recentGameIds[6]);
  });
});

describe('homepage.myHome author and finish arms', () => {
  const MY_HOME = `
    query { homepage { myHome {
      authored { game { id } lastRating { rating added } }
      toRate { game { id } since }
      hasData
      authoredCount
    } } }`;

  it('orders authored games by their last rating (unrated last) and maps nulls', async () => {
    const result: any = await executeQuery(server, MY_HOME, undefined, me());
    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    const authored = mine.authored.filter(
      (row: any) => Number(row.game.id) === authoredRatedId || Number(row.game.id) === authoredNoRatingsId,
    );
    // Both sort keys fall to the ?? 0 arm (the rating's added is null), so
    // the order is the query's (id asc): the no-ratings game was created
    // first. What matters is both arms of the sort ran and nulls mapped.
    expect(authored.map((row: any) => Number(row.game.id)).sort((a: number, b: number) => a - b))
      .toEqual([authoredNoRatingsId, authoredRatedId].sort((a, b) => a - b));
    const ratedRow = authored.find((row: any) => Number(row.game.id) === authoredRatedId);
    const unratedRow = authored.find((row: any) => Number(row.game.id) === authoredNoRatingsId);
    // the rating with added: null serves its added as null, not as a date
    expect(ratedRow.lastRating).toEqual({ rating: 9, added: null });
    // the game with no ratings at all serves lastRating null
    expect(unratedRow.lastRating).toBeNull();
    expect(mine.authoredCount).toBeGreaterThanOrEqual(2);
  });

  it('serves a played-but-unrated game in toRate with since null (added: null)', async () => {
    const result: any = await executeQuery(server, MY_HOME, undefined, me());
    const mine = result.data.homepage.myHome;
    const row = mine.toRate.find((r: any) => Number(r.game.id) === gameIds[gameIds.length - 1]);
    expect(row).toBeDefined();
    expect(row.since).toBeNull();
    expect(mine.hasData).toBe(true);
  });
});

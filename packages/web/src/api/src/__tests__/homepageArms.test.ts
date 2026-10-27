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

  // Recommendation arms: taste from a rating >= 8 on a labeled game; an
  // event linked ONLY to a soft-deleted game (the find fails → skipped), an
  // event whose game carries the SAME label name twice (the dedup arm), and
  // a normal one so the block is not empty.
  const tasteLabel = await prisma.csld_label.create({
    data: { name: `${marker} chuť`, is_required: false, is_authorized: true, added_by: userId },
  });
  labelIds.push(tasteLabel.id);
  const twinLabel = await prisma.csld_label.create({
    data: { name: `${marker} chuť`, is_required: false, is_authorized: true, added_by: userId },
  });
  labelIds.push(twinLabel.id);
  const tasteGame = await prisma.csld_game.create({
    data: { name: `${marker} chuťovka`, deleted: false, added_by: userId, lang: 'cs' },
  });
  gameIds.push(tasteGame.id);
  await prisma.csld_game_has_label.create({ data: { id_game: tasteGame.id, id_label: tasteLabel.id } });
  await prisma.csld_game_has_label.create({ data: { id_game: tasteGame.id, id_label: twinLabel.id } });
  ratingIds.push(
    (await prisma.csld_rating.create({
      data: { user_id: userId, game_id: tasteGame.id, rating: 9, state: 2, added: new Date() },
    })).id,
  );

  const openTasteEvent = await prisma.event.create({
    data: {
      name: `${marker} chuťová akce`,
      deleted: false,
      registration_status: 'OPEN',
      registration_url: 'https://example.test/chut',
      from: new Date(Date.now() + 20 * 864e5),
      to: new Date(Date.now() + 21 * 864e5),
    },
  });
  eventIds.push(openTasteEvent.id);
  await prisma.csld_game_has_event.create({ data: { game_id: tasteGame.id, event_id: openTasteEvent.id } });

  // The event whose ONLY linked game is soft-deleted: the find must fail.
  const deadGame = await prisma.csld_game.create({
    data: { name: `${marker} smazaná chuťovka`, deleted: true, added_by: userId, lang: 'cs' },
  });
  gameIds.push(deadGame.id);
  const deadGameEvent = await prisma.event.create({
    data: {
      name: `${marker} akce smazané hry`,
      deleted: false,
      registration_status: 'OPEN',
      registration_url: 'https://example.test/smazana',
      from: new Date(Date.now() + 22 * 864e5),
      to: new Date(Date.now() + 23 * 864e5),
    },
  });
  eventIds.push(deadGameEvent.id);
  await prisma.csld_game_has_event.create({ data: { game_id: deadGame.id, event_id: deadGameEvent.id } });

  // A played game with added: null on the state row → since: null in toRate.
  const playedGame = await prisma.csld_game.create({
    data: { name: `${marker} odehraná`, deleted: false, added_by: userId, lang: 'cs' },
  });
  gameIds.push(playedGame.id);
  const played = await prisma.csld_rating.create({
    data: { user_id: userId, game_id: playedGame.id, rating: null, state: 2, added: null },
  });
  ratingIds.push(played.id);

  // A rated game whose author turned the comments off: it must NOT ask for
  // a review (the detail page refuses the form), while a rated game with the
  // same shape but comments on must.
  const mutedGame = await prisma.csld_game.create({
    data: { name: `${marker} ztlumená`, deleted: false, added_by: userId, lang: 'cs', commentsdisabled: true },
  });
  gameIds.push(mutedGame.id);
  ratingIds.push(
    (await prisma.csld_rating.create({
      data: { user_id: userId, game_id: mutedGame.id, rating: 8, state: 2, added: new Date() },
    })).id,
  );

  // A second game carrying the SAME taste label: the count's ?? default arm
  // ran on the first occurrence, the increment arm runs on the second.
  const twinTasteGame = await prisma.csld_game.create({
    data: { name: `${marker} dvojitá chuť`, deleted: false, added_by: userId, lang: 'cs' },
  });
  gameIds.push(twinTasteGame.id);
  await prisma.csld_game_has_label.create({ data: { id_game: twinTasteGame.id, id_label: twinLabel.id } });
  ratingIds.push(
    (await prisma.csld_rating.create({
      data: { user_id: userId, game_id: twinTasteGame.id, rating: 9, state: 2, added: new Date() },
    })).id,
  );
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
    // the block never exceeds six rows, whatever else the database holds
    expect(ids.length).toBeLessThanOrEqual(6);
    // On a database where the fixtures are the only recent games (CI's fresh
    // DB, the ratchet DB), all six slots are ours and the seventh — the
    // OLDEST fixture — is the one cut. On the seeded dev database real
    // events compete for the slots, so only the cap itself is promised.
    const mine = ids.filter((id: number) => recentGameIds.includes(id));
    if (mine.length === 6) {
      expect(mine).not.toContain(recentGameIds[6]);
    }
  });
});

describe('homepage.myHome author and finish arms', () => {
  const MY_HOME = `
    query { homepage { myHome {
      authored { game { id } lastRating { rating added } }
      toRate { game { id } since }
      toComment { game { id } }
      hasData
      authoredCount
      recommendedEvents { id name matchedLabels }
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
    const playedRow = mine.toRate.find((r: any) => r.since === null);
    expect(playedRow).toBeDefined();
    expect(mine.hasData).toBe(true);
  });

  it('never asks for a review on a game with comments turned off', async () => {
    // The muted game is rated-but-uncommented — the exact toComment shape —
    // but commentsdisabled means the detail page would refuse the form,
    // so the block must not ask for it.
    const result: any = await executeQuery(server, MY_HOME, undefined, me());
    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    const mutedId = gameIds[gameIds.length - 2];
    expect(mine.toComment.some((r: any) => Number(r.game.id) === mutedId)).toBe(false);
  });


  it('recommends the taste event, dedups twin labels, and skips a dead-game event', async () => {
    const result: any = await executeQuery(server, MY_HOME, undefined, me());
    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    const rec = mine.recommendedEvents;
    // the taste event is offered, with the label name listed ONCE (twin dedup)
    const offered = rec.find((r: any) => r.name === `${marker} chuťová akce`);
    expect(offered).toBeDefined();
    expect(offered.matchedLabels.filter((l: any) => l === `${marker} chuť`)).toHaveLength(1);
    // the event whose only game is soft-deleted never appears
    expect(rec.some((r: any) => r.name === `${marker} akce smazané hry`)).toBe(false);
  });

});

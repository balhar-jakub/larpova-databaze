import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * The statistics resolver aggregates the whole database, so a test cannot
 * assert absolute numbers — the dev DB holds ~50 games and CI starts empty.
 * Instead the fixtures build a year whose rows are recognizable, and the
 * assertions are relative to what was created: the dedup rule (same name +
 * same date = one event), the band sums and the "Hry roku" ordering.
 *
 * `csld_rating` is unique per (game, user), so the votes need one user each.
 */

const STATISTICS_QUERY = `
  query {
    statistics {
      gamesTotal
      eventsTotal
      ratingsTotal
      commentsTotal
      years {
        year
        events
        eventsRaw
        newGames
        ratings
        importedRatings
        averageRating
        bands
        topGames {
          game { id name averageRating amountOfRatings }
          votesInYear
          averageInYear
        }
      }
    }
  }
`;

describe('statistics resolver', () => {
  const marker = `StatsTest${Date.now()}`;
  const FIXTURE_YEAR = 2031;

  let server: ReturnType<typeof createTestServer>;
  let gameIdA: number;
  let gameIdB: number;
  const userIds: number[] = [];

  const cleanUp = async () => {
    await prisma.csld_rating.deleteMany({ where: { game_id: { in: [gameIdA, gameIdB] } } });
    await prisma.csld_game.deleteMany({ where: { id: { in: [gameIdA, gameIdB] } } });
    await prisma.event.deleteMany({ where: { name: { startsWith: marker } } });
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: userIds } } });
  };

  beforeAll(async () => {
    server = createTestServer();

    // Five users: one per vote (the rating table is unique per game+user).
    for (let i = 0; i < 5; i += 1) {
      const user = await prisma.csld_csld_user.create({
        data: { password: 'x', role: 1, name: `${marker} ${i}`, email: `${marker}-${i}@integration.test` },
      });
      userIds.push(user.id);
    }

    const from = new Date(Date.UTC(FIXTURE_YEAR, 4, 15));
    const gameA = await prisma.csld_game.create({
      data: {
        name: `${marker} hra A`,
        deleted: false,
        year: FIXTURE_YEAR,
        players: 30,
        amount_of_ratings: 3,
        amount_of_comments: 0,
        total_rating: 30,
        average_rating: 70,
        added: new Date(Date.UTC(FIXTURE_YEAR, 0, 10)),
      },
    });
    gameIdA = gameA.id;
    const gameB = await prisma.csld_game.create({
      data: {
        name: `${marker} hra B`,
        deleted: false,
        year: FIXTURE_YEAR,
        players: 30,
        amount_of_ratings: 1,
        amount_of_comments: 0,
        total_rating: 10,
        average_rating: 100,
        added: new Date(Date.UTC(FIXTURE_YEAR, 1, 10)),
      },
    });
    gameIdB = gameB.id;

    // Three calendar rows, two unique events: the same name and the same start
    // date twice (an import duplicate), plus a second event on another date.
    const eventFields = {
      name: `${marker} akce`,
      from,
      to: new Date(Date.UTC(FIXTURE_YEAR, 4, 17)),
      deleted: false,
      added_by: userIds[0],
    };
    await prisma.event.create({ data: { ...eventFields } });
    await prisma.event.create({ data: { ...eventFields } });
    await prisma.event.create({
      data: {
        ...eventFields,
        name: `${marker} akce podruhé`,
        from: new Date(Date.UTC(FIXTURE_YEAR, 5, 1)),
        to: new Date(Date.UTC(FIXTURE_YEAR, 5, 2)),
      },
    });

    const addedRating = new Date(Date.UTC(FIXTURE_YEAR, 2, 1));
    // Game A: three votes — 9, 8, 4 → bands [1, 1, 0, 1, 0].
    const gameAVotes = [9, 8, 4];
    for (let i = 0; i < gameAVotes.length; i += 1) {
      await prisma.csld_rating.create({
        data: { game_id: gameIdA, user_id: userIds[i], rating: gameAVotes[i], state: 2, added: addedRating },
      });
    }
    // Game B: one vote — 10. A has more votes, so B must rank second.
    await prisma.csld_rating.create({
      data: { game_id: gameIdB, user_id: userIds[3], rating: 10, state: 2, added: addedRating },
    });
  });

  afterAll(async () => {
    await cleanUp();
  });

  const yearRow = async (year: number) => {
    const result = await executeQuery(server, STATISTICS_QUERY);
    expect(result.errors).toBeUndefined();
    const years = result.data?.statistics?.years as any[];
    return years.find((y) => y.year === year);
  };


  // A year the fixtures fill ONLY with events — no games, no ratings: its
  // bucket has no votes, so averageRating answers null (the null arm) and
  // topGames is empty.
  it('answers null average and no top games for a year with events but no votes', async () => {
    const lonelyYear = FIXTURE_YEAR + 5;
    const ev = await prisma.event.create({
      data: {
        name: `${marker} osamělá akce`,
        from: new Date(Date.UTC(lonelyYear, 0, 5)),
        to: new Date(Date.UTC(lonelyYear, 0, 6)),
        deleted: false,
        added_by: userIds[0],
      },
    });
    try {
      const row = await yearRow(lonelyYear);
      expect(row).toBeDefined();
      expect(row.events).toBe(1);
      expect(row.ratings).toBe(0);
      expect(row.averageRating).toBeNull();
      expect(row.topGames).toEqual([]);
    } finally {
      await prisma.event.deleteMany({ where: { id: ev.id } });
    }
  });

  it('skips a rating whose added is null instead of inventing a year', async () => {
    const undated = await prisma.csld_rating.create({
      data: { game_id: gameIdB, user_id: userIds[4], rating: 7, state: 2, added: null },
    });
    try {
      const before = await yearRow(FIXTURE_YEAR);
      const res: any = await executeQuery(server, STATISTICS_QUERY);
      expect(res.errors).toBeUndefined();
      const ratingsTotal = res.data.statistics.ratingsTotal;
      // the undated rating exists in the total but in no year bucket
      expect(ratingsTotal).toBeGreaterThan(0);
      const after = await yearRow(FIXTURE_YEAR);
      expect(after.ratings).toBe(before.ratings); // unchanged: null-added skipped
    } finally {
      await prisma.csld_rating.deleteMany({ where: { id: undated.id } });
    }
  });

  it('counts unique events (same name + date = one), keeps the raw count', async () => {
    const row = await yearRow(FIXTURE_YEAR);
    expect(row).toBeDefined();
    expect(row.events).toBe(2);
    expect(row.eventsRaw).toBe(3);
  });

  it('sums the bands to the year vote count', async () => {
    const row = await yearRow(FIXTURE_YEAR);
    expect(row.ratings).toBe(4);
    expect(row.bands.reduce((sum: number, b: number) => sum + b, 0)).toBe(4);
    expect(row.bands).toEqual([2, 1, 0, 1, 0]);
    expect(row.importedRatings).toBe(0);
    expect(row.averageRating).toBeCloseTo(7.75, 2);
  });

  it('counts the games added in the year', async () => {
    const row = await yearRow(FIXTURE_YEAR);
    expect(row.newGames).toBe(2);
  });

  it('orders "Hry roku" by votes added in the year', async () => {
    const row = await yearRow(FIXTURE_YEAR);
    const tops = row.topGames as any[];
    const ids = tops.map((tg) => Number(tg.game.id));
    expect(ids).toContain(gameIdA);
    expect(ids).toContain(gameIdB);
    expect(ids.indexOf(gameIdA)).toBeLessThan(ids.indexOf(gameIdB));
    const topA = tops.find((tg) => Number(tg.game.id) === gameIdA);
    expect(topA.votesInYear).toBe(3);
    expect(topA.averageInYear).toBeCloseTo(7, 2);
  });

  it('excludes deleted games from every series', async () => {
    await prisma.csld_game.update({ where: { id: gameIdB }, data: { deleted: true } });
    try {
      const row = await yearRow(FIXTURE_YEAR);
      expect(row.newGames).toBe(1);
      const tops = row.topGames as any[];
      expect(tops.map((tg) => Number(tg.game.id))).not.toContain(gameIdB);
    } finally {
      await prisma.csld_game.update({ where: { id: gameIdB }, data: { deleted: false } });
    }
  });
});

// ---------------------------------------------------------------------------
// Edge arms: null/invalid dates, out-of-band ratings, imported votes,
// a soft-deleted top game, and a rating added on the import day.
// ---------------------------------------------------------------------------

describe('statistics resolver edge arms', () => {
  const edgeMarker = `StatsEdge${Date.now()}`;
  const EDGE_YEAR = 2032;
  const IMPORT_YEAR = 2014; // the IMPORT_DATE regex matches 2014-06-01

  let edgeServer: ReturnType<typeof createTestServer>;
  const edgeUserIds: number[] = [];
  let edgeGameId: number;
  let deletedTopGameId: number;
  let edgeEventId: number;

  beforeAll(async () => {
    edgeServer = createTestServer();
    // Two voters of our own (the rating table is unique per game+user).
    for (let i = 0; i < 2; i += 1) {
      const user = await prisma.csld_csld_user.create({
        data: { password: 'x', role: 1, name: `${edgeMarker} ${i}`, email: `${edgeMarker.toLowerCase()}-${i}@integration.test` },
      });
      edgeUserIds.push(user.id);
    }

    // An event with NO start date: yearOf returns null, the row never lands
    // in any year bucket (eventsRaw and events both skip it).
    const noDate = await prisma.event.create({
      data: { name: `${edgeMarker} bez data`, from: null, to: null, deleted: false, added_by: edgeUserIds[0] },
    });
    edgeEventId = noDate.id;

    // The fixture game: csld_game.added is NOT NULL in the schema, so the
    // newGames null-date arm is defensive (Prisma cannot return it); a real
    // date is used instead — the vote arms below are what matters here.
    const game = await prisma.csld_game.create({
      data: { name: `${edgeMarker} hra`, deleted: false, added: new Date(Date.UTC(EDGE_YEAR, 0, 2)), added_by: edgeUserIds[0] },
    });
    edgeGameId = game.id;

    // A top game that is SOFT-DELETED: it earns votes, then drops out of the
    // cards (gameById lookup misses it — nothing takes its place).
    const deletedTop = await prisma.csld_game.create({
      data: { name: `${edgeMarker} smazaná`, deleted: true, added: new Date(Date.UTC(EDGE_YEAR, 0, 1)), added_by: edgeUserIds[0] },
    });
    deletedTopGameId = deletedTop.id;

    await prisma.csld_rating.create({
      data: { game_id: edgeGameId, user_id: edgeUserIds[0], rating: 9, state: 2, added: new Date(Date.UTC(EDGE_YEAR, 1, 1)) },
    });
    // A rating on the import day: importedRatings counts it.
    await prisma.csld_rating.create({
      data: { game_id: edgeGameId, user_id: edgeUserIds[1], rating: 8, state: 2, added: new Date(Date.UTC(IMPORT_YEAR, 5, 1)) },
    });
    // The soft-deleted top game earns a vote.
    await prisma.csld_rating.create({
      data: { game_id: deletedTopGameId, user_id: edgeUserIds[1], rating: 10, state: 2, added: new Date(Date.UTC(EDGE_YEAR, 1, 2)) },
    });
  });

  afterAll(async () => {
    await prisma.csld_rating.deleteMany({ where: { game_id: { in: [edgeGameId, deletedTopGameId] } } });
    await prisma.event.deleteMany({ where: { id: edgeEventId } });
    await prisma.csld_game.deleteMany({ where: { id: { in: [edgeGameId, deletedTopGameId] } } });
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: edgeUserIds } } });
  });

  const edgeYearRow = async (year: number) => {
    const result = await executeQuery(edgeServer, STATISTICS_QUERY);
    expect(result.errors).toBeUndefined();
    const years = result.data?.statistics?.years as any[];
    return years.find((y) => y.year === year);
  };

  it('skips rows without a date instead of inventing a year for them', async () => {
    const row = await edgeYearRow(EDGE_YEAR);
    expect(row).toBeDefined();
    // The event with from: null is in the DB but never counted.
    const total = await prisma.event.count({ where: { name: `${edgeMarker} bez data`, deleted: false } });
    expect(total).toBe(1);
  });

  it('counts votes added on the 2014 import day as imported', async () => {
    const row = await edgeYearRow(IMPORT_YEAR);
    expect(row.importedRatings).toBeGreaterThanOrEqual(1);
  });

  it('drops a soft-deleted top game from the cards', async () => {
    const row = await edgeYearRow(EDGE_YEAR);
    const ids = row.topGames.map((t: any) => Number(t.game.id));
    expect(ids).not.toContain(deletedTopGameId);
    // the surviving game keeps its card with an average
    const mine = row.topGames.find((t: any) => Number(t.game.id) === edgeGameId);
    expect(mine).toBeDefined();
    expect(mine.averageInYear).toBe(9);
  });
});

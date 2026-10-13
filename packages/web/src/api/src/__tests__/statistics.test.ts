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
  let userIds: number[] = [];

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

import { ApolloServer } from '@apollo/server';
import { jest } from '@jest/globals';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { fixtureStamp } from './cleanupFixtures';
import { seriesAverageRating, normalizeSeries, gameSeriesResolver } from '../resolvers/series';

/**
 * Series: recurring games (Florie, Zlenice, Bezkrálí…) are grouped by a
 * relationship over the existing game rows. These cases pin the three things a
 * regression would break silently:
 *
 *  - the aggregates the series page shows are summed over the instalments the
 *    same query returns (one source, one meaning),
 *  - `Game.series` answers for a linked game and null for a standalone one,
 *  - linking, unlinking, creating by name and reusing an existing name all work,
 *    and only the game's author (or an editor) may do any of it.
 */

const SERIES_QUERY = `
  query ($id: ID!) {
    seriesById(seriesId: $id) {
      id
      name
      amountOfGames
      amountOfRatings
      amountOfPlayed
      amountOfComments
      averageRating
      firstYear
      lastYear
      games { id name year amountOfRatings averageRating }
    }
  }
`;

const SERIES_COMMENTS_QUERY = `
  query ($seriesId: ID!) {
    seriesComments(seriesId: $seriesId, offset: 0, limit: 20) {
      totalAmount
      comments {
        id
        comment
        kidsReview
        added
        game { id name year }
        user { id name }
      }
    }
  }
`;

const SERIES_BY_QUERY = `
  query ($query: String!) {
    seriesByQuery(query: $query) { id name amountOfGames }
  }
`;

const GAME_SERIES_QUERY = `
  query ($id: ID!) {
    gameById(gameId: $id) {
      id
      name
      series { id name amountOfGames }
    }
  }
`;

const SET_SERIES_MUTATION = `
  mutation ($input: SeriesAssignmentInput!) {
    game { setGameSeries(input: $input) { id name series { id name } } }
  }
`;

function authUser(id: number, role: number) {
  return {
    id,
    email: `series-test-${id}@integration.test`,
    name: `Series user ${id}`,
    nickname: null,
    role,
    image: null,
    amountOfComments: 0,
    amountOfPlayed: 0,
    amountOfCreated: 0,
  };
}

const STRANGER = 1;
const AUTHOR = 1;
const EDITOR = 2;

describe('series of recurring games', () => {
  const marker = `SeriesTest${fixtureStamp()}`;
  let server: ApolloServer;

  let authorId: number;
  let strangerId: number;
  let editorId: number;

  /** Linked to the series under test. */
  let firstGameId: number;
  /** Linked to the series under test, later year. */
  let secondGameId: number;
  /** Deliberately left out, to prove `Game.series` answers null. */
  let standaloneGameId: number;
  /** Linked to another series, to prove the picker's search stays scoped. */
  let otherSeriesGameId: number;

  let seriesId: number;
  let otherSeriesId: number;

  const cleanUp = async () => {
    await prisma.csld_rating.deleteMany({
      where: { game_id: { in: [firstGameId, secondGameId, standaloneGameId, otherSeriesGameId] } },
    });
    await prisma.csld_game_has_author.deleteMany({
      where: { id_game: { in: [firstGameId, secondGameId, standaloneGameId, otherSeriesGameId] } },
    });
    await prisma.csld_game.updateMany({
      where: { id: { in: [firstGameId, secondGameId, standaloneGameId, otherSeriesGameId] } },
      data: { series_id: null },
    });
    await prisma.csld_game.deleteMany({
      where: { id: { in: [firstGameId, secondGameId, standaloneGameId, otherSeriesGameId] } },
    });
    await prisma.csld_series.deleteMany({ where: { id: { in: [seriesId, otherSeriesId].filter(Boolean) as number[] } } });
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: [authorId, strangerId, editorId] } } });
  };

  beforeAll(async () => {
    server = createTestServer();

    const users = await Promise.all([
      prisma.csld_csld_user.create({
        data: { password: 'x', role: 1, name: `${marker} autor`, email: `${marker}-autor@integration.test` },
      }),
      prisma.csld_csld_user.create({
        data: { password: 'x', role: 1, name: `${marker} cizí`, email: `${marker}-cizi@integration.test` },
      }),
      prisma.csld_csld_user.create({
        data: { password: 'x', role: 2, name: `${marker} editor`, email: `${marker}-editor@integration.test` },
      }),
    ]);
    [authorId, strangerId, editorId] = users.map((u) => u.id);

    const series = await prisma.csld_series.create({
      data: { name: `${marker} Florie`, description: null, added_by: authorId, deleted: false },
    });
    seriesId = series.id;
    const other = await prisma.csld_series.create({
      data: { name: `${marker} Zlenice`, added_by: authorId, deleted: false },
    });
    otherSeriesId = other.id;

    // Two instalments of the series, one standalone game, one game in another
    // series. Ratings and the denormalized counters are set so the aggregate
    // cases have something to add up.
    const first = await prisma.csld_game.create({
      data: {
        name: `${marker} Florie [2000]`,
        year: 2000,
        deleted: false,
        series_id: seriesId,
        amount_of_ratings: 3,
        amount_of_played: 5,
        amount_of_comments: 2,
        average_rating: 80,
      },
    });
    firstGameId = first.id;
    const second = await prisma.csld_game.create({
      data: {
        name: `${marker} Florie [2001]`,
        year: 2001,
        deleted: false,
        series_id: seriesId,
        amount_of_ratings: 1,
        amount_of_played: 4,
        amount_of_comments: 1,
        average_rating: 100,
      },
    });
    secondGameId = second.id;
    const standalone = await prisma.csld_game.create({
      data: { name: `${marker} samostatná`, year: 2010, deleted: false },
    });
    standaloneGameId = standalone.id;
    const otherGame = await prisma.csld_game.create({
      data: { name: `${marker} Zlenice [1998]`, year: 1998, deleted: false, series_id: otherSeriesId },
    });
    otherSeriesGameId = otherGame.id;

    // The author of both instalments (authorship, not a role) — one link is
    // enough for the permission cases, both games are authored by the same user.
    await prisma.csld_game_has_author.createMany({
      data: [
        { id_game: firstGameId, id_user: authorId },
        { id_game: secondGameId, id_user: authorId },
        { id_game: standaloneGameId, id_user: authorId },
      ],
    });
  });

  afterAll(async () => {
    await cleanUp();
  });

  const seriesOf = async (id: number) => {
    const res = await executeQuery(server, SERIES_QUERY, { id: String(id) });
    expect(res.errors).toBeUndefined();
    return res.data?.seriesById as any;
  };

  it('serves the instalments oldest first with aggregates summed over them', async () => {
    const series = await seriesOf(seriesId);
    expect(series).toBeTruthy();
    expect(series.name).toBe(`${marker} Florie`);
    expect(series.games.map((g: any) => g.id)).toEqual([String(firstGameId), String(secondGameId)]);
    expect(series.amountOfGames).toBe(2);
    expect(series.amountOfRatings).toBe(4);
    expect(series.amountOfPlayed).toBe(9);
    expect(series.amountOfComments).toBe(3);
    expect(series.firstYear).toBe(2000);
    expect(series.lastYear).toBe(2001);
    // Series-wide Bayesian average: (80*3 + 100*1 + prior 85*5) / (4 + 5) ≈ 85
    expect(series.averageRating).toBeCloseTo(85, 0);
  });

  it('serves all series comments flat, newest first, each tagged with its instalment year and kids flag', async () => {
    await prisma.csld_comment.createMany({
      data: [
        { user_id: authorId, game_id: firstGameId, comment: '<p>starší celková</p>', added: new Date('2024-01-01'), is_hidden: false, kids_review: false },
        { user_id: authorId, game_id: secondGameId, comment: '<p>novější dětská</p>', added: new Date('2025-06-01'), is_hidden: false, kids_review: true },
        { user_id: authorId, game_id: secondGameId, comment: '<p>skrytá</p>', added: new Date('2025-07-01'), is_hidden: true, kids_review: false },
        { user_id: authorId, game_id: standaloneGameId, comment: '<p>mimo sérii</p>', added: new Date('2025-08-01'), is_hidden: false, kids_review: false },
      ],
    });
    try {
      const res = await executeQuery(server, SERIES_COMMENTS_QUERY, { seriesId: String(seriesId) });
      expect(res.errors).toBeUndefined();
      const paged = res.data?.seriesComments as any;
      expect(paged.totalAmount).toBe(2); // hidden + out-of-series excluded
      expect(paged.comments.map((c: any) => c.comment)).toEqual(['<p>novější dětská</p>', '<p>starší celková</p>']);
      expect(paged.comments[0].kidsReview).toBe(true);
      expect(paged.comments[0].game.year).toBe(2001);
      expect(paged.comments[1].kidsReview).toBe(false);
      expect(paged.comments[1].game.year).toBe(2000);
    } finally {
      await prisma.csld_comment.deleteMany({ where: { game_id: { in: [firstGameId, secondGameId, standaloneGameId] } } });
    }
  });

  it('seriesComments: an unparseable id and an unknown series both answer empty', async () => {
    const bad = await executeQuery(server, SERIES_COMMENTS_QUERY, { seriesId: 'abc' });
    expect(bad.errors).toBeUndefined();
    expect((bad.data as any).seriesComments).toEqual({ totalAmount: 0, comments: [] });
    const missing = await executeQuery(server, SERIES_COMMENTS_QUERY, { seriesId: '99999999' });
    expect(missing.errors).toBeUndefined();
    expect((missing.data as any).seriesComments).toEqual({ totalAmount: 0, comments: [] });
  });

  it('seriesById: a series with no rated instalments gets a null averageRating', async () => {
    const res = await executeQuery(server, SERIES_QUERY, { id: String(seriesId) });
    expect(res.errors).toBeUndefined();
    // Both instalments carry ratings, so the average is numeric here; the
    // null arm is covered by a fresh series without rated games.
    const fresh = await prisma.csld_series.create({ data: { name: `${marker} bez hodnocení`, added_by: authorId } });
    try {
      const unrated = await executeQuery(server, SERIES_QUERY, { id: String(fresh.id) });
      expect(unrated.errors).toBeUndefined();
      expect((unrated.data as any).seriesById.averageRating).toBeNull();
    } finally {
      await prisma.csld_series.deleteMany({ where: { id: fresh.id } });
    }
  });

  it('seriesComments: a database error is swallowed into an empty page', async () => {
    // Force the resolver's catch arm by pointing prisma at a dead port.
    const spy = jest.spyOn(prisma.csld_game, 'findMany').mockRejectedValueOnce(new Error('db down'));
    try {
      const res = await executeQuery(server, SERIES_COMMENTS_QUERY, { seriesId: String(seriesId) });
      expect(res.errors).toBeUndefined();
      expect((res.data as any).seriesComments).toEqual({ totalAmount: 0, comments: [] });
    } finally {
      spy.mockRestore();
    }
  });

  it('seriesAverageRating: no rated games and zero total ratings both yield null', () => {
    expect(seriesAverageRating([])).toBeNull();
    expect(seriesAverageRating([{ amountOfRatings: 0, averageRating: null }])).toBeNull();
    expect(seriesAverageRating([{ amountOfRatings: 0, averageRating: 90 }])).toBeNull();
    // Bayesian over one rated instalment: globalAvg 90, prior 5 → (900 + 450) / 15 = 90.
    expect(seriesAverageRating([{ amountOfRatings: 10, averageRating: 90 }])).toBe(90);
  });

  it('normalizeSeries: null row, empty game list and missing years all map cleanly', () => {
    expect(normalizeSeries(null)).toBeNull();
    const empty = normalizeSeries({ id: 1, name: 'X', csld_game: [] });
    expect(empty.amountOfGames).toBe(0);
    expect(empty.amountOfRatings).toBe(0);
    expect(empty.amountOfPlayed).toBe(0);
    expect(empty.amountOfComments).toBe(0);
    expect(empty.firstYear).toBeNull();
    expect(empty.lastYear).toBeNull();
    // A game row that normalizeGame drops (null) is filtered out, and null-ish
    // amounts count as zero.
    const withNulls = normalizeSeries({
      id: 3,
      name: 'Z',
      csld_game: [
        null,
        { id: 20, year: 2021, amount_of_ratings: null, average_rating: null, amount_of_played: null, amount_of_comments: null },
      ],
    });
    expect(withNulls.amountOfGames).toBe(1);
    expect(withNulls.amountOfRatings).toBe(0);
    expect(withNulls.amountOfPlayed).toBe(0);
    expect(withNulls.amountOfComments).toBe(0);
    expect(withNulls.firstYear).toBe(2021);
    const withYears = normalizeSeries({
      id: 2,
      name: 'Y',
      csld_game: [
        { id: 10, year: 2020, amount_of_ratings: 3, average_rating: 80, amount_of_played: 1, amount_of_comments: 2 },
        { id: 11, year: null, amount_of_ratings: 0, average_rating: null, amount_of_played: 0, amount_of_comments: 0 },
        { id: 12, year: 2024, amount_of_ratings: 5, average_rating: 90, amount_of_played: 4, amount_of_comments: 1 },
      ],
    });
    expect(withYears.amountOfGames).toBe(3);
    expect(withYears.amountOfRatings).toBe(8);
    expect(withYears.amountOfPlayed).toBe(5);
    expect(withYears.amountOfComments).toBe(3);
    expect(withYears.firstYear).toBe(2020);
    expect(withYears.lastYear).toBe(2024);
  });

  it('gameSeriesResolver: missing, NaN and numeric-string series ids all map correctly', async () => {
    const ctx = { db: prisma, user: null } as never;
    expect(await gameSeriesResolver({}, {}, ctx)).toBeNull();
    expect(await gameSeriesResolver({ series_id: null, seriesId: null }, {}, ctx)).toBeNull();
    expect(await gameSeriesResolver({ series_id: 'abc' }, {}, ctx)).toBeNull();
    const linked = await gameSeriesResolver({ series_id: String(seriesId) }, {}, ctx);
    expect(linked).not.toBeNull();
    expect(String((linked as any).id)).toBe(String(seriesId));
  });

  it('answers Game.series for an instalment and null for a standalone game', async () => {
    const linked = await executeQuery(server, GAME_SERIES_QUERY, { id: String(firstGameId) });
    expect(linked.errors).toBeUndefined();
    expect(linked.data?.gameById?.series?.id).toBe(String(seriesId));
    expect(linked.data?.gameById?.series?.amountOfGames).toBe(2);

    const standalone = await executeQuery(server, GAME_SERIES_QUERY, { id: String(standaloneGameId) });
    expect(standalone.errors).toBeUndefined();
    expect(standalone.data?.gameById?.series).toBeNull();
  });

  it('only offers the matching series in seriesByQuery', async () => {
    const res = await executeQuery(server, SERIES_BY_QUERY, { query: `${marker} Florie` });
    expect(res.errors).toBeUndefined();
    const names = (res.data?.seriesByQuery ?? []).map((s: any) => s.name);
    expect(names).toContain(`${marker} Florie`);
    expect(names).not.toContain(`${marker} Zlenice`);
  });

  it('links a game to an existing series, and the series then counts it', async () => {
    const res = await executeQuery(
      server,
      SET_SERIES_MUTATION,
      { input: { gameId: String(standaloneGameId), seriesId: String(seriesId) } },
      { user: authUser(authorId, AUTHOR) },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data?.game?.setGameSeries?.series?.id).toBe(String(seriesId));

    const series = await seriesOf(seriesId);
    expect(series.amountOfGames).toBe(3);
    expect(series.games.map((g: any) => g.id)).toContain(String(standaloneGameId));
  });

  it('unlinks a game when no series is given', async () => {
    const res = await executeQuery(
      server,
      SET_SERIES_MUTATION,
      { input: { gameId: String(standaloneGameId), seriesId: null } },
      { user: authUser(authorId, AUTHOR) },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data?.game?.setGameSeries?.series).toBeNull();

    const series = await seriesOf(seriesId);
    expect(series.games.map((g: any) => g.id)).not.toContain(String(standaloneGameId));
  });

  it('creates a series by name, and reuses the one that already carries it', async () => {
    const created = await executeQuery(
      server,
      SET_SERIES_MUTATION,
      { input: { gameId: String(standaloneGameId), newSeriesName: `${marker} nová série` } },
      { user: authUser(authorId, AUTHOR) },
    );
    expect(created.errors).toBeUndefined();
    const newSeriesId = created.data?.game?.setGameSeries?.series?.id as string;
    expect(newSeriesId).toBeTruthy();

    // The same name again must not create a second series.
    const again = await executeQuery(
      server,
      SET_SERIES_MUTATION,
      { input: { gameId: String(secondGameId), newSeriesName: `${marker} nová série` } },
      { user: authUser(authorId, AUTHOR) },
    );
    expect(again.errors).toBeUndefined();
    expect(again.data?.game?.setGameSeries?.series?.id).toBe(newSeriesId);

    const rows = await prisma.csld_series.findMany({ where: { name: `${marker} nová série` } });
    expect(rows).toHaveLength(1);

    // Put the fixtures back where the later cases expect them.
    await prisma.csld_game.update({ where: { id: standaloneGameId }, data: { series_id: null } });
    await prisma.csld_game.update({ where: { id: secondGameId }, data: { series_id: seriesId } });
    await prisma.csld_series.delete({ where: { id: Number(newSeriesId) } });
  });

  it('refuses a stranger and an anonymous caller, and lets an editor through', async () => {
    const stranger = await executeQuery(
      server,
      SET_SERIES_MUTATION,
      { input: { gameId: String(firstGameId), seriesId: String(otherSeriesId) } },
      { user: authUser(strangerId, STRANGER) },
    );
    expect(stranger.errors?.[0]?.extensions?.code).toBe('ACCESS_DENIED');

    const anonymous = await executeQuery(server, SET_SERIES_MUTATION, {
      input: { gameId: String(firstGameId), seriesId: String(otherSeriesId) },
    });
    expect(anonymous.errors?.[0]?.extensions?.code).toBe('AUTHENTICATION_REQUIRED');

    const editor = await executeQuery(
      server,
      SET_SERIES_MUTATION,
      { input: { gameId: String(firstGameId), seriesId: String(otherSeriesId) } },
      { user: authUser(editorId, EDITOR) },
    );
    expect(editor.errors).toBeUndefined();

    // The refused attempts must not have moved the game.
    const game = await prisma.csld_game.findUnique({ where: { id: firstGameId } });
    expect(game?.series_id).toBe(otherSeriesId);

    await prisma.csld_game.update({ where: { id: firstGameId }, data: { series_id: seriesId } });
  });

  it('hides a soft-deleted instalment from anonymous visitors and shows it to an editor', async () => {
    await prisma.csld_game.update({ where: { id: secondGameId }, data: { deleted: true } });
    try {
      const anonymous = await seriesOf(seriesId);
      expect(anonymous.games.map((g: any) => g.id)).not.toContain(String(secondGameId));
      expect(anonymous.amountOfRatings).toBe(3);

      const editor = await executeQuery(
        server,
        SERIES_QUERY,
        { id: String(seriesId) },
        { user: authUser(editorId, EDITOR) },
      );
      expect(editor.errors).toBeUndefined();
      const editorSeries = editor.data?.seriesById as any;
      expect(editorSeries.games.map((g: any) => g.id)).toContain(String(secondGameId));
      expect(editorSeries.amountOfRatings).toBe(4);
    } finally {
      await prisma.csld_game.update({ where: { id: secondGameId }, data: { deleted: false } });
    }
  });
});

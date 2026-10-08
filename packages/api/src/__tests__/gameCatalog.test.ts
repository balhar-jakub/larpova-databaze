import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import {
  BAYES_WEIGHT,
  bayesRating,
  buildCatalogWhere,
  catalogOrderBy,
} from '../resolvers/gameCatalog';

describe('game catalog — pure helpers', () => {
  test('always excludes deleted games', () => {
    expect(buildCatalogWhere()).toEqual({ AND: [{ deleted: false }] });
  });

  test('each required label becomes its own condition', () => {
    const where = buildCatalogWhere({ allLabels: ['1', '4'] }) as any;
    expect(where.AND).toContainEqual({ csld_game_has_label: { some: { id_label: 1 } } });
    expect(where.AND).toContainEqual({ csld_game_has_label: { some: { id_label: 4 } } });
  });

  test('labels that are not ids are ignored', () => {
    const where = buildCatalogWhere({ allLabels: ['abc', '', '7'] }) as any;
    const labelConditions = where.AND.filter((c: any) => c.csld_game_has_label);
    expect(labelConditions).toEqual([{ csld_game_has_label: { some: { id_label: 7 } } }]);
  });

  test('label conditions can be skipped for facet counting', () => {
    const where = buildCatalogWhere({ allLabels: ['1'], yearFrom: 2000 }, { skipLabels: true }) as any;
    expect(where.AND).toEqual([{ deleted: false }, { year: { gte: 2000 } }]);
  });

  test('an author filter selects the games of that author', () => {
    const where = buildCatalogWhere({ authorIds: ['12'] }) as any;
    expect(where.AND).toContainEqual({
      csld_game_has_author: { some: { id_user: { in: [12] } } },
    });
  });

  test('author ids that are not ids are ignored', () => {
    const where = buildCatalogWhere({ authorIds: ['abc', '', 'x1'] }) as any;
    expect(where.AND.filter((c: any) => c.csld_game_has_author)).toEqual([]);
  });

  test('the author and the text filter stack', () => {
    const where = buildCatalogWhere({ authorIds: ['3'], query: 'neco' }, {}, [7, 8]) as any;
    expect(where.AND).toContainEqual({ id: { in: [7, 8] } });
    expect(where.AND).toContainEqual({
      csld_game_has_author: { some: { id_user: { in: [3] } } },
    });
  });

  test('duration buckets are mutually exclusive ranges', () => {
    const where = buildCatalogWhere({ durations: ['short', 'long'] }) as any;
    const durations = where.AND.find((c: any) => c.OR);
    expect(durations.OR).toHaveLength(2);
    expect(JSON.stringify(durations.OR[1])).toContain('"gte":4');
  });

  test('rating filters map to average and count', () => {
    const where = buildCatalogWhere({ minRating: 80, minRatings: 5 }) as any;
    expect(where.AND).toContainEqual({ average_rating: { gte: 80 } });
    expect(where.AND).toContainEqual({ amount_of_ratings: { gte: 5 } });
  });

  test('recommendation is a weighted average that pulls down a single rating', () => {
    const oneRating = bayesRating(100, 1, 76);
    const rated = bayesRating(100, 200, 76);
    expect(oneRating).toBeLessThan(rated);
    expect(rated).toBeCloseTo((100 * 200 + 76 * BAYES_WEIGHT) / (200 + BAYES_WEIGHT), 6);
    expect(oneRating).toBeGreaterThan(76);
    // A game without ratings lands exactly on the prior.
    expect(bayesRating(null, 0, 76)).toBe(76);
    expect(bayesRating(null, null, 76)).toBe(76);
    expect(BAYES_WEIGHT).toBeGreaterThan(1);
  });

  test('unrated games sort behind rated ones in every column-based order', () => {
    ['Best', 'MostPlayed', 'MostCommented', 'NameAsc'].forEach((order) => {
      const first = catalogOrderBy(order as any)[0] as any;
      const field = Object.keys(first)[0];
      if (field === 'name') return;
      expect(first[field].nulls).toBe('last');
      expect(first[field].sort).toBe('desc');
    });
  });
});

describe('game catalog — against the database', () => {
  let server: ApolloServer;
  const marker = `KatalogTest${Date.now()}`;
  let userId: number;
  let labelId: number;
  let ratedGameId: number;
  let unratedGameId: number;

  beforeAll(async () => {
    server = createTestServer();

    const user = await prisma.csld_csld_user.create({
      data: {
        password: 'x',
        role: 1,
        name: marker,
        email: `${marker}@integration.test`,
      },
    });
    userId = user.id;

    const label = await prisma.csld_label.create({
      data: { name: marker, is_required: false, is_authorized: true, added_by: userId },
    });
    labelId = label.id;

    // A game with no ratings at all: total_rating and average_rating are NULL
    // in the database even though the schema declares them non-nullable.
    const unrated = await prisma.csld_game.create({
      data: {
        name: `${marker} nehodnocená`,
        deleted: false,
        year: 2024,
        players: 30,
        amount_of_ratings: 0,
        amount_of_comments: 0,
        total_rating: null,
        average_rating: null,
      },
    });
    unratedGameId = unrated.id;

    const rated = await prisma.csld_game.create({
      data: {
        name: `${marker} hodnocená`,
        deleted: false,
        year: 2025,
        players: 40,
        amount_of_ratings: 20,
        amount_of_comments: 3,
        total_rating: 1800,
        average_rating: 90,
      },
    });
    ratedGameId = rated.id;

    await prisma.csld_game_has_label.create({ data: { id_label: labelId, id_game: ratedGameId } });
  });

  afterAll(async () => {
    await prisma.csld_game_has_label.deleteMany({ where: { id_game: { in: [ratedGameId, unratedGameId] } } });
    await prisma.csld_game.deleteMany({ where: { id: { in: [ratedGameId, unratedGameId] } } });
    await prisma.csld_label.deleteMany({ where: { id: labelId } });
    await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('a game without ratings no longer breaks the query', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) {
         games { catalog(filter: { query: $q }, order: NameAsc) { totalAmount games { id name totalRating averageRating amountOfRatings } } }
       }`,
      { q: marker },
    );

    expect(result.errors).toBeUndefined();
    const games = (result.data as any).games.catalog.games;
    expect(games).toHaveLength(2);
    games.forEach((game: any) => {
      expect(game.totalRating).not.toBeNull();
      expect(game.averageRating).not.toBeNull();
    });
  });

  test('search keeps working for games without ratings', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) { games { byQueryWithTotal(query: $q) { totalAmount games { id totalRating } } } }`,
      { q: marker },
    );

    expect(result.errors).toBeUndefined();
    expect((result.data as any).games.byQueryWithTotal.totalAmount).toBe(2);
  });

  test('the best ladder ranks a rated game above an unrated one', async () => {
    // One big page, so both fixtures are in it whatever else the database holds.
    const result = await executeQuery(
      server,
      `{ games { ladder(ladderType: Best, offset: 0, limit: 1000) { games { id } } } }`,
    );

    expect(result.errors).toBeUndefined();
    const ids = (result.data as any).games.ladder.games.map((game: any) => Number(game.id));
    expect(ids).toContain(ratedGameId);
    expect(ids).toContain(unratedGameId);
    expect(ids.indexOf(ratedGameId)).toBeLessThan(ids.indexOf(unratedGameId));
  });

  test('the recommended order prefers the rated game', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) {
         games { catalog(filter: { query: $q }, order: Recommended) { games { id name } } }
       }`,
      { q: marker },
    );

    expect(result.errors).toBeUndefined();
    const ids = (result.data as any).games.catalog.games.map((game: any) => Number(game.id));
    expect(ids[0]).toBe(ratedGameId);
  });

  test('label filters and facets agree', async () => {
    const result = await executeQuery(
      server,
      `query ($label: ID!) {
         games {
           catalog(filter: { allLabels: [$label] }) {
             totalAmount
             games { id }
             facets { labels { id name count isRequired } durations { key count } yearMin yearMax }
           }
         }
       }`,
      { label: String(labelId) },
    );

    expect(result.errors).toBeUndefined();
    const catalog = (result.data as any).games.catalog;
    expect(catalog.games.map((game: any) => Number(game.id))).toEqual([ratedGameId]);

    const facet = catalog.facets.labels.find((entry: any) => entry.id === String(labelId));
    expect(facet).toBeDefined();
    expect(facet.name).toBe(marker);
    expect(facet.count).toBe(1);

    expect(catalog.facets.durations.map((entry: any) => entry.key)).toEqual(['short', 'day', 'weekend', 'long']);
    expect(catalog.facets.yearMin).toBeGreaterThan(1900);
  });

  test('duration and players filters narrow the result', async () => {
    const result = await executeQuery(
      server,
      `query ($q: String!) {
         games { catalog(filter: { query: $q, playersFrom: 35 }) { totalAmount games { id } } }
       }`,
      { q: marker },
    );

    expect(result.errors).toBeUndefined();
    const catalog = (result.data as any).games.catalog;
    expect(catalog.totalAmount).toBe(1);
    expect(Number(catalog.games[0].id)).toBe(ratedGameId);
  });

  test('pagination walks the filtered set', async () => {
    const first = await executeQuery(
      server,
      `query ($q: String!) { games { catalog(filter: { query: $q }, order: NameAsc, offset: 0, limit: 1) { totalAmount games { id name } } } }`,
      { q: marker },
    );
    const second = await executeQuery(
      server,
      `query ($q: String!) { games { catalog(filter: { query: $q }, order: NameAsc, offset: 1, limit: 1) { games { id name } } } }`,
      { q: marker },
    );

    expect((first.data as any).games.catalog.totalAmount).toBe(2);
    expect((second.data as any).games.catalog.games).toHaveLength(1);
    expect((first.data as any).games.catalog.games[0].id).not.toBe(
      (second.data as any).games.catalog.games[0].id,
    );
  });
});

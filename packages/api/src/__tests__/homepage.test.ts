import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { commentAsText, decodeHtmlEntities } from '../resolvers/textUtils';

const __dirname = dirname(fileURLToPath(import.meta.url));
const marker = `hermes-home-${Date.now()}`;

/**
 * The comment bodies were imported from the legacy site, so they are full of
 * entities: the live database holds `&iacute;` in 55 145 rows and `&nbsp;` in
 * 4 844. The homepage used to render them verbatim ("Blackhillu&nbsp;."), which
 * is what these tests pin down.
 */
describe('comment text — entities and tags', () => {
  test('the entities the database actually contains are decoded', () => {
    expect(decodeHtmlEntities('Blackhillu&nbsp;.')).toBe('Blackhillu .');
    expect(decodeHtmlEntities('Kd&yacute;s &iacute; jin&aacute;')).toBe('Kdýs í jiná');
    expect(decodeHtmlEntities('&scaron;kola &ccaron;esk&aacute;')).toBe('škola česká');
    expect(decodeHtmlEntities('&#283; &#x11B;')).toBe('ě ě');
    expect(decodeHtmlEntities('&amp; &lt;tag&gt; &quot;text&quot;')).toBe('& <tag> "text"');
  });

  test('an entity nobody knows is left visible instead of being dropped', () => {
    expect(decodeHtmlEntities('&neznama; entita')).toBe('&neznama; entita');
  });

  test('a comment is stripped, decoded and collapsed into one line', () => {
    expect(commentAsText('<p>Ahoj&nbsp;sv&#283;te,<br />\n dnes&iacute; je   hezky</p>')).toBe(
      'Ahoj světe, dnesí je hezky',
    );
    expect(commentAsText('<a href="x">odkaz</a>')).toBe('odkaz');
  });

  test('an empty comment stays null, so the field means "no text"', () => {
    expect(commentAsText(null)).toBeNull();
    expect(commentAsText('')).toBeNull();
    expect(commentAsText('<p></p>')).toBeNull();
  });
});

/**
 * The blocks the anonymous visitor gets. Every case builds its own rows: the
 * suite runs against a seeded development database and against an empty CI one
 * (a postgres service container with the schema pushed), so an assertion may
 * only rely on the fixtures it created — the fixture games carry the highest
 * averages in either database, which makes the "best rated" page deterministic.
 */
describe('homepage — the anonymous blocks', () => {
  let server: ApolloServer;
  let userId: number;
  let labelId: number;
  let emptyLabelId: number;
  let eventId: number;
  /** The twelve fixture games, best first. */
  const rankedGameIds: number[] = [];
  let excludedFewRatingsId: number;
  let excludedNoAverageId: number;
  /** The fixture comments, newest first ("Komentář 4" is the newest). */
  const commentIds: number[] = [];

  beforeAll(async () => {
    server = createTestServer();

    const user = await prisma.csld_csld_user.create({
      data: {
        password: 'x',
        role: 1,
        name: `${marker} uživatel`,
        email: `${marker}@integration.test`,
      },
    });
    userId = user.id;

    // Twelve games with the highest averages in the database (100 → 94.5) and a
    // falling number of ratings: the top six of the block are then these, in
    // this order, whatever else the database holds.
    for (let index = 0; index < 12; index += 1) {
      const game = await prisma.csld_game.create({
        data: {
          name: `${marker} hra ${index}`,
          description: 'x',
          deleted: false,
          added_by: userId,
          average_rating: 100 - index * 0.5,
          amount_of_ratings: 20 - index,
          total_rating: (100 - index * 0.5) * (20 - index),
        },
      });
      rankedGameIds.push(game.id);
    }

    // Two games that must never appear: one with a single opinion (below the
    // five-rating gate) and one with no average at all — the very rows the old
    // block put in front, because PostgreSQL sorts NULLs first for DESC.
    const fewRatings = await prisma.csld_game.create({
      data: {
        name: `${marker} dva hlasy`,
        description: 'x',
        deleted: false,
        added_by: userId,
        average_rating: 100,
        amount_of_ratings: 2,
        total_rating: 200,
      },
    });
    excludedFewRatingsId = fewRatings.id;

    const noAverage = await prisma.csld_game.create({
      data: {
        name: `${marker} bez průměru`,
        description: 'x',
        deleted: false,
        added_by: userId,
        average_rating: null,
        amount_of_ratings: 10,
        total_rating: 99999,
      },
    });
    excludedNoAverageId = noAverage.id;

    const label = await prisma.csld_label.create({
      data: { name: `${marker} štítek`, is_authorized: true, is_required: false, added_by: userId },
    });
    labelId = label.id;
    await prisma.csld_game_has_label.createMany({
      data: rankedGameIds.map((id) => ({ id_game: id, id_label: labelId })),
    });

    // An authorized label nobody uses: the catalog's facet row lists it, the
    // homepage tiles must not.
    const emptyLabel = await prisma.csld_label.create({
      data: { name: `${marker} nepoužitý štítek`, is_authorized: true, is_required: false, added_by: userId },
    });
    emptyLabelId = emptyLabel.id;

    const event = await prisma.event.create({
      data: {
        name: `${marker} akce`,
        deleted: false,
        from: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
      },
    });
    eventId = event.id;

    // Four comments, stamped in the future so they are the newest in the
    // database — the block's own three are then the first three of these.
    for (let index = 4; index >= 1; index -= 1) {
      const comment = await prisma.csld_comment.create({
        data: {
          game_id: rankedGameIds[0],
          user_id: userId,
          comment: `Komentář ${index} na Blackhillu&nbsp;.&iacute;`,
          is_hidden: false,
          amount_of_upvotes: 0,
          added: new Date(Date.now() + index * 60_000),
        },
      });
      commentIds.push(comment.id);
    }
  });

  afterAll(async () => {
    await prisma.csld_comment.deleteMany({ where: { id: { in: commentIds } } });
    await prisma.csld_game_has_label.deleteMany({ where: { id_label: labelId } });
    await prisma.csld_label.deleteMany({ where: { id: { in: [labelId, emptyLabelId] } } });
    await prisma.event.deleteMany({ where: { id: eventId } });
    await prisma.csld_game.deleteMany({
      where: { id: { in: [...rankedGameIds, excludedFewRatingsId, excludedNoAverageId] } },
    });
    await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('the best rated block starts at five ratings and is ordered best first', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { bestRatedGames { id name averageRating amountOfRatings } } }`,
    );

    expect(result.errors).toBeUndefined();
    const games = result.data.homepage.bestRatedGames;
    const ids = games.map((game: any) => game.id);

    expect(ids).toEqual(rankedGameIds.slice(0, 6).map(String));
    for (const game of games) {
      expect(game.amountOfRatings).toBeGreaterThanOrEqual(5);
    }

    const averages = games.map((game: any) => game.averageRating);
    expect([...averages].sort((a, b) => b - a)).toEqual(averages);

    expect(ids).not.toContain(String(excludedFewRatingsId));
    expect(ids).not.toContain(String(excludedNoAverageId));
  });

  test('the hero stats describe the whole database', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { stats { games events upcomingEvents users labels } } }`,
    );

    expect(result.errors).toBeUndefined();
    const stats = result.data.homepage.stats;

    expect(stats.games).toBeGreaterThanOrEqual(rankedGameIds.length);
    expect(stats.events).toBeGreaterThanOrEqual(1);
    expect(stats.upcomingEvents).toBeGreaterThanOrEqual(1);
    expect(stats.upcomingEvents).toBeLessThanOrEqual(stats.events);
    expect(stats.users).toBeGreaterThanOrEqual(1);
    expect(stats.labels).toBeGreaterThanOrEqual(1);
  });

  test('the label tiles fit one row and carry the counts', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { stats { games } topLabels { id name count isRequired } } }`,
    );

    expect(result.errors).toBeUndefined();
    const labels = result.data.homepage.topLabels;

    expect(labels.length).toBeLessThanOrEqual(12);

    // Required labels lead the row, the rest is by how many games carry them.
    const order = labels.map((label: any) => [Number(label.isRequired), label.count]);
    expect([...order].sort((a, b) => b[0] - a[0] || b[1] - a[1])).toEqual(order);

    for (const label of labels) {
      // A facet count above the number of games means it counted rows twice.
      expect(label.count).toBeGreaterThan(0);
      expect(label.count).toBeLessThanOrEqual(result.data.homepage.stats.games);
    }

    // A tile leading to an empty list is noise, so an unused label is not a tile.
    expect(labels.map((label: any) => label.name)).not.toContain(`${marker} nepoužitý štítek`);

    // With an empty database (CI) the fixture label is in the row and its count
    // is exact; against a seeded one it may sit below the twelve shown.
    const mine = labels.find((label: any) => label.name === `${marker} štítek`);
    if (mine) {
      expect(mine.count).toBe(rankedGameIds.length);
    }
  });

  test('the comment block holds three comments, newest first and decoded', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { lastComments { id commentAsText added } } }`,
    );

    expect(result.errors).toBeUndefined();
    const comments = result.data.homepage.lastComments;

    expect(comments).toHaveLength(3);
    expect(comments.map((comment: any) => comment.id)).toEqual(commentIds.slice(0, 3).map(String));
    expect(comments[0].commentAsText).toBe('Komentář 4 na Blackhillu .í');
    for (const comment of comments) {
      expect(comment.commentAsText).not.toMatch(/&[a-zA-Z]+;/);
    }
  });

  test('loading more comments pages through the field resolver', async () => {
    const first: any = await executeQuery(
      server,
      `{ homepage { lastComments(offset: 0, limit: 1) { id } } }`,
    );
    const second: any = await executeQuery(
      server,
      `{ homepage { lastComments(offset: 1, limit: 1) { id } } }`,
    );

    expect(first.data.homepage.lastComments[0].id).toBe(String(commentIds[0]));
    expect(second.data.homepage.lastComments[0].id).toBe(String(commentIds[1]));
  });

  test('the running tree mirrors the homepage change', () => {
    // `packages/web/server.ts` loads the second API copy, so a change that lands
    // only in packages/api never reaches a visitor.
    const mirrored = readFileSync(
      join(__dirname, '../../../web/src/api/src/resolvers/homepage.ts'),
      'utf-8',
    );
    expect(mirrored).toContain('bestRatedGames');
    expect(mirrored).not.toContain('mostPopularGames');

    const schemaCopies = [
      '../../src/schema.graphql',
      '../../../web/src/api/src/schema.graphql',
      '../../../web/src/graphql/schema.graphql',
    ];
    for (const relative of schemaCopies) {
      const schema = readFileSync(join(__dirname, relative), 'utf-8');
      expect(schema).toContain('bestRatedGames');
      expect(schema).toContain('HomepageStats');
      expect(schema).not.toContain('mostPopularGames');
    }

    const mirrorIndex = readFileSync(
      join(__dirname, '../../../web/src/api/src/resolvers/index.ts'),
      'utf-8',
    );
    expect(mirrorIndex).toContain('lastCommentsPage');
  });
});

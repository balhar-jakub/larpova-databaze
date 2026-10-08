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

describe('homepage — the anonymous blocks', () => {
  let server: ApolloServer;
  let gameId: number;
  let userId: number;
  // Newest first — the loop creates index 4 (the newest) first, so push keeps it at 0.
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

    const game = await prisma.csld_game.create({
      data: { name: `${marker} hra`, description: 'x', deleted: false, added_by: userId },
    });
    gameId = game.id;

    // Four comments; the newest three belong to the block, the fourth proves the
    // offset pages. `added` is set explicitly so the order cannot depend on the
    // clock: index 4 is the newest ("Komentář 4").
    for (let index = 4; index >= 1; index -= 1) {
      const comment = await prisma.csld_comment.create({
        data: {
          game_id: gameId,
          user_id: userId,
          comment: `Komentář ${index} na Blackhillu&nbsp;.&iacute;`,
          is_hidden: false,
          amount_of_upvotes: 0,
          added: new Date(Date.now() - (4 - index) * 60_000),
        },
      });
      commentIds.push(comment.id);
    }
  });

  afterAll(async () => {
    await prisma.csld_comment.deleteMany({ where: { id: { in: commentIds } } });
    await prisma.csld_game.deleteMany({ where: { id: gameId } });
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
    expect(games.length).toBeGreaterThan(0);

    for (const game of games) {
      expect(game.amountOfRatings).toBeGreaterThanOrEqual(5);
    }

    const averages = games.map((game: any) => game.averageRating);
    expect([...averages].sort((a, b) => b - a)).toEqual(averages);
  });

  test('the hero stats describe the whole database', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { stats { games events upcomingEvents users labels } } }`,
    );

    expect(result.errors).toBeUndefined();
    const stats = result.data.homepage.stats;

    expect(stats.games).toBeGreaterThan(0);
    expect(stats.events).toBeGreaterThan(0);
    expect(stats.users).toBeGreaterThan(0);
    expect(stats.upcomingEvents).toBeLessThanOrEqual(stats.events);
    expect(stats.labels).toBeGreaterThanOrEqual(0);
  });

  test('the label tiles fit one row and carry the counts', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { topLabels { id name count isRequired } } }`,
    );

    expect(result.errors).toBeUndefined();
    const labels = result.data.homepage.topLabels;

    expect(labels.length).toBeLessThanOrEqual(12);
    // Required labels lead the row, the rest is by how many games carry them.
    const order = labels.map((label: any) => [Number(label.isRequired), label.count]);
    expect([...order].sort((a, b) => b[0] - a[0] || b[1] - a[1])).toEqual(order);
    expect(labels.some((label: any) => label.count > 0)).toBe(true);
  });

  test('the comment block holds three comments, newest first and decoded', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { lastComments { id commentAsText added } } }`,
    );

    expect(result.errors).toBeUndefined();
    const comments = result.data.homepage.lastComments;

    expect(comments).toHaveLength(3);
    // commentIds is filled newest first: index 0 is "Komentář 4".
    expect(comments[0].id).toBe(String(commentIds[0]));
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

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { commentAsText, decodeHtmlEntities } from '../resolvers/textUtils';

const __dirname = dirname(fileURLToPath(import.meta.url));
const marker = `hermes-home-${Date.now()}`;
/** Rows the personal block's fixtures add outside its own lists. */
const commentIds: number[] = [];
const eventIds: number[] = [];

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
  const homeCommentIds: number[] = [];

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
      homeCommentIds.push(comment.id);
    }
  });

  afterAll(async () => {
    await prisma.csld_comment.deleteMany({ where: { id: { in: homeCommentIds } } });
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
    expect(comments.map((comment: any) => comment.id)).toEqual(homeCommentIds.slice(0, 3).map(String));
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

    expect(first.data.homepage.lastComments[0].id).toBe(String(homeCommentIds[0]));
    expect(second.data.homepage.lastComments[0].id).toBe(String(homeCommentIds[1]));
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


/**
 * The signed-in visitor's blocks. `executeQuery` takes the session as an
 * override, so the suite drives the resolver the way a request with a cookie
 * does — and everything the assertions read is a fixture again, because CI runs
 * against an empty database and the dev one has a single account.
 */
describe('homepage — the personal blocks', () => {
  let server: ApolloServer;
  let userId: number;
  let otherUserId: number;
  const gameIds: number[] = [];
  const labelIds: number[] = [];
  let ignoredLabelId: number;
  let wantedWithEventId: number;
  let wantedWithoutEventId: number;
  let unratedPlayedId: number;
  let ratedHighId: number;
  let authoredTopId: number;
  let authoredSecondId: number;
  let recommendedId: number;

  const marker = `hermes-my-${Date.now()}`;

  const personal = (query: string) =>
    executeQuery(server, query, undefined, { user: { id: userId, email: 'x@integration.test' } });

  beforeAll(async () => {
    server = createTestServer();

    const user = await prisma.csld_csld_user.create({
      data: { password: 'x', role: 1, name: `${marker} hráč`, email: `${marker}@integration.test` },
    });
    userId = user.id;
    const other = await prisma.csld_csld_user.create({
      data: { password: 'x', role: 1, name: `${marker} hodnotící`, email: `${marker}-2@integration.test` },
    });
    otherUserId = other.id;

    const makeGame = async (name: string, averageRating: number, amountOfRatings: number) => {
      const game = await prisma.csld_game.create({
        data: {
          name: `${marker} ${name}`,
          description: 'x',
          deleted: false,
          added_by: userId,
          average_rating: averageRating,
          amount_of_ratings: amountOfRatings,
          total_rating: averageRating * amountOfRatings,
        },
      });
      gameIds.push(game.id);
      return game;
    };

    // The visitor's own rows: three played (one of them unrated), two wanted.
    unratedPlayedId = (await makeGame('hrál bez hlasu', 60, 6)).id;
    ratedHighId = (await makeGame('hodnocený 9', 90, 9)).id;
    const ratedLow = await makeGame('hodnocený 7', 70, 7);
    wantedWithEventId = (await makeGame('chci hrát s akcí', 50, 5)).id;
    wantedWithoutEventId = (await makeGame('chci hrát bez akce', 50, 5)).id;

    await prisma.csld_rating.createMany({
      data: [
        { game_id: unratedPlayedId, user_id: userId, state: 2, rating: null, added: new Date(Date.now() - 3 * 864e5) },
        { game_id: ratedHighId, user_id: userId, state: 2, rating: 9, added: new Date(Date.now() - 2 * 864e5) },
        { game_id: ratedLow.id, user_id: userId, state: 2, rating: 7, added: new Date(Date.now() - 864e5) },
        // The oldest row of the wanted list, and the one with an event ahead.
        { game_id: wantedWithEventId, user_id: userId, state: 1, rating: null, added: new Date('2019-04-05T00:00:00Z') },
        { game_id: wantedWithoutEventId, user_id: userId, state: 1, rating: null, added: new Date('2024-06-07T00:00:00Z') },
      ],
    });

    // Two games of their own, each with a rating from somebody else.
    authoredTopId = (await makeGame('moje nejnověji hodnocená', 80, 4)).id;
    authoredSecondId = (await makeGame('moje druhá', 80, 4)).id;
    await prisma.csld_game_has_author.createMany({
      data: [
        { id_game: authoredTopId, id_user: userId },
        { id_game: authoredSecondId, id_user: userId },
      ],
    });
    await prisma.csld_rating.createMany({
      data: [
        { game_id: authoredTopId, user_id: otherUserId, state: 2, rating: 9, added: new Date(Date.now() - 3600_000) },
        { game_id: authoredSecondId, user_id: otherUserId, state: 2, rating: 6, added: new Date(Date.now() - 7200_000) },
      ],
    });

    // One comment, and one event ahead of a game they want to play.
    const comment = await prisma.csld_comment.create({
      data: { game_id: ratedHighId, user_id: userId, comment: 'Šlo to&nbsp;.', is_hidden: false, amount_of_upvotes: 0, added: new Date() },
    });
    const event = await prisma.event.create({
      data: {
        name: `${marker} akce`,
        deleted: false,
        from: new Date(Date.now() + 30 * 864e5),
        to: new Date(Date.now() + 31 * 864e5),
      },
    });
    await prisma.csld_game_has_event.create({ data: { game_id: wantedWithEventId, event_id: event.id } });
    eventIds.push(event.id);
    commentIds.push(comment.id);

    // Labels: two on the game rated 9 (the visitor's taste), one only on the
    // game rated 7 (it must not count).
    const first = await prisma.csld_label.create({
      data: { name: `${marker} opakovatelný`, is_authorized: true, is_required: false, added_by: userId },
    });
    const second = await prisma.csld_label.create({
      data: { name: `${marker} komorní`, is_authorized: true, is_required: false, added_by: userId },
    });
    const ignored = await prisma.csld_label.create({
      data: { name: `${marker} nechci`, is_authorized: true, is_required: false, added_by: userId },
    });
    labelIds.push(first.id, second.id);
    ignoredLabelId = ignored.id;
    await prisma.csld_game_has_label.createMany({
      data: [
        { id_game: ratedHighId, id_label: first.id },
        { id_game: ratedHighId, id_label: second.id },
        { id_game: ratedLow.id, id_label: ignored.id },
      ],
    });

    // What the recommendation may offer: two games above the 80 line carrying
    // the taste labels, one below it, and one the visitor already has a row for.
    recommendedId = (await makeGame('doporučená', 92, 30)).id;
    const tooLow = await makeGame('pod hranicí', 55, 30);
    const alreadyKnown = await makeGame('už ji znám', 93, 40);
    await prisma.csld_game_has_label.createMany({
      data: [
        { id_game: recommendedId, id_label: first.id },
        { id_game: tooLow.id, id_label: first.id },
        { id_game: alreadyKnown.id, id_label: second.id },
      ],
    });
    // A row of any kind is enough for the recommendation to skip the game; a
    // played one keeps the "want to play" counts of the other assertions intact.
    await prisma.csld_rating.create({
      data: { game_id: alreadyKnown.id, user_id: userId, state: 2, rating: 5, added: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.csld_comment.deleteMany({ where: { id: { in: commentIds } } });
    await prisma.csld_rating.deleteMany({ where: { game_id: { in: gameIds } } });
    await prisma.csld_game_has_label.deleteMany({ where: { id_label: { in: [...labelIds, ignoredLabelId] } } });
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: { in: gameIds } } });
    await prisma.csld_game_has_event.deleteMany({ where: { game_id: { in: gameIds } } });
    await prisma.csld_label.deleteMany({ where: { id: { in: [...labelIds, ignoredLabelId] } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.csld_game.deleteMany({ where: { id: { in: gameIds } } });
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.$disconnect();
  });

  test('an anonymous caller gets no personal blocks at all', async () => {
    const result: any = await executeQuery(server, `{ homepage { myHome { playedCount } } }`);
    expect(result.errors).toBeUndefined();
    expect(result.data.homepage.myHome).toBeNull();
  });

  test('the counts come from the visitor\'s rows, not the legacy columns', async () => {
    const result: any = await personal(
      `{ homepage { myHome { playedCount wantedCount authoredCount commentsCount hasData } } }`,
    );

    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    expect(mine.playedCount).toBe(4);
    expect(mine.wantedCount).toBe(2);
    expect(mine.authoredCount).toBe(2);
    expect(mine.commentsCount).toBe(1);
    expect(mine.hasData).toBe(true);
  });

  test('the events block holds the events of the wanted games', async () => {
    const result: any = await personal(
      `{ homepage { myHome { myEvents { id name games { id } } wantedWithoutEvent } } }`,
    );

    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    expect(mine.myEvents).toHaveLength(1);
    expect(mine.myEvents[0].games.map((game: any) => game.id)).toEqual([String(wantedWithEventId)]);
    expect(mine.wantedWithoutEvent).toBe(1);
  });

  test('"finish" offers the played game without a rating and the oldest wish', async () => {
    const result: any = await personal(
      `{ homepage { myHome { toRate { game { id } since } oldestWanted { game { id } since } } } }`,
    );

    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    expect(mine.toRate.map((row: any) => row.game.id)).toEqual([String(unratedPlayedId)]);
    expect(mine.toRate[0].since).toBeTruthy();
    expect(mine.oldestWanted.map((row: any) => row.game.id)).toEqual([
      String(wantedWithEventId),
      String(wantedWithoutEventId),
    ]);
    expect(mine.oldestWanted[0].since.startsWith('2019')).toBe(true);
  });

  test('the author block leads with the game rated most recently, without naming the voter', async () => {
    const result: any = await personal(
      `{ homepage { myHome { authored { game { id name } lastRating { rating added } } } } }`,
    );

    expect(result.errors).toBeUndefined();
    const authored = result.data.homepage.myHome.authored;
    expect(authored.map((row: any) => row.game.id)).toEqual([String(authoredTopId), String(authoredSecondId)]);
    expect(authored[0].lastRating.rating).toBe(9);
    expect(authored[0].lastRating.added).toBeTruthy();
    expect(authored[1].lastRating.rating).toBe(6);
  });

  test('the voter is not part of the schema, so nobody can ask for them', async () => {
    const result: any = await personal(
      `{ homepage { myHome { authored { lastRating { user { id name } } } } } }`,
    );

    // Field "user" does not exist on type "LastRating" — the schema itself keeps
    // the voter out, not just the homepage.
    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain('Cannot query field "user" on type "LastRating"');
  });

  test('the recommendation is built from the labels of the games rated 8 or more', async () => {
    const result: any = await personal(
      `{ homepage { myHome {
        recommendedLabels { id name count }
        recommended { id averageRating labels { id } }
      } } }`,
    );

    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    const names = mine.recommendedLabels.map((label: any) => label.name);

    expect(names).toContain(`${marker} opakovatelný`);
    expect(names).toContain(`${marker} komorní`);
    // The label of the game rated 7 is not the visitor's taste.
    expect(names).not.toContain(`${marker} nechci`);
    // The count is "in how many of my ratings it occurs", not "in how many games".
    expect(mine.recommendedLabels.find((label: any) => label.name === `${marker} opakovatelný`).count).toBe(1);

    const ids = mine.recommended.map((game: any) => game.id);
    expect(ids).toContain(String(recommendedId));
    for (const game of mine.recommended) {
      expect(game.averageRating).toBeGreaterThanOrEqual(80);
      expect(game.labels.length).toBeGreaterThan(0);
    }
    // Nothing the visitor already rated, wants or wrote comes back.
    expect(ids).not.toContain(String(unratedPlayedId));
    expect(ids).not.toContain(String(authoredTopId));
  });

  test('an account with nothing in the database says so instead of rendering empty blocks', async () => {
    const fresh = await prisma.csld_csld_user.create({
      data: { password: 'x', role: 1, name: `${marker} nový`, email: `${marker}-3@integration.test` },
    });

    const result: any = await executeQuery(
      server,
      `{ homepage { myHome { hasData playedCount wantedCount authoredCount commentsCount recommended { id } recommendedLabels { id } } } }`,
      undefined,
      { user: { id: fresh.id, email: 'x@integration.test' } },
    );

    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    expect(mine.hasData).toBe(false);
    expect(mine.playedCount + mine.wantedCount + mine.authoredCount + mine.commentsCount).toBe(0);
    expect(mine.recommended).toEqual([]);
    expect(mine.recommendedLabels).toEqual([]);

    await prisma.csld_csld_user.deleteMany({ where: { id: fresh.id } });
  });
});

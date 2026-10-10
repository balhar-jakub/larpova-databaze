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
  /** Two fixture games with recent events, newest event first. */
  let recentNewestGameId: number;
  let recentSecondGameId: number;
  let recentNewestEventId: number;
  let recentSecondEventId: number;
  /** A game with only an old event — outside the recent window, must not appear. */
  let recentOldGameId: number;
  let recentOldEventId: number;
  /** A game with no event at all — must never appear. */
  let recentNoEventGameId: number;
  /** The twelve fixture games, best first. */
  const rankedGameIds: number[] = [];
  let excludedFewRatingsId: number;
  let excludedNoAverageId: number;
  /** The fixture comments, newest first ("Komentář 4" is the newest). */
  const homeCommentIds: number[] = [];
  /** Events with an open registration, soonest first. */
  let openRegSoonestId: number;
  let openRegLaterId: number;
  /** Events that must never appear in the open-registration block. */
  let closedRegEventId: number;
  let noUrlOpenRegEventId: number;
  let pastOpenRegEventId: number;

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

    // The "recently played" block: two games with events inside the window
    // (the newest one first), one game whose only event is old, and one game
    // with no event at all.
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const recentNewest = await prisma.csld_game.create({
      data: { name: `${marker} nedávno hraná`, description: 'x', deleted: false, added_by: userId },
    });
    recentNewestGameId = recentNewest.id;
    const recentNewestEvent = await prisma.event.create({
      data: { name: `${marker} akce nedávná`, deleted: false, from: daysAgo(2), to: daysAgo(1) },
    });
    recentNewestEventId = recentNewestEvent.id;
    await prisma.csld_game_has_event.create({ data: { game_id: recentNewestGameId, event_id: recentNewestEventId } });

    const recentSecond = await prisma.csld_game.create({
      data: { name: `${marker} druhá nedávno hraná`, description: 'x', deleted: false, added_by: userId },
    });
    recentSecondGameId = recentSecond.id;
    const recentSecondEvent = await prisma.event.create({
      data: { name: `${marker} akce starší`, deleted: false, from: daysAgo(10), to: daysAgo(9) },
    });
    recentSecondEventId = recentSecondEvent.id;
    await prisma.csld_game_has_event.create({ data: { game_id: recentSecondGameId, event_id: recentSecondEventId } });

    // A game with two events: the block must show its latest one, not the older.
    const recentOlderEvent = await prisma.event.create({
      data: { name: `${marker} akce ještě starší`, deleted: false, from: daysAgo(20), to: daysAgo(19) },
    });
    await prisma.csld_game_has_event.create({ data: { game_id: recentSecondGameId, event_id: recentOlderEvent.id } });
    eventIds.push(recentOlderEvent.id);

    const recentOld = await prisma.csld_game.create({
      data: { name: `${marker} dávno hraná`, description: 'x', deleted: false, added_by: userId },
    });
    recentOldGameId = recentOld.id;
    const recentOldEvent = await prisma.event.create({
      data: { name: `${marker} akce dávná`, deleted: false, from: daysAgo(400), to: daysAgo(399) },
    });
    recentOldEventId = recentOldEvent.id;
    await prisma.csld_game_has_event.create({ data: { game_id: recentOldGameId, event_id: recentOldEventId } });

    const recentNoEvent = await prisma.csld_game.create({
      data: { name: `${marker} bez akce`, description: 'x', deleted: false, added_by: userId },
    });
    recentNoEventGameId = recentNoEvent.id;

    // The open-registration block: two events an outsider can still sign up
    // for (soonest first), and three that must stay out — a closed
    // registration, an open flag without a URL (a legacy row), and an open
    // event that already lies in the past.
    const openRegSoonest = await prisma.event.create({
      data: {
        name: `${marker} běh s přihláškami`,
        deleted: false,
        from: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
        registration_url: 'https://example.test/form',
        registration_open: true,
      },
    });
    openRegSoonestId = openRegSoonest.id;

    const openRegLater = await prisma.event.create({
      data: {
        name: `${marker} běh později`,
        deleted: false,
        from: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000),
        registration_url: 'https://example.test/form-later',
        registration_open: true,
      },
    });
    openRegLaterId = openRegLater.id;

    const closedReg = await prisma.event.create({
      data: {
        name: `${marker} uzavřená registrace`,
        deleted: false,
        from: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000),
        registration_url: 'https://example.test/form-closed',
        registration_open: false,
      },
    });
    closedRegEventId = closedReg.id;

    const noUrlOpenReg = await prisma.event.create({
      data: {
        name: `${marker} bez odkazu`,
        deleted: false,
        from: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 24 * 24 * 60 * 60 * 1000),
        registration_open: true,
      },
    });
    noUrlOpenRegEventId = noUrlOpenReg.id;

    const pastOpenReg = await prisma.event.create({
      data: {
        name: `${marker} minulá přihláška`,
        deleted: false,
        from: daysAgo(10),
        to: daysAgo(9),
        registration_url: 'https://example.test/form-past',
        registration_open: true,
      },
    });
    pastOpenRegEventId = pastOpenReg.id;

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
    await prisma.csld_game_has_event.deleteMany({
      where: { game_id: { in: [recentNewestGameId, recentSecondGameId, recentOldGameId] } },
    });
    await prisma.event.deleteMany({
      where: {
        id: {
          in: [
            eventId,
            recentNewestEventId,
            recentSecondEventId,
            recentOldEventId,
            openRegSoonestId,
            openRegLaterId,
            closedRegEventId,
            noUrlOpenRegEventId,
            pastOpenRegEventId,
            ...eventIds,
          ],
        },
      },
    });
    await prisma.csld_game.deleteMany({
      where: {
        id: {
          in: [
            ...rankedGameIds,
            excludedFewRatingsId,
            excludedNoAverageId,
            recentNewestGameId,
            recentSecondGameId,
            recentOldGameId,
            recentNoEventGameId,
          ],
        },
      },
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

  test('the "recently played" block lists games with the latest events, newest first', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { recentGames { game { id name } event { id name from to } } } }`,
    );

    expect(result.errors).toBeUndefined();
    const rows = result.data.homepage.recentGames;
    const gameIds = rows.map((row: any) => row.game.id);

    // The seeded database already holds events inside the ninety-day window,
    // so the block cannot promise the fixtures the first positions — only
    // their order relative to each other.
    const newestAt = gameIds.indexOf(String(recentNewestGameId));
    const secondAt = gameIds.indexOf(String(recentSecondGameId));
    expect(newestAt).toBeGreaterThanOrEqual(0);
    expect(secondAt).toBeGreaterThanOrEqual(0);
    expect(newestAt).toBeLessThan(secondAt);

    // The game with two events shows its latest one, not the older.
    expect(rows[newestAt].event.id).toBe(String(recentNewestEventId));
    expect(rows[secondAt].event.id).toBe(String(recentSecondEventId));
    // The old event is outside the window and the game without an event never
    // appears at all.
    expect(gameIds).not.toContain(String(recentOldGameId));
    expect(gameIds).not.toContain(String(recentNoEventGameId));
    // One row per game, even when the game has more events.
    expect(gameIds.filter((id: string) => id === String(recentSecondGameId)).length).toBe(1);
  });

  test('the open-registration block lists events an outsider can still sign up for, soonest first', async () => {
    const result: any = await executeQuery(
      server,
      `{ homepage { openRegistrationEvents { id name registrationUrl registrationOpen } } }`,
    );

    expect(result.errors).toBeUndefined();
    const events = result.data.homepage.openRegistrationEvents;
    const ids = events.map((event: any) => event.id);

    // Both fixtures are in, soonest first — but the seeded database may hold
    // its own open registrations, so only their relative order is promised.
    const soonestAt = ids.indexOf(String(openRegSoonestId));
    const laterAt = ids.indexOf(String(openRegLaterId));
    expect(soonestAt).toBeGreaterThanOrEqual(0);
    expect(laterAt).toBeGreaterThanOrEqual(0);
    expect(soonestAt).toBeLessThan(laterAt);

    // Every row is actually sign-up-able: an open registration with a link.
    for (const event of events) {
      expect(event.registrationOpen).toBe(true);
      expect(event.registrationUrl).toMatch(/^https?:\/\//);
    }

    // A closed registration, an open flag without a URL and an event that
    // already happened never appear.
    expect(ids).not.toContain(String(closedRegEventId));
    expect(ids).not.toContain(String(noUrlOpenRegEventId));
    expect(ids).not.toContain(String(pastOpenRegEventId));
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

  test('the running tree is the only tree — no mirror copies to drift', () => {
    // Phase 3 (API consolidation): packages/api is gone; the copy under
    // src/api/src is the single source the server actually runs
    // (packages/web/server.ts imports it). What remains to guard is the
    // frontend codegen schema copy — it must stay in sync with the served
    // schema or `yarn codegen` types drift from reality.
    const served = readFileSync(join(__dirname, '../../src/schema.graphql'), 'utf-8');
    const codegen = readFileSync(join(__dirname, '../../../graphql/schema.graphql'), 'utf-8');
    expect(served).toContain('bestRatedGames');
    expect(served).toContain('HomepageStats');
    expect(served).not.toContain('mostPopularGames');
    // The codegen copy must be byte-identical to the served schema.
    expect(codegen).toBe(served);
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
  let ratedLowId: number;
  let authoredTopId: number;
  let authoredSecondId: number;
  let recommendedId: number;
  let alreadyKnownId: number;

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
    ratedLowId = (await makeGame('hodnocený 7', 70, 7)).id;
    wantedWithEventId = (await makeGame('chci hrát s akcí', 50, 5)).id;
    wantedWithoutEventId = (await makeGame('chci hrát bez akce', 50, 5)).id;

    await prisma.csld_rating.createMany({
      data: [
        { game_id: unratedPlayedId, user_id: userId, state: 2, rating: null, added: new Date(Date.now() - 3 * 864e5) },
        { game_id: ratedHighId, user_id: userId, state: 2, rating: 9, added: new Date(Date.now() - 2 * 864e5) },
        { game_id: ratedLowId, user_id: userId, state: 2, rating: 7, added: new Date(Date.now() - 864e5) },
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
        { id_game: ratedLowId, id_label: ignored.id },
      ],
    });

    // What the recommendation may offer: two games above the 80 line carrying
    // the taste labels, one below it, and one the visitor already has a row for.
    recommendedId = (await makeGame('doporučená', 92, 30)).id;
    const tooLow = await makeGame('pod hranicí', 55, 30);
    alreadyKnownId = (await makeGame('už ji znám', 93, 40)).id;
    await prisma.csld_game_has_label.createMany({
      data: [
        { id_game: recommendedId, id_label: first.id },
        { id_game: tooLow.id, id_label: first.id },
        { id_game: alreadyKnownId, id_label: second.id },
      ],
    });
    // A row of any kind is enough for the recommendation to skip the game; a
    // played one keeps the "want to play" counts of the other assertions intact.
    await prisma.csld_rating.create({
      data: { game_id: alreadyKnownId, user_id: userId, state: 2, rating: 5, added: new Date() },
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

  test('"finish" also offers the rated games the visitor never reviewed', async () => {
    const result: any = await personal(
      `{ homepage { myHome { toComment { game { id name } since } } } }`,
    );

    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    const ids = mine.toComment.map((row: any) => row.game.id);
    // The game rated 9 has the visitor's comment, the one rated 7 does not —
    // and neither does the played game from the recommendation fixture: every
    // rated game without the visitor's review belongs in this half.
    expect(ids).toContain(String(ratedLowId));
    expect(ids).toContain(String(alreadyKnownId));
    expect(ids).not.toContain(String(ratedHighId));
    expect(mine.toComment[0].since).toBeTruthy();
  });

  test('the newest comments under the visitor\'s own games say who wrote them and about what', async () => {
    const comment = await prisma.csld_comment.create({
      data: {
        game_id: authoredTopId,
        user_id: otherUserId,
        comment: '<p>Hravé&nbsp;a příjemné.</p>',
        is_hidden: false,
        amount_of_upvotes: 0,
        added: new Date(Date.now() - 1800_000),
      },
    });
    commentIds.push(comment.id);

    const result: any = await personal(
      `{ homepage { myHome { authoredComments { id commentAsText added user { id name } game { id } } } } }`,
    );

    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    expect(mine.authoredComments.length).toBeGreaterThan(0);
    const newest = mine.authoredComments[0];
    // Newest first, decoded entities, the author's name, and the game it is about.
    expect(newest.game.id).toBe(String(authoredTopId));
    expect(newest.commentAsText).toBe('Hravé a příjemné.');
    expect(newest.user.name).toContain(marker);
    expect(newest.added).toBeTruthy();
    // Comments under somebody else's games are not the author's business.
    for (const row of mine.authoredComments) {
      expect([String(authoredTopId), String(authoredSecondId)]).toContain(row.game.id);
    }
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

  test('the signable recommendation offers open-registration events of taste-matching games only', async () => {
    // An event ahead with an open registration, on a game carrying the taste
    // label — and a second event on the same game (a later run) that must
    // collapse away, a closed-registration run, and an open event on a game
    // with no taste label at all. All rows are local to this test and removed
    // at the end (makeGame lives inside beforeAll and pushes into the shared
    // gameIds, which the suite-wide afterAll would leave behind mid-run).
    const signableGame = await prisma.csld_game.create({
      data: { name: `${marker} přihlásitelný`, description: 'x', deleted: false, added_by: userId, average_rating: 85, amount_of_ratings: 20, total_rating: 1700 },
    });
    const noTasteGame = await prisma.csld_game.create({
      data: { name: `${marker} bez chuti`, description: 'x', deleted: false, added_by: userId, average_rating: 85, amount_of_ratings: 20, total_rating: 1700 },
    });
    await prisma.csld_game_has_label.createMany({
      data: [
        { id_game: signableGame.id, id_label: labelIds[0] },
        // The no-taste game carries the ignored label only.
        { id_game: noTasteGame.id, id_label: ignoredLabelId },
      ],
    });

    const openEvent = await prisma.event.create({
      data: {
        name: `${marker} běh s přihláškou`,
        deleted: false,
        registration_open: true,
        registration_url: 'https://example.test/prihlaska',
        from: new Date(Date.now() + 40 * 864e5),
        to: new Date(Date.now() + 41 * 864e5),
      },
    });
    const laterRun = await prisma.event.create({
      data: {
        name: `${marker} pozdější běh`,
        deleted: false,
        registration_open: true,
        registration_url: 'https://example.test/pozdeji',
        from: new Date(Date.now() + 50 * 864e5),
        to: new Date(Date.now() + 51 * 864e5),
      },
    });
    const closedEvent = await prisma.event.create({
      data: {
        name: `${marker} zavřená přihláška`,
        deleted: false,
        registration_open: false,
        registration_url: 'https://example.test/zavreno',
        from: new Date(Date.now() + 45 * 864e5),
        to: new Date(Date.now() + 46 * 864e5),
      },
    });
    const noTasteEvent = await prisma.event.create({
      data: {
        name: `${marker} akce bez chuti`,
        deleted: false,
        registration_open: true,
        registration_url: 'https://example.test/bez-chuti',
        from: new Date(Date.now() + 42 * 864e5),
        to: new Date(Date.now() + 43 * 864e5),
      },
    });
    await prisma.csld_game_has_event.createMany({
      data: [
        { game_id: signableGame.id, event_id: openEvent.id },
        { game_id: signableGame.id, event_id: laterRun.id },
        { game_id: signableGame.id, event_id: closedEvent.id },
        { game_id: noTasteGame.id, event_id: noTasteEvent.id },
      ],
    });
    eventIds.push(openEvent.id, laterRun.id, closedEvent.id, noTasteEvent.id);
    gameIds.push(signableGame.id, noTasteGame.id);

    const result: any = await personal(
      `{ homepage { myHome { recommendedEvents { id name registrationUrl registrationOpen matchedLabels games { id } } } } }`,
    );

    expect(result.errors).toBeUndefined();
    const mine = result.data.homepage.myHome;
    expect(mine.recommendedEvents).toHaveLength(1);
    const offered = mine.recommendedEvents[0];
    // The soonest open run of the taste-matching game, with the way to sign up.
    expect(offered.id).toBe(String(openEvent.id));
    expect(offered.registrationUrl).toBe('https://example.test/prihlaska');
    expect(offered.registrationOpen).toBe(true);
    expect(offered.games.map((game: any) => game.id)).toEqual([String(signableGame.id)]);
    expect(offered.matchedLabels).toContain(`${marker} opakovatelný`);
    // The later run, the closed registration and the no-taste game stay out.

    // Cleanup: the extra fixtures are not shared with the other assertions.
    await prisma.csld_game_has_event.deleteMany({
      where: { game_id: { in: [signableGame.id, noTasteGame.id] } },
    });
    await prisma.event.deleteMany({
      where: { id: { in: [openEvent.id, laterRun.id, closedEvent.id, noTasteEvent.id] } },
    });
    await prisma.csld_game_has_label.deleteMany({
      where: { id_game: { in: [signableGame.id, noTasteGame.id] } },
    });
    await prisma.csld_game.deleteMany({
      where: { id: { in: [signableGame.id, noTasteGame.id] } },
    });
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

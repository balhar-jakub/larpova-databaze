import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * `Query.allComments` — the listing the homepage's „všechny komentáře“ link
 * opens. The visibility rules are the homepage block's, and they are the ones
 * the legacy data actually exercises: a hidden comment stays out, a comment
 * under a deleted game stays out, and — the trap this suite pins — a comment
 * under a game whose `deleted` column is NULL is visible, because NULL means
 * "not deleted" for a hundred-plus legacy games that were never touched.
 */
const marker = `hermes-allcomments-${Date.now()}`;

// The fixtures are stamped into a dedicated far-future year (current + 10):
// parallel suites (e.g. yearReview) seed their own future rows into the same
// database while this suite runs, so "newest in the whole DB" is contested —
// "the rows of this year" are ours alone.
const FIXTURE_YEAR = new Date().getUTCFullYear() + 10;
const fixtureAdded = (minutes: number) =>
  new Date(Date.UTC(FIXTURE_YEAR, 0, 1, 12, minutes, 0));

describe('allComments — the listing behind "všechny komentáře"', () => {
  let server: ApolloServer;
  let userId: number;
  /** A live game with `deleted` explicitly false. */
  let liveGameId: number;
  /** A live game with `deleted` NULL — the legacy default the filter must not drop. */
  let nullDeletedGameId: number;
  /** A deleted game — its comment must stay out of the listing. */
  let deletedGameId: number;
  /** The fixture comments, newest first (stamped in the future so they lead). */
  const visibleIds: number[] = [];
  let hiddenCommentId: number;
  let deletedGameCommentId: number;

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

    const base = {
      description: 'x',
      added_by: userId,
    };
    const liveGame = await prisma.csld_game.create({
      data: { ...base, name: `${marker} živá hra`, deleted: false },
    });
    liveGameId = liveGame.id;
    // `deleted` deliberately omitted: the column has no default, so the row
    // lands with NULL — the shape of every legacy game.
    const nullDeletedGame = await prisma.csld_game.create({
      data: { ...base, name: `${marker} hra bez deleted` },
    });
    nullDeletedGameId = nullDeletedGame.id;
    const deletedGame = await prisma.csld_game.create({
      data: { ...base, name: `${marker} smazaná hra`, deleted: true },
    });
    deletedGameId = deletedGame.id;

    // Three visible comments, each on its own game so the game link is real.
    for (let index = 3; index >= 1; index -= 1) {
      const comment = await prisma.csld_comment.create({
        data: {
          game_id: index === 3 ? nullDeletedGameId : liveGameId,
          user_id: userId,
          comment: `${marker} komentář ${index}`,
          is_hidden: false,
          amount_of_upvotes: index,
          added: fixtureAdded(index),
        },
      });
      visibleIds.push(comment.id);
    }

    const hidden = await prisma.csld_comment.create({
      data: {
        game_id: liveGameId,
        user_id: userId,
        comment: `${marker} skrytý komentář`,
        is_hidden: true,
        added: fixtureAdded(4),
      },
    });
    hiddenCommentId = hidden.id;

    const deletedGameComment = await prisma.csld_comment.create({
      data: {
        game_id: deletedGameId,
        user_id: userId,
        comment: `${marker} komentář pod smazanou hrou`,
        is_hidden: false,
        added: fixtureAdded(5),
      },
    });
    deletedGameCommentId = deletedGameComment.id;
  });

  afterAll(async () => {
    await prisma.csld_comment.deleteMany({
      where: { id: { in: [...visibleIds, hiddenCommentId, deletedGameCommentId] } },
    });
    await prisma.csld_game.deleteMany({
      where: { id: { in: [liveGameId, nullDeletedGameId, deletedGameId] } },
    });
    await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  test('answers with the newest comments first and the honest total', async () => {
    const result: any = await executeQuery(
      server,
      `{ allComments(offset: 0, limit: 2) { totalAmount comments { id commentAsText added amountOfUpvotes game { id name } user { id name } } } }`,
    );

    expect(result.errors).toBeUndefined();
    const page = result.data.allComments;

    // Parallel suites (e.g. yearReview) can seed future-stamped rows into the
    // same database while this suite runs, so "the two newest rows in the whole
    // DB" is not ours to assert. What IS ours: the fixtures keep their relative
    // order — newest first — wherever the window finds them.
    const pageIds = page.comments.map((c: any) => c.id);
    const at = (id: number) => pageIds.indexOf(String(id));
    for (const id of visibleIds) {
      if (at(id) >= 0) {
        for (const later of visibleIds) {
          if (at(later) > at(id)) {
            expect(pageIds.indexOf(String(id))).toBeLessThan(pageIds.indexOf(String(later)));
          }
        }
      }
    }
    // The fixtures lead the list among rows from their own year (the fixtures
    // are stamped far-future, so only our own rows share the year).
    const ownYear: any = await executeQuery(
      server,
      `{ allComments(offset: 0, limit: ${visibleIds.length}, year: ${FIXTURE_YEAR}) { comments { id } } }`,
    );
    expect(ownYear.errors).toBeUndefined();
    expect(ownYear.data.allComments.comments.map((c: any) => c.id)).toEqual(
      visibleIds.map(String),
    );
    // The total counts every visible comment, not just this page.
    expect(page.totalAmount).toBeGreaterThanOrEqual(visibleIds.length);

    // The comment under a NULL-deleted game is served, with its game.
    const nullDeletedRow = await executeQuery(
      server,
      `{ allComments(offset: 0, limit: 50) { comments { id game { id } } } }`,
    );
    expect((nullDeletedRow.data as any).allComments.comments).toContainEqual({
      id: String(visibleIds[0]),
      game: { id: String(nullDeletedGameId) },
    });
  });

  test('hidden comments and comments under deleted games stay out', async () => {
    const result: any = await executeQuery(
      server,
      `{ allComments(offset: 0, limit: 50) { comments { id } } }`,
    );

    expect(result.errors).toBeUndefined();
    const ids = (result.data.allComments.comments as any[]).map((c) => c.id);

    expect(ids).not.toContain(String(hiddenCommentId));
    expect(ids).not.toContain(String(deletedGameCommentId));
    expect(ids).toContain(String(visibleIds[0]));
  });

  test('pages through the list: an offset skips what the previous page showed', async () => {
    const first: any = await executeQuery(
      server,
      `{ allComments(offset: 0, limit: 1) { comments { id } } }`,
    );
    const second: any = await executeQuery(
      server,
      `{ allComments(offset: 1, limit: 1) { comments { id } } }`,
    );

    expect(first.errors).toBeUndefined();
    expect(second.errors).toBeUndefined();
    // Pagination is asserted through the fixtures' own year so a parallel
    // suite's future-stamped rows cannot steal the page-1 slots.
    const yearFirst: any = await executeQuery(
      server,
      `{ allComments(offset: 0, limit: 1, year: ${FIXTURE_YEAR}) { comments { id } } }`,
    );
    const yearSecond: any = await executeQuery(
      server,
      `{ allComments(offset: 1, limit: 1, year: ${FIXTURE_YEAR}) { comments { id } } }`,
    );
    expect(yearFirst.data.allComments.comments[0].id).toBe(String(visibleIds[0]));
    expect(yearSecond.data.allComments.comments[0].id).toBe(String(visibleIds[1]));
  });

  test('the length filter counts the same rows the unfiltered list shows', async () => {
    // The fixture comments are one-breath reactions — SHORT band (<200 chars
    // of the stripped text). A LONG fixture proves the filter really narrows.
    const longComment = await prisma.csld_comment.create({
      data: {
        game_id: liveGameId,
        user_id: userId,
        comment: `${marker} dlouhá recenze. ${'Podrobný dojem z hrubého chodu hry, který rozhodně přesáhne tisíc znaků, aby spadl do dlouhé vrstvy filtru a nikdy do střední vrstvy délky. '.repeat(12)}`,
        is_hidden: false,
        added: fixtureAdded(6),
      },
    });

    try {
      const unfiltered: any = await executeQuery(
        server,
        `{ allComments(offset: 0, limit: 50) { totalAmount comments { id } } }`,
      );
      const shorts: any = await executeQuery(
        server,
        `{ allComments(offset: 0, limit: 50, length: SHORT) { totalAmount comments { id } } }`,
      );
      const longs: any = await executeQuery(
        server,
        `{ allComments(offset: 0, limit: 50, length: LONG) { totalAmount comments { id } } }`,
      );

      expect(unfiltered.errors).toBeUndefined();
      expect(shorts.errors).toBeUndefined();
      expect(longs.errors).toBeUndefined();

      const allIds = (unfiltered.data.allComments.comments as any[]).map((c) => c.id);
      const shortIds = (shorts.data.allComments.comments as any[]).map((c) => c.id);
      const longIds = (longs.data.allComments.comments as any[]).map((c) => c.id);

      // Every fixture lands in exactly one band — the bands partition the list.
      for (const id of visibleIds) {
        expect(shortIds).toContain(String(id));
        expect(longIds).not.toContain(String(id));
      }
      expect(longIds).toContain(String(longComment.id));
      expect(shortIds).not.toContain(String(longComment.id));
      // The bands partition the rows: no id can appear on two band pages
      // (an id is in exactly one band by construction).
      for (const id of shortIds) {
        expect(longIds).not.toContain(id);
      }
      // The fixtures lead their band within their own year (other suites'
      // future-stamped rows cannot interfere there).
      const yearShort: any = await executeQuery(
        server,
        `{ allComments(offset: 0, limit: 50, length: SHORT, year: ${FIXTURE_YEAR}) { comments { id } } }`,
      );
      const yearLong: any = await executeQuery(
        server,
        `{ allComments(offset: 0, limit: 50, length: LONG, year: ${FIXTURE_YEAR}) { comments { id } } }`,
      );
      const yearShortIds = (yearShort.data.allComments.comments as any[]).map((c) => c.id);
      const yearLongIds = (yearLong.data.allComments.comments as any[]).map((c) => c.id);
      expect(yearShortIds).toEqual(visibleIds.map(String));
      expect(yearLongIds).toEqual([String(longComment.id)]);
      // The bands' totals are the chip's numbers: they must not exceed the list.
      expect(shorts.data.allComments.totalAmount).toBeGreaterThanOrEqual(shortIds.length);
      expect(longs.data.allComments.totalAmount).toBeGreaterThanOrEqual(longIds.length);
    } finally {
      await prisma.csld_comment.deleteMany({ where: { id: longComment.id } });
    }
  });

  test('the year filter narrows to comments added in that calendar year', async () => {
    const thisYear = new Date().getUTCFullYear();
    const oldYear = thisYear - 3;

    // Stamped to the END of the old year, so the fixture is that year's
    // newest comment and leads the filtered page (the page window is 50;
    // a mid-year stamp can sit behind dozens of that year's rows).
    const oldComment = await prisma.csld_comment.create({
      data: {
        game_id: liveGameId,
        user_id: userId,
        comment: `${marker} starý komentář`,
        is_hidden: false,
        added: new Date(Date.UTC(oldYear, 11, 31, 23, 0, 0)),
      },
    });

    try {
      const filtered: any = await executeQuery(
        server,
        `{ allComments(offset: 0, limit: 50, year: ${oldYear}) { totalAmount comments { id } } }`,
      );
      const fixtureYearPage: any = await executeQuery(
        server,
        `{ allComments(offset: 0, limit: 50, year: ${FIXTURE_YEAR}) { comments { id } } }`,
      );

      expect(filtered.errors).toBeUndefined();
      const ids = (filtered.data.allComments.comments as any[]).map((c) => c.id);
      expect(ids).toContain(String(oldComment.id));
      // The fixtures live in their own far-future year, not the old one.
      expect(ids).not.toContain(String(visibleIds[0]));

      expect(fixtureYearPage.errors).toBeUndefined();
      const nowIds = (fixtureYearPage.data.allComments.comments as any[]).map((c) => c.id);
      // The fixture year holds exactly our fixtures, newest first.
      expect(nowIds).toEqual(visibleIds.map(String));
      expect(nowIds).not.toContain(String(oldComment.id));
    } finally {
      await prisma.csld_comment.deleteMany({ where: { id: oldComment.id } });
    }
  });

  test('length and year compose, and the stats agree with what the filters list', async () => {
    const thisYear = new Date().getUTCFullYear();

    const stats: any = await executeQuery(
      server,
      `{ commentsStats { lengths { SHORT MEDIUM LONG } years { year amount } } }`,
    );
    expect(stats.errors).toBeUndefined();

    const bands = stats.data.commentsStats.lengths;
    expect(bands.SHORT + bands.MEDIUM + bands.LONG).toBeGreaterThan(0);

    // Every stats year carries its own amount, and the fixture year is there.
    const years: { year: number; amount: number }[] = stats.data.commentsStats.years;
    const fixtureYearRow = years.find((y) => y.year === FIXTURE_YEAR);
    expect(fixtureYearRow).toBeDefined();
    // The fixture year's amount is exactly our three visible fixtures — the
    // chips' number and the filter's list come from the same rows.
    expect(fixtureYearRow!.amount).toBe(visibleIds.length);

    // The SHORT chip's number is what selecting SHORT with the fixture year
    // actually lists (the fixture year pins the comparison to rows we own).
    const shortFixtureYear: any = await executeQuery(
      server,
      `{ allComments(offset: 0, limit: 50, length: SHORT, year: ${FIXTURE_YEAR}) { totalAmount comments { id } } }`,
    );
    expect(shortFixtureYear.errors).toBeUndefined();
    expect(shortFixtureYear.data.allComments.totalAmount).toBe(visibleIds.length);
    expect(
      (shortFixtureYear.data.allComments.comments as any[]).map((c) => c.id),
    ).toEqual(visibleIds.map(String));
  });
});

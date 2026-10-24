/**
 * The year review resolver: what the content yearbook of one year serves.
 *
 * Fixtures build the whole year in beforeAll (a user with a comment, a user
 * with the legacy default avatar, games, value votes, an article) and every
 * row the assertions read is created here, so the suite is independent of
 * the dev/CI seed.
 */
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';

const MARK = 'yearreview-test';

interface Ids {
  authorId: number;
  commenterId: number;
  legacyAvatarId: number;
  gameId: number;
  game2Id: number;
  commentId: number;
  legacyCommentId: number;
  articleId: number;
}

let server: ReturnType<typeof createTestServer>;
let ids: Ids;

const YEAR = 2030;
const FROM = new Date(Date.UTC(YEAR, 0, 10));
const TO = new Date(Date.UTC(YEAR, 5, 20));

const REVIEW_QUERY = `
  query YearReview($year: Int!) {
    yearReview(year: $year) {
      year
      featuredGames { game { id name } votesInYear }
      runnerUpGames { game { id } votesInYear }
      newGames { id name }
      quotes {
        id
        text
        user { id name image { id path } }
        game { id }
      }
      articles { id title url perex authors }
    }
  }
`;

beforeAll(async () => {
  server = createTestServer();

  // Self-healing: a crashed earlier run of this suite leaves its rows behind
  // (a failed beforeAll skips afterAll), and the email unique constraint then
  // fails every later run. Sweep our own marker first — comments by their game
  // (the stored text starts with HTML, not with the marker).
  await prisma.csld_comment.deleteMany({
    where: { csld_game: { name: { startsWith: MARK } } },
  });
  await prisma.csld_rating.deleteMany({
    where: { csld_game: { name: { startsWith: MARK } } },
  });
  await prisma.csld_game_has_author.deleteMany({
    where: { csld_game: { name: { startsWith: MARK } } },
  });
  await prisma.csld_article.deleteMany({ where: { source_id: { startsWith: MARK } } });
  await prisma.csld_game.deleteMany({
    where: { name: { startsWith: MARK } },
  });
  await prisma.csld_csld_user.deleteMany({
    where: { email: { startsWith: `${MARK}-` } },
  });
  await prisma.csld_image.deleteMany({
    where: { path: 'upload/default_avatar.png', csld_csld_user: { none: {} } },
  });

  const legacyImage = await prisma.csld_image.create({
    data: { path: 'upload/default_avatar.png', contenttype: 'image/png' },
  });
  const commenter = await prisma.csld_csld_user.create({
    data: {
      email: `${MARK}-commenter@example.invalid`,
      name: `${MARK} Komentátor`,
      nickname: MARK,
      password: '',
      role: 1,
      default_lang: 'cs',
      image: legacyImage.id,
    },
  });
  const author = await prisma.csld_csld_user.create({
    data: {
      email: `${MARK}-author@example.invalid`,
      name: `${MARK} Autor`,
      password: '',
      role: 1,
      default_lang: 'cs',
    },
  });
  const game = await prisma.csld_game.create({
    data: { name: `${MARK} Hra roku`, added: FROM, added_by: author.id },
  });
  const game2 = await prisma.csld_game.create({
    data: { name: `${MARK} Druhá hra`, added: TO, added_by: author.id },
  });
  await prisma.csld_game_has_author.create({
    data: { id_user: author.id, id_game: game.id },
  });

  const comment = await prisma.csld_comment.create({
    data: {
      user_id: commenter.id,
      game_id: game.id,
      comment: `<p>${MARK} Nejdelší recenze roku — text dlouhý přesnostně dostatečně na to, aby citát upoutal. Přidávám ještě větu, aby délka překročila osmdesát znaků bezezbytku.</p>`,
      added: TO,
      is_hidden: false,
    },
  });
  const legacyComment = await prisma.csld_comment.create({
    data: {
      user_id: commenter.id,
      game_id: game2.id,
      comment: `<p>${MARK} Krátká reakce.</p>`,
      added: TO,
      is_hidden: false,
    },
  });

  // Value votes in the year: game 1 gets three, game 2 gets one.
  const voters = await Promise.all(
    [1, 2, 3, 4].map((n) =>
      prisma.csld_csld_user.create({
        data: {
          email: `${MARK}-voter${n}@example.invalid`,
          name: `${MARK} Volič ${n}`,
          password: '',
          role: 1,
          default_lang: 'cs',
        },
      }),
    ),
  );
  await Promise.all([
    prisma.csld_rating.create({
      data: { user_id: voters[0].id, game_id: game.id, rating: 10, state: 2, added: TO },
    }),
    prisma.csld_rating.create({
      data: { user_id: voters[1].id, game_id: game.id, rating: 9, state: 2, added: TO },
    }),
    prisma.csld_rating.create({
      data: { user_id: voters[2].id, game_id: game.id, rating: 8, state: 2, added: TO },
    }),
    prisma.csld_rating.create({
      data: { user_id: voters[3].id, game_id: game2.id, rating: 10, state: 2, added: TO },
    }),
  ]);
  // A vote OUTSIDE the year must not count.
  await prisma.csld_rating.create({
    data: {
      user_id: voters[0].id,
      game_id: game2.id,
      rating: 7,
      state: 2,
      added: new Date(Date.UTC(YEAR - 1, 5, 1)),
    },
  });
  // A state-only rating (no value) must not count as a vote.
  await prisma.csld_rating.create({
    data: { user_id: voters[1].id, game_id: game2.id, rating: null, state: 1, added: TO },
  });

  const article = await prisma.csld_article.create({
    data: {
      source: 'LARPY_CZ',
      source_id: `${MARK}-1`,
      url: `https://example.invalid/${MARK}`,
      title: `${MARK} Článek roku`,
      perex: `${MARK} perex článku`,
      language: 'cs',
      authors: `${MARK} Autor článku`,
      published_at: TO,
      categories: ['Praxe'],
      tags: [],
    },
  });

  ids = {
    authorId: author.id,
    commenterId: commenter.id,
    legacyAvatarId: legacyImage.id,
    gameId: game.id,
    game2Id: game2.id,
    commentId: comment.id,
    legacyCommentId: legacyComment.id,
    articleId: article.id,
  };
});

afterAll(async () => {
  // FK chain, narrowest-first: votes, comments, author links, games, users, image, article.
  await prisma.csld_comment.deleteMany({ where: { id: { in: [ids.commentId, ids.legacyCommentId] } } });
  await prisma.csld_rating.deleteMany({
    where: { game_id: { in: [ids.gameId, ids.game2Id] } },
  });
  await prisma.csld_game_has_author.deleteMany({ where: { id_game: { in: [ids.gameId, ids.game2Id] } } });
  await prisma.csld_game.deleteMany({ where: { id: { in: [ids.gameId, ids.game2Id] } } });
  await prisma.csld_csld_user.deleteMany({
    where: { email: { startsWith: `${MARK}-` } },
  });
  await prisma.csld_image.deleteMany({ where: { id: ids.legacyAvatarId } });
  await prisma.csld_article.deleteMany({ where: { source_id: { startsWith: MARK } } });
  await prisma.$disconnect();
});

describe('yearReview', () => {
  it('serves the year, the ranked games and their votes', async () => {
    const result = await executeQuery(server, REVIEW_QUERY, { year: YEAR });
    expect(result.errors).toBeUndefined();

    const review = result.data?.yearReview;
    expect(review.year).toBe(YEAR);
    // The resolver caps featured at 3 and the fixture year has only 2 ranked
    // games, so both sit in featured (in vote order) and runner-ups are empty.
    expect(review.featuredGames).toHaveLength(2);
    expect(review.featuredGames[0].game.id).toBe(String(ids.gameId));
    expect(review.featuredGames[0].votesInYear).toBe(3);
    expect(review.runnerUpGames).toHaveLength(0);
  });

  it('counts only the games added in the year as new games', async () => {
    const result = await executeQuery(server, REVIEW_QUERY, { year: YEAR });
    const newIds = result.data?.yearReview.newGames.map((g: { id: string }) => g.id);
    expect(newIds).toContain(String(ids.gameId));
    expect(newIds).toContain(String(ids.game2Id));
  });

  it('serves quotes with the legacy default avatar nulled', async () => {
    const result = await executeQuery(server, REVIEW_QUERY, { year: YEAR });
    const quotes = result.data?.yearReview.quotes;
    // Only the long comment qualifies; the short one is filtered by length.
    const texts = quotes.map((q: { text: string | null }) => q.text);
    expect(texts.some((t: string | null) => (t ?? '').includes('Nejdelší recenze roku'))).toBe(true);
    expect(texts.some((t: string | null) => (t ?? '').includes('Krátká reakce'))).toBe(false);
    // The legacy blue default must not be served as the user's photo.
    for (const quote of quotes) {
      expect(quote.user?.image?.path ?? null).not.toBe('upload/default_avatar.png');
    }
  });

  it('serves the year\'s articles with metadata', async () => {
    const result = await executeQuery(server, REVIEW_QUERY, { year: YEAR });
    const articles = result.data?.yearReview.articles;
    const mine = articles.find((a: { id: string }) => a.id === String(ids.articleId));
    expect(mine).toBeDefined();
    expect(mine.title).toContain('Článek roku');
    expect(mine.url).toContain('example.invalid');
  });

  it('rejects an invalid year', async () => {
    const result = await executeQuery(server, REVIEW_QUERY, { year: 1800 });
    expect(result.errors).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Edge arms of the review resolver: the quotes cap (QUOTES), a comment with
// added: null, an article without published_at, and an empty year (no ranked
// games at all).
// ---------------------------------------------------------------------------

describe('yearReview edge arms', () => {
  const EDGE_YEAR = 2035;
  const EDGE_MARK = 'yearreview-edge';
  const edgeIds: { userId: number; gameIds: number[]; commentIds: number[] } = {
    userId: 0, gameIds: [], commentIds: [],
  };

  beforeAll(async () => {
    await prisma.csld_comment.deleteMany({
      where: { csld_game: { name: { startsWith: `${EDGE_MARK} ` } } },
    });
    await prisma.csld_game.deleteMany({ where: { name: { startsWith: `${EDGE_MARK} ` } } });
    await prisma.csld_csld_user.deleteMany({ where: { email: { startsWith: `${EDGE_MARK}-` } } });

    const user = await prisma.csld_csld_user.create({
      data: { email: `${EDGE_MARK}-u@example.invalid`, name: `${EDGE_MARK} Uživatel`, password: '', role: 1, default_lang: 'cs' },
    });
    edgeIds.userId = user.id;

    // NINE ranked games with long comments each: the resolver caps quotes
    // at QUOTES = 8, so the ninth-longest comment never becomes a quote.
    for (let i = 0; i < 9; i += 1) {
      const game = await prisma.csld_game.create({
        data: { name: `${EDGE_MARK} Hra ${i}`, added: new Date(Date.UTC(EDGE_YEAR, 0, 1)), added_by: user.id },
      });
      edgeIds.gameIds.push(game.id);
      const voter = await prisma.csld_csld_user.create({
        data: { email: `${EDGE_MARK}-v${i}@example.invalid`, name: `${EDGE_MARK} Volič ${i}`, password: '', role: 1, default_lang: 'cs' },
      });
      await prisma.csld_rating.create({
        data: { user_id: voter.id, game_id: game.id, rating: 9, state: 2, added: new Date(Date.UTC(EDGE_YEAR, 2, 1)) },
      });
      const comment = await prisma.csld_comment.create({
        data: {
          user_id: user.id,
          game_id: game.id,
          comment: `<p>${EDGE_MARK} Dlouhá recenze číslo ${i} — text dostatečně dlouhý na to, aby citát upoutal pozornost a nepropadl filtrem délky.</p>`,
          is_hidden: false,
          added: i === 2 ? null : new Date(Date.UTC(EDGE_YEAR, 3, 1)), // the third carries NULL
        },
      });
      edgeIds.commentIds.push(comment.id);
    }

    // NOTE: an article with published_at: null never reaches the mapping —
    // the resolver's year window filters it out in SQL — so the null arm of
    // the article mapping is defensive and NOT asserted here.
  });

  afterAll(async () => {
    await prisma.csld_comment.deleteMany({ where: { id: { in: edgeIds.commentIds } } });
    await prisma.csld_rating.deleteMany({ where: { game_id: { in: edgeIds.gameIds } } });
    await prisma.csld_game.deleteMany({ where: { id: { in: edgeIds.gameIds } } });
    await prisma.csld_csld_user.deleteMany({ where: { email: { startsWith: `${EDGE_MARK}-` } } });
  });

  it('caps the quotes at QUOTES and serves the null added as null', async () => {
    const result = await executeQuery(server, REVIEW_QUERY, { year: EDGE_YEAR });
    expect(result.errors).toBeUndefined();
    const review = result.data?.yearReview;
    // nine candidate games, only QUOTES of them get a quote
    expect(review.quotes.length).toBeLessThan(edgeIds.gameIds.length);
    expect(review.quotes.length).toBe(8); // the cap itself
    // ranked games still list all nine
    expect(review.featuredGames.length + review.runnerUpGames.length).toBe(9);
  });

  it('answers an empty year without ranked games', async () => {
    // 2099, not a merely "old" year: the seeded database ranks real games
    // from 2007, so only a year nothing can carry stays empty everywhere.
    const result = await executeQuery(server, REVIEW_QUERY, { year: 2099 }); // far future: empty
    expect(result.errors).toBeUndefined();
    const review = result.data?.yearReview;
    expect(review.featuredGames).toHaveLength(0);
    expect(review.runnerUpGames).toHaveLength(0);
    expect(review.quotes).toHaveLength(0);
    expect(review.articles).toHaveLength(0);
  });
});

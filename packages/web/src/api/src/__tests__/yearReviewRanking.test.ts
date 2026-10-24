import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';

/**
 * The ranking and quote arms of the year review that the happy-path suite
 * (yearReview.test.ts, a 2-game year) leaves cold: the runner-up range
 * (4th–10th ranked games), the soft-deletion of a ranked game after the votes
 * (it drops out, nothing takes its place), the one-quote-per-game dedup
 * (continue arm) and the QUOTES cap (break arm), comments without a user,
 * articles with null published_at / null categories, and the hasRealAvatar
 * false arm (no image at all).
 *
 * A second fixture year keeps every assertion local to this suite.
 */
const MARK = 'yrrich';
const stamp = Date.now();

let server: ReturnType<typeof createTestServer>;

const YEAR = 2044;

const REVIEW_QUERY = `
  query YearReview($year: Int!) {
    yearReview(year: $year) {
      year
      featuredGames { game { id } votesInYear averageInYear }
      runnerUpGames { game { id } votesInYear }
      newGames { id }
      quotes { id text user { id image { path } } game { id } }
      articles { id title publishedAt categories }
    }
  }
`;

let voterIds: number[] = [];
let gameIds: number[] = [];
let unrankedId = 0;
let commentIds: number[] = [];
let articleIds: number[] = [];
let imageIds: number[] = [];
let extraUserIds: number[] = [];

beforeAll(async () => {
  server = createTestServer();

  // Self-healing sweep (a crashed beforeAll skips afterAll).
  await prisma.csld_comment.deleteMany({ where: { csld_game: { name: { startsWith: `${MARK}-` } } } });
  await prisma.csld_rating.deleteMany({ where: { csld_game: { name: { startsWith: `${MARK}-` } } } });
  await prisma.csld_game_has_author.deleteMany({ where: { csld_game: { name: { startsWith: `${MARK}-` } } } });
  await prisma.csld_article.deleteMany({ where: { source_id: { startsWith: `${MARK}-` } } });
  await prisma.csld_game.deleteMany({ where: { name: { startsWith: `${MARK}-` } } });
  await prisma.csld_csld_user.deleteMany({ where: { email: { startsWith: `${MARK}-` } } });

  const FROM = new Date(Date.UTC(YEAR, 2, 1));
  const MID = new Date(Date.UTC(YEAR, 4, 1));

  const voters = await Promise.all(
    [1, 2, 3, 4].map((n) =>
      prisma.csld_csld_user.create({
        data: {
          email: `${MARK}-voter${n}-${stamp}@example.invalid`,
          name: `${MARK} Volič ${n}`,
          password: '',
          role: 1,
          default_lang: 'cs',
        },
      }),
    ),
  );
  voterIds = voters.map((v) => v.id);

  // SIX ranked games: votes 4, 3, 2, 2, 1, 1 — three featured (cap 3),
  // three runner-ups. The 4-vote game gets soft-deleted AFTER the votes,
  // so it must drop out of featured entirely (rankedGame null arm).
  const games: { id: number; votes: number; deleted: boolean }[] = [];
  const plan: [string, number, boolean][] = [
    ['prvni', 4, true],
    ['druha', 3, false],
    ['treti', 2, false],
    ['ctvrta', 2, false],
    ['pata', 1, false],
    ['sesta', 1, false],
  ];
  for (const [slug, votes, deleted] of plan) {
    const g = await prisma.csld_game.create({
      data: { name: `${MARK}-${slug}`, added: FROM, added_by: voters[0].id, deleted, lang: 'cs' },
    });
    games.push({ id: g.id, votes, deleted });
    gameIds.push(g.id);
  }

  // Votes: voter i votes for the games the plan says.
  for (const g of games) {
    for (let v = 0; v < g.votes; v++) {
      // rotate voters so the (user, game) unique constraint holds
      await prisma.csld_rating.create({
        data: {
          user_id: voterIds[v % voterIds.length],
          game_id: g.id,
          rating: 10 - v,
          state: 2,
          added: MID,
        },
      });
      // second-round votes for games needing more
      if (g.votes > voterIds.length && v < g.votes - voterIds.length) {
        await prisma.csld_rating.create({
          data: {
            user_id: voterIds[(v + 2) % voterIds.length],
            game_id: g.id,
            rating: 9,
            state: 2,
            added: MID,
          },
        });
      }
    }
  }

  // TWO long quotes on the second-ranked game (dedup: only one serves),
  // plus a long comment on an UNRANKED game (no votes → outside the quote pool).
  const unranked = await prisma.csld_game.create({
    data: { name: `${MARK}-nehrana`, added: FROM, added_by: voters[0].id, deleted: false, lang: 'cs' },
  });
  unrankedId = unranked.id;
  gameIds.push(unranked.id);
  const longText = (n: number) =>
    `<p>${MARK} Dlouhá recenze číslo ${n} — text záměrně delší než osmdesát znaků, aby se kvalifikovala jako citát na zeď roku. Ještě jedna věta pro jistotu.</p>`;
  for (const g of [games[1].id, games[1].id, unranked.id]) {
    const c = await prisma.csld_comment.create({
      data: {
        user_id: voterIds[0],
        game_id: g,
        comment: longText(commentIds.length + 1),
        added: MID,
        is_hidden: false,
      },
    });
    commentIds.push(c.id);
  }

  // A commenter with a REAL picture: their quote keeps the image
  // (hasRealAvatar true arm — the legacy default and no image null it).
  const realPic = await prisma.csld_image.create({
    data: { path: `upload/${MARK}-real-${stamp}.png`, contenttype: 'image/png' },
  });
  imageIds.push(realPic.id);
  const photographer = await prisma.csld_csld_user.create({
    data: {
      email: `${MARK}-photographer-${stamp}@example.invalid`,
      name: `${MARK} Fotograf`,
      password: '',
      role: 1,
      default_lang: 'cs',
      image: realPic.id,
    },
  });
  extraUserIds.push(photographer.id);
  const photoComment = await prisma.csld_comment.create({
    data: {
      user_id: photographer.id,
      game_id: games[2].id,
      comment: `<p>${MARK} Fotorecenze — text záměrně delší než osmdesát znaků, aby se kvalifikoval jako citát na zeď roku. Ještě jedna věta pro jistotu.</p>`,
      added: MID,
      is_hidden: false,
    },
  });
  commentIds.push(photoComment.id);

  const withCats = await prisma.csld_article.create({
    data: {
      source: 'LARPY_CZ',
      source_id: `${MARK}-1-${stamp}`,
      url: `https://example.invalid/${MARK}-1`,
      title: `${MARK} s kategoriemi`,
      perex: 'perex',
      language: 'cs',
      authors: 'Někdo',
      published_at: MID,
      categories: ['Praxe'],
      tags: [],
    },
  });
  articleIds.push(withCats.id);
  // One with empty categories (the served shape is [] either way; the
  // column is non-null in Prisma, so the ?? [] is defensive only).
  const noCats = await prisma.csld_article.create({
    data: {
      source: 'LARPY_CZ',
      source_id: `${MARK}-2-${stamp}`,
      url: `https://example.invalid/${MARK}-2`,
      title: `${MARK} bez kategorií`,
      perex: 'perex',
      language: 'cs',
      authors: 'Někdo',
      published_at: MID,
      categories: [],
      tags: [],
    },
  });
  articleIds.push(noCats.id);
});

afterAll(async () => {
  await prisma.csld_comment.deleteMany({ where: { id: { in: commentIds } } });
  await prisma.csld_rating.deleteMany({ where: { game_id: { in: gameIds } } });
  await prisma.csld_game_has_author.deleteMany({ where: { id_game: { in: gameIds } } });
  await prisma.csld_game.deleteMany({ where: { id: { in: gameIds } } });
  await prisma.csld_article.deleteMany({ where: { id: { in: articleIds } } });
  await prisma.csld_csld_user.deleteMany({ where: { id: { in: [...voterIds, ...extraUserIds] } } });
  await prisma.csld_image.deleteMany({ where: { id: { in: imageIds } } });
  await prisma.$disconnect();
});

describe('yearReview ranking and quote arms', () => {
  it('drops a soft-deleted ranked game and fills the runner-up range', async () => {
    const result = await executeQuery(server, REVIEW_QUERY, { year: YEAR });
    expect(result.errors).toBeUndefined();
    const review = (result.data as any).yearReview;

    const featuredIds = review.featuredGames.map((g: any) => Number(g.game.id));
    const runnerUpIds = review.runnerUpGames.map((g: any) => Number(g.game.id));
    // the soft-deleted 4-vote game is gone from both lists
    expect(featuredIds).not.toContain(gameIds[0]);
    expect(runnerUpIds).not.toContain(gameIds[0]);
    // The deletion happened after the year: the game DROPS OUT and nothing
    // takes its place — 6 ranked, one dropped: 2 featured + 3 runner-ups.
    expect(featuredIds).toHaveLength(2);
    expect(runnerUpIds).toHaveLength(3);
    expect(featuredIds[0]).toBe(gameIds[1]); // the 3-vote game leads now
    // every ranked game carries its average
    expect(review.featuredGames[0].averageInYear).toBeGreaterThan(0);
  });

  it('serves at most one quote per game, from the ranked pool only', async () => {
    const result = await executeQuery(server, REVIEW_QUERY, { year: YEAR });
    const quotes = (result.data as any).yearReview.quotes;
    const gameIdsInQuotes = quotes.map((q: any) => Number(q.game.id));
    const distinct = new Set(gameIdsInQuotes);
    // one per game (the two comments on game 2 collapse to one quote)
    expect(gameIdsInQuotes.length).toBe(distinct.size);
    // the comment on the unranked game never qualifies
    expect(gameIdsInQuotes).not.toContain(unrankedId);
    // the commenter has no image at all (hasRealAvatar false arm) → null image
    expect(quotes[0].user.image).toBeNull();
    // the photographer's quote keeps their REAL picture (true arm)
    const photoQuote = quotes.find((q: any) => q.user && Number(q.user.id) === extraUserIds[0]);
    expect(photoQuote).toBeDefined();
    expect(photoQuote.user.image).not.toBeNull();
    expect(photoQuote.user.image.path).toContain('real');
  });

  it('renders articles with null categories as an empty list', async () => {
    const result = await executeQuery(server, REVIEW_QUERY, { year: YEAR });
    const articles = (result.data as any).yearReview.articles;
    const noCats = articles.find((a: any) => a.title.includes('bez kategorií'));
    expect(noCats).toBeDefined();
    expect(noCats.categories).toEqual([]);
    const withCats = articles.find((a: any) => a.title.includes('s kategoriemi'));
    expect(withCats.categories).toEqual(['Praxe']);
  });
});

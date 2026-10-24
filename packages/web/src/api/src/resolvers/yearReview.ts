import type { Context } from '../context.js';
import type { Prisma } from '@prisma/client';
import { normalizeGame, normalizeUserRef } from './mappers.js';
import { commentAsText } from './textUtils.js';

/**
 * The year review (`query { yearReview(year: 2025) }`): the content yearbook
 * of larpovadatabaze.cz — the games the community talked about, the reviews
 * written under them, the games added to the catalog and the articles the
 * Czech larp scene published, all in one round trip for one calendar year.
 *
 * Shape decisions mirror the statistics resolver: aggregation runs in JS
 * because the tables are small and Prisma cannot group by a date's year.
 * Honesty rules (value votes only, hidden comments, soft-deleted games) live
 * HERE, not in the UI.
 */

/** Featured games: how many of the most-discussed games get a big card. */
const FEATURED_GAMES = 3;

/** Runner-up games: the rest of the top list, small rows with a cover. */
const RUNNER_UP_GAMES = 7;

/** A comment must have this many plain-text characters to qualify as a quote. */
const QUOTE_MIN_LENGTH = 80;

/** How many quote cards the review shows. */
const QUOTES = 8;

/** Articles: how many the review lists. */
const ARTICLES = 6;

/** A comment row with everything the quote card renders. */
const COMMENT_INCLUDE = {
  csld_csld_user: { include: { csld_image: true } },
  csld_game: true,
} as const;

/** A game row with everything the year review cards render. */
const GAME_INCLUDE = {
  csld_game_has_label: { include: { csld_label: true } },
  csld_game_has_author: {
    include: { csld_csld_user: { include: { csld_image: true } } },
  },
  csld_image_csld_game_cover_imageTocsld_image: true,
} as const;

/**
 * The old CSLD had a default avatar uploaded as a user picture
 * (`upload/default_avatar.png` — a flat blue silhouette). It is not a photo
 * of the person; serving it as their profile image reads as a bug, so the
 * review nulls it and the UI falls back to the current grey default.
 */
const LEGACY_DEFAULT_AVATAR_PATHS = new Set(['upload/default_avatar.png']);

/** True when the user's image is a real picture, not the legacy default. */
function hasRealAvatar(
  user: { csld_image?: { path: string | null } | null } | null | undefined,
): boolean {
  const path = user?.csld_image?.path;
  if (!path) return false;
  return !LEGACY_DEFAULT_AVATAR_PATHS.has(path);
}

/** Maps a raw comment row to the GraphQL `YearReviewQuote` shape. */
function mapQuote(row: {
  id: number;
  added: Date | null;
  comment: string;
  csld_csld_user: unknown;
  csld_game: unknown;
}) {
  const user = normalizeUserRef(row.csld_csld_user as never);
  return {
    id: row.id,
    text: commentAsText(row.comment),
    added: row.added?.toISOString() ?? null,
    user: hasRealAvatar(row.csld_csld_user as never)
      ? user
      : { ...(user ?? {}), image: null },
    game: normalizeGame(row.csld_game as never),
  };
}

export async function yearReviewResolver(
  _parent: unknown,
  args: { year: number },
  ctx: Context,
) {
  const year = args.year;
  if (!Number.isInteger(year) || year < 2006 || year > 2100) {
    throw new Error(`Neplatný rok: ${year}`);
  }
  const from = new Date(Date.UTC(year, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  // `deleted` is NULL on 110 legacy games (and on every Prisma-created row:
  // the column has no default), so the catalog's `deleted: false` would drop
  // exactly the games nothing ever touched. NULL means "not deleted".
  const live: Prisma.csld_gameWhereInput = { OR: [{ deleted: false }, { deleted: null }] };

  // Value votes of the year: which games the community judged. A "played"
  // state without a number is activity, but it is not a judgement, so the
  // ranking sees votes only (the same rule as the statistics page).
  const ratingRows = await ctx.db.csld_rating.findMany({
    where: { added: { gte: from, lt: to }, rating: { not: null } },
    select: { game_id: true, rating: true },
  });
  const votesByGame = new Map<number, { votes: number; sum: number }>();
  for (const row of ratingRows) {
    const entry = votesByGame.get(row.game_id) ?? { votes: 0, sum: 0 };
    entry.votes += 1;
    entry.sum += row.rating!;
    votesByGame.set(row.game_id, entry);
  }

  const [commentRows, newGameRows, articleRows] = await Promise.all([
    ctx.db.csld_comment.findMany({
      where: { added: { gte: from, lt: to }, is_hidden: false },
      include: COMMENT_INCLUDE,
      orderBy: { added: 'asc' },
    }),
    ctx.db.csld_game.findMany({
      where: { added: { gte: from, lt: to }, ...live },
      include: GAME_INCLUDE,
      orderBy: { added: 'asc' },
    }),
    ctx.db.csld_article.findMany({
      where: { published_at: { gte: from, lt: to }, language: 'cs' },
      orderBy: { published_at: 'desc' },
      take: ARTICLES,
    }),
  ]);

  // The ranking: votes received in the year, tie-broken by the comment count
  // of the year — how much discussion the game drove.
  const commentsByGame = new Map<number, number>();
  for (const row of commentRows) {
    commentsByGame.set(row.game_id, (commentsByGame.get(row.game_id) ?? 0) + 1);
  }
  const ranking = Array.from(votesByGame.keys())
    .map((id) => ({ id, votes: votesByGame.get(id)!.votes, comments: commentsByGame.get(id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes || b.comments - a.comments);

  const featuredIds = ranking.slice(0, FEATURED_GAMES).map((r) => r.id);
  const runnerUpIds = ranking.slice(FEATURED_GAMES, FEATURED_GAMES + RUNNER_UP_GAMES).map((r) => r.id);

  // Quotes: the most substantial comments of the year, one per game so no
  // single game fills the wall. Only comments under the year's talked-about
  // games qualify — a quote is here because its game mattered this year.
  const quoteGamePool = new Set([...featuredIds, ...runnerUpIds]);
  const quoteCandidates = commentRows
    .filter((row) => quoteGamePool.has(row.game_id))
    .map((row) => ({ row, length: commentAsText(row.comment)?.length ?? 0 }))
    .filter(({ length }) => length >= QUOTE_MIN_LENGTH)
    .sort((a, b) => b.length - a.length);
  const seenQuoteGames = new Set<number>();
  const quoteRows: typeof commentRows = [];
  for (const { row } of quoteCandidates) {
    if (seenQuoteGames.has(row.game_id)) continue;
    seenQuoteGames.add(row.game_id);
    quoteRows.push(row);
    if (quoteRows.length >= QUOTES) break;
  }

  // The ranked games need full rows (cover, labels, authors with avatars).
  const rankedIds = [...featuredIds, ...runnerUpIds];
  const rankedRows = rankedIds.length
    ? await ctx.db.csld_game.findMany({
        where: { id: { in: rankedIds }, ...live },
        include: GAME_INCLUDE,
      })
    : [];
  const gameById = new Map(rankedRows.map((row) => [row.id, normalizeGame(row)]));

  const rankedGame = (id: number, votes: number) => {
    const game = gameById.get(id);
    // A soft-deleted game drops out of the ranking; nothing takes its place
    // because its deletion happened after the community's year was over.
    if (!game) return null;
    const entry = votesByGame.get(id)!;
    return { game, votesInYear: votes, averageInYear: entry.sum / entry.votes };
  };

  return {
    year,
    featuredGames: featuredIds
      .map((id) => rankedGame(id, votesByGame.get(id)!.votes))
      .filter(Boolean),
    runnerUpGames: runnerUpIds
      .map((id) => rankedGame(id, votesByGame.get(id)!.votes))
      .filter(Boolean),
    newGames: newGameRows.map((row) => normalizeGame(row)),
    quotes: quoteRows.map(mapQuote),
    articles: articleRows.map((row) => ({
      id: row.id,
      source: row.source,
      url: row.url,
      title: row.title,
      perex: row.perex,
      authors: row.authors,
      publishedAt: row.published_at?.toISOString() ?? null,
      categories: row.categories ?? [],
      imageUrl: row.image_url,
    })),
  };
}

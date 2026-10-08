import type { Context } from '../context.js';
import { normalizeGame, normalizeUserRef } from './mappers.js';
import { commentAsText } from './textUtils.js';
import { buildCatalogWhere, catalogOrderBy, labelFacets } from './gameCatalog.js';

/**
 * The anonymous homepage is a shop window, not a list: a handful of games per
 * block, the newest comments and the label tiles that lead into the catalog.
 * The logged-in variant is the web app's own business (it already reads
 * `loggedInUser`); the API hands the visitor real content instead of the
 * personal leftovers.
 */

/** Games per block. */
export const HOMEPAGE_GAMES = 6;

/**
 * Comments per block. The block used to take 6 comments and claim half of the
 * page; three are enough next to a link into the catalog.
 */
export const HOMEPAGE_COMMENTS = 3;

/** Label tiles before the "and N more" link. */
export const HOMEPAGE_LABELS = 12;

/**
 * How many ratings a game needs before it may lead the "best rated" block.
 * `total_rating`, the column the old block sorted on, is NULL for the four
 * most-visited games in the database (54154242, 40000, 237, 198 — none of them
 * has a single rating) and PostgreSQL sorts NULLs first for DESC, so the block
 * opened with four unrated games. Five ratings is where an average stops being
 * one person's opinion (`bayesRating` weights the prior 12 times heavier, but a
 * hard floor keeps a single-rating game off the first screen entirely).
 */
export const MIN_RATINGS_FOR_TOP = 5;

const GAME_INCLUDE = { csld_game_has_label: { include: { csld_label: true } } };

const COMMENT_INCLUDE = {
  csld_game: true,
  csld_csld_user: { include: { csld_image: true } },
};

/** One page of comments, in the shape the block renders (shared with "load more"). */
export async function lastCommentsPage(
  ctx: Context,
  args: { offset?: number; limit?: number } = {},
) {
  const offset = Math.max(0, args.offset ?? 0);
  const limit = Math.min(Math.max(1, args.limit ?? HOMEPAGE_COMMENTS), 50);
  const comments = await ctx.db.csld_comment.findMany({
    where: { is_hidden: false, csld_game: { deleted: false } },
    orderBy: { added: 'desc' },
    skip: offset,
    take: limit,
    include: COMMENT_INCLUDE,
  });

  return comments.map((comment: any) => ({
    ...comment,
    commentAsText: commentAsText(comment.comment),
    user: normalizeUserRef(comment.csld_csld_user),
    game: comment.csld_game ? normalizeGame(comment.csld_game) : null,
    amountOfUpvotes: comment.amount_of_upvotes ?? 0,
  }));
}

export async function homepageResolver(_parent: unknown, _args: unknown, ctx: Context) {
  const now = new Date();

  const [
    lastAddedGames,
    bestRatedGames,
    nextEvents,
    lastComments,
    labels,
    gamesTotal,
    eventsTotal,
    upcomingEventsTotal,
    usersTotal,
  ] = await Promise.all([
    ctx.db.csld_game.findMany({
      where: { deleted: false },
      orderBy: { added: 'desc' },
      take: HOMEPAGE_GAMES,
      include: GAME_INCLUDE,
    }),
    ctx.db.csld_game.findMany({
      // The very same ranking the catalog uses for "Best" (average rating, nulls
      // last), so the block cannot drift away from the catalog's own ordering.
      where: {
        deleted: false,
        average_rating: { not: null },
        amount_of_ratings: { gte: MIN_RATINGS_FOR_TOP },
      },
      orderBy: catalogOrderBy('Best'),
      take: HOMEPAGE_GAMES,
      include: GAME_INCLUDE,
    }),
    ctx.db.event.findMany({
      where: {
        deleted: false,
        from: { gte: now },
      },
      orderBy: { from: 'asc' },
      take: HOMEPAGE_GAMES,
      include: {
        event_has_labels: { include: { csld_label: true } },
      },
    }),
    lastCommentsPage(ctx, { limit: HOMEPAGE_COMMENTS }),
    labelFacets(ctx),
    ctx.db.csld_game.count({ where: buildCatalogWhere() }),
    ctx.db.event.count({ where: { deleted: false } }),
    ctx.db.event.count({ where: { deleted: false, from: { gte: now } } }),
    ctx.db.csld_csld_user.count(),
  ]);

  return {
    lastAddedGames: lastAddedGames.map((game: any) => normalizeGame(game)),
    bestRatedGames: bestRatedGames.map((game: any) => normalizeGame(game)),
    topLabels: labels.slice(0, HOMEPAGE_LABELS),
    stats: {
      games: gamesTotal,
      events: eventsTotal,
      upcomingEvents: upcomingEventsTotal,
      users: usersTotal,
      labels: labels.length,
    },
    nextEvents,
    lastComments,
  };
}

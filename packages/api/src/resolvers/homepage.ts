import type { Context } from '../context.js';
import { normalizeGame, normalizeUserRef } from './mappers.js';
import { commentAsText } from './textUtils.js';
import {
  buildCatalogWhere,
  catalogOrderBy,
  GAME_CATALOG_INCLUDE,
  GAME_LIST_INCLUDE,
  labelFacets,
  pageGameIds,
} from './gameCatalog.js';
import { mapEventRow } from './search.js';
import { STATE_PLAYED, STATE_WANT_TO_PLAY } from './user.js';

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

/** Cards per personal block — the same handful as the anonymous one. */
export const MY_HOME_GAMES = 6;

/**
 * Labels the recommendation is built from. Four is what fits the note above the
 * cards ("podle štítků opakovatelný, komorní, sociální drama, současnost"); the
 * rest of the visitor's taste would not change which games come back.
 */
export const MY_RECOMMENDED_LABELS = 4;

/**
 * A rating of 8 or more means "I want more of this", so the labels of those
 * games are the visitor's taste. 5 and 6 are "it was fine" — counting them
 * would recommend more of the average, which is what the catalog already
 * leads with for everybody.
 */
export const MIN_RATING_FOR_TASTE = 8;

/**
 * The rating a recommended game has to have. `ratingUtils` calls 80 and up
 * "recommended" (the same line the profile uses), and the catalog's own
 * `RECOMMENDED_FROM` prior sits below it on purpose — the prior is where an
 * unrated game starts, not the bar a recommendation has to clear.
 */
export const RECOMMENDED_MIN_RATING = 80;

/**
 * How many of the visitor's own games the block lists before "the rest is in
 * your profile", and how many cards the personal blocks show at all.
 */
export const MY_HOME_AUTHORED = 6;

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

/**
 * The signed-in visitor's own blocks.
 *
 * Everything here is counted from the visitor's *rows*, never from the legacy
 * denormalized columns: `amount_of_created` says 34 while the author table holds
 * 15 links, and `amount_of_comments` says 101 while 51 of them are on live
 * games. The homepage is the one place where those numbers are read at a glance,
 * so it is the one place where they must not lie.
 *
 * Returns null for an anonymous caller: the web app asks for `myHome` only when
 * the session says somebody is signed in, but a query that forgets to skip it
 * must not answer with somebody else's data.
 */
export async function myHomepage(ctx: Context, userId: number) {
  const now = new Date();

  const [ratingRows, authoredRows, commentsCount, upcomingLinks] = await Promise.all([
    ctx.db.csld_rating.findMany({
      where: { user_id: userId, csld_game: { deleted: false } },
      include: { csld_game: { include: GAME_LIST_INCLUDE } },
      orderBy: { added: 'desc' },
    }),
    ctx.db.csld_game_has_author.findMany({
      where: { id_user: userId, csld_game: { deleted: false } },
      include: { csld_game: { include: GAME_LIST_INCLUDE } },
    }),
    ctx.db.csld_comment.count({
      where: { user_id: userId, is_hidden: false, csld_game: { deleted: false } },
    }),
    // Games with an event still ahead — the link table the calendar reads.
    ctx.db.csld_game_has_event.findMany({
      where: { csld_game: { deleted: false }, event: { deleted: false, from: { gte: now } } },
      select: { game_id: true },
    }),
  ]);

  const played = ratingRows.filter((row: any) => row.state === STATE_PLAYED);
  const wanted = ratingRows.filter((row: any) => row.state === STATE_WANT_TO_PLAY);
  const authoredGames = authoredRows.map((row: any) => row.csld_game).filter(Boolean);
  const authoredIds = authoredGames.map((game: any) => game.id);

  // The visitor's taste: labels of the games they rated 8 or more, counted over
  // their own ratings. The personal path used to return no labels at all, which
  // is why the block could not exist before.
  const labelCounts = new Map<number, { id: string; name: string | null; count: number }>();
  for (const row of ratingRows as any[]) {
    if ((row.rating ?? 0) < MIN_RATING_FOR_TASTE) continue;
    for (const link of row.csld_game?.csld_game_has_label ?? []) {
      const label = link.csld_label;
      // Only labels the catalog can filter by: a tile that leads into an empty
      // list is worse than no tile.
      if (!label || (!label.is_authorized && !label.is_required)) continue;
      const entry = labelCounts.get(label.id) ?? { id: String(label.id), name: label.name, count: 0 };
      entry.count += 1;
      labelCounts.set(label.id, entry);
    }
  }
  const recommendedLabels = [...labelCounts.values()]
    .sort((a, b) => b.count - a.count || (a.name ?? '').localeCompare(b.name ?? '', 'cs'))
    .slice(0, MY_RECOMMENDED_LABELS);

  const wantedIds = wanted.map((row: any) => row.game_id);
  const linkedWantedIds = new Set(upcomingLinks.map((link: any) => link.game_id));

  // The newest rating each of the visitor's own games received — what the author
  // otherwise has to open fifteen detail pages to find out. The voter is not
  // fetched: who rated the game is not the author's business.
  const lastRatings = authoredIds.length
    ? await ctx.db.csld_rating.findMany({
        where: { game_id: { in: authoredIds }, rating: { not: null } },
        orderBy: { added: 'desc' },
      })
    : [];
  const lastRatingByGame = new Map<number, any>();
  for (const row of lastRatings as any[]) {
    if (!lastRatingByGame.has(row.game_id)) lastRatingByGame.set(row.game_id, row);
  }

  const [myEvents, recommended] = await Promise.all([
    wantedIds.length
      ? ctx.db.event.findMany({
          where: {
            deleted: false,
            from: { gte: now },
            csld_game_has_event: { some: { game_id: { in: wantedIds } } },
          },
          orderBy: { from: 'asc' },
          take: MY_HOME_GAMES,
          include: {
            event_has_labels: { include: { csld_label: true } },
            csld_game_has_event: { include: { csld_game: true } },
          },
        })
      : Promise.resolve([] as any[]),
    recommendGames(ctx, recommendedLabels.map((label) => label.id), [
      ...ratingRows.map((row: any) => row.game_id),
      ...authoredIds,
    ]),
  ]);

  const knownGames = [...played, ...wanted].sort(
    (a: any, b: any) => new Date(b.added).getTime() - new Date(a.added).getTime(),
  );
  const wantedOldestFirst = [...wanted].sort(
    (a: any, b: any) => new Date(a.added).getTime() - new Date(b.added).getTime(),
  );

  // The block leads with the games whose last rating is the newest: a rating on
  // an old game is the news the author came for.
  const authoredByRecency = [...authoredGames].sort((a: any, b: any) => {
    const left = lastRatingByGame.get(a.id)?.added?.getTime() ?? 0;
    const right = lastRatingByGame.get(b.id)?.added?.getTime() ?? 0;
    return right - left;
  });

  const personal = (row: any) => ({
    game: normalizeGame(row.csld_game),
    since: row.added ? new Date(row.added).toISOString() : null,
  });

  return {
    playedCount: played.length,
    wantedCount: wanted.length,
    authoredCount: authoredGames.length,
    commentsCount,
    // A third of the accounts have nothing at all in the database; the page has
    // to say so instead of rendering five empty blocks.
    hasData: played.length + wanted.length + authoredGames.length + commentsCount > 0,
    myEvents: myEvents.map((event: any) => mapEventRow(event, ctx)),
    wantedWithoutEvent: wantedIds.filter((id: number) => !linkedWantedIds.has(id)).length,
    toRate: knownGames
      .filter((row: any) => row.state === STATE_PLAYED && row.rating == null)
      .slice(0, 2)
      .map(personal),
    oldestWanted: wantedOldestFirst.slice(0, 2).map(personal),
    authored: authoredByRecency.slice(0, MY_HOME_AUTHORED).map((game: any) => {
      const rating = lastRatingByGame.get(game.id);
      return {
        game: normalizeGame(game),
        lastRating: rating
          ? {
              rating: rating.rating,
              added: rating.added ? new Date(rating.added).toISOString() : null,
            }
          : null,
      };
    }),
    recommendedLabels,
    recommended,
  };
}

/**
 * What the catalog shows for the same filter — `pageGameIds` is the catalog's own
 * ranking, so a game recommended here is in the same order as in the list the
 * visitor lands on after clicking "all of them".
 */
async function recommendGames(ctx: Context, labelIds: string[], knownIds: number[]) {
  if (!labelIds.length) return [];

  const where = {
    AND: [
      buildCatalogWhere({ anyLabels: labelIds, minRating: RECOMMENDED_MIN_RATING }),
      // Already played, wanted or written: recommending it back is noise.
      { id: { notIn: knownIds } },
    ],
  };

  const ids = await pageGameIds(ctx, where, 'Recommended', 0, MY_HOME_GAMES, null);
  if (!ids.length) return [];

  const rows = await ctx.db.csld_game.findMany({ where: { id: { in: ids } }, include: GAME_CATALOG_INCLUDE });
  const byId = new Map(rows.map((row: any) => [row.id, row]));

  return ids
    .map((id) => byId.get(id))
    .filter((game): game is NonNullable<typeof game> => Boolean(game))
    .map((game: any) => normalizeGame(game));
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
    myHome,
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
        csld_game_has_event: { include: { csld_game: true } },
      },
    }),
    lastCommentsPage(ctx, { limit: HOMEPAGE_COMMENTS }),
    labelFacets(ctx),
    ctx.db.csld_game.count({ where: buildCatalogWhere() }),
    ctx.db.event.count({ where: { deleted: false } }),
    ctx.db.event.count({ where: { deleted: false, from: { gte: now } } }),
    ctx.db.csld_csld_user.count(),
    // Only for a signed-in caller; the personal blocks are nobody else's business.
    ctx.user ? myHomepage(ctx, ctx.user.id) : Promise.resolve(null),
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
    nextEvents: nextEvents.map((event: any) => mapEventRow(event, ctx)),
    lastComments,
    myHome,
  };
}

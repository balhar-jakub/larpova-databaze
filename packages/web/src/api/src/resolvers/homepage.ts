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
import { mapEventRow, EVENT_COVER_IMAGE_INCLUDE } from './search.js';
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
 * Games per block on the "recently played" list. The block leads with the
 * newest activity, so it takes one card more than the rating blocks.
 */
export const HOMEPAGE_RECENT_GAMES = 6;

/**
 * How far back the "recently played" block reaches. Without a window the
 * block would show the same games for weeks once the calendar runs dry;
 * three months is the span of a larp season, and a game with no event in it
 * is no longer "recently played".
 */
export const HOMEPAGE_RECENT_WINDOW_DAYS = 90;

/**
 * Events in the "registration open" block. The same handful as the other
 * blocks; a longer list would promise more openings than a larp season
 * usually has.
 */
export const HOMEPAGE_OPEN_REGISTRATION = 6;

/**
 * Comments per block. The block used to take 6 comments and claim half of
 * the page; three are enough next to a link into the catalog.
 */
export const HOMEPAGE_COMMENTS = 3;

/**
 * Comments per page of the all-comments listing. The same page size the game
 * detail and the profile use (`PagedCommentsPanel`), so the pager behaves the
 * same everywhere.
 */
export const ALL_COMMENTS_PAGE = 10;

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

/** The "recently played" block: the game row plus its latest event row. */
const RECENT_GAME_INCLUDE = {
  csld_game_has_label: { include: { csld_label: true } },
  csld_image_csld_game_cover_imageTocsld_image: true,
};
const RECENT_EVENT_INCLUDE = {
  event_has_labels: { include: { csld_label: true } },
  ...EVENT_COVER_IMAGE_INCLUDE,
};

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

/** How many of the visitor's own games the block lists before "the rest is in
 * your profile", and how many cards the personal blocks show at all.
 */
export const MY_HOME_AUTHORED = 6;

/**
 * Events the taste-based recommendation offers. Three or four is what a larp
 * season has open at once; a longer list would promise more openings than
 * exist and the block would drift into being a second calendar.
 */
export const MY_HOME_RECOMMENDED_EVENTS = 4;

/**
 * Comments per personal block: the "finish it" checklist and the comments on
 * the visitor's own games. Three is what fits a card without scrolling.
 */
export const MY_HOME_COMMENTS = 3;

const COMMENT_INCLUDE = {
  csld_game: true,
  csld_csld_user: { include: { csld_image: true } },
};

/**
 * Games with the most recent event, newest event first — the "what is being
 * played right now" block. The window keeps the block honest when the calendar
 * runs dry: a game whose latest event is older is no longer "recently played",
 * and a game with no event at all never appears here.
 *
 * One event per game: the latest one. The block is about games, not about
 * listing every run of every game.
 */
export async function recentGames(ctx: Context) {
  const now = new Date();
  const since = new Date(now.getTime() - HOMEPAGE_RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const links = await ctx.db.csld_game_has_event.findMany({
    where: {
      csld_game: { deleted: false },
      // The window is the past: an event still ahead of us is upcoming, not
      // recently played — without the upper bound a future event leads the
      // block (it sorts newest), pushing the actually-played games out.
      event: { deleted: false, from: { gte: since, lte: now } },
    },
    orderBy: { event: { from: 'desc' } },
    include: {
      csld_game: { include: RECENT_GAME_INCLUDE },
      event: { include: RECENT_EVENT_INCLUDE },
    },
  });

  // Latest event per game: the links come ordered by the event date, so the
  // first link of each game is its most recent event.
  const seen = new Set<number>();
  const recent: { game: any; event: any }[] = [];
  for (const link of links as any[]) {
    if (!link.csld_game || seen.has(link.csld_game.id)) continue;
    seen.add(link.csld_game.id);
    recent.push({ game: link.csld_game, event: link.event });
    if (recent.length >= HOMEPAGE_RECENT_GAMES) break;
  }

  return recent.map(({ game, event }) => ({
    game: normalizeGame(game),
    event: mapEventRow(event, ctx),
  }));
}

/**
 * Upcoming events whose registration is open — "you can still sign up for
 * these", the one question the anonymous visitor arrives with. An event
 * without a registration URL has nothing to sign up for, so it stays out
 * even if the flag says open (the mutation only allows open with a URL, but
 * legacy rows predate that rule). Sorted by the event date, soonest first:
 * the deadline, not the upload, decides the order.
 */
export async function openRegistrationEvents(ctx: Context) {
  const now = new Date();

  const events = await ctx.db.event.findMany({
    where: {
      deleted: false,
      // The event must still be ahead: once it starts, there is nothing
      // left to sign up for.
      from: { gte: now },
      // Only a live sign-up belongs here; UPCOMING ("will open") events stay
      // out — the panel's promise is "you can sign up right now".
      registration_status: 'OPEN',
      registration_url: { not: null },
    },
    orderBy: { from: 'asc' },
    take: HOMEPAGE_OPEN_REGISTRATION,
    include: {
      event_has_labels: { include: { csld_label: true } },
      ...EVENT_COVER_IMAGE_INCLUDE,
      csld_game_has_event: { include: { csld_game: true } },
    },
  });

  return events.map((event: any) => mapEventRow(event, ctx));
}

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
 * Every visible comment in the database, one page at a time — the listing the
 * homepage's „všechny komentáře“ link opens, the comments' counterpart of the
 * games catalog. The visibility rules are the homepage block's: a hidden
 * comment is out, and so is a comment under a deleted game (its game link
 * would lead nowhere).
 *
 * `length` and `year` are the page's two filter chips. They must count from
 * the same visibility rules as the unfiltered list — the chip's number comes
 * from `commentsStats`, and a chip that promises 1 336 long comments must list
 * 1 336 rows when selected. The length bands measure `commentAsText` (the
 * text the visitor reads), not the raw HTML, so the boundaries are the same
 * ones the UI labels quote.
 */
export const SHORT_LENGTH_LIMIT = 200;
export const LONG_LENGTH_LIMIT = 1000;

export type CommentLengthBand = 'SHORT' | 'MEDIUM' | 'LONG';

/**
 * The band of a comment's reading weight — the single place both the filter
 * and the chip counts decide it from, so the two can never disagree. The
 * lengths measure `commentAsText` (the text the visitor reads), not the raw
 * HTML.
 */
export const bandOf = (text: string | null | undefined): CommentLengthBand => {
  const length = (text ?? '').length;
  if (length < SHORT_LENGTH_LIMIT) return 'SHORT';
  if (length < LONG_LENGTH_LIMIT) return 'MEDIUM';
  return 'LONG';
};

/**
 * The ids of every visible comment per band, newest first. Loading the whole
 * visible set is what the chips' own numbers need anyway (`commentsStats`
 * counts from the same rows), so the length filter reuses the pass instead
 * of duplicating the band math in SQL it cannot express.
 *
 * The pass costs one full-table read (~200 ms on the live data), and a page
 * load asks for it up to twice (the chips' counts plus a filtered list), so
 * the result is cached per process for a minute. The bands therefore lag a
 * freshly posted comment by at most the TTL — the same freshness the chips'
 * numbers have always had, and a brand-new comment is `MEDIUM`-adjacent in
 * the pager long before anyone filters by its band.
 */
const BANDS_TTL_MS = 60_000;

let bandsCache: { at: number; bands: Record<CommentLengthBand, { ids: number[] }> } | null = null;

async function visibleCommentBands(ctx: Context) {
  if (bandsCache && Date.now() - bandsCache.at < BANDS_TTL_MS) {
    return bandsCache.bands;
  }

  const visibility = { is_hidden: false, csld_game: { OR: [{ deleted: false }, { deleted: null }] } };
  const comments = await ctx.db.csld_comment.findMany({
    where: visibility,
    select: { id: true, comment: true },
    orderBy: [{ added: 'desc' }, { id: 'desc' }],
  });

  const bands: Record<CommentLengthBand, { ids: number[] }> = {
    SHORT: { ids: [] },
    MEDIUM: { ids: [] },
    LONG: { ids: [] },
  };
  for (const row of comments) {
    bands[bandOf(commentAsText(row.comment))].ids.push(row.id);
  }

  bandsCache = { at: Date.now(), bands };
  return bands;
}

export async function allCommentsPage(
  ctx: Context,
  args: {
    offset?: number;
    limit?: number;
    length?: CommentLengthBand;
    year?: number;
  } = {},
) {
  const offset = Math.max(0, args.offset ?? 0);
  const limit = Math.min(Math.max(1, args.limit ?? ALL_COMMENTS_PAGE), 50);
  const visibility = { is_hidden: false, csld_game: { OR: [{ deleted: false }, { deleted: null }] } };

  // The length bands measure the STRIPPED text (`commentAsText`), which SQL
  // cannot compute — the tag stripping and entity decoding live in JS. The
  // filter therefore narrows by id through the same band helper the chips'
  // counts come from (`visibleCommentBands`), so a chip's number is exactly
  // what selecting it lists; the page then loads those ids through the same
  // `findMany` the unfiltered list uses.
  let lengthFilteredIds: number[] | undefined;
  if (args.length) {
    const bands = await visibleCommentBands(ctx);
    lengthFilteredIds = bands[args.length].ids;
  }

  const where = {
    ...visibility,
    ...(lengthFilteredIds ? { id: { in: lengthFilteredIds } } : {}),
    ...(args.year
      ? {
          added: {
            gte: new Date(Date.UTC(args.year, 0, 1)),
            lt: new Date(Date.UTC(args.year + 1, 0, 1)),
          },
        }
      : {}),
  };

  const [comments, total] = await Promise.all([
    ctx.db.csld_comment.findMany({
      where,
      // The tie-break matters: the 2013–2014 import carries thousands of
      // comments with the same `added`, and without a second key the pager
      // swaps rows between pages (observed on the live test instance).
      orderBy: [{ added: 'desc' }, { id: 'desc' }],
      skip: offset,
      take: limit,
      include: COMMENT_INCLUDE,
    }),
    ctx.db.csld_comment.count({ where }),
  ]);

  return {
    comments: comments.map((comment: any) => ({
      ...comment,
      commentAsText: commentAsText(comment.comment),
      user: normalizeUserRef(comment.csld_csld_user),
      game: comment.csld_game ? normalizeGame(comment.csld_game) : null,
      amountOfUpvotes: comment.amount_of_upvotes ?? 0,
    })),
    totalAmount: total,
  };
}

/**
 * The counts the /komentare filter chips render. `allCommentsPage` cannot
 * filter on `commentAsText` directly (it is computed per row in JS, not in
 * SQL), so this aggregates the whole visible set once per page load and the
 * page filter then narrows the same rows through the shared band limits.
 */
export async function commentsStats(ctx: Context) {
  const visibility = { is_hidden: false, csld_game: { OR: [{ deleted: false }, { deleted: null }] } };
  const comments = await ctx.db.csld_comment.findMany({
    where: visibility,
    select: { comment: true, added: true },
  });

  const lengths = { SHORT: 0, MEDIUM: 0, LONG: 0 };
  const years = new Map<number, number>();
  for (const row of comments) {
    lengths[bandOf(commentAsText(row.comment))] += 1;

    if (row.added) {
      const year = row.added.getUTCFullYear();
      years.set(year, (years.get(year) ?? 0) + 1);
    }
  }

  return {
    lengths,
    years: [...years.entries()]
      .sort(([a], [b]) => a - b)
      .map(([year, amount]) => ({ year, amount })),
  };
}

/** Add one game's labels to the counts, skipping labels the catalog cannot
 * filter by (a tile that leads into an empty list is worse than no tile). */
function tallyGameLabels(
  labelCounts: Map<number, { id: string; name: string | null; count: number }>,
  row: any,
): void {
  for (const link of row.csld_game?.csld_game_has_label ?? []) {
    const label = link.csld_label;
    if (!label || (!label.is_authorized && !label.is_required)) continue;
    const entry = labelCounts.get(label.id) ?? { id: String(label.id), name: label.name, count: 0 };
    entry.count += 1;
    labelCounts.set(label.id, entry);
  }
}

/**
 * The visitor's taste: labels of the games they rated 8 or more, counted over
 * their own ratings. Only labels the catalog can filter by are kept — a tile
 * that leads into an empty list is worse than no tile.
 */
function countTasteLabels(ratingRows: readonly any[]): {
  recommended: { id: string; name: string | null; count: number }[];
  tasteIds: Set<number>;
} {
  const labelCounts = new Map<number, { id: string; name: string | null; count: number }>();
  for (const row of ratingRows) {
    if ((row.rating ?? 0) < MIN_RATING_FOR_TASTE) continue;
    tallyGameLabels(labelCounts, row);
  }
  const recommended = [...labelCounts.values()]
    .sort((a, b) => b.count - a.count || (a.name ?? '').localeCompare(b.name ?? '', 'cs'))
    .slice(0, MY_RECOMMENDED_LABELS);
  return { recommended, tasteIds: new Set(labelCounts.keys()) };
}

/** Games the visitor rated but never wrote about: rated, uncommented and with
 * comments not turned off, newest first. A game whose author turned the
 * comments off cannot be reviewed either — the detail page refuses the form,
 * so the block must not ask for it. */
function gamesToComment(played: readonly any[], commentedGameIds: Set<number>): readonly any[] {
  return played
    .filter((row: any) => row.rating != null)
    .filter((row: any) => !commentedGameIds.has(row.game_id))
    .filter((row: any) => !row.csld_game?.commentsdisabled)
    .sort((a: any, b: any) => new Date(b.added).getTime() - new Date(a.added).getTime());
}

/** Played but unrated games: a played game with the ratings turned off keeps
 * its state rows, but the vote itself is impossible, so it never belongs in
 * the "finish" list. The rows stay in the database untouched — when the
 * author turns the ratings back on, the game returns on its own. */
function gamesToRate(knownGames: readonly any[]): readonly any[] {
  return knownGames
    .filter((row: any) => row.state === STATE_PLAYED && row.rating == null)
    .filter((row: any) => !row.csld_game?.ratingsdisabled)
    .slice(0, 2);
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

  const [
    ratingRows,
    authoredRows,
    commentsCount,
    upcomingLinks,
    myCommentGameIds,
  ] = await Promise.all([
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
    // Which of the visitor's played games already carry their review — a rated
    // game with a comment is finished, one without is "toComment".
    ctx.db.csld_comment.findMany({
      where: { user_id: userId, is_hidden: false },
      select: { game_id: true },
    }),
  ]);

  const played = ratingRows.filter((row: any) => row.state === STATE_PLAYED);
  const wanted = ratingRows.filter((row: any) => row.state === STATE_WANT_TO_PLAY);
  const authoredGames = authoredRows.map((row: any) => row.csld_game).filter(Boolean);
  const authoredIds = authoredGames.map((game: any) => game.id);
  const commentedGameIds = new Set(
    (myCommentGameIds as any[]).map((row: any) => row.game_id).filter(Boolean),
  );

  // The visitor's taste: labels of the games they rated 8 or more, counted over
  // their own ratings. The personal path used to return no labels at all, which
  // is why the block could not exist before.
  const { recommended: recommendedLabels, tasteIds: tasteLabelIds } = countTasteLabels(ratingRows);

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

  const [myEvents, recommended, authoredCommentRows] = await Promise.all([
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
    // The newest comments under the visitor's own games — the author otherwise
    // has no way to learn that somebody wrote about their work.
    authoredIds.length
      ? ctx.db.csld_comment.findMany({
          where: {
            is_hidden: false,
            game_id: { in: authoredIds },
            csld_game: { deleted: false },
          },
          orderBy: { added: 'desc' },
          take: MY_HOME_COMMENTS,
          include: COMMENT_INCLUDE,
        })
      : Promise.resolve([] as any[]),
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

  // Games the visitor rated but never wrote about: the review is the half of
  // the work that helps the next visitor. Rated-but-uncommented is three times
  // more common in the database than played-but-unrated, so this list is the
  // bigger half of "finish it". The block lists the first page; the counts and
  // the page arguments answer "how much is left" and "what comes next", so the
  // header never says three when fifty await.
  const toCommentRows = gamesToComment(played, commentedGameIds);
  const toComment = toCommentRows.slice(0, MY_HOME_COMMENTS).map(personal);

  // The taste-based signable events: future open-registration events of games
  // whose labels overlap the visitor's 8+ taste. Wishlist games are excluded
  // (the event card at the top already carries them), and duplicate runs of
  // one game collapse to the soonest.
  const recommendedEvents = await recommendSignableEvents(
    ctx,
    tasteLabelIds,
    wantedIds,
    now,
  );

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
    toRate: gamesToRate(knownGames).map(personal),
    toRateCount: gamesToRate(knownGames).length,
    toComment,
    toCommentCount: toCommentRows.length,
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
    // The comments under the visitor's own games, newest first. The excerpt is
    // the same decoded plain text the comment block uses.
    authoredComments: authoredCommentRows.map((comment: any) => ({
      id: comment.id,
      commentAsText: commentAsText(comment.comment),
      added: comment.added ? new Date(comment.added).toISOString() : null,
      user: normalizeUserRef(comment.csld_csld_user),
      game: comment.csld_game ? normalizeGame(comment.csld_game) : null,
    })),
    recommendedLabels,
    recommended,
    recommendedEvents,
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

/**
 * The recommendation a signed-in visitor can act on: future events with an open
 * registration whose game shares at least one taste label (from the games they
 * rated 8 or more). A recommendation you cannot sign up for is just a catalog
 * row, so events without an open registration stay out; the wishlist stays out
 * too (the event card at the top of the page already carries those), and when
 * a game has several runs open, only the soonest is offered — the rest is in
 * the calendar. Ranked by the number of shared labels, then by the date.
 */
/** The taste labels one game shares with the visitor's highly-rated games;
 * an event with no shared label is not signable FOR THIS VISITOR and stays out. */
function sharedTasteLabels(game: any, tasteLabelIds: Set<number>): string[] {
  const matches: string[] = [];
  for (const gl of game.csld_game_has_label ?? []) {
    const label = gl.csld_label;
    if (label && tasteLabelIds.has(label.id) && !matches.includes(label.name)) {
      matches.push(label.name);
    }
  }
  return matches;
}

function scoreSignableEvents(
  events: readonly any[],
  tasteLabelIds: Set<number>,
  wantedIds: readonly number[],
): { event: any; matches: string[] }[] {
  const wanted = new Set(wantedIds);
  const seenGames = new Set<number>();
  const scored: { event: any; matches: string[] }[] = [];

  for (const event of events) {
    // The first linked game decides; an event with several games is rare and
    // the card shows one anyway.
    const link = (event.csld_game_has_event ?? []).find(
      (j: any) => j.csld_game && !j.csld_game.deleted,
    );
    if (!link?.csld_game) continue;
    const game = link.csld_game;
    if (wanted.has(game.id) || seenGames.has(game.id)) continue;

    const matches = sharedTasteLabels(game, tasteLabelIds);
    if (!matches.length) continue;

    seenGames.add(game.id);
    scored.push({ event, matches });
  }
  return scored;
}

async function recommendSignableEvents(
  ctx: Context,
  tasteLabelIds: Set<number>,
  wantedIds: number[],
  now: Date,
) {
  if (!tasteLabelIds.size) return [];

  const events = await ctx.db.event.findMany({
    where: {
      deleted: false,
      from: { gte: now },
      // Open with a URL to sign up at; anything else is either not yet
      // signable (UPCOMING) or already full (CLOSED).
      registration_status: 'OPEN',
      registration_url: { not: null },
      csld_game_has_event: { some: { csld_game: { deleted: false } } },
    },
    orderBy: { from: 'asc' },
    include: {
      event_has_labels: { include: { csld_label: true } },
      csld_game_has_event: {
        include: { csld_game: { include: GAME_LIST_INCLUDE } },
      },
    },
  });

  return scoreSignableEvents(events, tasteLabelIds, wantedIds)
    .sort((a, b) => b.matches.length - a.matches.length || new Date(a.event.from).getTime() - new Date(b.event.from).getTime())
    .slice(0, MY_HOME_RECOMMENDED_EVENTS)
    .map(({ event, matches }) => ({
      ...mapEventRow(event, ctx),
      matchedLabels: matches,
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
    myHome,
    recent,
    openRegistration,
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
    recentGames(ctx),
    openRegistrationEvents(ctx),
  ]);

  return {
    lastAddedGames: lastAddedGames.map((game: any) => normalizeGame(game)),
    bestRatedGames: bestRatedGames.map((game: any) => normalizeGame(game)),
    topLabels: labels.slice(0, HOMEPAGE_LABELS),
    recentGames: recent,
    openRegistrationEvents: openRegistration,
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

/**
 * A page of the visitor's rated-but-never-reviewed games — the "load more" arm
 * of the homepage's "finish it" block. The same definition, ordering and
 * exclusions as the `toComment` the first page ships, so paging cannot show
 * what the block's contract excludes.
 *
 * Returns null for an anonymous caller, like `myHomepage` itself.
 */
export async function myHomeToCommentPage(
  ctx: Context,
  offset: number,
  limit: number,
) {
  if (!ctx.user) return null;
  const userId = ctx.user.id;

  // The visitor's played ratings and their own comments — the same two reads
  // `myHomepage` builds the first page from.
  const [ratingRows, myCommentGameIds] = await Promise.all([
    ctx.db.csld_rating.findMany({
      where: { user_id: userId, csld_game: { deleted: false } },
      include: { csld_game: { include: GAME_LIST_INCLUDE } },
      orderBy: { added: 'desc' },
    }),
    ctx.db.csld_comment.findMany({
      where: { user_id: userId, is_hidden: false },
      select: { game_id: true },
    }),
  ]);

  const played = ratingRows.filter((row: any) => row.state === STATE_PLAYED);
  const commentedGameIds = new Set(
    (myCommentGameIds as any[]).map((row: any) => row.game_id).filter(Boolean),
  );

  return gamesToComment(played, commentedGameIds)
    .slice(offset, offset + limit)
    .map((row: any) => ({
      game: normalizeGame(row.csld_game),
      since: row.added ? new Date(row.added).toISOString() : null,
    }));
}

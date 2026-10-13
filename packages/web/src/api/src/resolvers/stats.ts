import type { Context } from '../context.js';
import { normalizeGame } from './mappers.js';

/**
 * The five recommendation bands a vote falls into, in the order the statistics
 * page draws them (best first). Pairs, matching the UI's rating input, which
 * saves one value per pair (10/8/6/4/2).
 */
const BAND_RANGES: readonly [number, number][] = [
  [9, 10],
  [7, 8],
  [5, 6],
  [3, 4],
  [1, 2],
];

/**
 * The 2014 one-time import: 5 778 votes share `added = 2014-06-01` (a single
 * day in a year whose every other day has tens). Drawn separately by the UI so
 * the year reads as "the database's history arrived", not "the community voted
 * like crazy".
 */
const IMPORT_DATE = /^2014-06-01/;

/** Games per year on the "Hry roku" cards. */
const TOP_GAMES_PER_YEAR = 5;

interface YearBucket {
  events: Set<string>;
  eventsRaw: number;
  newGames: number;
  ratings: number;
  importedRatings: number;
  ratingSum: number;
  bands: number[];
  topGameVotes: Map<number, { votes: number; sum: number }>;
}

const emptyBucket = (): YearBucket => ({
  events: new Set(),
  eventsRaw: 0,
  newGames: 0,
  ratings: 0,
  importedRatings: 0,
  ratingSum: 0,
  bands: BAND_RANGES.map(() => 0),
  topGameVotes: new Map(),
});

/**
 * Year-by-year history of the database: how many events ran, how many games
 * were added and how the community rated, per calendar year. The statistics
 * page consumes it in one query.
 *
 * The aggregation runs in JS on purpose, the same trade-off as
 * `eventCalendarStatsResolver`: the tables are small (thousands of rows of two
 * columns each), Prisma's `groupBy` cannot group by a date's year, and the
 * dedup of events (same name + same start date = one event) has no SQL shape
 * we want to duplicate in raw queries.
 */
export async function statisticsResolver(
  _parent: unknown,
  _args: Record<string, never>,
  ctx: Context,
) {
  const [eventRows, gameRows, ratingRows, commentCount] = await Promise.all([
    ctx.db.event.findMany({
      where: { deleted: false },
      select: { name: true, from: true },
    }),
    ctx.db.csld_game.findMany({
      where: { deleted: false },
      select: { added: true },
    }),
    ctx.db.csld_rating.findMany({
      where: { rating: { not: null } },
      select: { game_id: true, rating: true, added: true },
    }),
    ctx.db.csld_comment.count({ where: { is_hidden: false } }),
  ]);

  const buckets = new Map<number, YearBucket>();
  const bucketOf = (year: number) => {
    let bucket = buckets.get(year);
    if (!bucket) {
      bucket = emptyBucket();
      buckets.set(year, bucket);
    }
    return bucket;
  };
  const yearOf = (date: Date | null): number | null => {
    if (!date || isNaN(date.getTime())) return null;
    return date.getUTCFullYear();
  };

  // Events: dedup by name + start date within the year. The whole table is a
  // couple of thousand rows; the key needs no normalization beyond the exact
  // name because the duplicates come from imports that repeated rows verbatim.
  let eventsTotal = 0;
  for (const row of eventRows) {
    const year = yearOf(row.from);
    if (year === null) continue;
    const bucket = bucketOf(year);
    bucket.eventsRaw += 1;
    const key = `${row.name ?? ''}|${row.from?.toISOString() ?? ''}`;
    if (!bucket.events.has(key)) {
      bucket.events.add(key);
      eventsTotal += 1;
    }
  }

  for (const row of gameRows) {
    const year = yearOf(row.added);
    if (year === null) continue;
    bucketOf(year).newGames += 1;
  }

  for (const row of ratingRows) {
    const year = yearOf(row.added);
    if (year === null) continue;
    const bucket = bucketOf(year);
    const rating = row.rating!;
    bucket.ratings += 1;
    if (IMPORT_DATE.test(row.added?.toISOString() ?? '')) {
      bucket.importedRatings += 1;
    }
    bucket.ratingSum += rating;
    const band = BAND_RANGES.findIndex(([lo, hi]) => rating >= lo && rating <= hi);
    if (band >= 0) bucket.bands[band] += 1;

    const top = bucket.topGameVotes.get(row.game_id) ?? { votes: 0, sum: 0 };
    top.votes += 1;
    top.sum += rating;
    bucket.topGameVotes.set(row.game_id, top);
  }

  const years = Array.from(buckets.keys()).sort((a, b) => a - b);

  // The "Hry roku" cards need the games themselves: fetch the winners for
  // every year at once, in one query, and hand each year back its own list.
  const topGameIds = new Set<number>();
  for (const year of years) {
    const bucket = buckets.get(year)!;
    const sorted = Array.from(bucket.topGameVotes.entries())
      .sort((a, b) => b[1].votes - a[1].votes)
      .slice(0, TOP_GAMES_PER_YEAR);
    // Stash the ordered ids on the bucket for the assembly below.
    (bucket as any)._orderedTop = sorted;
    sorted.forEach(([id]) => topGameIds.add(id));
  }

  const topGames = topGameIds.size
    ? await ctx.db.csld_game.findMany({
        where: { id: { in: Array.from(topGameIds) }, deleted: false },
        include: { csld_game_has_label: { include: { csld_label: true } } },
      })
    : [];
  const gameById = new Map(topGames.map((g) => [g.id, normalizeGame(g)]));

  return {
    gamesTotal: gameRows.length,
    eventsTotal,
    ratingsTotal: ratingRows.length,
    commentsTotal: commentCount,
    years: years.map((year) => {
      const bucket = buckets.get(year)!;
      const orderedTop = (bucket as any)._orderedTop as [number, { votes: number; sum: number }][];
      return {
        year,
        events: bucket.events.size,
        eventsRaw: bucket.eventsRaw,
        newGames: bucket.newGames,
        ratings: bucket.ratings,
        importedRatings: bucket.importedRatings,
        averageRating: bucket.ratings ? bucket.ratingSum / bucket.ratings : null,
        bands: bucket.bands,
        topGames: orderedTop
          .map(([id, { votes, sum }]) => {
            const game = gameById.get(id);
            if (!game) return null;
            return { game, votesInYear: votes, averageInYear: votes ? sum / votes : null };
          })
          .filter(Boolean),
      };
    }),
  };
}

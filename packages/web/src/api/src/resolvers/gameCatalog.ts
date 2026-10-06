import type { Prisma } from '@prisma/client';
import type { Context } from '../context.js';
import { normalizeGame } from './mappers.js';

/**
 * Catalog = the browse surface of the games list (replaces the ladder there).
 *
 * The ladder could only order by one raw column, which made two of its tabs
 * identical and put unrated games at the top of "Best" (PostgreSQL sorts NULLs
 * first for DESC). The catalog adds filters, real facets and an order that
 * cannot be expressed as a single column (a Bayes-weighted recommendation
 * score), so the ranking is stable for games with few ratings.
 */

/**
 * Rating bands shared with the frontend — see src/utils/ratingUtils.ts.
 * 70 is where the frontend starts calling a game "recommended"; the value is
 * also the fallback prior when no rated game exists at all.
 */
export const RECOMMENDED_FROM = 70;

/**
 * Weight of the prior in the recommendation score, in "number of ratings".
 * A game needs roughly this many ratings before its own average dominates the
 * database average, which keeps 1-rating outliers out of the top of the list.
 */
export const BAYES_WEIGHT = 12;

export const DEFAULT_ORDER = 'Recommended';

export type CatalogOrder =
  | 'Recommended'
  | 'Best'
  | 'MostPlayed'
  | 'Newest'
  | 'MostCommented'
  | 'NameAsc';

export interface CatalogFilter {
  query?: string | null;
  allLabels?: (string | number)[] | null;
  anyLabels?: (string | number)[] | null;
  noLabels?: (string | number)[] | null;
  durations?: string[] | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  playersFrom?: number | null;
  playersTo?: number | null;
  minRating?: number | null;
  minRatings?: number | null;
  withComments?: boolean | null;
  withImage?: boolean | null;
  addedWithinDays?: number | null;
}

export interface CatalogArgs {
  filter?: CatalogFilter | null;
  order?: CatalogOrder | null;
  offset?: number | null;
  limit?: number | null;
}

/**
 * Duration buckets. Games usually carry either `hours` (about a quarter of the
 * database) or `days` (about a third), so the buckets are keyed off whichever
 * is present and stay mutually exclusive: `days` 0/NULL means "single day" and
 * is split by hours, otherwise days decide.
 */
export const DURATION_KEYS = ['short', 'day', 'weekend', 'long'] as const;
export type DurationKey = (typeof DURATION_KEYS)[number];

const NO_DAYS: Prisma.csld_gameWhereInput = { OR: [{ days: null }, { days: 0 }] };

export const DURATION_WHERE: { [key in DurationKey]: Prisma.csld_gameWhereInput } = {
  short: { AND: [NO_DAYS, { hours: { gte: 1, lte: 8 } }] },
  day: { AND: [NO_DAYS, { hours: { gte: 9, lte: 30 } }] },
  weekend: { days: { gte: 1, lte: 3 } },
  long: { days: { gte: 4 } },
};

/** Columns the game card needs — the ladder only sent labels, so cards had no image. */
export const GAME_CATALOG_INCLUDE = {
  csld_game_has_label: { include: { csld_label: true } },
  csld_image_csld_game_cover_imageTocsld_image: true,
};

export const GAME_LIST_INCLUDE = {
  csld_game_has_label: { include: { csld_label: true } },
};

const toIntIds = (values?: (string | number)[] | null): number[] =>
  (values ?? [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

const orderByInput = (sort: 'asc' | 'desc'): Prisma.SortOrderInput => ({ sort, nulls: 'last' });

const NAME_ORDER: Prisma.csld_gameOrderByWithRelationInput = { name: orderByInput('asc') };

/**
 * `Recommended` is intentionally missing here: it is ranked in memory (see
 * pageGameIds) because the score is not a column.
 */
export function catalogOrderBy(order: CatalogOrder): Prisma.csld_gameOrderByWithRelationInput[] {
  switch (order) {
    case 'Best':
      // Average, not the sum: total_rating rewards games that simply have more
      // ratings, and nulls last keeps unrated games out of the top.
      return [
        { average_rating: orderByInput('desc') },
        { amount_of_ratings: orderByInput('desc') },
        NAME_ORDER,
      ];
    case 'MostPlayed':
      // Games people actually marked as played — ordering by amount_of_ratings
      // made this list identical to the best rated one.
      return [{ amount_of_played: orderByInput('desc') }, NAME_ORDER];
    case 'Newest':
      return [{ added: 'desc' }, NAME_ORDER];
    case 'MostCommented':
      return [{ amount_of_comments: orderByInput('desc') }, NAME_ORDER];
    case 'NameAsc':
      return [NAME_ORDER];
    default:
      return [
        { average_rating: orderByInput('desc') },
        { amount_of_ratings: orderByInput('desc') },
        NAME_ORDER,
      ];
  }
}

export interface WhereOptions {
  /** Skip label conditions — facet counts must not be narrowed by their own dimension. */
  skipLabels?: boolean;
  skipDurations?: boolean;
}

export function buildCatalogWhere(filter: CatalogFilter = {}, options: WhereOptions = {}): Prisma.csld_gameWhereInput {
  const and: Prisma.csld_gameWhereInput[] = [{ deleted: false }];

  const query = filter.query?.trim();
  if (query) {
    and.push({ name: { contains: query, mode: 'insensitive' } });
  }

  if (!options.skipLabels) {
    toIntIds(filter.allLabels).forEach((id) => {
      and.push({ csld_game_has_label: { some: { id_label: id } } });
    });

    const anyLabels = toIntIds(filter.anyLabels);
    if (anyLabels.length) {
      and.push({ csld_game_has_label: { some: { id_label: { in: anyLabels } } } });
    }

    const noLabels = toIntIds(filter.noLabels);
    if (noLabels.length) {
      and.push({ csld_game_has_label: { none: { id_label: { in: noLabels } } } });
    }
  }

  if (!options.skipDurations && filter.durations?.length) {
    const buckets = DURATION_KEYS.filter((key) => filter.durations?.includes(key)).map(
      (key) => DURATION_WHERE[key],
    );
    if (buckets.length) {
      and.push({ OR: buckets });
    }
  }

  if (filter.yearFrom != null || filter.yearTo != null) {
    const year: Prisma.IntNullableFilter = {};
    if (filter.yearFrom != null) year.gte = filter.yearFrom;
    if (filter.yearTo != null) year.lte = filter.yearTo;
    and.push({ year });
  }

  if (filter.playersFrom != null || filter.playersTo != null) {
    const players: Prisma.IntNullableFilter = {};
    if (filter.playersFrom != null) players.gte = filter.playersFrom;
    if (filter.playersTo != null) players.lte = filter.playersTo;
    and.push({ players });
  }

  if (filter.minRating != null) {
    and.push({ average_rating: { gte: filter.minRating } });
  }

  if (filter.minRatings != null) {
    and.push({ amount_of_ratings: { gte: filter.minRatings } });
  }

  if (filter.withComments) {
    and.push({ amount_of_comments: { gt: 0 } });
  }

  if (filter.withImage) {
    and.push({ cover_image: { not: null } });
  }

  if (filter.addedWithinDays != null && filter.addedWithinDays > 0) {
    const from = new Date(Date.now() - filter.addedWithinDays * 24 * 60 * 60 * 1000);
    and.push({ added: { gte: from } });
  }

  return { AND: and };
}

/** Bayes-weighted average: (sum + prior * weight) / (count + weight). */
export function bayesRating(
  averageRating?: number | null,
  amountOfRatings?: number | null,
  prior = RECOMMENDED_FROM,
  weight = BAYES_WEIGHT,
): number {
  const count = amountOfRatings ?? 0;
  const sum = (averageRating ?? 0) * count;
  return (sum + prior * weight) / (count + weight);
}

/**
 * Upper bound on how many games are ranked in memory for `Recommended`.
 * The whole table is ~1.5k rows; the cap only guards against a runaway filter.
 */
const RECOMMENDED_CANDIDATE_LIMIT = 20000;

async function averageRatingOfRatedGames(ctx: Context): Promise<number> {
  const aggregate = await ctx.db.csld_game.aggregate({
    where: { deleted: false, amount_of_ratings: { gt: 0 }, average_rating: { not: null } },
    _avg: { average_rating: true },
  });
  return aggregate._avg.average_rating ?? RECOMMENDED_FROM;
}

async function pageGameIds(
  ctx: Context,
  where: Prisma.csld_gameWhereInput,
  order: CatalogOrder,
  offset: number,
  limit: number,
): Promise<number[]> {
  if (order !== 'Recommended') {
    const rows = await ctx.db.csld_game.findMany({
      where,
      orderBy: catalogOrderBy(order),
      skip: offset,
      take: limit,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  const [candidates, prior] = await Promise.all([
    ctx.db.csld_game.findMany({
      where,
      select: { id: true, average_rating: true, amount_of_ratings: true },
      take: RECOMMENDED_CANDIDATE_LIMIT,
    }),
    averageRatingOfRatedGames(ctx),
  ]);

  // A game nobody has rated scores exactly the prior, which would tie it with
  // an average game — and ties fall back to the id, so brand-new games would
  // lead the list. No evidence ranks last instead; "Newest" is where new games
  // belong.
  return candidates
    .map((candidate) => ({
      id: candidate.id,
      hasRatings: (candidate.amount_of_ratings ?? 0) > 0 ? 1 : 0,
      score: bayesRating(candidate.average_rating, candidate.amount_of_ratings, prior),
    }))
    .sort((a, b) => b.hasRatings - a.hasRatings || b.score - a.score || a.id - b.id)
    .slice(offset, offset + limit)
    .map((ranked) => ranked.id);
}

export interface CatalogFacets {
  labels: { id: string; name: string | null; count: number; isRequired: boolean }[];
  durations: { key: string; count: number }[];
  yearMin: number | null;
  yearMax: number | null;
}

async function buildFacets(ctx: Context, filter: CatalogFilter): Promise<CatalogFacets> {
  const labelWhere = buildCatalogWhere(filter, { skipLabels: true });
  const durationWhere = buildCatalogWhere(filter, { skipDurations: true });

  const [labelGroups, labelRows, yearAggregate, durationCounts] = await Promise.all([
    ctx.db.csld_game_has_label.groupBy({
      by: ['id_label'],
      where: { csld_game: labelWhere },
      _count: { _all: true },
    }),
    ctx.db.csld_label.findMany({
      where: { OR: [{ is_authorized: true }, { is_required: true }] },
      select: { id: true, name: true, is_required: true },
    }),
    ctx.db.csld_game.aggregate({ where: labelWhere, _min: { year: true }, _max: { year: true } }),
    Promise.all(
      DURATION_KEYS.map((key) =>
        ctx.db.csld_game.count({ where: { AND: [durationWhere, DURATION_WHERE[key]] } }),
      ),
    ),
  ]);

  const counts = new Map(labelGroups.map((group) => [group.id_label, group._count._all]));

  const labels = labelRows
    .map((label) => ({
      id: String(label.id),
      name: label.name,
      count: counts.get(label.id) ?? 0,
      isRequired: label.is_required ?? false,
    }))
    .sort(
      (a, b) =>
        Number(b.isRequired) - Number(a.isRequired) ||
        b.count - a.count ||
        (a.name ?? '').localeCompare(b.name ?? '', 'cs'),
    );

  return {
    labels,
    durations: DURATION_KEYS.map((key, index) => ({ key, count: durationCounts[index] })),
    yearMin: yearAggregate._min.year ?? null,
    yearMax: yearAggregate._max.year ?? null,
  };
}

export async function catalogResolver(
  _parent: unknown,
  args: CatalogArgs,
  ctx: Context,
) {
  const offset = Math.max(0, args.offset ?? 0);
  const limit = Math.min(Math.max(1, args.limit ?? 24), 100);
  const filter = args.filter ?? {};
  const order = args.order ?? DEFAULT_ORDER;
  const where = buildCatalogWhere(filter);

  const [totalAmount, ids] = await Promise.all([
    ctx.db.csld_game.count({ where }),
    pageGameIds(ctx, where, order, offset, limit),
  ]);

  const [games, facets] = await Promise.all([
    ids.length
      ? ctx.db.csld_game.findMany({ where: { id: { in: ids } }, include: GAME_CATALOG_INCLUDE })
      : Promise.resolve([] as Awaited<ReturnType<typeof ctx.db.csld_game.findMany>>),
    buildFacets(ctx, filter),
  ]);

  const byId = new Map(games.map((game) => [game.id, game]));

  return {
    games: ids
      .map((id) => byId.get(id))
      .filter((game): game is NonNullable<typeof game> => Boolean(game))
      .map((game) => normalizeGame(game)),
    totalAmount,
    facets,
  };
}

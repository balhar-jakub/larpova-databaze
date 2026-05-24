import type { Context } from '../context.js';
import { GraphQLError } from 'graphql';

function requireAdmin(ctx: Context) {
  // No user = no admin. When auth is implemented, check role >= 3.
  if (!ctx.user) {
    throw new GraphQLError('Access denied', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }
}

export function adminResolver(_parent: unknown, _args: unknown, ctx: Context) {
  requireAdmin(ctx);
  // Return empty object — sub-resolvers populate each field
  return {};
}

export async function adminAllLabelsResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  return ctx.db.csld_label.findMany({
    orderBy: { name: 'asc' },
    include: { csld_csld_user: true },
  });
}

export async function adminAllUsersResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  return ctx.db.csld_csld_user.findMany({
    orderBy: { name: 'asc' },
    include: { csld_image: true },
  });
}

export async function adminStatsResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  // Return stats from csld_rating aggregated by year/month
  const rows = await ctx.db.$queryRaw<Array<{ year: number; month: number; numRatings: bigint; averageRating: number; numComments: bigint }>>`
    SELECT
      EXTRACT(YEAR FROM r.added)::int AS year,
      EXTRACT(MONTH FROM r.added)::int AS month,
      COUNT(*)::int AS "numRatings",
      COALESCE(AVG(r.rating), 0)::float AS "averageRating",
      0::int AS "numComments"
    FROM csld_rating r
    WHERE r.rating IS NOT NULL
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `;

  return rows.map((r) => ({
    id: `${String(r.year).padStart(4, '0')}${String(r.month).padStart(2, '0')}`,
    year: r.year,
    month: r.month,
    numRatings: Number(r.numRatings),
    numComments: Number(r.numComments),
    averageRating: r.averageRating,
  }));
}

export async function adminSelfRatedResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  return ctx.db.csld_rating.findMany({
    where: { by_author: true },
    include: {
      csld_csld_user: true,
      csld_game: true,
    },
  });
}

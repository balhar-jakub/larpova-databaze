import type { Context } from '../context.js';

export async function groupByIdResolver(
  _parent: unknown,
  args: { groupId: string },
  ctx: Context,
) {
  const id = parseInt(args.groupId, 10);
  if (isNaN(id)) return null;

  const row = await ctx.db.csld_csld_group.findUnique({
    where: { id },
    include: {
      csld_game_has_group: {
        include: { csld_game: true },
      },
    },
  });

  if (!row) return null;

  return {
    ...row,
    authorsOf: (row.csld_game_has_group ?? []).map((j) => j.csld_game).filter(Boolean),
  };
}

export async function groupsByQueryResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 25;

  return ctx.db.csld_csld_group.findMany({
    where: { name: { contains: args.query, mode: 'insensitive' } },
    skip: offset,
    take: limit,
    include: {
      csld_game_has_group: {
        include: { csld_game: true },
      },
    },
  });
}

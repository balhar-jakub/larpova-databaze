import type { Context } from '../context.js';
import { normalizeGame } from './mappers.js';
import { fetchGroupsByIds, groupsSearchPage } from './search.js';

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
    authorsOf: (row.csld_game_has_group ?? []).map((j) => j.csld_game).filter(Boolean).map((g: any) => normalizeGame(g)),
  };
}

export async function groupsByQueryResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  // The group autocomplete of the game form goes through the shared search
  // engine too, so a group written without diacritics is found there as well.
  const page = await groupsSearchPage(ctx, args.query, args.offset ?? 0, args.limit ?? 25);
  return fetchGroupsByIds(ctx, page.ids);
}

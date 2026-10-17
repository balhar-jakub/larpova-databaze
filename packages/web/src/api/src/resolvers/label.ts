import type { Context } from '../context.js';

export async function authorizedRequiredLabelsResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  return ctx.db.csld_label.findMany({
    where: { is_required: true, is_authorized: true },
  });
}

export async function authorizedOptionalLabelsResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  return ctx.db.csld_label.findMany({
    // `is_required` is nullable and NULL means "not required", so `is_required:
    // false` alone would hide those rows from both catalogues (the same trap as
    // `csld_game.deleted`) and leave the label unselectable in the edit form.
    where: {
      is_authorized: true,
      OR: [{ is_required: false }, { is_required: null }],
    },
  });
}

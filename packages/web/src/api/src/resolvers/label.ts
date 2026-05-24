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
    where: { is_required: false, is_authorized: true },
  });
}

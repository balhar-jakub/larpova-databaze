import type { Context } from '../context.js';

export async function donationsResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  return ctx.db.donation.findMany({
    orderBy: { date: 'desc' },
  });
}

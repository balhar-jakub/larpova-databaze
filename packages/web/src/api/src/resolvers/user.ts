import type { Context } from '../context.js';
import { normalizeGame } from './mappers.js';

export function normalizeUser(row: any) {
  if (!row) return null;
  return {
    ...row,
    role: ['ANONYMOUS', 'USER', 'EDITOR', 'ADMIN', 'AUTHOR'][row.role] ?? 'USER',
    image: row.csld_image?.id ? row.csld_image : null,
    lastRating: row.last_rating,
    birthDate: row.birth_date?.toISOString().split('T')[0] ?? null,
    amountOfComments: row.amount_of_comments,
    amountOfPlayed: row.amount_of_played,
    amountOfCreated: row.amount_of_created,
    authoredGames: (row.csld_game_has_author ?? []).map((j: any) => normalizeGame(j.csld_game)).filter(Boolean),
    playedGames: [],
    wantedGames: [],
    ratings: (row.csld_rating ?? []).map((r: any) => ({
      ...r,
      game: normalizeGame(r.csld_game),
      user: null,
    })),
    commentsPaged: ({ offset, limit }: { offset: number; limit: number }) => {
      const comments = (row.csld_comment ?? [])
        .slice(offset, offset + limit)
        .map((c: any) => ({
          ...c,
          commentAsText: (c.comment ?? '').replace(/<[^>]*>/g, '').trim(),
          user: { id: row.id, name: row.name },
          game: normalizeGame(c.csld_game),
        }));
      return { comments, totalAmount: (row.csld_comment ?? []).length };
    },
  };
}

export async function userByIdResolver(
  _parent: unknown,
  args: { userId: string },
  ctx: Context,
) {
  const id = parseInt(args.userId, 10);
  if (isNaN(id)) return null;

  const row = await ctx.db.csld_csld_user.findUnique({
    where: { id },
    include: {
      csld_image: true,
      csld_comment: {
        include: { csld_game: true },
        orderBy: { added: 'desc' },
      },
      csld_rating: {
        include: { csld_game: true },
      },
      csld_game_has_author: {
        include: { csld_game: true },
      },
    },
  });

  return normalizeUser(row);
}

export async function userByEmailResolver(
  _parent: unknown,
  args: { email: string },
  ctx: Context,
) {
  if (!args.email) return null;
  return ctx.db.csld_csld_user.findUnique({
    where: { email: args.email },
    include: { csld_image: true },
  });
}

export async function usersByQueryResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 25;

  return ctx.db.csld_csld_user.findMany({
    where: {
      OR: [
        { name: { contains: args.query, mode: 'insensitive' } },
        { nickname: { contains: args.query, mode: 'insensitive' } },
      ],
    },
    skip: offset,
    take: limit,
    include: { csld_image: true },
  });
}

export async function loggedInUserResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  return ctx.user ? normalizeUser(ctx.user) : null;
}

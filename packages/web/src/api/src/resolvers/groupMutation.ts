import type { Context } from '../context.js';
import { isSignedIn, isAdminOfGroup } from '../auth/appUsers.js';
import { GraphQLError } from 'graphql';
import { normalizeGame } from './mappers.js';

function requireAdminOfGroup(ctx: Context) {
  if (!isAdminOfGroup(ctx)) {
    throw new GraphQLError('Insufficient permissions', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }
}

export async function createGroupResolver(
  _parent: unknown,
  args: { input: { name: string } },
  ctx: Context,
) {
  requireAdminOfGroup(ctx);

  const group = await ctx.db.csld_csld_group.create({
    data: { name: args.input.name },
    include: {
      csld_game_has_group: {
        include: { csld_game: true },
      },
    },
  });

  return {
    ...group,
    authorsOf: (group.csld_game_has_group ?? []).map((j) => j.csld_game).filter(Boolean).map((g: any) => normalizeGame(g)),
  };
}

export async function updateGroupResolver(
  _parent: unknown,
  args: { input: { id: string; name: string } },
  ctx: Context,
) {
  requireAdminOfGroup(ctx);

  const groupId = parseInt(args.input.id, 10);
  if (isNaN(groupId)) throw new GraphQLError('Invalid group ID');

  const group = await ctx.db.csld_csld_group.update({
    where: { id: groupId },
    data: { name: args.input.name },
    include: {
      csld_game_has_group: {
        include: { csld_game: true },
      },
    },
  });

  return {
    ...group,
    authorsOf: (group.csld_game_has_group ?? []).map((j) => j.csld_game).filter(Boolean).map((g: any) => normalizeGame(g)),
  };
}

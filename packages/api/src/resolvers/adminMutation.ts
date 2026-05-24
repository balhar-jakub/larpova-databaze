import type { Context } from '../context.js';
import { isAdmin } from '../auth/appUsers.js';
import { GraphQLError } from 'graphql';

function requireAdmin(ctx: Context) {
  if (!isAdmin(ctx)) {
    throw new GraphQLError('Admin access required', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }
}

export async function updateLabelResolver(
  _parent: unknown,
  args: { input: { id: string; name: string; description?: string } },
  ctx: Context,
) {
  requireAdmin(ctx);
  return ctx.db.csld_label.update({
    where: { id: parseInt(args.input.id) },
    data: { name: args.input.name, description: args.input.description ?? null },
  });
}

export async function setLabelRequiredResolver(
  _parent: unknown,
  args: { labelId: string; required: boolean },
  ctx: Context,
) {
  requireAdmin(ctx);
  return ctx.db.csld_label.update({
    where: { id: parseInt(args.labelId) },
    data: { is_required: args.required },
  });
}

export async function setLabelAuthorizedResolver(
  _parent: unknown,
  args: { labelId: string; authorized: boolean },
  ctx: Context,
) {
  requireAdmin(ctx);
  return ctx.db.csld_label.update({
    where: { id: parseInt(args.labelId) },
    data: { is_authorized: args.authorized },
  });
}

export async function deleteLabelResolver(
  _parent: unknown,
  args: { labelId: string },
  ctx: Context,
) {
  requireAdmin(ctx);
  const id = parseInt(args.labelId);
  const label = await ctx.db.csld_label.findUnique({ where: { id } });
  if (!label) return null;
  await ctx.db.csld_label.delete({ where: { id } });
  return label;
}

export async function setUserRoleResolver(
  _parent: unknown,
  args: { userId: string; role: string },
  ctx: Context,
) {
  requireAdmin(ctx);
  const roleMap: Record<string, number> = {
    USER: 1,
    EDITOR: 2,
    ADMIN: 3,
  };
  const role = roleMap[args.role] ?? 1;
  return ctx.db.csld_csld_user.update({
    where: { id: parseInt(args.userId) },
    data: { role },
    include: { csld_image: true },
  });
}

export async function deleteUserResolver(
  _parent: unknown,
  args: { userId: string },
  ctx: Context,
) {
  requireAdmin(ctx);
  const userId = parseInt(args.userId);
  const user = await ctx.db.csld_csld_user.findUnique({
    where: { id: userId },
    include: { csld_image: true },
  });
  if (!user) return null;

  // Cascade delete user data
  await ctx.db.$transaction([
    ctx.db.csld_rating.deleteMany({ where: { user_id: userId } }),
    ctx.db.csld_comment_upvote.deleteMany({ where: { user_id: userId } }),
    ctx.db.csld_comment.deleteMany({ where: { user_id: userId } }),
    ctx.db.csld_game_has_author.deleteMany({ where: { id_user: userId } }),
    ctx.db.csld_email_authentication.deleteMany({ where: { user_id: userId } }),
    ctx.db.csld_csld_user.delete({ where: { id: userId } }),
  ]);

  return user;
}

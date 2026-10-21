import type { Context } from '../context.js';
import { isAdmin } from '../auth/appUsers.js';
import { normalizeUserRef } from './mappers.js';
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
  const row = await ctx.db.csld_csld_user.update({
    where: { id: parseInt(args.userId) },
    data: { role },
    include: { csld_image: true },
  });
  // Raw Prisma row -> GraphQL User: numeric role breaks the UserRole enum and
  // the image FK is not an Image object.
  return normalizeUserRef(row);
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

  // Cascade delete user data. Two legacy FK shapes need explicit handling
  // inside the transaction:
  // 1. NoAction upvotes — on the user's OWN comments (same as their own
  //    upvote rows) they must be deleted before the comments.
  // 2. Restrict/no-action attribution (`csld_game.added_by`, `event.added_by`,
  //    `csld_csld_group.administrator_id`, `csld_photo.author`) — the records
  //    the user touched must SURVIVE (games, events, groups are not theirs to
  //    take with them); the FK columns are nullable, so the user is detached
  //    from them instead. `csld_label.added_by` and `csld_article.author_id`
  //    are NOT nullable — a user who owns either is not deletable; the
  //    transaction rolls back and nothing is removed.
  await ctx.db.$transaction([
    ctx.db.csld_rating.deleteMany({ where: { user_id: userId } }),
    ctx.db.csld_comment_upvote.deleteMany({ where: { user_id: userId } }),
    // upvotes by OTHERS on this user's comments (NoAction FK, legacy schema)
    ctx.db.csld_comment_upvote.deleteMany({ where: { csld_comment: { user_id: userId } } }),
    ctx.db.csld_comment.deleteMany({ where: { user_id: userId } }),
    ctx.db.csld_game_has_author.deleteMany({ where: { id_user: userId } }),
    ctx.db.csld_email_authentication.deleteMany({ where: { user_id: userId } }),
    // detach from surviving records (nullable FK columns)
    ctx.db.csld_game.updateMany({ where: { added_by: userId }, data: { added_by: null } }),
    ctx.db.event.updateMany({ where: { added_by: userId }, data: { added_by: null } }),
    ctx.db.csld_csld_group.updateMany({ where: { administrator_id: userId }, data: { administrator_id: null } }),
    ctx.db.csld_photo.updateMany({ where: { author: userId }, data: { author: null } }),
    ctx.db.csld_csld_user.delete({ where: { id: userId } }),
  ]);

  return normalizeUserRef(user);
}

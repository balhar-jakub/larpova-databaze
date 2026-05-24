import type { Context } from '../context.js';
import { isSignedIn, isAtLeastEditor } from '../auth/appUsers.js';
import { GraphQLError } from 'graphql';
import { normalizeGame } from './mappers.js';
import type { Prisma } from '@prisma/client';
import { Base64UploadedFile } from '../files/fileService.js';
import { getCoverImageStrategy } from '../files/imageStrategies.js';

// ── Helpers ──────────────────────────────────────────────

function requireAuth(ctx: Context) {
  if (!isSignedIn(ctx)) {
    throw new GraphQLError('Authentication required', {
      extensions: { code: 'AUTHENTICATION_REQUIRED' },
    });
  }
}

function requireEditor(ctx: Context) {
  if (!isAtLeastEditor(ctx)) {
    throw new GraphQLError('Editor access required', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }
}

/** Convert URLs in plain text to HTML <a> links */
function urlLinkify(text: string): string {
  if (!text) return text;
  return text.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

// ── rateGame ─────────────────────────────────────────────

export async function rateGameResolver(
  _parent: unknown,
  args: { gameId: string; rating?: number },
  ctx: Context,
) {
  requireAuth(ctx);
  const gameId = parseInt(args.gameId, 10);
  if (isNaN(gameId)) throw new GraphQLError('Invalid gameId');

  if (args.rating == null) {
    // Remove rating (un-rate)
    await ctx.db.csld_rating.deleteMany({
      where: { game_id: gameId, user_id: ctx.user!.id },
    });
  } else {
    // Upsert rating — state=2 means PLAYED when rating is given
    await ctx.db.csld_rating.upsert({
      where: {
        game_id_user_id: { game_id: gameId, user_id: ctx.user!.id },
      },
      create: {
        game_id: gameId,
        user_id: ctx.user!.id,
        rating: args.rating,
        state: 2, // PLAYED
      },
      update: {
        rating: args.rating,
        state: 2,
      },
    });
  }

  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  });
  return game ? normalizeGame(game) : null;
}

// ── deleteGameRating ─────────────────────────────────────

export async function deleteGameRatingResolver(
  _parent: unknown,
  args: { gameId: string; userId?: string },
  ctx: Context,
) {
  requireEditor(ctx); // editor+, not admin-only
  const gameId = parseInt(args.gameId, 10);
  const userId = args.userId ? parseInt(args.userId, 10) : null;
  if (isNaN(gameId)) throw new GraphQLError('Invalid gameId');

  await ctx.db.csld_rating.deleteMany({
    where: {
      game_id: gameId,
      ...(userId ? { user_id: userId } : {}),
    },
  });

  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  });
  return game ? normalizeGame(game) : null;
}

// ── setGamePlayedState ───────────────────────────────────

export async function setGamePlayedStateResolver(
  _parent: unknown,
  args: { gameId: string; state: number },
  ctx: Context,
) {
  requireAuth(ctx);
  const gameId = parseInt(args.gameId, 10);
  if (isNaN(gameId)) throw new GraphQLError('Invalid gameId');

  if (args.state === 0) {
    // Remove play state entirely
    await ctx.db.csld_rating.deleteMany({
      where: { game_id: gameId, user_id: ctx.user!.id },
    });
  } else {
    // Upsert with state (WANT_TO_PLAY=1 or PLAYED=2)
    await ctx.db.csld_rating.upsert({
      where: {
        game_id_user_id: { game_id: gameId, user_id: ctx.user!.id },
      },
      create: {
        game_id: gameId,
        user_id: ctx.user!.id,
        state: args.state,
      },
      update: {
        state: args.state,
      },
    });
  }

  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  });
  return game ? normalizeGame(game) : null;
}

// ── createOrUpdateComment ────────────────────────────────

export async function createOrUpdateCommentResolver(
  _parent: unknown,
  args: { gameId: string; comment: string },
  ctx: Context,
) {
  requireAuth(ctx);
  const gameId = parseInt(args.gameId, 10);
  if (isNaN(gameId)) throw new GraphQLError('Invalid gameId');

  if (!args.comment || args.comment.trim().length === 0) {
    throw new GraphQLError('Comment cannot be empty', {
      extensions: { code: 'VALIDATION_FAILED' },
    });
  }

  // URL-linkify (not HTML sanitization — comments only get links)
  const processed = urlLinkify(args.comment.trim());

  // Check if comment already exists for this user+game
  const existing = await ctx.db.csld_comment.findFirst({
    where: { game_id: gameId, user_id: ctx.user!.id },
  });

  if (existing) {
    await ctx.db.csld_comment.update({
      where: { id: existing.id },
      data: { comment: processed, added: new Date() },
    });
  } else {
    await ctx.db.csld_comment.create({
      data: {
        game_id: gameId,
        user_id: ctx.user!.id,
        comment: processed,
        is_hidden: false,
        amount_of_upvotes: 0,
      },
    });
  }

  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  });
  return game ? normalizeGame(game) : null;
}

// ── setCommentVisible ────────────────────────────────────

export async function setCommentVisibleResolver(
  _parent: unknown,
  args: { commentId: string; visible: boolean },
  ctx: Context,
) {
  requireEditor(ctx);
  const commentId = parseInt(args.commentId, 10);
  if (isNaN(commentId)) throw new GraphQLError('Invalid commentId');

  const comment = await ctx.db.csld_comment.update({
    where: { id: commentId },
    data: { is_hidden: !args.visible },
    include: { csld_game: { include: { csld_game_has_label: { include: { csld_label: true } } } } },
  });

  return comment.csld_game ? normalizeGame(comment.csld_game) : null;
}

// ── setCommentLiked ──────────────────────────────────────

export async function setCommentLikedResolver(
  _parent: unknown,
  args: { commentId: string; liked: boolean },
  ctx: Context,
) {
  requireAuth(ctx);
  const commentId = parseInt(args.commentId, 10);
  if (isNaN(commentId)) throw new GraphQLError('Invalid commentId');

  if (args.liked) {
    // Check for existing upvote
    const existing = await ctx.db.csld_comment_upvote.findFirst({
      where: { comment_id: commentId, user_id: ctx.user!.id },
    });
    if (!existing) {
      await ctx.db.csld_comment_upvote.create({
        data: { comment_id: commentId, user_id: ctx.user!.id },
      });
    }
  } else {
    await ctx.db.csld_comment_upvote.deleteMany({
      where: { comment_id: commentId, user_id: ctx.user!.id },
    });
  }

  // Update the denormalized count
  const count = await ctx.db.csld_comment_upvote.count({
    where: { comment_id: commentId },
  });
  await ctx.db.csld_comment.update({
    where: { id: commentId },
    data: { amount_of_upvotes: count },
  });

  const comment = await ctx.db.csld_comment.findUnique({
    where: { id: commentId },
    include: { csld_game: { include: { csld_game_has_label: { include: { csld_label: true } } } } },
  });

  return comment?.csld_game ? normalizeGame(comment.csld_game) : null;
}

// ── deleteGame ───────────────────────────────────────────

export async function deleteGameResolver(
  _parent: unknown,
  args: { gameId: string },
  ctx: Context,
) {
  requireAuth(ctx);
  const gameId = parseInt(args.gameId, 10);
  if (isNaN(gameId)) throw new GraphQLError('Invalid gameId');

  // Wrap in transaction: soft-delete game + hide all comments
  await ctx.db.$transaction([
    ctx.db.csld_game.update({
      where: { id: gameId },
      data: { deleted: true },
    }),
    ctx.db.csld_comment.updateMany({
      where: { game_id: gameId },
      data: { is_hidden: true },
    }),
  ]);

  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  });
  return game ? normalizeGame(game) : null;
}

// ── createGame ───────────────────────────────────────────

export async function createGameResolver(
  _parent: unknown,
  args: { input: any },
  ctx: Context,
) {
  requireAuth(ctx);
  const { input } = args;

  const game = await ctx.db.csld_game.create({
    data: {
      name: input.name,
      description: urlLinkify(input.description ?? ''),
      year: input.year ?? null,
      players: input.players ?? null,
      men_role: input.menRole ?? null,
      women_role: input.womenRole ?? null,
      both_role: input.bothRole ?? null,
      hours: input.hours ?? null,
      days: input.days ?? null,
      web: input.web ?? null,
      gallery_url: input.galleryURL ?? null,
      photo_author: input.photoAuthor ?? null,
      ratingsdisabled: input.ratingsDisabled ?? false,
      commentsdisabled: input.commentsDisabled ?? false,
      added_by: ctx.user!.id,
      deleted: false,
      lang: 'cs',
      // cover image/video handled in Phase 5
    },
  });

  // Handle cover image upload
  if (input.coverImage?.fileName && input.coverImage?.contents) {
    const uploaded = new Base64UploadedFile(input.coverImage.fileName, input.coverImage.contents);
    const strategy = getCoverImageStrategy();
    const result = await ctx.files.saveImageAndReturnPath(uploaded, strategy);

    await ctx.db.csld_image.create({
      data: {
        path: result.path,
        contenttype: `image/${input.coverImage.fileName.split('.').pop()?.toLowerCase() || 'jpeg'}`,
      },
    });

    // Link cover image to game
    const image = await ctx.db.csld_image.findFirst({
      where: { path: result.path },
      orderBy: { id: 'desc' },
    });
    if (image) {
      await ctx.db.csld_game.update({
        where: { id: game.id },
        data: { cover_image: image.id },
      });
    }
  }

  // Link authors (user authors)
  if (input.authors?.length) {
    for (const authorId of input.authors) {
      await ctx.db.csld_game_has_author.create({
        data: { id_game: game.id, id_user: parseInt(authorId) },
      });
    }
  }

  // Link group authors
  if (input.groupAuthors?.length) {
    for (const groupId of input.groupAuthors) {
      await ctx.db.csld_game_has_group.create({
        data: { id_game: game.id, id_group: parseInt(groupId) },
      });
    }
  }

  // Link labels
  if (input.labels?.length) {
    for (const labelId of input.labels) {
      await ctx.db.csld_game_has_label.create({
        data: { id_game: game.id, id_label: parseInt(labelId) },
      });
    }
  }

  const fullGame = await ctx.db.csld_game.findUnique({
    where: { id: game.id },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_game_has_author: { include: { csld_csld_user: true } },
      csld_game_has_group: { include: { csld_csld_group: true } },
      csld_game_has_event: { include: { event: true } },
      csld_video: true,
      csld_image_csld_game_cover_imageTocsld_image: true,
      csld_image_csld_game_imageTocsld_image: true,
      csld_photo_csld_photo_gameTocsld_game: {
        include: { csld_image: true },
        orderBy: { orderseq: 'asc' },
      },
      similar_games_similar_games_id_game1Tocsld_game: {
        include: { csld_game_similar_games_id_game2Tocsld_game: true },
        take: 9,
      },
      csld_comment: {
        include: { csld_csld_user: true, csld_game: true },
        orderBy: { added: 'asc' },
      },
      csld_rating: {
        include: { csld_csld_user: true, csld_game: true },
      },
    },
  });

  return fullGame ? normalizeGame(fullGame) : null;
}

// ── updateGame ───────────────────────────────────────────

export async function updateGameResolver(
  _parent: unknown,
  args: { input: any },
  ctx: Context,
) {
  requireAuth(ctx);
  const { input } = args;
  const gameId = parseInt(input.id);
  if (isNaN(gameId)) throw new GraphQLError('Invalid game ID');

  // Verify ownership or editor status
  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: { csld_game_has_author: true },
  });

  if (!game) throw new GraphQLError('Game not found');

  const isAuthor = game.csld_game_has_author.some(
    (a) => a.id_user === ctx.user!.id,
  );
  if (!isAuthor && !isAtLeastEditor(ctx)) {
    throw new GraphQLError('Not authorized to edit this game', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }

  // Update game fields
  await ctx.db.csld_game.update({
    where: { id: gameId },
    data: {
      name: input.name,
      description: urlLinkify(input.description ?? ''),
      year: input.year ?? null,
      players: input.players ?? null,
      men_role: input.menRole ?? null,
      women_role: input.womenRole ?? null,
      both_role: input.bothRole ?? null,
      hours: input.hours ?? null,
      days: input.days ?? null,
      web: input.web ?? null,
      gallery_url: input.galleryURL ?? null,
      photo_author: input.photoAuthor ?? null,
      ratingsdisabled: input.ratingsDisabled ?? false,
      commentsdisabled: input.commentsDisabled ?? false,
      added: new Date(), // Java behavior: reset added timestamp on every save
    },
  });

  // Sync authors — delete old, insert new
  if (input.authors) {
    await ctx.db.csld_game_has_author.deleteMany({ where: { id_game: gameId } });
    for (const authorId of input.authors) {
      await ctx.db.csld_game_has_author.create({
        data: { id_game: gameId, id_user: parseInt(authorId) },
      });
    }
  }

  // Handle cover image upload
  if (input.coverImage?.fileName && input.coverImage?.contents) {
    const uploaded = new Base64UploadedFile(input.coverImage.fileName, input.coverImage.contents);
    const strategy = getCoverImageStrategy();
    const result = await ctx.files.saveImageAndReturnPath(uploaded, strategy);

    await ctx.db.csld_image.create({
      data: {
        path: result.path,
        contenttype: `image/${input.coverImage.fileName.split('.').pop()?.toLowerCase() || 'jpeg'}`,
      },
    });

    const image = await ctx.db.csld_image.findFirst({
      where: { path: result.path },
      orderBy: { id: 'desc' },
    });
    if (image) {
      await ctx.db.csld_game.update({
        where: { id: gameId },
        data: { cover_image: image.id },
      });
    }
  }

  // Sync group authors
  if (input.groupAuthors) {
    await ctx.db.csld_game_has_group.deleteMany({ where: { id_game: gameId } });
    for (const groupId of input.groupAuthors) {
      await ctx.db.csld_game_has_group.create({
        data: { id_game: gameId, id_group: parseInt(groupId) },
      });
    }
  }

  // Sync labels
  if (input.labels) {
    await ctx.db.csld_game_has_label.deleteMany({ where: { id_game: gameId } });
    for (const labelId of input.labels) {
      await ctx.db.csld_game_has_label.create({
        data: { id_game: gameId, id_label: parseInt(labelId) },
      });
    }
  }

  const fullGame = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_game_has_author: { include: { csld_csld_user: true } },
      csld_game_has_group: { include: { csld_csld_group: true } },
      csld_game_has_event: { include: { event: true } },
      csld_video: true,
      csld_image_csld_game_cover_imageTocsld_image: true,
      csld_image_csld_game_imageTocsld_image: true,
      csld_photo_csld_photo_gameTocsld_game: {
        include: { csld_image: true },
        orderBy: { orderseq: 'asc' },
      },
      similar_games_similar_games_id_game1Tocsld_game: {
        include: { csld_game_similar_games_id_game2Tocsld_game: true },
        take: 9,
      },
      csld_comment: {
        include: { csld_csld_user: true, csld_game: true },
        orderBy: { added: 'asc' },
      },
      csld_rating: {
        include: { csld_csld_user: true, csld_game: true },
      },
    },
  });

  return fullGame ? normalizeGame(fullGame) : null;
}

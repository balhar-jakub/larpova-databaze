import type { Context } from '../context.js';
import { isSignedIn, isAtLeastEditor } from '../auth/appUsers.js';
import { GraphQLError } from 'graphql';
import { isGameAuthor } from './gamePermissions.js';
import { normalizeGame } from './mappers.js';
import { Base64UploadedFile } from '../files/fileService.js';
import { getCoverImageStrategy } from '../files/imageStrategies.js';

// ── Helpers ──────────────────────────────────────────────
/** Shared error messages: the GraphQL field name is the API contract
 * (tests assert on these strings), so they live here once. */
const INVALID_GAME_ID = 'Invalid gameId';
const INVALID_COMMENT_ID = 'Invalid commentId';
const GAME_NOT_FOUND = 'Game not found';
const NOT_FOUND = 'NOT_FOUND';
const notFoundError = () => new GraphQLError(GAME_NOT_FOUND, { extensions: { code: NOT_FOUND } });

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
  if (isNaN(gameId)) throw new GraphQLError(INVALID_GAME_ID);

  // A game with ratings disabled is not rateable through the API — the UI
  // hides the rating widget, the API must not rely on that.
  if (args.rating != null) {
    const gameRow = await ctx.db.csld_game.findUnique({
      where: { id: gameId },
      select: { ratingsdisabled: true },
    });
    if (gameRow?.ratingsdisabled) {
      throw new GraphQLError('Ratings are disabled for this game', {
        extensions: { code: 'RATINGS_DISABLED' },
      });
    }
  }
  // Removing a rating (rating == null) stays allowed: it is not new activity.

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
  // Recalculate rating aggregates on the game row
  const stats = await ctx.db.csld_rating.aggregate({
    where: { game_id: gameId, rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const avg = (stats._avg.rating ?? 0);
  const n = stats._count.rating ?? 0;
  // Bayesian average: shrink toward 50 (5.0 scale) with C=20
  const totalRating = n > 0 ? (avg * 10 * n + 50 * 20) / (n + 20) : 0;
  await ctx.db.csld_game.update({
    where: { id: gameId },
    data: {
      average_rating: avg * 10,
      total_rating: totalRating,
      amount_of_ratings: n,
    },
  });


  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_rating: { include: { csld_csld_user: true } },
    },
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
  if (isNaN(gameId)) throw new GraphQLError(INVALID_GAME_ID);

  await ctx.db.csld_rating.deleteMany({
    where: {
      game_id: gameId,
      ...(userId ? { user_id: userId } : {}),
    },
  });
  // Recalculate rating aggregates on the game row
  const stats = await ctx.db.csld_rating.aggregate({
    where: { game_id: gameId, rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const avg = (stats._avg.rating ?? 0);
  const n = stats._count.rating ?? 0;
  // Bayesian average: shrink toward 50 (5.0 scale) with C=20
  const totalRating = n > 0 ? (avg * 10 * n + 50 * 20) / (n + 20) : 0;
  await ctx.db.csld_game.update({
    where: { id: gameId },
    data: {
      average_rating: avg * 10,
      total_rating: totalRating,
      amount_of_ratings: n,
    },
  });


  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_rating: { include: { csld_csld_user: true } },
    },
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
  if (isNaN(gameId)) throw new GraphQLError(INVALID_GAME_ID);

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
  // Recalculate rating aggregates on the game row
  const stats = await ctx.db.csld_rating.aggregate({
    where: { game_id: gameId, rating: { not: null } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const avg = (stats._avg.rating ?? 0);
  const n = stats._count.rating ?? 0;
  // Bayesian average: shrink toward 50 (5.0 scale) with C=20
  const totalRating = n > 0 ? (avg * 10 * n + 50 * 20) / (n + 20) : 0;
  await ctx.db.csld_game.update({
    where: { id: gameId },
    data: {
      average_rating: avg * 10,
      total_rating: totalRating,
      amount_of_ratings: n,
    },
  });


  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_rating: { include: { csld_csld_user: true } },
    },
  });
  return game ? normalizeGame(game) : null;
}

// ── createOrUpdateComment ────────────────────────────────

/** New comments are refused on a comments-disabled game; editing an existing
 * one stays possible (the UI mirrors exactly that). */
async function requireCommentsEnabledForNew(db: Context['db'], gameId: number): Promise<void> {
  const gameRow = await db.csld_game.findUnique({
    where: { id: gameId },
    select: { commentsdisabled: true },
  });
  if (gameRow?.commentsdisabled) {
    throw new GraphQLError('Comments are disabled for this game', {
      extensions: { code: 'COMMENTS_DISABLED' },
    });
  }
}

/** Write the comment: update the user's existing row, or create the first
 * one (hidden=false, zero upvotes — same defaults the old insert used). */
async function writeComment(
  db: Context['db'],
  gameId: number,
  userId: number,
  existing: { id: number } | null,
  processed: string,
): Promise<void> {
  if (existing) {
    await db.csld_comment.update({
      where: { id: existing.id },
      data: { comment: processed, added: new Date() },
    });
  } else {
    await db.csld_comment.create({
      data: {
        game_id: gameId,
        user_id: userId,
        comment: processed,
        is_hidden: false,
        amount_of_upvotes: 0,
      },
    });
  }
}

export async function createOrUpdateCommentResolver(
  _parent: unknown,
  args: { gameId: string; comment: string },
  ctx: Context,
) {
  requireAuth(ctx);
  const gameId = parseInt(args.gameId, 10);
  if (isNaN(gameId)) throw new GraphQLError(INVALID_GAME_ID);

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

  if (!existing) {
    await requireCommentsEnabledForNew(ctx.db, gameId);
  }
  await writeComment(ctx.db, gameId, ctx.user!.id, existing, processed);

  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_rating: { include: { csld_csld_user: true } },
    },
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
  if (isNaN(commentId)) throw new GraphQLError(INVALID_COMMENT_ID);

  const comment = await ctx.db.csld_comment.update({
    where: { id: commentId },
    data: { is_hidden: !args.visible },
    include: { csld_game: { include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_rating: { include: { csld_csld_user: true } },
    } } },
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
  if (isNaN(commentId)) throw new GraphQLError(INVALID_COMMENT_ID);

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
    include: { csld_game: { include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_rating: { include: { csld_csld_user: true } },
    } } },
  });

  return comment?.csld_game ? normalizeGame(comment.csld_game) : null;
}

// ── deleteComment ────────────────────────────────────────

export async function deleteCommentResolver(
  _parent: unknown,
  args: { commentId: string },
  ctx: Context,
) {
  requireAuth(ctx);
  const commentId = parseInt(args.commentId, 10);
  if (isNaN(commentId)) throw new GraphQLError(INVALID_COMMENT_ID);

  // Verify the comment exists and belongs to current user (or user is editor)
  const comment = await ctx.db.csld_comment.findUnique({
    where: { id: commentId },
    select: { id: true, user_id: true, game_id: true },
  });

  if (!comment) throw new GraphQLError('Comment not found');
  if (comment.user_id !== ctx.user!.id && !isAtLeastEditor(ctx)) {
    throw new GraphQLError('Not authorized to delete this comment', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }

  // A comment with upvotes cannot be deleted directly — csld_comment_upvote
  // references it with NoAction (legacy schema). The upvotes must go first,
  // atomically with the comment, or the delete fails on any liked comment.
  await ctx.db.$transaction([
    ctx.db.csld_comment_upvote.deleteMany({ where: { comment_id: commentId } }),
    ctx.db.csld_comment.delete({ where: { id: commentId } }),
  ]);

  const game = await ctx.db.csld_game.findUnique({
    where: { id: comment.game_id },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_comment: { include: { csld_csld_user: true } },
      csld_rating: { include: { csld_csld_user: true } },
    },
  });
  return game ? normalizeGame(game) : null;
}

// ── setGameSeries ───────────────────────────────────────

/** Resolve the target series of setGameSeries: existing id, a new one by
 * name (reusing a same-name series instead of a silent duplicate), or null
 * (unlink). */
async function resolveTargetSeries(
  db: Context['db'],
  ctx: Context,
  input: { seriesId?: string | null; newSeriesName?: string | null },
): Promise<number | null> {
  if (input.seriesId) {
    const seriesId = parseInt(input.seriesId, 10);
    if (isNaN(seriesId)) throw new GraphQLError('Invalid series ID');
    const exists = await db.csld_series.findUnique({ where: { id: seriesId } });
    if (!exists || (exists.deleted && !isAtLeastEditor(ctx))) {
      throw new GraphQLError('Series not found', { extensions: { code: 'NOT_FOUND' } });
    }
    return seriesId;
  }
  if (input.newSeriesName?.trim()) {
    const name = input.newSeriesName.trim();
    const existing = await db.csld_series.findFirst({ where: { name, deleted: false } });
    return existing
      ? existing.id
      : (
          await db.csld_series.create({
            data: { name, added_by: ctx.user!.id, deleted: false },
          })
        ).id;
  }
  return null;
}

/**
 * Assign a game to a series (or unlink it from any series). The series is a
 * relationship between existing game rows: an instalment never loses its own
 * ratings, comments or play states, and the aggregate numbers on the series are
 * always computed over the instalments (see `normalizeSeries`).
 *
 * Permission mirrors updateGame: the game's authors may link the games they
 * wrote, editors and admins any game. Creating a series by name is part of the
 * same mutation (the edit form's picker offers "create new"); the series starts
 * empty of description — editing the description is an editor's job.
 */
export async function setGameSeriesResolver(
  _parent: unknown,
  args: { input: { gameId: string; seriesId?: string; newSeriesName?: string } },
  ctx: Context,
) {
  requireAuth(ctx);
  const { input } = args;
  const gameId = parseInt(input.gameId, 10);
  if (isNaN(gameId)) throw new GraphQLError('Invalid game ID');

  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: { csld_game_has_author: true },
  });
  if (!game) {
    throw notFoundError();
  }
  if (!(await isGameAuthor(game, ctx)) && !isAtLeastEditor(ctx)) {
    throw new GraphQLError('Not authorized to edit this game', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }

  const seriesId = await resolveTargetSeries(ctx.db, ctx, input);

  await ctx.db.csld_game.update({
    where: { id: gameId },
    data: { series_id: seriesId },
  });

  const fullGame = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_game_has_author: { include: { csld_csld_user: true } },
      csld_game_has_group: { include: { csld_csld_group: true } },
      csld_game_has_event: { include: { event: true } },
      csld_rating: { include: { csld_csld_user: true } },
    },
  });
  return fullGame ? normalizeGame(fullGame) : null;
}

// ── deleteGame ───────────────────────────────────────────

export async function deleteGameResolver(
  _parent: unknown,
  args: { gameId: string },
  ctx: Context,
) {
  requireAuth(ctx);
  const gameId = parseInt(args.gameId, 10);
  if (isNaN(gameId)) throw new GraphQLError(INVALID_GAME_ID);

  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: { csld_game_has_author: true },
  });
  if (!game) {
    throw notFoundError();
  }

  // The game's authors may delete the game they wrote, editors and admins
  // any game. Without this check any signed-in user could soft-delete a game
  // through the API — the button is hidden in the UI, the API was not.
  if (!(await isGameAuthor(game, ctx)) && !isAtLeastEditor(ctx)) {
    throw new GraphQLError('Not authorized to delete this game', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }

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

  const deletedGame = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_rating: { include: { csld_csld_user: true } },
    },
  });
  return deletedGame ? normalizeGame(deletedGame) : null;
}

// ── restoreGame ──────────────────────────────────────────

/**
 * Bring a soft-deleted game back. Deleting is a soft delete: the game is hidden
 * from everybody but editors and admins and its comments are hidden with it.
 * Restoring is the exact reverse, so the game reappears where it was.
 *
 * Editors and admins only — the legacy screen toggled the flag the same way
 * (`SqlGames.toggleDeleted`), so an author who deleted their own game asks a
 * moderator instead of restoring it themselves.
 */
export async function restoreGameResolver(
  _parent: unknown,
  args: { gameId: string },
  ctx: Context,
) {
  requireAuth(ctx);
  requireEditor(ctx);
  const gameId = parseInt(args.gameId, 10);

  const game = !isNaN(gameId)
    ? await ctx.db.csld_game.findUnique({ where: { id: gameId } })
    : null;
  if (!game) {
    throw notFoundError();
  }

  await ctx.db.$transaction([
    ctx.db.csld_game.update({
      where: { id: gameId },
      data: { deleted: false },
    }),
    // Undo the comment hiding that the deletion did. A comment a moderator hid
    // before the game was deleted comes back with it and can be hidden again
    // from the game detail.
    ctx.db.csld_comment.updateMany({
      where: { game_id: gameId },
      data: { is_hidden: false },
    }),
  ]);

  const restoredGame = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_rating: { include: { csld_csld_user: true } },
    },
  });
  return restoredGame ? normalizeGame(restoredGame) : null;
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
      ...gameFieldData(input),
      added_by: ctx.user!.id,
      deleted: false,
      lang: 'cs',
      // cover image/video handled in Phase 5
    },
  });

  // Handle cover image upload
  await saveCoverImage(ctx, game.id, input.coverImage);

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

/** Full include set for the game the mutation resolvers return (createGame,
 * updateGame, setGameSeries all serve the same shape). */
const FULL_GAME_INCLUDE = {
  csld_game_has_label: { include: { csld_label: true } },
  csld_game_has_author: { include: { csld_csld_user: true } },
  csld_game_has_group: { include: { csld_csld_group: true } },
  csld_game_has_event: { include: { event: true } },
  csld_video: true,
  csld_image_csld_game_cover_imageTocsld_image: true,
  csld_image_csld_game_imageTocsld_image: true,
  csld_photo_csld_photo_gameTocsld_game: {
    include: { csld_image: true },
    orderBy: { orderseq: 'asc' as const },
  },
  similar_games_similar_games_id_game1Tocsld_game: {
    include: { csld_game_similar_games_id_game2Tocsld_game: true },
    take: 9,
  },
  csld_comment: {
    include: { csld_csld_user: true, csld_game: true },
    orderBy: { added: 'asc' as const },
  },
  csld_rating: {
    include: { csld_csld_user: true, csld_game: true },
  },
};

/** Load the game an edit-style mutation may act on, with the author list the
 * permission check needs. Shared by updateGame, setGameSeries, deleteGame. */
async function loadEditableGame(ctx: Context, gameId: number) {
  const game = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: { csld_game_has_author: true },
  });
  if (!game) throw new GraphQLError(GAME_NOT_FOUND);
  return game;
}

/** Authors may edit the game they wrote; editors and admins any game. */
async function requireGameEditPermission(game: { csld_game_has_author: { id_user: number }[] }, ctx: Context) {
  if (!(await isGameAuthor(game, ctx)) && !isAtLeastEditor(ctx)) {
    throw new GraphQLError('Not authorized to edit this game', {
      extensions: { code: 'ACCESS_DENIED' },
    });
  }
}

/** Save the base (scalar) game fields; also used by createGame. */
function gameFieldData(input: any) {
  return {
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
  };
}

/** Store an uploaded cover image and link it to the game. Shared by
 * createGame and updateGame (identical block in both before). The GraphQL
 * schema (UploadedFileInput: fileName String!, contents String!) already
 * guarantees a half-input never reaches this far — null means "no upload". */
async function saveCoverImage(ctx: Context, gameId: number, coverImage: { fileName: string; contents: string } | null | undefined) {
  if (!coverImage) return;
  const uploaded = new Base64UploadedFile(coverImage.fileName, coverImage.contents);
  const strategy = getCoverImageStrategy();
  const result = await ctx.files.saveImageAndReturnPath(uploaded, strategy);

  await ctx.db.csld_image.create({
    data: {
      path: result.path,
      contenttype: `image/${coverImage.fileName.split('.').pop()?.toLowerCase() || 'jpeg'}`,
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

/** Replace the game's user-author links (delete old, insert new). */
async function syncGameAuthors(ctx: Context, gameId: number, authorIds: string[]) {
  await ctx.db.csld_game_has_author.deleteMany({ where: { id_game: gameId } });
  for (const authorId of authorIds) {
    await ctx.db.csld_game_has_author.create({
      data: { id_game: gameId, id_user: parseInt(authorId) },
    });
  }
}

/** Replace the game's group-author links (delete old, insert new). */
async function syncGameGroupAuthors(ctx: Context, gameId: number, groupIds: string[]) {
  await ctx.db.csld_game_has_group.deleteMany({ where: { id_game: gameId } });
  for (const groupId of groupIds) {
    await ctx.db.csld_game_has_group.create({
      data: { id_game: gameId, id_group: parseInt(groupId) },
    });
  }
}

/** Replace the game's label links (delete old, insert new). */
async function syncGameLabels(ctx: Context, gameId: number, labelIds: string[]) {
  await ctx.db.csld_game_has_label.deleteMany({ where: { id_game: gameId } });
  for (const labelId of labelIds) {
    await ctx.db.csld_game_has_label.create({
      data: { id_game: gameId, id_label: parseInt(labelId) },
    });
  }
}

/** Load the full game (all relations) a mutation returns. */
async function loadFullGame(ctx: Context, gameId: number) {
  const fullGame = await ctx.db.csld_game.findUnique({
    where: { id: gameId },
    include: FULL_GAME_INCLUDE,
  });
  return fullGame ? normalizeGame(fullGame) : null;
}

export async function updateGameResolver(
  _parent: unknown,
  args: { input: any },
  ctx: Context,
) {
  requireAuth(ctx);
  const { input } = args;
  const gameId = parseInt(input.id);
  if (isNaN(gameId)) throw new GraphQLError('Invalid game ID');

  // The game's authors may edit the game they wrote, editors and admins any game.
  const game = await loadEditableGame(ctx, gameId);
  await requireGameEditPermission(game, ctx);

  // Update game fields
  await ctx.db.csld_game.update({
    where: { id: gameId },
    data: {
      ...gameFieldData(input),
      added: new Date(), // Java behavior: reset added timestamp on every save
    },
  });

  // Sync authors — delete old, insert new
  if (input.authors) {
    await syncGameAuthors(ctx, gameId, input.authors);
  }

  // Handle cover image upload
  await saveCoverImage(ctx, gameId, input.coverImage);

  // Sync group authors
  if (input.groupAuthors) {
    await syncGameGroupAuthors(ctx, gameId, input.groupAuthors);
  }

  // Sync labels
  if (input.labels) {
    await syncGameLabels(ctx, gameId, input.labels);
  }

  return loadFullGame(ctx, gameId);
}

import type { Context } from '../context.js';
import { normalizeGame } from './mappers.js';
import type { Prisma } from '@prisma/client';

export async function gameByIdResolver(
  _parent: unknown,
  args: { gameId: string },
  ctx: Context,
) {
  const id = parseInt(args.gameId, 10);
  if (isNaN(id)) return null;

  const row = await ctx.db.csld_game.findUnique({
    where: { id },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_game_has_author: { include: { csld_csld_user: true } },
      csld_game_has_group: { include: { csld_csld_group: true } },
      csld_game_has_event: { include: { event: true } },
      csld_video: true,
      csld_image_csld_game_cover_imageTocsld_image: true,
      csld_image_csld_game_imageTocsld_image: true,
      csld_photo_csld_photo_gameTocsld_game: {
        include: { csld_image: true, csld_csld_user: true },
        orderBy: { orderseq: 'asc' },
      },
      similar_games_similar_games_id_game1Tocsld_game: {
        include: { csld_game_similar_games_id_game2Tocsld_game: true },
        orderBy: { similarity_coefficient: 'desc' },
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

  return normalizeGame(row);
}

// ── Ladder resolver ──────────────────────────────────────

type LadderType = 'RecentAndMostPlayed' | 'MostPlayed' | 'Recent' | 'Best' | 'MostCommented';

const LADDER_CONFIG: Record<LadderType, { orderBy: Prisma.csld_gameOrderByWithRelationInput; include: Prisma.csld_gameInclude }> = {
  RecentAndMostPlayed: {
    orderBy: { amount_of_ratings: 'desc' },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  },
  MostPlayed: {
    orderBy: { amount_of_ratings: 'desc' },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  },
  Recent: {
    orderBy: { added: 'desc' },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  },
  Best: {
    orderBy: { total_rating: 'desc' },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  },
  MostCommented: {
    orderBy: { amount_of_comments: 'desc' },
    include: { csld_game_has_label: { include: { csld_label: true } } },
  },
};

export async function ladderResolver(
  _parent: unknown,
  args: {
    ladderType: LadderType;
    offset?: number;
    limit?: number;
    requiredLabels?: string[];
    otherLabels?: string[];
  },
  ctx: Context,
) {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 25;
  const config = LADDER_CONFIG[args.ladderType] ?? LADDER_CONFIG.RecentAndMostPlayed;

  // Build label filter conditions
  const andConditions: Prisma.csld_gameWhereInput[] = [
    { deleted: false },
  ];

  if (args.requiredLabels?.length) {
    andConditions.push({
      csld_game_has_label: {
        some: {
          csld_label: { id: { in: args.requiredLabels.map(Number) } },
        },
      },
    });
  }

  if (args.otherLabels?.length) {
    andConditions.push({
      csld_game_has_label: {
        some: {
          csld_label: { id: { in: args.otherLabels.map(Number) } },
        },
      },
    });
  }

  const where: Prisma.csld_gameWhereInput = { AND: andConditions };

  const [games, totalAmount] = await Promise.all([
    ctx.db.csld_game.findMany({
      where,
      orderBy: config.orderBy,
      skip: offset,
      take: limit,
      include: config.include,
    }),
    ctx.db.csld_game.count({ where }),
  ]);

  return {
    games: games.map((g) => normalizeGame(g)),
    totalAmount,
  };
}

// ── byQuery / byQueryWithTotal resolvers ─────────────────

export async function byQueryResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 25;

  const games = await ctx.db.csld_game.findMany({
    where: {
      deleted: false,
      name: { contains: args.query, mode: 'insensitive' },
    },
    orderBy: { total_rating: 'desc' },
    skip: offset,
    take: limit,
    include: { csld_game_has_label: { include: { csld_label: true } } },
  });

  return games.map((g) => normalizeGame(g));
}

export async function byQueryWithTotalResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  const offset = args.offset ?? 0;
  const limit = args.limit ?? 25;

  const where: Prisma.csld_gameWhereInput = {
    deleted: false,
    name: { contains: args.query, mode: 'insensitive' },
  };

  const [games, totalAmount] = await Promise.all([
    ctx.db.csld_game.findMany({
      where,
      orderBy: { total_rating: 'desc' },
      skip: offset,
      take: limit,
      include: { csld_game_has_label: { include: { csld_label: true } } },
    }),
    ctx.db.csld_game.count({ where }),
  ]);

  return {
    games: games.map((g) => normalizeGame(g)),
    totalAmount,
  };
}

// ── GamesQuery type resolver ─────────────────────────────

export function gamesQueryResolver() {
  return {};
}

// ── Game type field resolvers ────────────────────────────

export async function gamesOfAuthorsResolver(
  parent: { id: number | string },
  _args: unknown,
  ctx: Context,
) {
  try {
    const gameId = typeof parent.id === 'string' ? parseInt(parent.id, 10) : parent.id;
    if (!gameId || isNaN(gameId)) return [];
    
    const authorLinks = await ctx.db.csld_game_has_author.findMany({
      where: { id_game: gameId },
      select: { id_user: true },
    });
    const authorIds = authorLinks.map((l) => l.id_user).filter(Boolean);
    if (authorIds.length === 0) return [];
    
    const otherGames = await ctx.db.csld_game.findMany({
      where: {
        id: { not: gameId },
        deleted: false,
      csld_game_has_author: {
        some: { id_user: { in: authorIds } },
      },
      },
      take: 9,
      orderBy: { total_rating: 'desc' },
      include: {
        csld_game_has_label: { include: { csld_label: true } },
        csld_image_csld_game_cover_imageTocsld_image: true,
      },
    });
    
    return otherGames.map((g) => normalizeGame(g));
  } catch (e) {
    console.error('gamesOfAuthors resolver error:', e);
    return [];
  }
}

export async function commentsPagedResolver(
  parent: { id: number | string },
  args: { offset: number; limit: number },
  ctx: Context,
) {
  try {
    const gameId = typeof parent.id === 'string' ? parseInt(parent.id, 10) : parent.id;
    if (!gameId || isNaN(gameId)) return { comments: [], totalAmount: 0 };
    
    const comments = await ctx.db.csld_comment.findMany({
      where: { game_id: gameId, is_hidden: false },
      orderBy: { added: 'desc' },
      skip: args.offset ?? 0,
      take: args.limit ?? 10,
      include: { csld_csld_user: true, csld_game: true },
    });
    const total = await ctx.db.csld_comment.count({
      where: { game_id: gameId, is_hidden: false },
    });
    
    return {
      comments: comments.map((c) => ({
        ...c,
        amountOfUpvotes: c.amount_of_upvotes ?? 0,
        amount_of_upvotes: c.amount_of_upvotes ?? 0,
        commentAsText: (c.comment ?? '').replace(/<[^>]*>/g, '').trim(),
        user: c.csld_csld_user ?? null,
        game: normalizeGame(c.csld_game),
      })),
      totalAmount: total,
    };
  } catch (e) {
    console.error('commentsPaged resolver error:', e);
    return { comments: [], totalAmount: 0 };
  }
}


import type { Context } from '../context.js';
import { normalizeGame, normalizeUserRef } from './mappers.js';
import { isAtLeastEditor } from '../auth/appUsers.js';
import type { Prisma } from '@prisma/client';
import { fetchGamesByIds, gamesSearchPage } from './search.js';

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
      csld_game_has_author: { include: { csld_csld_user: { include: { csld_image: true } } } },
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
        include: { csld_csld_user: { include: { csld_image: true } }, csld_game: true },
        orderBy: { added: 'asc' },
      },
      csld_rating: {
        include: { csld_csld_user: { include: { csld_image: true } }, csld_game: true },
      },
    },
  });

  // A deleted game is soft-deleted: it stays in the database so it can be
  // restored, but it must not be served any more. The legacy CSLD enforced this
  // in `GameBuilder.build()` — "shows deleted games only to editors and admins"
  // — and every query went through that builder; the rewrite lost the rule, so
  // a deleted game kept answering on its detail URL (and through the profile
  // lists) for everybody. Editors and admins still get it, marked by
  // `Game.deleted`, which is what the restore button keys off.
  if (row?.deleted && !isAtLeastEditor(ctx)) return null;

  return normalizeGame(row);
}

// ── Ladder resolver ──────────────────────────────────────

type LadderType = 'RecentAndMostPlayed' | 'MostPlayed' | 'Recent' | 'Best' | 'MostCommented';

/**
 * Legacy leaderboards. The games page now uses `games.catalog`; these stay for
 * old links and API clients, but each tab has to order by something different —
 * `RecentAndMostPlayed` and `MostPlayed` used to share an order by
 * `amount_of_ratings`, so two tabs returned the very same list. Nulls are
 * ordered last so that games without ratings never lead a "best" list.
 */
const LADDER_CONFIG: Record<LadderType, { orderBy: Prisma.csld_gameOrderByWithRelationInput[]; include: Prisma.csld_gameInclude }> = {
  RecentAndMostPlayed: {
    orderBy: [{ amount_of_played: { sort: 'desc', nulls: 'last' } }, { added: 'desc' }],
    include: { csld_game_has_label: { include: { csld_label: true } } },
  },
  MostPlayed: {
    orderBy: [{ amount_of_played: { sort: 'desc', nulls: 'last' } }, { name: { sort: 'asc', nulls: 'last' } }],
    include: { csld_game_has_label: { include: { csld_label: true } } },
  },
  Recent: {
    orderBy: [{ added: 'desc' }],
    include: { csld_game_has_label: { include: { csld_label: true } } },
  },
  Best: {
    // Average rating, not total_rating: the sum rewards games that merely have
    // more ratings, and NULL sums sorted first, so unrated games used to top
    // this ladder.
    orderBy: [{ average_rating: { sort: 'desc', nulls: 'last' } }, { amount_of_ratings: { sort: 'desc', nulls: 'last' } }],
    include: { csld_game_has_label: { include: { csld_label: true } } },
  },
  MostCommented: {
    orderBy: [{ amount_of_comments: { sort: 'desc', nulls: 'last' } }, { name: { sort: 'asc', nulls: 'last' } }],
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

/**
 * Both queries delegate to the shared search engine (`search.ts`): the plain
 * `contains` this used to run matched only a case-insensitive substring of the
 * name, so it missed every accented name typed without diacritics, ignored the
 * word order (`Novák Jozef` found nothing) and ranked by rating, which buried
 * the exact match.
 */
export async function byQueryResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  const page = await gamesSearchPage(ctx, args.query, args.offset ?? 0, args.limit ?? 25);
  return fetchGamesByIds(ctx, page.ids);
}

export async function byQueryWithTotalResolver(
  _parent: unknown,
  args: { query: string; offset?: number; limit?: number },
  ctx: Context,
) {
  const page = await gamesSearchPage(ctx, args.query, args.offset ?? 0, args.limit ?? 25);
  return {
    games: await fetchGamesByIds(ctx, page.ids),
    totalAmount: page.totalAmount,
    suggestion: page.suggestion,
  };
}

// ── GamesQuery type resolver ─────────────────────────────

export function gamesQueryResolver() {
  return {};
}


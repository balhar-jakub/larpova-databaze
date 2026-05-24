import type { Context } from '../context.js';
import { normalizeGame } from './mappers.js';

export async function homepageResolver(_parent: unknown, _args: unknown, ctx: Context) {
  const [lastAddedGames, mostPopularGames, nextEvents, lastComments] = await Promise.all([
    ctx.db.csld_game.findMany({
      where: { deleted: false },
      orderBy: { added: 'desc' },
      take: 6,
      include: { csld_game_has_label: { include: { csld_label: true } } },
    }),
    ctx.db.csld_game.findMany({
      where: { deleted: false },
      orderBy: { total_rating: 'desc' },
      take: 6,
      include: { csld_game_has_label: { include: { csld_label: true } } },
    }),
    ctx.db.event.findMany({
      where: {
        deleted: false,
        from: { gte: new Date() },
      },
      orderBy: { from: 'asc' },
      take: 6,
      include: {
        event_has_labels: { include: { csld_label: true } },
      },
    }),
    ctx.db.csld_comment.findMany({
      where: { is_hidden: false, csld_game: { deleted: false } },
      orderBy: { added: 'desc' },
      take: 5,
      include: {
        csld_game: true,
        csld_csld_user: true,
      },
    }),
  ]);

  return {
    lastAddedGames: lastAddedGames.map((g) => normalizeGame(g)),
    mostPopularGames: mostPopularGames.map((g) => normalizeGame(g)),
    nextEvents,
    lastComments: lastComments.map((c) => ({
      ...c,
      commentAsText: (c.comment ?? '').replace(/<[^>]*>/g, '').trim(),
      user: c.csld_csld_user,
      game: c.csld_game ? normalizeGame(c.csld_game) : null,
    })),
  };
}

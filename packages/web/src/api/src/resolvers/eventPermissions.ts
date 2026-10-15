import type { Context } from '../context.js';

/**
 * Is the logged-in user an author of a game linked to the event?
 *
 * Authorship lives in `csld_game_has_author`, linked to the event through
 * `csld_game_has_event` (an event may have several linked games — being the
 * author of any one of them grants the rights). Event authorship is data, not
 * a role: linked games' authors are ordinary users (`role` stays USER), which
 * is why this is asked separately from the editor/admin check, exactly like
 * `isGameAuthor` for games.
 */
export async function isLinkedGameAuthor(
  eventId: number | null | undefined,
  ctx: Context,
): Promise<boolean> {
  if (!ctx.user || !eventId) return false;
  const link = await ctx.db.csld_game_has_author.findFirst({
    where: {
      id_user: ctx.user.id,
      csld_game: {
        csld_game_has_event: { some: { event_id: eventId } },
      },
    },
  });
  return link !== null;
}

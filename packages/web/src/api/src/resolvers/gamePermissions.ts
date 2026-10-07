import type { Context } from '../context.js';
import { isAtLeastEditor } from '../auth/appUsers.js';

/**
 * What the logged-in user may do with one game. The values are the GraphQL
 * `AllowedAction` enum members, which the frontend turns into the edit and
 * delete buttons on the game detail page.
 */
export type GameAllowedAction = 'Edit' | 'Delete';

/**
 * A game as it reaches a `Game` field resolver: either the normalized shape
 * from `normalizeGame` (`authors`) or the raw Prisma row
 * (`csld_game_has_author`). Both are accepted because `normalizeGame` spreads
 * the row, so a normalized game still carries its raw relations.
 */
interface GameWithAuthors {
  id?: number | string | null;
  authors?: Array<{ id?: number | string | null } | null> | null;
  csld_game_has_author?: Array<{ id_user?: number | null } | null> | null;
}

/**
 * Author ids already loaded with the game, or `null` when the query did not
 * load them. Only the raw relation tells "loaded" from "not loaded":
 * `normalizeGame` always sets `authors`, an empty array included, so a game
 * from `games.byQuery` (no authors included) looks exactly like a game
 * without authors.
 */
function loadedAuthorIds(game: GameWithAuthors): number[] | null {
  if (!Array.isArray(game.csld_game_has_author)) return null;
  return game.csld_game_has_author
    .map((link) => Number(link?.id_user))
    .filter((id) => !isNaN(id));
}

/**
 * Is the logged-in user one of the game's authors?
 *
 * Authorship lives in `csld_game_has_author`, it is not a role: a game is
 * authored by ordinary users, whose `csld_csld_user.role` stays USER. An
 * author may edit and delete the games they wrote, which is why this is
 * asked separately from the editor/admin check.
 */
export async function isGameAuthor(
  game: GameWithAuthors | null | undefined,
  ctx: Context,
): Promise<boolean> {
  if (!ctx.user || !game) return false;

  const loaded = loadedAuthorIds(game);
  if (loaded) return loaded.includes(ctx.user.id);

  // The game came from a query that did not load its authors — ask the
  // database instead of reporting "not an author".
  const gameId = Number(game.id);
  if (!gameId || isNaN(gameId)) return false;
  const link = await ctx.db.csld_game_has_author.findFirst({
    where: { id_game: gameId, id_user: ctx.user.id },
  });
  return link !== null;
}

/**
 * Actions the logged-in user may perform on the game: its authors may manage
 * the game they wrote, editors and admins any game, everybody else none.
 */
export async function gameAllowedActions(
  game: GameWithAuthors | null | undefined,
  ctx: Context,
): Promise<GameAllowedAction[]> {
  if (!ctx.user) return [];
  if (isAtLeastEditor(ctx)) return ['Edit', 'Delete'];
  return (await isGameAuthor(game, ctx)) ? ['Edit', 'Delete'] : [];
}

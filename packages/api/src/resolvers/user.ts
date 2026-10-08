import type { Context } from '../context.js';
import { isAtLeastEditor } from '../auth/appUsers.js';
import { normalizeGame, normalizeGender, normalizeUserRole } from './mappers.js';
import { commentAsText } from './textUtils.js';

/**
 * Values of `csld_rating.state`, mirroring the legacy CSLD `Rating.GameState`
 * codes: 1 = "chci hrát", 2 = "hrál jsem", 0/NULL = "nehrál jsem".
 * A row with state 0 only carries a star rating (it predates the explicit
 * play state), so it belongs to neither list on the profile.
 */
export const STATE_WANT_TO_PLAY = 1;
export const STATE_PLAYED = 2;

/**
 * A soft-deleted game is hidden from everybody except editors and admins, and
 * the profile lists are no exception: the legacy `GameBuilder` applied that
 * rule to every query, so a game deleted on its detail page must not survive in
 * the profiles of its authors and players. `includeDeleted` carries the
 * viewer's role (see the resolvers) and defaults to the legacy behaviour —
 * hidden.
 */
export function normalizeUser(row: any, includeDeleted = false) {
  if (!row) return null;
  const visibleGame = (game: any) => Boolean(game) && (includeDeleted || !game.deleted);
  const ratingRows: any[] = (row.csld_rating ?? []).filter((r: any) => visibleGame(r.csld_game));
  const commentRows: any[] = (row.csld_comment ?? []).filter((c: any) => visibleGame(c.csld_game));
  // The profile splits the user's rating rows by play state: only state=PLAYED
  // games belong under "Hrál jsem" and only WANT_TO_PLAY under "Chci hrát".
  // Listing every row as played pushed the "want to play" games into the
  // played list and left "Chci hrát" empty.
  const playedGames = ratingRows
    .filter((r: any) => r.state === STATE_PLAYED)
    .map((r: any) => ({
      game: normalizeGame(r.csld_game),
      rating: r.rating,
    }))
    .filter((pg: any) => pg.game != null);
  const wantedGames = ratingRows
    .filter((r: any) => r.state === STATE_WANT_TO_PLAY)
    .map((r: any) => normalizeGame(r.csld_game))
    .filter(Boolean);
  return {
    ...row,
    role: normalizeUserRole(row.role),
    // The raw column is a number and the field is the `Gender` enum of names.
    gender: normalizeGender(row.gender),
    // `row.image` is the scalar foreign key; the GraphQL field is an Image.
    // Returning the raw row made every query answer
    // "Cannot return null for non-nullable field Image.id".
    image: row.csld_image?.id ? row.csld_image : null,
    lastRating: row.last_rating,
    birthDate: row.birth_date?.toISOString().split('T')[0] ?? null,
    // The database column is `address`, the GraphQL field is `city`. Without
    // this mapping the settings form loads an empty city and saving wipes it.
    city: row.address ?? null,
    amountOfComments: row.amount_of_comments,
    // `amount_of_played` is a legacy denormalized column that nothing updates
    // any more, so it drifts from the ratings. Count the played rows we have
    // loaded instead; fall back to the column when the relation is absent.
    amountOfPlayed: row.csld_rating ? playedGames.length : row.amount_of_played,
    amountOfCreated: row.amount_of_created,
    authoredGames: (row.csld_game_has_author ?? []).map((j: any) => j.csld_game).filter(visibleGame).map((g: any) => normalizeGame(g)),
    playedGames,
    wantedGames,
    ratings: ratingRows.map((r: any) => ({
      ...r,
      game: normalizeGame(r.csld_game),
      user: null,
    })),
    commentsPaged: ({ offset, limit }: { offset: number; limit: number }) => {
      // Comments on a deleted game stay hidden too — their game link would lead
      // to a page that no longer answers — so the total counts only the rows the
      // caller may see.
      const comments = commentRows.slice(offset, offset + limit).map((c: any) => ({
        ...c,
        commentAsText: commentAsText(c.comment),
        user: { id: row.id, name: row.name, role: normalizeUserRole(row.role) },
        game: normalizeGame(c.csld_game),
      }));
      return { comments, totalAmount: commentRows.length };
    },
  };
}

export async function userByIdResolver(
  _parent: unknown,
  args: { userId: string },
  ctx: Context,
) {
  const id = parseInt(args.userId, 10);
  if (isNaN(id)) return null;

  const row = await ctx.db.csld_csld_user.findUnique({
    where: { id },
    include: {
      csld_image: true,
      csld_comment: {
        include: { csld_game: true },
        orderBy: { added: 'desc' },
      },
      csld_rating: {
        include: { csld_game: true },
      },
      csld_game_has_author: {
        include: { csld_game: true },
      },
    },
  });

  return normalizeUser(row, isAtLeastEditor(ctx));
}

export async function userByEmailResolver(
  _parent: unknown,
  args: { email: string },
  ctx: Context,
) {
  if (!args.email) return null;
  const row = await ctx.db.csld_csld_user.findUnique({
    where: { email: args.email },
    include: { csld_image: true },
  });
  return normalizeUser(row, isAtLeastEditor(ctx));
}

/**
 * `usersByQuery` moved to `search.ts` with the rest of the search: it is the
 * engine that knows about diacritics, word prefixes and ranking, and that module
 * imports `normalizeUser` from here (never the other way round).
 *
 * `normalizeUser` stays here: it maps the numeric `role` to the `UserRole` enum
 * and the scalar `image` foreign key to the `Image` object, and every user row
 * that reaches the API has to pass through it.
 */

export async function loggedInUserResolver(
  _parent: unknown,
  _args: unknown,
  ctx: Context,
) {
  if (!ctx.user) return null;

  // Re-load from DB with all relations (ctx.user is a flat AuthUser from session
  // that lacks csld_rating, csld_comment, csld_game_has_author, etc.)
  const row = await ctx.db.csld_csld_user.findUnique({
    where: { id: ctx.user.id },
    include: {
      csld_image: true,
      csld_comment: {
        include: { csld_game: true },
        orderBy: { added: 'desc' },
      },
      csld_rating: {
        include: { csld_game: true },
      },
      csld_game_has_author: {
        include: { csld_game: true },
      },
    },
  });

  return normalizeUser(row, isAtLeastEditor(ctx));
}

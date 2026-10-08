import { commentAsText } from './textUtils.js';

/**
 * `csld_csld_user.role` is a number (0 ANONYMOUS, 1 USER, 2 EDITOR, 3 ADMIN,
 * 4 AUTHOR) while the GraphQL field is the `UserRole` enum of *names*: handing
 * the number to the enum fails the whole path with
 * `Enum "UserRole" cannot represent value: 1`.
 */
const USER_ROLE_NAMES = ['ANONYMOUS', 'USER', 'EDITOR', 'ADMIN', 'AUTHOR'];

export function normalizeUserRole(role: number | null | undefined): string {
  return USER_ROLE_NAMES[role ?? -1] ?? 'USER';
}

/**
 * `csld_csld_user.gender` is a number (0 unspecified, 1 male, 2 female) while the
 * GraphQL field is the `Gender` enum of names — the same trap as `role`: handing
 * the number to the enum fails the whole path with
 * `Enum "Gender" cannot represent value: 1`. The UI picks its wording
 * (`Hrál jsem` / `Hrála jsem`) from it, so an unknown value has to answer
 * UNSPECIFIED rather than break the query.
 */
const GENDER_NAMES = ['UNSPECIFIED', 'MALE', 'FEMALE'];

export function normalizeGender(gender: number | null | undefined): string {
  return GENDER_NAMES[gender ?? 0] ?? 'UNSPECIFIED';
}

/** The GraphQL enum value back to the number stored in the database. */
export function genderToNumber(gender: string | null | undefined): number {
  const index = GENDER_NAMES.indexOf(gender ?? '');
  return index < 0 ? 0 : index;
}

/**
 * A `User` reached through another type — a game author, the author of a
 * comment or of a rating. A raw `csld_csld_user` row cannot be served as a
 * `User`: the numeric `role` breaks the enum (above), and `image` is the scalar
 * foreign key while the schema declares an `Image`, which answers
 * `Cannot return null for non-nullable field Image.id`. Both are mapped here,
 * every other scalar passes through. A caller that wants the photo itself has
 * to include `csld_image`.
 */
export function normalizeUserRef(row: any) {
  if (!row) return null;
  return {
    ...row,
    role: normalizeUserRole(row.role),
    gender: normalizeGender(row.gender),
    image: row.csld_image?.id ? row.csld_image : null,
  };
}

/**
 * Normalize a Prisma game row (snake_case) to GraphQL schema (camelCase).
 */
export function normalizeGame(row: any) {
  if (!row) return null;
  return {
    ...row,
    // Non-null in the schema, nullable in the database: a game with no ratings
    // has NULL here and returning null failed the whole query ("Cannot return
    // null for non-nullable field Game.totalRating") for the search and for the
    // last pages of the ladder.
    totalRating: row.total_rating ?? 0,
    averageRating: row.average_rating ?? 0,
    amountOfComments: row.amount_of_comments,
    amountOfPlayed: row.amount_of_played,
    amountOfRatings: row.amount_of_ratings,
    galleryURL: row.gallery_url,
    photoAuthor: row.photo_author,
    ratingsDisabled: row.ratingsdisabled,
    commentsDisabled: row.commentsdisabled,
    menRole: row.men_role,
    womenRole: row.women_role,
    bothRole: row.both_role,
    labels: (row.csld_game_has_label ?? []).map((j: any) => j.csld_label).filter(Boolean),
    authors: (row.csld_game_has_author ?? []).map((j: any) => normalizeUserRef(j.csld_csld_user)).filter(Boolean),
    groupAuthor: (row.csld_game_has_group ?? []).map((j: any) => j.csld_csld_group).filter(Boolean),
    events: (row.csld_game_has_event ?? []).map((j: any) => j.event).filter(Boolean),
    video: row.csld_video ?? null,
    coverImage: row.csld_image_csld_game_cover_imageTocsld_image ?? null,
    image: row.csld_image_csld_game_imageTocsld_image ?? null,
    photos: (row.csld_photo_csld_photo_gameTocsld_game ?? []).map((p: any) => ({
      ...p,
      fullWidth: p.fullwidth,
      fullHeight: p.fullheight,
      image: p.csld_image ?? null,
      game: normalizeGame(p.csld_game_csld_photo_gameTocsld_game),
    })),
    similarGames: (row.similar_games_similar_games_id_game1Tocsld_game ?? []).map(
      (s: any) => s.csld_game_similar_games_id_game2Tocsld_game
    ).filter(Boolean)
      // A soft-deleted game must not be offered as a recommendation; the legacy
      // code carried a standing TODO to verify this (SqlSimilarGames).
      .filter((g: any) => !g.deleted)
      .map((g: any) => normalizeGame(g)),
    ratingStats: computeRatingStats(row.csld_rating ?? []),
    comments: (row.csld_comment ?? []).map((c: any) => ({
      ...c,
      commentAsText: commentAsText(c.comment),
      user: normalizeUserRef(c.csld_csld_user),
      game: normalizeGame(c.csld_game),
    })),
    ratings: (row.csld_rating ?? []).map((r: any) => ({
      ...r,
      game: normalizeGame(r.csld_game),
      user: normalizeUserRef(r.csld_csld_user),
    })),
    allowedActions: null, // computed field — needs auth context
  };
}

function computeRatingStats(ratings: any[]) {
  const counts = new Map<number, number>();
  for (const r of ratings) {
    if (r.rating != null) {
      counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);
    }
  }
  return Array.from(counts, ([rating, count]) => ({ rating, count }));
}


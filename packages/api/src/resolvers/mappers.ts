/**
 * Normalize a Prisma game row (snake_case) to GraphQL schema (camelCase).
 */
export function normalizeGame(row: any) {
  if (!row) return null;
  return {
    ...row,
    // Both fields are non-null in the schema but nullable in the database:
    // a game with no ratings has NULL here, and returning null made the whole
    // query fail ("Cannot return null for non-nullable field Game.totalRating")
    // for the search and the last pages of the ladder.
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
    authors: (row.csld_game_has_author ?? []).map((j: any) => j.csld_csld_user).filter(Boolean),
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
      game: p.csld_game_csld_photo_gameTocsld_game ?? null,
    })),
    similarGames: (row.similar_games_similar_games_id_game1Tocsld_game ?? []).map(
      (s: any) => s.csld_game_similar_games_id_game2Tocsld_game
    ).filter(Boolean),
    gamesOfAuthors: (row.csld_game_has_author ?? [])
      .flatMap((j: any) => j.csld_csld_user?.csld_game_has_author ?? [])
      .map((a: any) => a.csld_game)
      .filter((g: any) => g && g.id !== row.id),
    ratingStats: computeRatingStats(row.csld_rating ?? []),
    comments: (row.csld_comment ?? []).map((c: any) => ({
      ...c,
      commentAsText: stripHtml(c.comment),
      user: c.csld_csld_user ?? null,
      game: c.csld_game ?? null,
    })),
    ratings: (row.csld_rating ?? []).map((r: any) => ({
      ...r,
      game: r.csld_game ?? null,
      user: r.csld_csld_user ?? null,
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

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return html.replace(/<[^>]*>/g, '').trim();
}

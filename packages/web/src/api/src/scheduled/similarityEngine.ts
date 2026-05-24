import type { PrismaClient } from '@prisma/client';

// ── 5-Factor Similarity Engine ───────────────────────────
//
// Factors (from Java SqlSimilarGames.java):
//   Label overlap:   40% — custom: required labels count double
//   Rating similarity: 20% — 1 - abs(r1 - r2) / 10
//   Author overlap:  20% — Jaccard index
//   Year proximity:  10% — 1 - abs(y1 - y2) / maxYearDiff
//   Player proximity: 10% — 1 - abs(p1 - p2) / maxPlayersDiff
//
// Stores top 9 most similar games per game in similar_games table.

interface GameVector {
  id: number;
  labelIds: number[];
  requiredLabelIds: number[];
  totalRating: number;
  authorIds: number[];
  year: number;
  players: number;
}

export async function recalculateSimilarity(db: PrismaClient): Promise<void> {
  console.log('Similarity engine: loading games...');

  const games = await db.csld_game.findMany({
    where: { deleted: false },
    include: {
      csld_game_has_label: { include: { csld_label: true } },
      csld_game_has_author: true,
    },
  });

  if (games.length < 2) {
    console.log('Similarity engine: not enough games (< 2), skipping');
    return;
  }

  const vectors: GameVector[] = games.map((g) => ({
    id: g.id,
    labelIds: g.csld_game_has_label.map((j) => j.id_label),
    requiredLabelIds: g.csld_game_has_label
      .filter((j) => j.csld_label?.is_required)
      .map((j) => j.id_label),
    totalRating: g.total_rating ?? 0,
    authorIds: g.csld_game_has_author.map((j) => j.id_user),
    year: g.year ?? new Date().getFullYear(),
    players: g.players ?? 0,
  }));

  // Compute max differences for normalization
  const years = vectors.map((v) => v.year);
  const players = vectors.map((v) => v.players);
  const maxYearDiff = Math.max(1, Math.max(...years) - Math.min(...years));
  const maxPlayersDiff = Math.max(1, Math.max(...players) - Math.min(...players));

  console.log(`Similarity engine: computing for ${vectors.length} games...`);

  // Build similarity matrix for new/stale games
  // NOTE: full O(n²) for all pairs. For large datasets, batch by recently-updated games.
  for (let i = 0; i < vectors.length; i++) {
    const a = vectors[i];
    const similarities: { gameId: number; coefficient: number }[] = [];

    for (let j = 0; j < vectors.length; j++) {
      if (i === j) continue;
      const b = vectors[j];

      const coefficient = computeSimilarity(a, b, maxYearDiff, maxPlayersDiff);
      similarities.push({ gameId: b.id, coefficient });
    }

    // Sort descending, take top 9
    similarities.sort((x, y) => y.coefficient - x.coefficient);
    const top9 = similarities.slice(0, 9);

    // Upsert into similar_games
    await db.$transaction(async (tx) => {
      // Delete old similar games for this game
      await tx.similar_games.deleteMany({
        where: { id_game1: a.id },
      });

      // Insert top 9
      for (const sim of top9) {
        if (sim.coefficient > 0) {
          await tx.similar_games.create({
            data: {
              id_game1: a.id,
              id_game2: sim.gameId,
              similarity_coefficient: sim.coefficient,
            },
          });
        }
      }
    });
  }

  console.log(`Similarity engine: done (${vectors.length} games processed)`);
}

// ── Similarity computation ───────────────────────────────

function computeSimilarity(
  a: GameVector,
  b: GameVector,
  maxYearDiff: number,
  maxPlayersDiff: number,
): number {
  const labelSim = labelSimilarity(a, b);
  const ratingSim = 1 - Math.abs(a.totalRating - b.totalRating) / 10;
  const authorSim = jaccardSimilarity(a.authorIds, b.authorIds);
  const yearSim = 1 - Math.abs(a.year - b.year) / maxYearDiff;
  const playerSim = 1 - Math.abs(a.players - b.players) / maxPlayersDiff;

  return (
    0.4 * labelSim +
    0.2 * Math.max(0, ratingSim) +
    0.2 * authorSim +
    0.1 * yearSim +
    0.1 * playerSim
  );
}

/**
 * Custom label similarity: required labels count double.
 * Formula from Java SqlSimilarGames:
 *   distance = disjunctLabels + differingRequiredLabels
 *   size = max(setA.size, setB.size) + differingRequiredLabels
 *   similarity = 1 - distance / size
 */
function labelSimilarity(a: GameVector, b: GameVector): number {
  const setA = new Set(a.labelIds);
  const setB = new Set(b.labelIds);

  const differing = [...setA].filter((id) => !setB.has(id)).concat(
    [...setB].filter((id) => !setA.has(id)),
  );

  const differingRequired = differing.filter(
    (id) => a.requiredLabelIds.includes(id) || b.requiredLabelIds.includes(id),
  ).length;

  const distance = differing.length + differingRequired;
  const size = Math.max(setA.size, setB.size) + differingRequired;

  if (size === 0) return 1;
  return 1 - distance / size;
}

/**
 * Jaccard similarity between two sets.
 */
function jaccardSimilarity(setA: number[], setB: number[]): number {
  const a = new Set(setA);
  const b = new Set(setB);

  if (a.size === 0 && b.size === 0) return 1;

  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;

  if (union === 0) return 1;
  return intersection / union;
}

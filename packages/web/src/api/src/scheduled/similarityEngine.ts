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

  const vectors = games.map(toGameVector);
  const maxYearDiff = maxDiff(vectors.map((v) => v.year));
  const maxPlayersDiff = maxDiff(vectors.map((v) => v.players));

  console.log(`Similarity engine: computing for ${vectors.length} games...`);

  // Build similarity matrix for new/stale games
  // NOTE: full O(n²) for all pairs. For large datasets, batch by recently-updated games.
  for (let i = 0; i < vectors.length; i++) {
    const a = vectors[i];
    const similarities: { gameId: number; coefficient: number }[] = [];

    for (let j = 0; j < vectors.length; j++) {
      if (i === j) continue;
      const b = vectors[j];
      similarities.push({ gameId: b.id, coefficient: computeSimilarity(a, b, maxYearDiff, maxPlayersDiff) });
    }

    await persistTopSimilarities(db, a, similarities);
  }

  console.log(`Similarity engine: done (${vectors.length} games processed)`);
}

// ── Vector helpers (extracted to keep recalculateSimilarity small) ──

function toGameVector(g: any): GameVector {
  return {
    id: g.id,
    labelIds: g.csld_game_has_label.map((j: any) => j.id_label),
    requiredLabelIds: g.csld_game_has_label
      .filter((j: any) => j.csld_label?.is_required)
      .map((j: any) => j.id_label),
    totalRating: g.total_rating ?? 0,
    authorIds: g.csld_game_has_author.map((j: any) => j.id_user),
    year: g.year ?? new Date().getFullYear(),
    players: g.players ?? 0,
  };
}

/** Max difference between values, floored at 1 so normalization never divides by zero. */
function maxDiff(values: number[]): number {
  return Math.max(1, Math.max(...values) - Math.min(...values));
}

/** Replace one game's similar_games rows with its current top-9 positive matches. */
async function persistTopSimilarities(
  db: PrismaClient,
  a: GameVector,
  similarities: { gameId: number; coefficient: number }[],
): Promise<void> {
  similarities.sort((x, y) => y.coefficient - x.coefficient);
  const top9 = similarities.slice(0, 9);

  await db.$transaction(async (tx) => {
    await tx.similar_games.deleteMany({ where: { id_game1: a.id } });
    for (const sim of top9) {
      if (sim.coefficient > 0) {
        await tx.similar_games.create({
          data: { id_game1: a.id, id_game2: sim.gameId, similarity_coefficient: sim.coefficient },
        });
      }
    }
  });
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
export function jaccardSimilarity(setA: number[], setB: number[]): number {
  const a = new Set(setA);
  const b = new Set(setB);

  if (a.size === 0 && b.size === 0) return 1;

  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;

  if (union === 0) return 1;
  return intersection / union;
}

import type { PrismaClient } from '@prisma/client';
import { recalculateSimilarity } from './similarityEngine.js';
import { importLarpCzEvents } from '../external/larpCzImport.js';

/**
 * Nightly recalculation of amount_of_ratings.
 * 
 * The DB trigger maintains this count in real-time, but the Java
 * RegularTasks.nightly() runs a full SQL recalculation to correct
 * any drift accumulated by the trigger. We replicate that here.
 */
export async function recalculateAmountOfRatings(db: PrismaClient): Promise<void> {
  console.log('Nightly: recalculating amount_of_ratings...');
  await db.$executeRaw`
    UPDATE csld_game
    SET amount_of_ratings = subquery.ratings
    FROM (
      SELECT sum(amounts.amount_of_ratings) AS ratings, amounts.game_id
      FROM (
        SELECT count(*) AS amount_of_ratings, game_id
        FROM csld_rating
        GROUP BY game_id, rating
        HAVING rating IS NOT NULL
      ) AS amounts
      GROUP BY amounts.game_id
    ) AS subquery
    WHERE csld_game.id = subquery.game_id
  `;
  console.log('Nightly: amount_of_ratings recalculation done');
}

/**
 * Run the nightly batch (intended to be called by node-cron at 02:00).
 */
export async function runNightlyBatch(db: PrismaClient): Promise<void> {
  console.log('=== Nightly batch starting ===');

  // recalculate amount_of_ratings
  try {
    await recalculateAmountOfRatings(db);
  } catch (err) {
    console.error('Nightly: amount_of_ratings failed:', err);
  }

  // Similarity engine
  try {
    await recalculateSimilarity(db);
  } catch (err) {
    console.error('Nightly: similarity engine failed:', err);
  }

  // larp.cz import (if enabled)
  if (process.env.INTEGRATE_CALENDAR === 'true') {
    try {
      await importLarpCzEvents(db);
    } catch (err) {
      console.error('Nightly: larp.cz import failed:', err);
    }
  }

  console.log('=== Nightly batch complete ===');
}

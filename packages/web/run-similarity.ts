/**
 * Standalone script to run the similarity engine on the production database.
 * Usage: npx tsx run-similarity.ts
 * 
 * Connects to the DB, runs runNightlyBatch() which includes:
 *   1. recalculateAmountOfRatings()
 *   2. recalculateSimilarity() — O(n²) for ~1500 games, takes 5-15 min
 */
import { PrismaClient } from '@prisma/client';
import { runNightlyBatch } from './src/api/src/scheduled/tasks.js';

async function main() {
  console.log('=== CSLD Similarity Engine Runner ===');
  console.log('Connecting to database...');

  const prisma = new PrismaClient();

  try {
    // Verify connection
    const gameCount = await prisma.csld_game.count({ where: { deleted: false } });
    console.log(`Connected. Found ${gameCount} active games.`);

    if (gameCount < 2) {
      console.log('Not enough games for similarity computation. Exiting.');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log(`Estimated runtime: ${Math.round(gameCount * gameCount / 1500 / 60)} minutes for ${gameCount} games (O(${gameCount}²))`);
    console.log('Running nightly batch (amount_of_ratings + similarity engine)...');
    console.log('');

    const start = Date.now();
    await runNightlyBatch(prisma);
    const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);

    console.log('');
    console.log(`=== Done in ${elapsed} minutes ===`);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

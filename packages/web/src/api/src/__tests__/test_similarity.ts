import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config({ path: new URL('../.env', import.meta.url).pathname });

const db = new PrismaClient();

async function main() {
  const { recalculateSimilarity } = await import('../scheduled/similarityEngine.js');
  await recalculateSimilarity(db);
  
  const results = await db.similar_games.findMany();
  console.log(`Similarity results: ${results.length} rows`);
  
  for (const r of results) {
    const g1 = await db.csld_game.findUnique({ where: { id: r.id_game1! } });
    const g2 = await db.csld_game.findUnique({ where: { id: r.id_game2! } });
    console.log(`  ${g1?.name} → ${g2?.name}: ${r.similarity_coefficient?.toFixed(4)}`);
  }
  
  await db.$disconnect();
}

main();

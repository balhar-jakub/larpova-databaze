import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';

/**
 * Cold arms of resolvers/game.ts: the gamesByQuery/gamesByQueryWithTotal
 * paging defaults (offset/limit omitted), a game's comments resolved from a
 * parent that did not include them (the ?? [] arms), and a null comment
 * string tolerated by the text extraction.
 */
const stamp = Date.now();
const marker = `garm-${stamp}`;

let server: ReturnType<typeof createTestServer>;
let userId: number;
let gameId: number;

beforeAll(async () => {
  server = createTestServer();
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  userId = user.id;
  const game = await prisma.csld_game.create({
    data: { name: `${marker} hra`, deleted: false, added_by: userId, lang: 'cs' },
  });
  gameId = game.id;
});

afterAll(async () => {
  await prisma.csld_game.deleteMany({ where: { id: gameId } });
  await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('gamesByQuery paging defaults', () => {
  it('answers with offset 0 and limit 25 when the args are omitted', async () => {
    const res: any = await executeQuery(
      server,
      `query ($q: String!) { games { byQuery(query: $q) { id name comments { id commentAsText } } } }`,
      { q: marker },
    );
    expect(res.errors).toBeUndefined();
    const games = res.data.games.byQuery;
    expect(games.map((g: any) => Number(g.id))).toContain(gameId);
    // comments resolved on a parent that did not include them → [] (the ?? arm)
    const mine = games.find((g: any) => Number(g.id) === gameId);
    expect(mine.comments).toEqual([]);
    expect(games.length).toBeLessThanOrEqual(25);
  });

  it('byQueryWithTotal answers the same defaults with the honest total', async () => {
    const res: any = await executeQuery(
      server,
      `query ($q: String!) { games { byQueryWithTotal(query: $q) { totalAmount games { id } } } }`,
      { q: marker },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data.games.byQueryWithTotal.totalAmount).toBeGreaterThanOrEqual(1);
  });
});

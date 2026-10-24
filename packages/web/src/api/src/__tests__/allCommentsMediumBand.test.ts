import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';

/**
 * The MEDIUM band of the /komentare filter (200–999 stripped characters).
 *
 * A separate suite on purpose: the band helper answers from a 60-second
 * process-wide cache, so a comment created inside the main allComments suite
 * would be invisible to that suite's own band queries. Here the suite is the
 * first to touch the module in this jest process (its own module registry
 * under --runInBand is shared — but jest resets module registries between
 * test FILES, and the suite creates its comment before its first query).
 */
const FIXTURE_YEAR = new Date().getUTCFullYear() + 10;
const stamp = Date.now();
const marker = `cmedium-${stamp}`;

let server: ReturnType<typeof createTestServer>;
let userId: number;
let gameId: number;
let mediumCommentId: number;

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

  // ~420 stripped characters: MEDIUM (>= 200, < 1000).
  const filler = 'stredne dlouhy text '.repeat(20).trim();
  const medium = await prisma.csld_comment.create({
    data: {
      game_id: gameId,
      user_id: userId,
      comment: `<p>${marker} ${filler}</p>`,
      is_hidden: false,
      added: new Date(Date.UTC(FIXTURE_YEAR, 5, 1, 12, 30, 0)),
    },
  });
  mediumCommentId = medium.id;

  // Warm the cache AFTER the comment exists (the first query below).
});

afterAll(async () => {
  await prisma.csld_comment.deleteMany({ where: { id: mediumCommentId } });
  await prisma.csld_game.deleteMany({ where: { id: gameId } });
  await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('allComments MEDIUM band', () => {
  it('lists the medium comment under length: MEDIUM and the chips count it', async () => {
    const mediums: any = await executeQuery(
      server,
      `{ allComments(offset: 0, limit: 50, length: MEDIUM, year: ${FIXTURE_YEAR}) { totalAmount comments { id } } }`,
    );
    expect(mediums.errors).toBeUndefined();
    expect(mediums.data.allComments.comments.map((c: any) => c.id)).toContain(String(mediumCommentId));

    const stats: any = await executeQuery(
      server,
      `{ commentsStats { lengths { SHORT MEDIUM LONG } } }`,
    );
    expect(stats.errors).toBeUndefined();
    expect(stats.data.commentsStats.lengths.MEDIUM).toBeGreaterThanOrEqual(1);
  });
});

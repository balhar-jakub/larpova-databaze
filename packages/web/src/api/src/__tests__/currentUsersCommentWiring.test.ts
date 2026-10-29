import { ApolloServer } from '@apollo/server';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * Regression test for the lost `Game.currentUsersComment` wiring.
 *
 * The resolver existed in resolvers/game.ts and was wired in
 * resolvers/index.ts by 562545bd, but the 6479b800 merge of
 * hermes/magic-link into main resolved the Game-map conflict in favour of
 * the main side, which only had an inline currentUsersRating — so
 * `currentUsersComment: currentUsersCommentResolver` silently disappeared
 * from the resolver map. From then on Apollo's default field resolver read
 * `parent.currentUsersComment` (undefined) and the field answered null for
 * EVERY signed-in user, on EVERY game — so the game detail page never
 * rendered the "Upravit komentář" / "Smazat komentář" buttons and the edit
 * modal always opened empty. Reproduced on production: gameById(1270) with
 * a signed-in user returned the user's comment under `comments` but
 * `currentUsersComment: null`.
 *
 * This test goes through the real resolver map (createTestServer) with a
 * signed-in context, so a missing wiring fails here instead of in prod.
 */
describe('Game.currentUsersComment wiring (resolvers/index.ts)', () => {
  let server: ApolloServer;
  const marker = `CucWiring${Date.now()}`;

  let userId: number;
  let otherUserId: number;
  let gameId: number;
  let commentId: number;

  const QUERY = `query ($id: ID!) {
    gameById(gameId: $id) {
      id
      currentUsersComment { id comment }
    }
  }`;

  const ctx = (user: { id: number; role: number } | null) =>
    user ? { user: { id: user.id, email: `u-${marker}@integration.test`, role: user.role } } : {};

  beforeAll(async () => {
    server = createTestServer();

    const user = await prisma.csld_csld_user.create({
      data: { password: 'x', role: 1, name: `${marker} user`, email: `${marker}-u@integration.test` },
    });
    userId = user.id;
    const other = await prisma.csld_csld_user.create({
      data: { password: 'x', role: 1, name: `${marker} other`, email: `${marker}-o@integration.test` },
    });
    otherUserId = other.id;

    const game = await prisma.csld_game.create({
      data: { name: `${marker} hra`, deleted: false, added_by: userId, lang: 'cs' },
    });
    gameId = game.id;

    const comment = await prisma.csld_comment.create({
      data: { game_id: gameId, user_id: userId, comment: '<p>muj komentar</p>', is_hidden: false, amount_of_upvotes: 0 },
    });
    commentId = comment.id;
  });

  afterAll(async () => {
    await prisma.csld_comment.deleteMany({ where: { id: commentId } });
    await prisma.csld_game.deleteMany({ where: { id: gameId } });
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.$disconnect();
  });

  it('returns the signed-in user\'s own comment through the resolver map', async () => {
    const result = await executeQuery(server, QUERY, { id: String(gameId) }, ctx({ id: userId, role: 1 }));
    expect(result.errors).toBeUndefined();
    const game = (result.data as any).gameById;
    expect(game.currentUsersComment).not.toBeNull();
    expect(game.currentUsersComment.id).toBe(String(commentId));
    expect(game.currentUsersComment.comment).toBe('<p>muj komentar</p>');
  });

  it('returns null for a signed-in user without a comment on that game', async () => {
    const result = await executeQuery(server, QUERY, { id: String(gameId) }, ctx({ id: otherUserId, role: 1 }));
    expect(result.errors).toBeUndefined();
    expect((result.data as any).gameById.currentUsersComment).toBeNull();
  });

  it('returns null for an anonymous visitor even when a comment exists', async () => {
    const result = await executeQuery(server, QUERY, { id: String(gameId) });
    expect(result.errors).toBeUndefined();
    expect((result.data as any).gameById.currentUsersComment).toBeNull();
  });
});

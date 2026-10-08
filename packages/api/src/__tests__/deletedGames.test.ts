import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * A soft-deleted game must disappear from everything but the screens of editors
 * and admins — the legacy CSLD rule, spelled out in `GameBuilder.build()`
 * ("Add restriction that shows deleted games only to editors and admins").
 *
 * The rewrite lost it: deleting set `deleted = true` (and hid the comments), the
 * lists filtered it out, but `gameById` kept answering and the profile lists
 * kept the game, so a deleted game stayed fully readable on its detail URL and
 * in the profile of its authors and players. Reproduced against production
 * before the fix: `gameById(gameId: 1093)` ("Test 2", deleted) answered with the
 * game while `games.byQuery("Test 2")` was empty, and `userById(1)` listed three
 * deleted games under `authoredGames`.
 *
 * `restoreGame` (editors and admins only) is the way back — the deletion is a
 * soft delete and there was no way to undo it at all.
 */
describe('deleted games', () => {
  let server: ApolloServer;
  const marker = `DeletedProbe${Date.now()}`;

  const EDITOR = 2;
  const USER = 1;

  let authorId: number;
  let editorId: number;
  let deletedGameId: number;
  let liveGameId: number;
  let restoreGameId: number;
  let commentId: number;

  const editorCtx = () => ({ user: { id: editorId, email: `e-${marker}@integration.test`, role: EDITOR } });
  const authorCtx = () => ({ user: { id: authorId, email: `a-${marker}@integration.test`, role: USER } });

  beforeAll(async () => {
    server = createTestServer();

    const author = await prisma.csld_csld_user.create({
      data: {
        password: 'x',
        role: USER,
        name: `${marker} autor`,
        email: `a-${marker}@integration.test`,
      },
    });
    authorId = author.id;

    const editor = await prisma.csld_csld_user.create({
      data: {
        password: 'x',
        role: EDITOR,
        name: `${marker} editor`,
        email: `e-${marker}@integration.test`,
      },
    });
    editorId = editor.id;

    const deleted = await prisma.csld_game.create({
      data: { name: `${marker} smazaná`, description: 'x', deleted: true, added_by: authorId },
    });
    deletedGameId = deleted.id;
    await prisma.csld_game_has_author.create({ data: { id_game: deletedGameId, id_user: authorId } });

    // What `deleteGame` does to the comments of the game it hides.
    const comment = await prisma.csld_comment.create({
      data: {
        game_id: deletedGameId,
        user_id: authorId,
        comment: `${marker} komentář`,
        is_hidden: true,
        amount_of_upvotes: 0,
      },
    });
    commentId = comment.id;

    // The author played (and rated) the game they wrote, so it must vanish from
    // the played list too.
    await prisma.csld_rating.create({
      data: { game_id: deletedGameId, user_id: authorId, rating: 8, state: 2 },
    });

    const live = await prisma.csld_game.create({
      data: { name: `${marker} živá`, description: 'x', deleted: false, added_by: authorId },
    });
    liveGameId = live.id;
    await prisma.csld_game_has_author.create({ data: { id_game: liveGameId, id_user: authorId } });

    const restorable = await prisma.csld_game.create({
      data: { name: `${marker} k obnovení`, description: 'x', deleted: true, added_by: authorId },
    });
    restoreGameId = restorable.id;
    await prisma.csld_comment.create({
      data: {
        game_id: restoreGameId,
        user_id: authorId,
        comment: `${marker} komentář k obnovení`,
        is_hidden: true,
        amount_of_upvotes: 0,
      },
    });
  });

  afterAll(async () => {
    const gameIds = [deletedGameId, liveGameId, restoreGameId];
    await prisma.csld_comment.deleteMany({ where: { game_id: { in: gameIds } } });
    await prisma.csld_rating.deleteMany({ where: { game_id: { in: gameIds } } });
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: { in: gameIds } } });
    await prisma.csld_game.deleteMany({ where: { id: { in: gameIds } } });
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: [authorId, editorId] } } });
    await prisma.$disconnect();
  });

  const GAME = `query ($id: ID!) { gameById(gameId: $id) { id name deleted allowedActions authors { id } } }`;
  const PROFILE = `query ($id: ID!) {
    userById(userId: $id) {
      id
      authoredGames { id name }
      playedGames { game { id name } }
      commentsPaged(offset: 0, limit: 20) { totalAmount comments { id game { id name } } }
    }
  }`;

  test('an anonymous visitor no longer gets a deleted game', async () => {
    const deleted = await executeQuery(server, GAME, { id: String(deletedGameId) });
    expect(deleted.errors).toBeUndefined();
    expect((deleted.data as any).gameById).toBeNull();

    const live = await executeQuery(server, GAME, { id: String(liveGameId) });
    expect((live.data as any).gameById.id).toBe(String(liveGameId));
  });

  test('its author does not get it either — authorship does not beat deletion', async () => {
    const result = await executeQuery(server, GAME, { id: String(deletedGameId) }, authorCtx());
    expect(result.errors).toBeUndefined();
    expect((result.data as any).gameById).toBeNull();
  });

  test('an editor gets it, marked as deleted, without a Delete action', async () => {
    const result = await executeQuery(server, GAME, { id: String(deletedGameId) }, editorCtx());
    expect(result.errors).toBeUndefined();
    const game = (result.data as any).gameById;
    expect(game.deleted).toBe(true);
    // Deleting it again is a no-op; what an editor needs is Edit (the UI drives
    // Restore from `deleted`).
    expect(game.allowedActions).toEqual(['Edit']);
  });

  test('the profiles of ordinary visitors drop the deleted game', async () => {
    const result = await executeQuery(server, PROFILE, { id: String(authorId) });
    expect(result.errors).toBeUndefined();
    const profile = (result.data as any).userById;

    const authoredIds = profile.authoredGames.map((g: any) => g.id);
    expect(authoredIds).toContain(String(liveGameId));
    expect(authoredIds).not.toContain(String(deletedGameId));

    const playedIds = profile.playedGames.map((p: any) => p.game.id);
    expect(playedIds).not.toContain(String(deletedGameId));

    expect(profile.commentsPaged.comments.map((c: any) => c.id)).not.toContain(String(commentId));
    expect(profile.commentsPaged.totalAmount).toBe(0);
  });

  test('editors still see them in a profile', async () => {
    const result = await executeQuery(server, PROFILE, { id: String(authorId) }, editorCtx());
    expect(result.errors).toBeUndefined();
    const profile = (result.data as any).userById;
    expect(profile.authoredGames.map((g: any) => g.id)).toContain(String(deletedGameId));
    expect(profile.playedGames.map((p: any) => p.game.id)).toContain(String(deletedGameId));
    expect(profile.commentsPaged.comments.map((c: any) => c.id)).toContain(String(commentId));
  });

  test('the search never returned a deleted game (control)', async () => {
    const result = await executeQuery(server, `{ games { byQuery(query: "${marker}") { id name } } }`);
    expect(result.errors).toBeUndefined();
    const ids = (result.data as any).games.byQuery.map((g: any) => g.id);
    expect(ids).toContain(String(liveGameId));
    expect(ids).not.toContain(String(deletedGameId));
    expect(ids).not.toContain(String(restoreGameId));
  });

  describe('restoreGame', () => {
    const RESTORE = `mutation ($id: ID!) { game { restoreGame(gameId: $id) { id deleted } } }`;

    test('anonymous cannot restore', async () => {
      const result = await executeQuery(server, RESTORE, { id: String(restoreGameId) });
      expect(result.errors?.[0]?.extensions?.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('an author cannot restore, not even their own game', async () => {
      const result = await executeQuery(server, RESTORE, { id: String(restoreGameId) }, authorCtx());
      expect(result.errors?.[0]?.extensions?.code).toBe('ACCESS_DENIED');
    });

    test('an unknown game is NOT_FOUND', async () => {
      const result = await executeQuery(server, RESTORE, { id: '99999999' }, editorCtx());
      expect(result.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    });

    test('an editor restores the game and its comments', async () => {
      const result = await executeQuery(server, RESTORE, { id: String(restoreGameId) }, editorCtx());
      expect(result.errors).toBeUndefined();
      expect((result.data as any).game.restoreGame.deleted).toBe(false);

      const row = await prisma.csld_game.findUnique({ where: { id: restoreGameId } });
      expect(row?.deleted).toBe(false);
      const comment = await prisma.csld_comment.findFirst({ where: { game_id: restoreGameId } });
      expect(comment?.is_hidden).toBe(false);

      // And it is back for everybody, detail page included.
      const anonymous = await executeQuery(server, GAME, { id: String(restoreGameId) });
      expect((anonymous.data as any).gameById.id).toBe(String(restoreGameId));
    });
  });
});

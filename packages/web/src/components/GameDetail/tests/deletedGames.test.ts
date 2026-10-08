import { resolvers } from '../../../api/src/resolvers/index';
import { normalizeGame } from '../../../api/src/resolvers/mappers';
import { normalizeUser } from '../../../api/src/resolvers/user';

/**
 * The deletion rule, checked against the copy the server really loads:
 * `server.ts` imports `./src/api/src/...` and `packages/web/jest.config.json`
 * never collects the tests inside that tree, so a regression there would slip
 * through the API suite.
 *
 * The legacy CSLD rule (`GameBuilder.build()`: "shows deleted games only to
 * editors and admins") was lost in the rewrite: the detail query kept answering
 * for a soft-deleted game and the profile kept listing it, while the searches
 * filtered it out — so deleting "worked" and the game stayed readable on its own
 * URL. `restoreGame` is the editor's and admin's way back; before this change
 * nothing could undo `deleteGame`.
 */

const USER = 1;
const EDITOR = 2;

function authUser(id: number, role: number) {
  return {
    id,
    email: `deleted-test-${id}@integration.test`,
    name: `User ${id}`,
    nickname: null,
    role,
    image: null,
    amountOfComments: 0,
    amountOfPlayed: 0,
    amountOfCreated: 0,
  };
}

interface FakeDb {
  writes: Array<{ table: string; args: any }>;
  db: any;
}

/** Only what `restoreGameResolver` touches: the game row, its comments. */
function fakeDb(game: any): FakeDb {
  const writes: Array<{ table: string; args: any }> = [];

  const db: any = {
    csld_game: {
      findUnique: async () => game,
      update: async (args: any) => {
        writes.push({ table: 'csld_game.update', args });
        // The resolver re-reads the game after the write, so the fake has to
        // remember it the way the database would.
        if (game) Object.assign(game, args.data);
        return game;
      },
    },
    csld_comment: {
      updateMany: async (args: any) => {
        writes.push({ table: 'csld_comment.updateMany', args });
        return { count: 0 };
      },
    },
    // The resolver passes an array of already-started promises.
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };

  return { writes, db };
}

const context = (user: any, db: any) => ({ user, db, files: null } as any);

const allowedActions = resolvers.Game.allowedActions;
const restoreGame = resolvers.GameMutation.restoreGame;

const deletedGameRow = {
  id: 7,
  name: 'Smazaná hra',
  deleted: true,
  csld_game_has_author: [{ id_user: 42 }],
  csld_game_has_label: [],
};

describe('Game.allowedActions of a deleted game', () => {
  test('an editor is offered edit only — Restore comes from `deleted`', async () => {
    const { db } = fakeDb(deletedGameRow);

    await expect(allowedActions(deletedGameRow, {}, context(authUser(99, EDITOR), db))).resolves.toEqual(['Edit']);
  });

  test('the author gets nothing — a deleted game is not theirs to touch', async () => {
    const { db } = fakeDb(deletedGameRow);

    await expect(allowedActions(deletedGameRow, {}, context(authUser(42, USER), db))).resolves.toEqual([]);
  });

  test('an anonymous visitor gets nothing', async () => {
    const { db } = fakeDb(deletedGameRow);

    await expect(allowedActions(deletedGameRow, {}, context(null, db))).resolves.toEqual([]);
  });
});

describe('GameMutation.restoreGame of the deployed resolvers', () => {
  test('an anonymous visitor is asked to sign in', async () => {
    const { db } = fakeDb(deletedGameRow);

    await expect(restoreGame({}, { gameId: '7' }, context(null, db))).rejects.toMatchObject({
      extensions: { code: 'AUTHENTICATION_REQUIRED' },
    });
  });

  test('an ordinary user is denied, even the author', async () => {
    const { db } = fakeDb(deletedGameRow);

    await expect(restoreGame({}, { gameId: '7' }, context(authUser(42, USER), db))).rejects.toMatchObject({
      extensions: { code: 'ACCESS_DENIED' },
    });
  });

  test('an unknown game is NOT_FOUND', async () => {
    const { db } = fakeDb(null);

    await expect(restoreGame({}, { gameId: '7' }, context(authUser(99, EDITOR), db))).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });

  test('an editor unhides the game and its comments in one transaction', async () => {
    const game = { ...deletedGameRow, csld_game_has_author: [{ id_user: 42 }] };
    const fake = fakeDb(game);

    const result = await restoreGame({}, { gameId: '7' }, context(authUser(99, EDITOR), fake.db));

    expect(result.deleted).toBe(false);
    expect(fake.writes).toEqual([
      {
        table: 'csld_game.update',
        args: { where: { id: 7 }, data: { deleted: false } },
      },
      {
        table: 'csld_comment.updateMany',
        args: { where: { game_id: 7 }, data: { is_hidden: false } },
      },
    ]);
  });
});

describe('mappers hide a deleted game', () => {
  const deleted = { id: 7, name: 'Smazaná', deleted: true };
  const live = { id: 8, name: 'Živá', deleted: false };

  test('similarGames of a live game drop the deleted ones', () => {
    const game = normalizeGame({
      id: 5,
      name: 'Hra',
      deleted: false,
      similar_games_similar_games_id_game1Tocsld_game: [
        { csld_game_similar_games_id_game2Tocsld_game: deleted },
        { csld_game_similar_games_id_game2Tocsld_game: live },
      ],
    });
    expect(game.similarGames.map((g: any) => g.id)).toEqual([8]);
  });

  test('a profile hides the deleted games an ordinary visitor may not see', () => {
    const row = {
      id: 42,
      role: USER,
      csld_game_has_author: [{ csld_game: deleted }, { csld_game: live }],
      csld_rating: [
        { state: 2, rating: 8, csld_game: deleted },
        { state: 2, rating: 5, csld_game: live },
        { state: 1, rating: null, csld_game: deleted },
      ],
      csld_comment: [
        { id: 1, comment: 'na smazané', csld_game: deleted },
        { id: 2, comment: 'na živé', csld_game: live },
      ],
    };

    const profile = normalizeUser(row);

    expect(profile.authoredGames.map((g: any) => g.id)).toEqual([8]);
    expect(profile.playedGames.map((p: any) => p.game.id)).toEqual([8]);
    expect(profile.wantedGames.map((g: any) => g.id)).toEqual([]);
    expect(profile.commentsPaged({ offset: 0, limit: 10 }).comments.map((c: any) => c.id)).toEqual([2]);
    expect(profile.commentsPaged({ offset: 0, limit: 10 }).totalAmount).toBe(1);
  });

  test('an editor sees the deleted games in the same profile', () => {
    const row = {
      id: 42,
      role: EDITOR,
      csld_game_has_author: [{ csld_game: deleted }, { csld_game: live }],
      csld_rating: [
        { state: 2, rating: 8, csld_game: deleted },
        { state: 1, rating: null, csld_game: deleted },
      ],
      csld_comment: [{ id: 1, comment: 'na smazané', csld_game: deleted }],
    };

    const profile = normalizeUser(row, true);

    expect(profile.authoredGames.map((g: any) => g.id)).toEqual([7, 8]);
    expect(profile.playedGames.map((p: any) => p.game.id)).toEqual([7]);
    expect(profile.wantedGames.map((g: any) => g.id)).toEqual([7]);
    expect(profile.commentsPaged({ offset: 0, limit: 10 }).totalAmount).toBe(1);
  });
});

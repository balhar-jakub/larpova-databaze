import { resolvers } from '../../../api/src/resolvers/index';

/**
 * The same cases as the API-copy suite `src/api/src/__tests__/gameAuthorPermissions.test.ts`,
 * but against the copy the server really loads: `server.ts` imports
 * `./src/api/src/...`, and `packages/web/jest.config.json` never collects the
 * tests in that tree (`testPathIgnorePatterns: ["<rootDir>/src/api/"]`), so
 * without a test here a regression in the deployed resolvers would slip
 * through the API suite.
 *
 * Games are authored by ordinary users, not by a role: the author of a game
 * lives in `csld_game_has_author` while their `csld_csld_user.role` stays USER.
 * Editing and deleting a game therefore has to check the authorship, and
 * `Game.allowedActions` — the field the game detail page renders its edit and
 * delete buttons from — has to report what the mutations accept.
 *
 * The database is a hand-written fake: the resolvers under test only read the
 * game and its authors, so no Postgres (and no Prisma client, which the web
 * jest environment cannot load) is needed.
 */

const USER = 1;
const EDITOR = 2;
const AUTHOR_ROLE = 4;

function authUser(id: number, role: number) {
  return {
    id,
    email: `perm-test-${id}@integration.test`,
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
  authorLookups: Array<any>;
  db: any;
}

/** A game row as `findUnique` with `include: { csld_game_has_author: true }` returns it. */
function fakeDb(game: any, authorIds: number[] = []): FakeDb {
  const writes: Array<{ table: string; args: any }> = [];
  const authorLookups: Array<any> = [];

  /** `deleteMany`/`create` on a relation table, recorded in `writes`. */
  const relationTable = (table: string) => ({
    deleteMany: async (args: any) => {
      writes.push({ table: `${table}.deleteMany`, args });
      return { count: 0 };
    },
    create: async (args: any) => {
      writes.push({ table: `${table}.create`, args });
      return args.data;
    },
  });

  const db: any = {
    csld_game: {
      findUnique: async () => game,
      update: async (args: any) => {
        writes.push({ table: 'csld_game.update', args });
        // deleteGame re-reads the game after the write, so the fake has to
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
    csld_game_has_author: {
      findFirst: async (args: any) => {
        authorLookups.push(args.where);
        return authorIds.includes(args.where.id_user) ? { id_user: args.where.id_user, id_game: args.where.id_game } : null;
      },
      ...relationTable('csld_game_has_author'),
    },
    csld_game_has_group: relationTable('csld_game_has_group'),
    csld_game_has_label: relationTable('csld_game_has_label'),
    // The resolver passes an array of already-started promises.
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };

  return { writes, authorLookups, db };
}

const context = (user: any, db: any) => ({ user, db, files: null } as any);

const allowedActions = resolvers.Game.allowedActions;
const deleteGame = resolvers.GameMutation.deleteGame;
const updateGame = resolvers.GameMutation.updateGame;

const gameRow = (authorIds: number[]) => ({
  id: 7,
  name: 'Hra',
  deleted: false,
  csld_game_has_author: authorIds.map((id_user) => ({ id_user })),
  csld_game_has_label: [],
});

/** A game as `normalizeGame` leaves it for a list query — authors are not loaded. */
const normalizedWithoutAuthors = { id: 7, name: 'Hra', deleted: false, authors: [], allowedActions: null };

describe('Game.allowedActions of the deployed resolvers', () => {
  test('an author is offered edit and delete for their own game', async () => {
    const { db } = fakeDb(gameRow([42, 43]));

    await expect(allowedActions(gameRow([42, 43]), {}, context(authUser(42, USER), db))).resolves.toEqual([
      'Edit',
      'Delete',
    ]);
  });

  test('a signed-in user who is not an author gets nothing', async () => {
    const { db } = fakeDb(gameRow([42]));

    await expect(allowedActions(gameRow([42]), {}, context(authUser(43, USER), db))).resolves.toEqual([]);
  });

  test('the AUTHOR role alone grants nothing without authorship', async () => {
    const { db } = fakeDb(gameRow([42]));

    await expect(allowedActions(gameRow([42]), {}, context(authUser(43, AUTHOR_ROLE), db))).resolves.toEqual([]);
  });

  test('an editor keeps edit and delete on a game they did not write', async () => {
    const { db } = fakeDb(gameRow([42]));

    await expect(allowedActions(gameRow([42]), {}, context(authUser(99, EDITOR), db))).resolves.toEqual([
      'Edit',
      'Delete',
    ]);
  });

  test('an anonymous visitor gets nothing', async () => {
    const { db } = fakeDb(gameRow([42]));

    await expect(allowedActions(gameRow([42]), {}, context(null, db))).resolves.toEqual([]);
  });

  test('the authors already loaded with the game are used without asking the database', async () => {
    const fake = fakeDb(gameRow([42]));

    await allowedActions(gameRow([42]), {}, context(authUser(42, USER), fake.db));

    expect(fake.authorLookups).toEqual([]);
  });

  test('a list query without authors falls back to the database, for author and stranger alike', async () => {
    const asAuthor = fakeDb(gameRow([42]), [42]);
    await expect(
      allowedActions(normalizedWithoutAuthors, {}, context(authUser(42, USER), asAuthor.db)),
    ).resolves.toEqual(['Edit', 'Delete']);
    expect(asAuthor.authorLookups).toEqual([{ id_game: 7, id_user: 42 }]);

    const asStranger = fakeDb(gameRow([42]), [42]);
    await expect(
      allowedActions(normalizedWithoutAuthors, {}, context(authUser(43, USER), asStranger.db)),
    ).resolves.toEqual([]);
    expect(asStranger.authorLookups).toEqual([{ id_game: 7, id_user: 43 }]);
  });
});

describe('updateGame and deleteGame of the deployed resolvers', () => {
  const updateInput = {
    id: '7',
    name: 'Přejmenováno',
    description: 'x',
    authors: ['42'],
    groupAuthors: [],
    labels: [],
  };

  test('an author may rename their own game without being an editor', async () => {
    const fake = fakeDb(gameRow([42]));

    await updateGame({}, { input: updateInput }, context(authUser(42, USER), fake.db));

    expect(fake.writes.some((write) => write.table === 'csld_game.update' && write.args.data.name === 'Přejmenováno')).toBe(
      true,
    );
  });

  test('a signed-in user who is not an author is refused', async () => {
    const fake = fakeDb(gameRow([42]));

    await expect(updateGame({}, { input: updateInput }, context(authUser(43, USER), fake.db))).rejects.toMatchObject({
      extensions: { code: 'ACCESS_DENIED' },
    });
  });

  test('an anonymous visitor cannot update at all', async () => {
    const fake = fakeDb(gameRow([42]));

    await expect(updateGame({}, { input: updateInput }, context(null, fake.db))).rejects.toMatchObject({
      extensions: { code: 'AUTHENTICATION_REQUIRED' },
    });
  });

  test('an author may delete the game they wrote', async () => {
    const fake = fakeDb(gameRow([42]));

    const deleted = await deleteGame({}, { gameId: '7' }, context(authUser(42, USER), fake.db));

    expect(fake.writes).toEqual([
      { table: 'csld_game.update', args: { where: { id: 7 }, data: { deleted: true } } },
      { table: 'csld_comment.updateMany', args: { where: { game_id: 7 }, data: { is_hidden: true } } },
    ]);
    expect(deleted.deleted).toBe(true);
  });

  test('an editor may delete a game they did not write', async () => {
    const fake = fakeDb(gameRow([42]));

    await deleteGame({}, { gameId: '7' }, context(authUser(99, EDITOR), fake.db));

    expect(fake.writes.map((write) => write.table)).toEqual(['csld_game.update', 'csld_comment.updateMany']);
  });

  test('a signed-in user who is not an author is refused and nothing is written', async () => {
    const fake = fakeDb(gameRow([42]));

    await expect(deleteGame({}, { gameId: '7' }, context(authUser(43, USER), fake.db))).rejects.toMatchObject({
      extensions: { code: 'ACCESS_DENIED' },
    });
    expect(fake.writes).toEqual([]);
  });

  test('an anonymous visitor cannot delete and nothing is written', async () => {
    const fake = fakeDb(gameRow([42]));

    await expect(deleteGame({}, { gameId: '7' }, context(null, fake.db))).rejects.toMatchObject({
      extensions: { code: 'AUTHENTICATION_REQUIRED' },
    });
    expect(fake.writes).toEqual([]);
  });

  test('an unknown game is reported as missing, not silently accepted', async () => {
    const fake = fakeDb(null, [42]);

    await expect(deleteGame({}, { gameId: '7' }, context(authUser(99, EDITOR), fake.db))).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
    expect(fake.writes).toEqual([]);
  });
});

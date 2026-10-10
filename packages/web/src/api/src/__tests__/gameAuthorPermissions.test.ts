import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * Games are authored by ordinary users, not by a role: the author of a game
 * lives in `csld_game_has_author` while their `csld_csld_user.role` stays USER.
 *
 * Editing and deleting a game therefore has to check the authorship, and
 * `Game.allowedActions` — the field the game detail page renders its edit and
 * delete buttons from — has to report what the mutations accept. It used to
 * answer from the role alone, so the authors of a game saw no buttons at all.
 */

const USER = 1;
const EDITOR = 2;

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

const gameDetailQuery = `
  query ($id: ID!) { gameById(gameId: $id) { id name deleted allowedActions } }
`;

const updateGameMutation = `
  mutation ($input: UpdateGameInput!) { game { updateGame(input: $input) { id name } } }
`;

const deleteGameMutation = `
  mutation ($id: ID!) { game { deleteGame(gameId: $id) { id deleted } } }
`;

describe('a game can be edited and deleted by its author', () => {
  let server: ApolloServer;
  const marker = `AuthorPerm${Date.now()}`;

  let authorId: number;
  let strangerId: number;
  let editorId: number;

  /** Owned by the author, only read in the allowedActions tests. */
  let permGameId: number;
  /** Renamed by the author, by a stranger and anonymously. */
  let updateGameId: number;
  /** Deleted by its author. */
  let ownDeleteGameId: number;
  /** Someone else's game, deleted by an editor. */
  let editorDeleteGameId: number;
  /** Kept: neither a stranger nor an anonymous user may delete it. */
  let strangerDeleteGameId: number;

  const author = () => authUser(authorId, USER);
  const stranger = () => authUser(strangerId, USER);
  const editor = () => authUser(editorId, EDITOR);

  async function createGame(name: string, authorUserId: number) {
    const game = await prisma.csld_game.create({
      data: { name, description: 'x', deleted: false, added_by: authorUserId },
    });
    await prisma.csld_game_has_author.create({
      data: { id_game: game.id, id_user: authorUserId },
    });
    return game.id;
  }

  beforeAll(async () => {
    server = createTestServer();

    const [a, s, e] = await Promise.all([
      prisma.csld_csld_user.create({
        data: { password: 'x', role: USER, name: `${marker} autor`, email: `${marker}-author@integration.test` },
      }),
      prisma.csld_csld_user.create({
        data: { password: 'x', role: USER, name: `${marker} cizí`, email: `${marker}-stranger@integration.test` },
      }),
      prisma.csld_csld_user.create({
        data: { password: 'x', role: EDITOR, name: `${marker} editor`, email: `${marker}-editor@integration.test` },
      }),
    ]);
    authorId = a.id;
    strangerId = s.id;
    editorId = e.id;

    permGameId = await createGame(`${marker} práva`, authorId);
    updateGameId = await createGame(`${marker} editace`, authorId);
    ownDeleteGameId = await createGame(`${marker} smazání autorem`, authorId);
    editorDeleteGameId = await createGame(`${marker} smazání editorem`, authorId);
    strangerDeleteGameId = await createGame(`${marker} smazání cizím`, authorId);
  });

  afterAll(async () => {
    const ids = [permGameId, updateGameId, ownDeleteGameId, editorDeleteGameId, strangerDeleteGameId];
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: { in: ids } } });
    await prisma.csld_game.deleteMany({ where: { id: { in: ids } } });
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: [authorId, strangerId, editorId] } } });
    await prisma.$disconnect();
  });

  describe('Game.allowedActions drives the buttons on the game detail page', () => {
    test('an author is offered edit and delete for their own game', async () => {
      const result = await executeQuery(server, gameDetailQuery, { id: String(permGameId) }, { user: author() });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).gameById.allowedActions).toEqual(['Edit', 'Delete']);
    });

    test('a signed-in user who is not an author gets nothing', async () => {
      const result = await executeQuery(server, gameDetailQuery, { id: String(permGameId) }, { user: stranger() });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).gameById.allowedActions).toEqual([]);
    });

    test('an editor keeps edit and delete on a game they did not write', async () => {
      const result = await executeQuery(server, gameDetailQuery, { id: String(permGameId) }, { user: editor() });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).gameById.allowedActions).toEqual(['Edit', 'Delete']);
    });

    test('an anonymous visitor gets nothing', async () => {
      const result = await executeQuery(server, gameDetailQuery, { id: String(permGameId) });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).gameById.allowedActions).toEqual([]);
    });

    test('the author is recognised in list queries too, which load no authors', async () => {
      // games.byQuery returns games without their authors, so the authorship
      // cannot be read off the parent here.
      const query = `query ($q: String!) { games { byQuery(query: $q) { id allowedActions } } }`;

      const asAuthor = await executeQuery(server, query, { q: `${marker} práva` }, { user: author() });
      expect(asAuthor.errors).toBeUndefined();
      expect((asAuthor.data as any).games.byQuery[0].allowedActions).toEqual(['Edit', 'Delete']);

      const asStranger = await executeQuery(server, query, { q: `${marker} práva` }, { user: stranger() });
      expect(asStranger.errors).toBeUndefined();
      expect((asStranger.data as any).games.byQuery[0].allowedActions).toEqual([]);
    });
  });

  describe('updateGame', () => {
    const input = () => ({
      id: String(updateGameId),
      name: `${marker} přejmenováno`,
      description: 'x',
      authors: [String(authorId)],
      newAuthors: [],
      groupAuthors: [],
      newGroupAuthors: [],
      labels: [],
      newLabels: [],
    });

    test('an author may rename their own game without being an editor', async () => {
      const result = await executeQuery(server, updateGameMutation, { input: input() }, { user: author() });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).game.updateGame.name).toBe(`${marker} přejmenováno`);

      const stored = await prisma.csld_game.findUnique({ where: { id: updateGameId } });
      expect(stored?.name).toBe(`${marker} přejmenováno`);
    });

    test('a signed-in user who is not an author is refused', async () => {
      const result = await executeQuery(
        server,
        updateGameMutation,
        { input: { ...input(), name: `${marker} cizí pokus` } },
        { user: stranger() },
      );

      expect(result.errors?.[0].extensions?.code).toBe('ACCESS_DENIED');
      const stored = await prisma.csld_game.findUnique({ where: { id: updateGameId } });
      expect(stored?.name).toBe(`${marker} přejmenováno`);
    });

    test('an anonymous visitor cannot update at all', async () => {
      const result = await executeQuery(server, updateGameMutation, { input: input() });

      expect(result.errors?.[0].extensions?.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('deleteGame', () => {
    test('an author may delete the game they wrote', async () => {
      const result = await executeQuery(server, deleteGameMutation, { id: String(ownDeleteGameId) }, { user: author() });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).game.deleteGame.deleted).toBe(true);

      const stored = await prisma.csld_game.findUnique({ where: { id: ownDeleteGameId } });
      expect(stored?.deleted).toBe(true);
    });

    test('an editor may delete a game they did not write', async () => {
      const result = await executeQuery(server, deleteGameMutation, { id: String(editorDeleteGameId) }, { user: editor() });

      expect(result.errors).toBeUndefined();
      const stored = await prisma.csld_game.findUnique({ where: { id: editorDeleteGameId } });
      expect(stored?.deleted).toBe(true);
    });

    test('a signed-in user who is not an author is refused and the game survives', async () => {
      const result = await executeQuery(server, deleteGameMutation, { id: String(strangerDeleteGameId) }, { user: stranger() });

      expect(result.errors?.[0].extensions?.code).toBe('ACCESS_DENIED');
      const stored = await prisma.csld_game.findUnique({ where: { id: strangerDeleteGameId } });
      expect(stored?.deleted).toBe(false);
    });

    test('an anonymous visitor cannot delete', async () => {
      const result = await executeQuery(server, deleteGameMutation, { id: String(strangerDeleteGameId) });

      expect(result.errors?.[0].extensions?.code).toBe('AUTHENTICATION_REQUIRED');
      const stored = await prisma.csld_game.findUnique({ where: { id: strangerDeleteGameId } });
      expect(stored?.deleted).toBe(false);
    });

    test('an unknown game is reported as missing, not silently accepted', async () => {
      const result = await executeQuery(server, deleteGameMutation, { id: '999999999' }, { user: editor() });

      expect(result.errors?.[0].extensions?.code).toBe('NOT_FOUND');
    });
  });
});

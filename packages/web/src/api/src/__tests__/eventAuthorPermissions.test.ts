import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';

/**
 * Events have no authors of their own: an event is managed by the authors of
 * the games linked to it (`csld_game_has_event` → `csld_game_has_author`),
 * by editors and by admins. The mutations used to check only that somebody is
 * signed in, so any logged-in user could rewrite or delete any event; and
 * `Event.allowedActions` answered from the role alone, so the authors of the
 * linked games saw no buttons at all.
 *
 * A linked-game author may edit and delete the event, but may only REMOVE
 * game links — adding a link to their own game would grant them rights over
 * an event they had none (self-granting).
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

const eventDetailQuery = `
  query ($id: ID!) { eventById(eventId: $id) { id name allowedActions } }
`;

const updateEventMutation = `
  mutation ($input: UpdateEventInput!) { event { updateEvent(input: $input) { id name } } }
`;

const deleteEventMutation = `
  mutation ($id: ID!) { event { deleteEvent(eventId: $id) { id deleted } } }
`;

describe('an event can be managed by the authors of its linked games', () => {
  let server: ApolloServer;
  const marker = `EventPerm${Date.now()}`;

  let authorId: number;
  let strangerId: number;
  let editorId: number;
  let gameId: number;
  let otherGameId: number;

  /** Linked to `gameId`, which `authorId` wrote. */
  let permEventId: number;
  /** Renamed by the author / a stranger. */
  let updateEventId: number;
  /** Game links removed by the author. */
  let unlinkEventId: number;
  /** The author tries to ADD a link to their own other game. */
  let selfGrantEventId: number;
  /** Deleted by its linked author. */
  let ownDeleteEventId: number;
  /** Someone else's event, deleted by an editor. */
  let editorDeleteEventId: number;
  /** Kept: neither a stranger nor an anonymous user may delete it. */
  let strangerDeleteEventId: number;

  const author = () => authUser(authorId, USER);
  const stranger = () => authUser(strangerId, USER);
  const editor = () => authUser(editorId, EDITOR);

  async function createEvent(name: string, linkedGameIds: number[]) {
    const event = await prisma.event.create({
      data: {
        name,
        from: new Date('2027-06-01'),
        to: new Date('2027-06-02'),
        added_by: authorId,
        deleted: false,
        lang: 'cs',
      },
    });
    for (const linkedGameId of linkedGameIds) {
      await prisma.csld_game_has_event.create({
        data: { game_id: linkedGameId, event_id: event.id },
      });
    }
    return event.id;
  }

  const eventInput = (id: number, name: string, games: string[] = []) => ({
    id: String(id),
    name,
    fromDate: '2027-06-01',
    toDate: '2027-06-02',
    registrationOpen: false,
    games,
    labels: [],
    newLabels: [],
  });

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

    const games = await Promise.all([
      prisma.csld_game.create({ data: { name: `${marker} hra`, description: 'x', deleted: false, added_by: authorId } }),
      prisma.csld_game.create({ data: { name: `${marker} druhá hra`, description: 'x', deleted: false, added_by: authorId } }),
    ]);
    gameId = games[0].id;
    otherGameId = games[1].id;
    await prisma.csld_game_has_author.create({ data: { id_game: gameId, id_user: authorId } });
    await prisma.csld_game_has_author.create({ data: { id_game: otherGameId, id_user: authorId } });

    permEventId = await createEvent(`${marker} práva`, [gameId]);
    updateEventId = await createEvent(`${marker} editace`, [gameId]);
    unlinkEventId = await createEvent(`${marker} odvázání`, [gameId, otherGameId]);
    selfGrantEventId = await createEvent(`${marker} selfgrant`, [gameId]);
    ownDeleteEventId = await createEvent(`${marker} smazání autorem`, [gameId]);
    editorDeleteEventId = await createEvent(`${marker} smazání editorem`, [gameId]);
    strangerDeleteEventId = await createEvent(`${marker} smazání cizím`, [gameId]);
  });

  afterAll(async () => {
    const eventIds = [permEventId, updateEventId, unlinkEventId, selfGrantEventId, ownDeleteEventId, editorDeleteEventId, strangerDeleteEventId];
    await prisma.csld_game_has_event.deleteMany({ where: { event_id: { in: eventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
    const gameIds = [gameId, otherGameId];
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: { in: gameIds } } });
    await prisma.csld_game.deleteMany({ where: { id: { in: gameIds } } });
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: [authorId, strangerId, editorId] } } });
    await prisma.$disconnect();
  });

  describe('Event.allowedActions drives the buttons on the event detail page', () => {
    test('a linked-game author is offered edit and delete', async () => {
      const result = await executeQuery(server, eventDetailQuery, { id: String(permEventId) }, { user: author() });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).eventById.allowedActions).toEqual(['Edit', 'Delete']);
    });

    test('a signed-in user who is not a linked author gets nothing', async () => {
      const result = await executeQuery(server, eventDetailQuery, { id: String(permEventId) }, { user: stranger() });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).eventById.allowedActions).toEqual([]);
    });

    test('an editor keeps edit and delete on an event they do not author', async () => {
      const result = await executeQuery(server, eventDetailQuery, { id: String(permEventId) }, { user: editor() });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).eventById.allowedActions).toEqual(['Edit', 'Delete']);
    });

    test('an anonymous visitor gets nothing', async () => {
      const result = await executeQuery(server, eventDetailQuery, { id: String(permEventId) });

      expect(result.errors).toBeUndefined();
      expect((result.data as any).eventById.allowedActions).toEqual([]);
    });

    test('an event without linked games offers nothing to a plain user', async () => {
      const bare = await createEvent(`${marker} bez her`, []);
      try {
        const result = await executeQuery(server, eventDetailQuery, { id: String(bare) }, { user: author() });

        expect(result.errors).toBeUndefined();
        expect((result.data as any).eventById.allowedActions).toEqual([]);
      } finally {
        await prisma.event.delete({ where: { id: bare } });
      }
    });
  });

  describe('updateEvent', () => {
    test('a linked-game author may rename the event without being an editor', async () => {
      const result = await executeQuery(
        server,
        updateEventMutation,
        { input: eventInput(updateEventId, `${marker} přejmenováno`, [String(gameId)]) },
        { user: author() },
      );

      expect(result.errors).toBeUndefined();
      expect((result.data as any).event.updateEvent.name).toBe(`${marker} přejmenováno`);

      const stored = await prisma.event.findUnique({ where: { id: updateEventId } });
      expect(stored?.name).toBe(`${marker} přejmenováno`);
    });

    test('a signed-in user who is not a linked author is refused', async () => {
      const result = await executeQuery(
        server,
        updateEventMutation,
        { input: eventInput(updateEventId, `${marker} cizí pokus`, [String(gameId)]) },
        { user: stranger() },
      );

      expect(result.errors?.[0].extensions?.code).toBe('ACCESS_DENIED');
      const stored = await prisma.event.findUnique({ where: { id: updateEventId } });
      expect(stored?.name).toBe(`${marker} přejmenováno`);
    });

    test('an anonymous visitor cannot update at all', async () => {
      const result = await executeQuery(
        server,
        updateEventMutation,
        { input: eventInput(updateEventId, `${marker} anonym`, [String(gameId)]) },
      );

      expect(result.errors?.[0].extensions?.code).toBe('AUTHENTICATION_REQUIRED');
    });

    test('a linked-game author may REMOVE a game link (their game did not run there)', async () => {
      const result = await executeQuery(
        server,
        updateEventMutation,
        { input: eventInput(unlinkEventId, `${marker} odvázání`, [String(gameId)]) },
        { user: author() },
      );

      expect(result.errors).toBeUndefined();
      const links = await prisma.csld_game_has_event.findMany({ where: { event_id: unlinkEventId } });
      expect(links.map((link: any) => link.game_id)).toEqual([gameId]);
    });

    test('a linked-game author may not ADD a game link (no self-granting)', async () => {
      const result = await executeQuery(
        server,
        updateEventMutation,
        { input: eventInput(selfGrantEventId, `${marker} selfgrant`, [String(gameId), String(otherGameId)]) },
        { user: author() },
      );

      expect(result.errors?.[0].extensions?.code).toBe('ACCESS_DENIED');
      const links = await prisma.csld_game_has_event.findMany({ where: { event_id: selfGrantEventId } });
      expect(links.map((link: any) => link.game_id)).toEqual([gameId]);
    });

    test('an editor may resync the game links freely', async () => {
      const result = await executeQuery(
        server,
        updateEventMutation,
        { input: eventInput(selfGrantEventId, `${marker} selfgrant`, [String(gameId), String(otherGameId)]) },
        { user: editor() },
      );

      expect(result.errors).toBeUndefined();
      const links = await prisma.csld_game_has_event.findMany({ where: { event_id: selfGrantEventId } });
      expect(links.map((link: any) => link.game_id).sort()).toEqual([gameId, otherGameId].sort());
    });
  });

  describe('deleteEvent', () => {
    test('a linked-game author may delete the event', async () => {
      const result = await executeQuery(server, deleteEventMutation, { id: String(ownDeleteEventId) }, { user: author() });

      expect(result.errors).toBeUndefined();
      const stored = await prisma.event.findUnique({ where: { id: ownDeleteEventId } });
      expect(stored?.deleted).toBe(true);
    });

    test('an editor may delete an event they do not author', async () => {
      const result = await executeQuery(server, deleteEventMutation, { id: String(editorDeleteEventId) }, { user: editor() });

      expect(result.errors).toBeUndefined();
      const stored = await prisma.event.findUnique({ where: { id: editorDeleteEventId } });
      expect(stored?.deleted).toBe(true);
    });

    test('a signed-in user who is not a linked author is refused and the event survives', async () => {
      const result = await executeQuery(server, deleteEventMutation, { id: String(strangerDeleteEventId) }, { user: stranger() });

      expect(result.errors?.[0].extensions?.code).toBe('ACCESS_DENIED');
      const stored = await prisma.event.findUnique({ where: { id: strangerDeleteEventId } });
      expect(stored?.deleted).toBe(false);
    });

    test('an anonymous visitor cannot delete', async () => {
      const result = await executeQuery(server, deleteEventMutation, { id: String(strangerDeleteEventId) });

      expect(result.errors?.[0].extensions?.code).toBe('AUTHENTICATION_REQUIRED');
      const stored = await prisma.event.findUnique({ where: { id: strangerDeleteEventId } });
      expect(stored?.deleted).toBe(false);
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { createTestServer, executeQuery } from './testHelpers';

/**
 * The last default-argument and mapping arms: eventCalendar with NO paging
 * args at all, games.byQuery with explicit offset/limit, the userRating
 * field resolved for a signed-in visitor who rated the game, and a user
 * profile WITH a birth date (the non-null mapping arm).
 */
const stamp = Date.now();
const marker = `lastarms-${stamp}`;

let server: ReturnType<typeof createTestServer>;
let userId: number;
let gameId: number;
let ratingId: number;

beforeAll(async () => {
  server = createTestServer();
  const user = await prisma.csld_csld_user.create({
    data: {
      password: 'x', role: 1, name: marker, email: `${marker}@integration.test`,
      birth_date: new Date('1990-05-15T00:00:00Z'),
    },
  });
  userId = user.id;
  const game = await prisma.csld_game.create({
    data: { name: `${marker} hra`, deleted: false, added_by: userId, lang: 'cs' },
  });
  gameId = game.id;
  const rating = await prisma.csld_rating.create({
    data: { user_id: userId, game_id: gameId, rating: 8, state: 2, added: new Date() },
  });
  ratingId = rating.id;
});

afterAll(async () => {
  await prisma.csld_rating.deleteMany({ where: { id: ratingId } });
  await prisma.csld_game.deleteMany({ where: { id: gameId } });
  await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('default-argument arms', () => {
  it('eventCalendar answers with the offset/limit defaults when nothing is passed', async () => {
    const res: any = await executeQuery(
      server,
      `{ eventCalendar { totalAmount events { id name } } }`,
    );
    expect(res.errors).toBeUndefined();
    expect(Array.isArray(res.data.eventCalendar.events)).toBe(true);
    expect(res.data.eventCalendar.events.length).toBeLessThanOrEqual(25);
  });

  it('games.byQuery honours explicit offset and limit', async () => {
    const res: any = await executeQuery(
      server,
      `query ($q: String!) { games { byQuery(query: $q, offset: 0, limit: 5) { id } } }`,
      { q: marker },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data.games.byQuery.length).toBeLessThanOrEqual(5);
  });
});

describe('userRating field and birthDate mapping', () => {
  it('answers the signed-in visitor\'s own rating on the game detail', async () => {
    // The field resolves from the ratings included by gameById; through a
    // parent without them it answers null by design.
    const res: any = await executeQuery(
      server,
      `query ($id: ID!) { gameById(gameId: $id) { id currentUsersRating { rating state } } }`,
      { id: String(gameId) },
      { user: { id: userId, role: 1 } },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data.gameById.currentUsersRating).not.toBeNull();
    expect(res.data.gameById.currentUsersRating.rating).toBe(8);
  });

  it('maps a stored birth date to its day', async () => {
    const res: any = await executeQuery(
      server,
      `query ($id: ID!) { userById(userId: $id) { birthDate } }`,
      { id: String(userId) },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data.userById.birthDate).toBe('1990-05-15');
  });
});

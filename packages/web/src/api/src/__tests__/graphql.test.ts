import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';

let server: ApolloServer;

beforeAll(async () => {
  server = createTestServer();
});

describe('GraphQL read queries', () => {
  it('config returns reCaptchaKey', async () => {
    const result = await executeQuery(server, '{ config { reCaptchaKey } }');
    expect(result.errors).toBeUndefined();
    expect(result.data?.config).toEqual({ reCaptchaKey: '' });
  });

  it('gameById returns null for unknown game', async () => {
    const result = await executeQuery(server, '{ gameById(gameId: "99999") { id name } }');
    expect(result.errors).toBeUndefined();
    expect(result.data?.gameById).toBeNull();
  });

  it('gameById returns data for existing game', async () => {
    const result = await executeQuery(server, '{ gameById(gameId: "3") { id name year } }');
    expect(result.errors).toBeUndefined();
    expect(result.data?.gameById).not.toBeNull();
    expect(result.data?.gameById.name).toBe('Image Test');
    expect(result.data?.gameById.year).toBe(2025);
  });

  it('homepage returns arrays', async () => {
    const result = await executeQuery(server, `
      { homepage { lastAddedGames { id name } mostPopularGames { id name } nextEvents { id name } lastComments { commentAsText } } }
    `);
    expect(result.errors).toBeUndefined();
    expect(Array.isArray(result.data?.homepage.lastAddedGames)).toBe(true);
  });

  it('games.ladder returns paginated results', async () => {
    const result = await executeQuery(server, `
      { games { ladder(ladderType: Recent, offset: 0, limit: 10) { totalAmount games { id name } } } }
    `);
    expect(result.errors).toBeUndefined();
    expect(typeof result.data?.games.ladder.totalAmount).toBe('number');
    expect(Array.isArray(result.data?.games.ladder.games)).toBe(true);
  });

  it('authorized labels return arrays', async () => {
    const result = await executeQuery(server, `
      { authorizedRequiredLabels { id name } authorizedOptionalLabels { id name } }
    `);
    expect(result.errors).toBeUndefined();
    expect(Array.isArray(result.data?.authorizedRequiredLabels)).toBe(true);
  });

  it('eventCalendar returns paginated results', async () => {
    const result = await executeQuery(server, `
      { eventCalendar(from: "2000-01-01", to: "2030-01-01") { totalAmount events { id name } } }
    `);
    expect(result.errors).toBeUndefined();
    expect(Array.isArray(result.data?.eventCalendar.events)).toBe(true);
  });

  it('userById returns null for unknown user', async () => {
    const result = await executeQuery(server, '{ userById(userId: "99999") { id } }');
    expect(result.errors).toBeUndefined();
    expect(result.data?.userById).toBeNull();
  });

  it('loggedInUser returns null when anonymous', async () => {
    const result = await executeQuery(server, '{ loggedInUser { id } }');
    expect(result.errors).toBeUndefined();
    expect(result.data?.loggedInUser).toBeNull();
  });
});

describe('GraphQL mutations', () => {
  it('createUser requires recaptcha', async () => {
    const result = await executeQuery(server, `
      mutation {
        user {
          createUser(input: {
            email: "new-integration-test@test.com", password: "pass123", name: "New",
            recaptcha: "bypass"
          }) { id email }
        }
      }
    `);
    // recaptcha bypasses in dev (no key configured) — should succeed
    expect(result.errors).toBeUndefined();
    expect(result.data?.user.createUser).not.toBeNull();
  });

  it('login with wrong password fails', async () => {
    const result = await executeQuery(server, `
      mutation {
        user { logIn(userName: "test@example.com", password: "wrongpassword") { id } }
      }
    `);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].extensions?.code).toBe('AUTHENTICATION_FAILED');
  });

  it('createGame requires auth', async () => {
    const result = await executeQuery(server, `
      mutation {
        game { createGame(input: { name: "Unauth", description: "", year: 2025, players: 1,
          menRole: 0, womenRole: 0, authors: [], labels: [], newLabels: [],
          groupAuthors: [], newGroupAuthors: [], newAuthors: [] }) { id } }
      }
    `);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].extensions?.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('createGroup requires elevated permissions', async () => {
    const result = await executeQuery(server, `
      mutation {
        group { createGroup(input: { name: "Unauth Group" }) { id } }
      }
    `);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].extensions?.code).toBe('ACCESS_DENIED');
  });

  it('admin mutations require auth', async () => {
    const result = await executeQuery(server, `
      mutation {
        admin { updateLabel(input: { id: "1", name: "Test" }) { id } }
      }
    `);
    expect(result.errors).toBeDefined();
    expect(result.errors![0].extensions?.code).toBe('ACCESS_DENIED');
  });
});

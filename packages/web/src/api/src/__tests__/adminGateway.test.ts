import { ApolloServer } from '@apollo/server';
import {describe, it, expect, beforeAll, afterAll} from '@jest/globals';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';

/**
 * The admin gateway and every AdminQuery sub-resolver must refuse anyone who
 * is not an ADMIN — the gateway originally checked only that *someone* was
 * signed in ("no user = no admin; check role >= 3 when auth is implemented"),
 * which let every plain USER read allUsers, stats and selfRated.
 *
 * Each sub-resolver carries its own guard too: they must stay safe even if
 * someone re-mounts one outside the `admin` gateway.
 */

const stamp = Date.now();

const ALL_USERS = `query { admin { allUsers { id name role } } }`;
const ALL_LABELS = `query { admin { allLabels { id name } } }`;
const STATS = `query { admin { stats { id year month } } }`;
const SELF_RATED = `query { admin { selfRated { id } } }`;


function asUser(id: number, role: number) {
  return {
    user: {
      id,
      email: `admin-gate-${stamp}@integration.test`,
      name: 'Admin Gate Probe',
      nickname: null,
      description: null,
      role,
      image: null,
      amountOfComments: 0,
      amountOfPlayed: 0,
      amountOfCreated: 0,
    },
  };
}

const adminCtx = asUser(1, 3);
const editorCtx = asUser(2, 2);
const userCtx = asUser(3, 1);
const authorCtx = asUser(4, 4); // AUTHOR ranks above ADMIN numerically — must still be denied

let server: ApolloServer;

beforeAll(() => {
  server = createTestServer();
});

afterAll(async () => {
  // Nothing is written by these tests, but keep the cleanup contract for
  // future fixture additions.
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, `admin-gate-${stamp}`));
});

describe('admin gateway: every non-admin is refused', () => {
  for (const [label, ctx] of [
    ['anonymous', {}],
    ['plain USER', userCtx],
    ['EDITOR (staff but not admin)', editorCtx],
    ['AUTHOR (numeric role above ADMIN)', authorCtx],
  ] as const) {
    for (const [field, query] of [
      ['allUsers', ALL_USERS],
      ['allLabels', ALL_LABELS],
      ['stats', STATS],
      ['selfRated', SELF_RATED],
    ] as const) {
      it(`${label} cannot read admin.${field}`, async () => {
        const res = await executeQuery(server, query, {}, ctx);
        expect(res.errors).toBeDefined();
        expect(res.errors?.[0]?.message).toBe('Admin access required');
        expect((res.errors?.[0] as any)?.extensions?.code).toBe('ACCESS_DENIED');
        // When the `admin` gateway throws, Apollo nulls the whole data payload.
        expect(res.data?.admin ?? null).toBeNull();
      });
    }
  }

  it('EDITOR is denied even via the gateway field alone', async () => {
    // `admin` itself throws before any sub-field resolves — pin the gateway,
    // not just the sub-resolvers.
    const res = await executeQuery(server, `query { admin { allUsers { id } } }`, {}, editorCtx);
    expect(res.errors?.[0]?.message).toBe('Admin access required');
    expect((res.errors?.[0] as any)?.path).toEqual(['admin']);
  });
});

describe('admin gateway: ADMIN passes', () => {
  it('allUsers resolves (lists users with roles)', async () => {
    const res = await executeQuery(server, ALL_USERS, {}, adminCtx);
    expect(res.errors).toBeUndefined();
    const users = res.data?.admin?.allUsers;
    expect(Array.isArray(users)).toBe(true);
    if (users.length > 0) {
      expect(users[0]).toHaveProperty('name');
      expect(users[0]).toHaveProperty('role');
    }
  });

  it('allLabels resolves', async () => {
    const res = await executeQuery(server, ALL_LABELS, {}, adminCtx);
    expect(res.errors).toBeUndefined();
    expect(Array.isArray(res.data?.admin?.allLabels)).toBe(true);
  });

  it('stats resolves with the yyyymm id shape', async () => {
    const res = await executeQuery(server, STATS, {}, adminCtx);
    expect(res.errors).toBeUndefined();
    const rows = res.data?.admin?.stats;
    expect(Array.isArray(rows)).toBe(true);
    for (const row of rows) {
      expect(row.id).toMatch(/^\d{6}$/); // yyyyMM
    }
  });

  it('selfRated resolves', async () => {
    const res = await executeQuery(server, SELF_RATED, {}, adminCtx);
    expect(res.errors).toBeUndefined();
    expect(Array.isArray(res.data?.admin?.selfRated)).toBe(true);
  });
});

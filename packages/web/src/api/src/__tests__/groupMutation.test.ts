import { ApolloServer } from '@apollo/server';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';

/**
 * groupMutation.ts coverage (55% at the Phase 1 baseline — the guard was
 * probed by graphql.test.ts, but neither resolver body ever ran).
 *
 * Group mutation permission rule (isAdminOfGroup): role > USER — editors,
 * authors and admins, but not plain users. Matches the Java rule.
 *
 * Pinned contracts:
 * - guards: anonymous and plain USER refused on both mutations
 * - EDITOR passes (the minimum role above USER)
 * - createGroup persists the name and returns authorsOf (empty for a new
 *   group, and NORMALIZED games when linked)
 * - updateGroup renames in place, keeps authorsOf mapped
 * - a non-numeric group id is rejected with 'Invalid group ID'
 */

const stamp = Date.now();

let server: ApolloServer;
let editorId: number;
let groupId: number;
let linkedGameId: number;

function asUser(id: number, role: number) {
  return {
    user: {
      id,
      email: `group-mut-${stamp}@integration.test`,
      name: 'Group Mutation Probe',
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

const editorCtx = () => asUser(editorId, 2);
const userCtx = () => asUser(editorId, 1); // same id, insufficient role

const CREATE = `mutation { group { createGroup(input: { name: "grp-mut-${stamp}" }) { id name authorsOf { id } } } }`;
const UPDATE = (name: string, id?: number | string) =>
  `mutation { group { updateGroup(input: { id: "${id ?? groupId}", name: "${name}" }) { id name authorsOf { id name } } } }`;

beforeAll(async () => {
  server = createTestServer();

  const editor = await prisma.csld_csld_user.create({
    data: { email: `group-mut-${stamp}@integration.test`, password: 'x', role: 2, name: 'group-mut-editor', is_author: false },
  });
  editorId = editor.id;

  // a game linked to the group, so authorsOf has real rows to normalize
  const game = await prisma.csld_game.create({
    data: {
      name: `grp-mut-game-${stamp}`,
      description: 'group-mut fixture',
      added_by: editorId,
      deleted: false,
      lang: 'cs',
    },
  });
  linkedGameId = game.id;
  const group = await prisma.csld_csld_group.create({
    data: { name: `grp-mut-seed-${stamp}` },
  });
  groupId = group.id;
  await prisma.csld_game_has_group.create({
    data: { id_game: linkedGameId, id_group: groupId },
  });
}, 30_000);

afterAll(async () => {
  await prisma.csld_game_has_group.deleteMany({ where: { id_game: linkedGameId } });
  await prisma.csld_game.deleteMany({ where: { id: linkedGameId } });
  // every group this suite created or renamed carries the stamped marker
  await prisma.csld_csld_group.deleteMany({ where: { name: { contains: `grp-mut-` } } });
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, `group-mut-${stamp}`));
}, 30_000);

describe('group mutations: guards', () => {
  for (const [label, mutation] of [
    ['createGroup', CREATE],
    ['updateGroup', UPDATE('x')],
  ] as const) {
    it(`anonymous cannot ${label}`, async () => {
      const res = await executeQuery(server, mutation, {});
      expect(res.errors).toBeDefined();
      expect(res.errors?.[0]?.message).toBe('Insufficient permissions');
      expect((res.errors?.[0] as any)?.extensions?.code).toBe('ACCESS_DENIED');
    });

    it(`plain USER cannot ${label}`, async () => {
      const res = await executeQuery(server, mutation, {}, userCtx());
      expect(res.errors?.[0]?.message).toBe('Insufficient permissions');
      expect((res.errors?.[0] as any)?.extensions?.code).toBe('ACCESS_DENIED');
    });
  }
});

describe('group mutations: EDITOR passes (role > USER)', () => {
  it('createGroup persists the name and returns an empty authorsOf', async () => {
    const res = await executeQuery(server, CREATE, {}, editorCtx());
    expect(res.errors).toBeUndefined();
    const created = res.data?.group?.createGroup;
    expect(created.name).toBe(`grp-mut-${stamp}`);
    expect(created.authorsOf).toEqual([]);

    const row = await prisma.csld_csld_group.findUnique({ where: { id: Number(created.id) } });
    expect(row?.name).toBe(`grp-mut-${stamp}`);
    // register for cleanup
    await prisma.csld_csld_group.update({
      where: { id: Number(created.id) },
      data: { name: `grp-mut-created-${stamp}-${created.id}` },
    });
  });

  it('updateGroup renames and maps authorsOf through normalizeGame', async () => {
    const res = await executeQuery(server, UPDATE(`grp-mut-renamed-${stamp}`), {}, editorCtx());
    expect(res.errors).toBeUndefined();
    const updated = res.data?.group?.updateGroup;
    expect(updated.name).toBe(`grp-mut-renamed-${stamp}`);

    // the linked fixture game comes back normalized
    expect(Array.isArray(updated.authorsOf)).toBe(true);
    const gameRow = updated.authorsOf.find((g: { id: string }) => Number(g.id) === linkedGameId);
    expect(gameRow).toBeDefined();
    expect(gameRow.name).toBe(`grp-mut-game-${stamp}`);

    expect((await prisma.csld_csld_group.findUnique({ where: { id: groupId } }))?.name)
      .toBe(`grp-mut-renamed-${stamp}`);
  });

  it('updateGroup with a non-numeric id is refused with Invalid group ID', async () => {
    const res = await executeQuery(server, UPDATE('renamed', 'not-a-number'), {}, editorCtx());
    expect(res.errors).toBeDefined();
    expect(res.errors?.[0]?.message).toBe('Invalid group ID');
    // the group is untouched
    expect((await prisma.csld_csld_group.findUnique({ where: { id: groupId } }))?.name)
      .toBe(`grp-mut-renamed-${stamp}`);
  });
});

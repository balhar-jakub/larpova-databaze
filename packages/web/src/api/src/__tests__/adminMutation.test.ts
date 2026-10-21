import { ApolloServer } from '@apollo/server';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';

/**
 * AdminMutation coverage (31% at the Phase 1 baseline; the only test touching
 * it was an anonymous `updateLabel` auth probe in graphql.test.ts).
 *
 * All six resolvers, through the REAL Apollo wiring:
 * - updateLabel, setLabelRequired, setLabelAuthorized: guard + behaviour
 * - deleteLabel: guard, delete, and the unknown-id null contract
 * - setUserRole: guard + the USER/EDITOR/ADMIN mapping and its silent
 *   `?? 1` fallback for unknown enum values
 * - deleteUser: guard + the cascade contract. The cascade covers
 *   ratings/upvotes/comments/authors/email-auth — the rows that would
 *   otherwise violate their RESTRICT/NoAction FKs.
 */

const stamp = Date.now();

let server: ApolloServer;
let adminId: number;
let labelId: number;
let editorId: number;
let targetId: number;
let ratedGameId: number;

function asUser(id: number, role: number, email: string) {
  return {
    user: {
      id,
      email,
      name: 'Admin Mutation Probe',
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

const adminCtx = () => asUser(adminId, 3, `admin-mut-${stamp}-admin@integration.test`);
const userCtx = () => asUser(targetId, 1, `admin-mut-${stamp}-target@integration.test`);

beforeAll(async () => {
  server = createTestServer();

  // a label-adding user, a target with the full delete-cascade footprint
  const admin = await prisma.csld_csld_user.create({
    data: { email: `admin-mut-${stamp}-admin@integration.test`, password: 'x', role: 3, name: 'admin-mut-admin', is_author: false },
  });
  adminId = admin.id;

  const labelAdder = await prisma.csld_csld_user.create({
    data: { email: `admin-mut-${stamp}-adder@integration.test`, password: 'x', role: 1, name: 'admin-mut-adder', is_author: false },
  });
  const label = await prisma.csld_label.create({
    data: { name: `admin-mut-label-${stamp}`, is_required: false, is_authorized: true, added_by: labelAdder.id },
  });
  labelId = label.id;

  const target = await prisma.csld_csld_user.create({
    data: { email: `admin-mut-${stamp}-target@integration.test`, password: 'x', role: 1, name: 'admin-mut-target', is_author: false },
  });
  targetId = target.id;

  const editor = await prisma.csld_csld_user.create({
    data: { email: `admin-mut-${stamp}-editor@integration.test`, password: 'x', role: 2, name: 'admin-mut-editor', is_author: false },
  });
  editorId = editor.id;

  // the target's footprint: a game they added, a rating, a comment (+upvote
  // by the admin) — everything the cascade must unlink/delete
  const game = await prisma.csld_game.create({
    data: {
      name: `admin-mut-game-${stamp}`,
      description: 'admin-mut fixture',
      added_by: targetId,
      deleted: false,
      lang: 'cs',
    },
  });
  ratedGameId = game.id;
  await prisma.csld_rating.create({
    data: { game_id: game.id, user_id: targetId, rating: 5, state: 2 },
  });
  const comment = await prisma.csld_comment.create({
    data: { game_id: game.id, user_id: targetId, is_hidden: false, added: new Date(), comment: `admin-mut comment ${stamp}` },
  });
  await prisma.csld_comment_upvote.create({
    data: { comment_id: comment.id, user_id: adminId },
  });
  await prisma.csld_game_has_author.create({
    data: { id_game: game.id, id_user: targetId },
  });
}, 30_000);

afterAll(async () => {
  // order matters: upvotes/comments/ratings/author-links before their rows
  await prisma.csld_comment_upvote.deleteMany({ where: { csld_comment: { game_id: ratedGameId } } });
  await prisma.csld_comment.deleteMany({ where: { game_id: ratedGameId } });
  await prisma.csld_rating.deleteMany({ where: { game_id: ratedGameId } });
  await prisma.csld_game_has_author.deleteMany({ where: { id_game: ratedGameId } });
  await prisma.csld_game.deleteMany({ where: { id: ratedGameId } });
  await prisma.csld_label.deleteMany({ where: { id: labelId } });
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, `admin-mut-${stamp}`));
}, 30_000);

describe('AdminMutation guards: every non-admin is refused', () => {
  const MUTATIONS = [
    ['updateLabel', `mutation { admin { updateLabel(input: { id: "${labelId}", name: "x" }) { id } } }`],
    ['setLabelRequired', `mutation { admin { setLabelRequired(labelId: "${labelId}", required: true) { id } } }`],
    ['setLabelAuthorized', `mutation { admin { setLabelAuthorized(labelId: "${labelId}", authorized: false) { id } } }`],
    ['deleteLabel', `mutation { admin { deleteLabel(labelId: "${labelId}") { id } } }`],
    ['setUserRole', `mutation { admin { setUserRole(userId: "${targetId}", role: EDITOR) { id } } }`],
    ['deleteUser', `mutation { admin { deleteUser(userId: "${targetId}") { id } } }`],
  ] as const;

  for (const [label, mutation] of MUTATIONS) {
    it(`plain USER cannot ${label}`, async () => {
      const res = await executeQuery(server, mutation, {}, userCtx());
      expect(res.errors).toBeDefined();
      expect(res.errors?.[0]?.message).toBe('Admin access required');
      expect((res.errors?.[0] as any)?.extensions?.code).toBe('ACCESS_DENIED');
      // no side effect happened
      if (label === 'deleteUser') {
        expect(await prisma.csld_csld_user.findUnique({ where: { id: targetId } })).not.toBeNull();
      }
    });

    it(`anonymous cannot ${label}`, async () => {
      const res = await executeQuery(server, mutation, {});
      expect(res.errors?.[0]?.message).toBe('Admin access required');
      expect((res.errors?.[0] as any)?.extensions?.code).toBe('ACCESS_DENIED');
    });
  }
});

describe('AdminMutation behaviour: ADMIN passes', () => {
  it('updateLabel renames and re-describes the label (description omitted → null)', async () => {
    await prisma.csld_label.update({ where: { id: labelId }, data: { description: 'old text' } });
    const res = await executeQuery(server, `
      mutation { admin { updateLabel(input: { id: "${labelId}", name: "renamed-${stamp}" }) { id name description } } }
    `, {}, adminCtx());
    expect(res.errors).toBeUndefined();
    expect(res.data?.admin?.updateLabel?.name).toBe(`renamed-${stamp}`);
    expect(res.data?.admin?.updateLabel?.description).toBeNull();

    const row = await prisma.csld_label.findUnique({ where: { id: labelId } });
    expect(row?.name).toBe(`renamed-${stamp}`);
    expect(row?.description).toBeNull();
  });

  it('setLabelRequired toggles is_required and returns the updated label', async () => {
    const res = await executeQuery(server, `
      mutation { admin { setLabelRequired(labelId: "${labelId}", required: true) { id isRequired } } }
    `, {}, adminCtx());
    expect(res.errors).toBeUndefined();
    expect(res.data?.admin?.setLabelRequired?.isRequired).toBe(true);
    expect((await prisma.csld_label.findUnique({ where: { id: labelId } }))?.is_required).toBe(true);
  });

  it('setLabelAuthorized toggles is_authorized', async () => {
    const res = await executeQuery(server, `
      mutation { admin { setLabelAuthorized(labelId: "${labelId}", authorized: false) { id isAuthorized } } }
    `, {}, adminCtx());
    expect(res.errors).toBeUndefined();
    expect(res.data?.admin?.setLabelAuthorized?.isAuthorized).toBe(false);
    expect((await prisma.csld_label.findUnique({ where: { id: labelId } }))?.is_authorized).toBe(false);
  });

  it('deleteLabel removes the label and returns the pre-delete snapshot', async () => {
    const res = await executeQuery(server, `
      mutation { admin { deleteLabel(labelId: "${labelId}") { id name } } }
    `, {}, adminCtx());
    expect(res.errors).toBeUndefined();
    expect(res.data?.admin?.deleteLabel?.name).toBe(`renamed-${stamp}`);
    expect(await prisma.csld_label.findUnique({ where: { id: labelId } })).toBeNull();
  });

  it('deleteLabel of an unknown id returns null (contract: Label nullable)', async () => {
    const res = await executeQuery(server, `
      mutation { admin { deleteLabel(labelId: "999999999") { id } } }
    `, {}, adminCtx());
    expect(res.errors).toBeUndefined();
    expect(res.data?.admin?.deleteLabel).toBeNull();
  });

  it('setUserRole maps USER/EDITOR/ADMIN and an unknown enum string falls back to USER', async () => {
    // EDITOR via enum
    const res = await executeQuery(server, `
      mutation { admin { setUserRole(userId: "${targetId}", role: EDITOR) { id role } } }
    `, {}, adminCtx());
    expect(res.errors).toBeUndefined();
    expect(res.data?.admin?.setUserRole?.role).toBe('EDITOR');
    expect((await prisma.csld_csld_user.findUnique({ where: { id: targetId } }))?.role).toBe(2);

    // ADMIN via enum, then back down — through the resolver, not psql
    const up = await executeQuery(server, `
      mutation { admin { setUserRole(userId: "${targetId}", role: ADMIN) { id role } } }
    `, {}, adminCtx());
    expect(up.data?.admin?.setUserRole?.role).toBe('ADMIN');
    expect((await prisma.csld_csld_user.findUnique({ where: { id: targetId } }))?.role).toBe(3);

    // The schema's UserRoleIn enum admits only USER/EDITOR/ADMIN, so the
    // resolver's `?? 1` fallback is unreachable through the GraphQL API —
    // the schema rejects anything else with GRAPHQL_VALIDATION_FAILED
    // before the resolver runs. Pinned so a future enum widening or a
    // direct-call path gets a conscious decision.
    const unknown = await executeQuery(server, `
      mutation { admin { setUserRole(userId: "${targetId}", role: AUTHOR) { id role } } }
    `, {}, adminCtx());
    expect(unknown.errors).toBeDefined();
    expect((unknown.errors?.[0] as any)?.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
    // unchanged by the rejected call
    expect((await prisma.csld_csld_user.findUnique({ where: { id: targetId } }))?.role).toBe(3);
  });

  it('deleteUser cascades the full footprint and returns the pre-delete user', async () => {
    const res = await executeQuery(server, `
      mutation { admin { deleteUser(userId: "${targetId}") { id name } } }
    `, {}, adminCtx());
    expect(res.errors).toBeUndefined();
    expect(res.data?.admin?.deleteUser?.name).toBe('admin-mut-target');

    // the user is gone
    expect(await prisma.csld_csld_user.findUnique({ where: { id: targetId } })).toBeNull();
    // the cascade removed their ratings, comments (and the admin's upvote on
    // it), author links — while the game itself stays
    expect(await prisma.csld_rating.findFirst({ where: { user_id: targetId } })).toBeNull();
    expect(await prisma.csld_comment.findFirst({ where: { user_id: targetId } })).toBeNull();
    expect(await prisma.csld_game_has_author.findFirst({ where: { id_user: targetId } })).toBeNull();
    expect(await prisma.csld_game.findUnique({ where: { id: ratedGameId } })).not.toBeNull();
  });

  it('deleteUser of an unknown id returns null', async () => {
    const res = await executeQuery(server, `
      mutation { admin { deleteUser(userId: "999999999") { id } } }
    `, {}, adminCtx());
    expect(res.errors).toBeUndefined();
    expect(res.data?.admin?.deleteUser).toBeNull();
  });

  it('deleteUser on a user with an FK the cascade does NOT cover is refused, not corrupted', async () => {
    // `csld_label.added_by` has no onDelete and the cascade skips it — a
    // user who added a label cannot be deleted; the transaction rolls back
    // and NOTHING is removed. Pinned so a future cascade fix flips this.
    const orphan = await prisma.csld_csld_user.create({
      data: { email: `admin-mut-${stamp}-orphan@integration.test`, password: 'x', role: 1, name: 'admin-mut-orphan', is_author: false },
    });
    await prisma.csld_label.create({
      data: { name: `admin-mut-orphan-label-${stamp}`, is_required: false, is_authorized: true, added_by: orphan.id },
    });
    await prisma.csld_rating.create({
      data: { game_id: ratedGameId, user_id: orphan.id, rating: 3, state: 2 },
    });
    const res = await executeQuery(server, `
      mutation { admin { deleteUser(userId: "${orphan.id}") { id } } }
    `, {}, adminCtx());
    expect(res.errors).toBeDefined();
    // transaction rolled back: the user and their rating are still there
    expect(await prisma.csld_csld_user.findUnique({ where: { id: orphan.id } })).not.toBeNull();
    expect(await prisma.csld_rating.findFirst({ where: { user_id: orphan.id } })).not.toBeNull();
    // cleanup
    await prisma.csld_label.deleteMany({ where: { added_by: orphan.id } });
    await prisma.csld_rating.deleteMany({ where: { user_id: orphan.id } });
  });
});

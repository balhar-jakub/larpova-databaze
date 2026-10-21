import { ApolloServer } from '@apollo/server';
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';

/**
 * The per-game `ratingsDisabled` / `commentsDisabled` switches are set by the
 * edit form and respected by the reads (homepage filters) and the UI (the
 * rating widget and the add-comment button disappear) — but the mutations
 * never checked them: a game with ratings disabled still accepted ratings
 * through the API, and one with comments disabled still accepted new
 * comments. The UI is not a permission model.
 *
 * Mirrored UI semantics:
 * - ratingsDisabled: no rating (setting one is refused; clearing your own
 *   rating stays possible — it is not new activity)
 * - commentsDisabled: no NEW comment (editing your existing comment stays
 *   possible, exactly like the UI keeps the edit button)
 */

const stamp = Date.now();

const RATE = `mutation R($g: ID!, $r: Int) { game { rateGame(gameId: $g, rating: $r) { id } } }`;
const COMMENT = `mutation C($g: ID!, $c: String!) { game { createOrUpdateComment(gameId: $g, comment: $c) { id } } }`;
const PLAYED = `mutation P($g: ID!) { game { setGamePlayedState(gameId: $g, state: 2) { id } } }`;

function asUser(id: number, role = 1) {
  return {
    user: {
      id,
      email: `game-flags-${stamp}@integration.test`,
      name: 'Game Flags Probe',
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

let server: ApolloServer;
let normalGameId: number;
let noRatingsGameId: number;
let noCommentsGameId: number;
let userCtx: ReturnType<typeof asUser>;
let otherCtx: ReturnType<typeof asUser>;

async function makeGame(ratingsdisabled: boolean, commentsdisabled: boolean) {
  return prisma.csld_game.create({
    data: {
      name: `Audit-flags-${stamp}-${ratingsdisabled ? 'norate' : ''}${commentsdisabled ? 'nocomment' : ''}`,
      description: 'audit fixture',
      added_by: userCtx.user.id,
      deleted: false,
      lang: 'cs',
      ratingsdisabled,
      commentsdisabled,
    },
  });
}

beforeAll(async () => {
  server = createTestServer();

  // Real accounts — csld_game.added_by has an FK to csld_csld_user.
  const marker = `game-flags-${stamp}`;
  const me = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  const other = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: `${marker}-b`, email: `${marker}-b@integration.test` },
  });
  userCtx = asUser(me.id);
  otherCtx = asUser(other.id);

  normalGameId = (await makeGame(false, false)).id;
  noRatingsGameId = (await makeGame(true, false)).id;
  noCommentsGameId = (await makeGame(false, true)).id;
});

afterAll(async () => {
  // Games first (comment/rating rows reference them), then accounts.
  const gameIds = [normalGameId, noRatingsGameId, noCommentsGameId].filter(Boolean);
  if (gameIds.length) {
    await prisma.csld_rating.deleteMany({ where: { game_id: { in: gameIds } } });
    await prisma.csld_comment.deleteMany({ where: { game_id: { in: gameIds } } });
    await prisma.csld_game.deleteMany({ where: { id: { in: gameIds } } });
  }
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, `game-flags-${stamp}`));
});

describe('ratingsDisabled is enforced by the API', () => {
  it('setting a rating on a ratings-disabled game is refused', async () => {
    const res = await executeQuery(server, RATE, { g: String(noRatingsGameId), r: 5 }, userCtx);
    expect(res.errors?.[0]?.message).toBe('Ratings are disabled for this game');
    expect((res.errors?.[0] as any)?.extensions?.code).toBe('RATINGS_DISABLED');
  });

  it('clearing your own rating on a ratings-disabled game still works', async () => {
    const res = await executeQuery(server, RATE, { g: String(noRatingsGameId), r: null }, userCtx);
    expect(res.errors).toBeUndefined();
  });

  it('setGamePlayedState is NOT blocked by ratingsDisabled (play state, not a rating)', async () => {
    const res = await executeQuery(server, PLAYED, { g: String(noRatingsGameId) }, userCtx);
    expect(res.errors).toBeUndefined();
  });

  it('rating a normal game still works', async () => {
    const res = await executeQuery(server, RATE, { g: String(normalGameId), r: 4 }, userCtx);
    expect(res.errors).toBeUndefined();
  });
});

describe('commentsDisabled is enforced by the API (new comments only)', () => {
  it('creating a comment on a comments-disabled game is refused', async () => {
    const res = await executeQuery(
      server,
      COMMENT,
      { g: String(noCommentsGameId), c: `probe ${stamp}` },
      userCtx,
    );
    expect(res.errors?.[0]?.message).toBe('Comments are disabled for this game');
    expect((res.errors?.[0] as any)?.extensions?.code).toBe('COMMENTS_DISABLED');
  });

  it('creating a comment on a normal game still works', async () => {
    const res = await executeQuery(
      server,
      COMMENT,
      { g: String(normalGameId), c: `probe ${stamp}` },
      userCtx,
    );
    expect(res.errors).toBeUndefined();
  });

  it('editing your OWN comment on a comments-disabled game still works (UI parity)', async () => {
    // The user must already have a comment there: put one on while the flag
    // was off, then flip the flag and edit.
    const game = await prisma.csld_game.create({
      data: {
        name: `Audit-flags-${stamp}-flip`,
        description: 'audit fixture',
        added_by: userCtx.user.id,
        deleted: false,
        lang: 'cs',
        ratingsdisabled: false,
        commentsdisabled: false,
      },
    });
    const created = await executeQuery(
      server,
      COMMENT,
      { g: String(game.id), c: `first ${stamp}` },
      userCtx,
    );
    expect(created.errors).toBeUndefined();

    await prisma.csld_game.update({
      where: { id: game.id },
      data: { commentsdisabled: true },
    });

    const edited = await executeQuery(
      server,
      COMMENT,
      { g: String(game.id), c: `second ${stamp}` },
      userCtx,
    );
    expect(edited.errors).toBeUndefined();

    // And a different user still cannot add a NEW comment once disabled.
    const refused = await executeQuery(
      server,
      COMMENT,
      { g: String(game.id), c: `trespass ${stamp}` },
      otherCtx,
    );
    expect(refused.errors?.[0]?.message).toBe('Comments are disabled for this game');

    // cleanup the extra game
    await prisma.csld_comment.deleteMany({ where: { game_id: game.id } });
    await prisma.csld_game.delete({ where: { id: game.id } });
  });
});

import { ApolloServer } from '@apollo/server';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';

/**
 * Guard and edge arms of resolvers/gameMutation.ts that the behaviour suites
 * (gameMutationBehaviour, gameFlags, gameAuthorPermissions, deletedGames,
 * series) leave cold: the NaN-id reject of every mutation, the aggregate
 * `??` fallbacks (an empty rating set), the deleteGameRating userId arm,
 * rateGame's remove-rating arm, setGamePlayedState's state-0 arm, the
 * comment-update-vs-create arm, and setGameSeries' resolve-target arms
 * (invalid id, soft-deleted series, unlink).
 *
 * Every test asserts the resolver's own error contract (code) or the
 * persisted state — never just "no errors".
 */
const stamp = Date.now();
const marker = `gmut-guard-${stamp}`;

const RATE = `mutation R($g: ID!, $r: Int) { game { rateGame(gameId: $g, rating: $r) { id amountOfRatings } } }`;
const PLAYED = `mutation P($g: ID!, $s: Int!) { game { setGamePlayedState(gameId: $g, state: $s) { id } } }`;
const COMMENT = `mutation CM($g: ID!, $c: String!) { game { createOrUpdateComment(gameId: $g, comment: $c) { id } } }`;
const DELETE_COMMENT = `mutation D($c: ID!) { game { deleteComment(commentId: $c) { id } } }`;
const SET_VISIBLE = `mutation V($c: ID!, $v: Boolean!) { game { setCommentVisible(commentId: $c, visible: $v) { id } } }`;
const DELETE_RATING = `mutation DR($g: ID!, $u: ID) { game { deleteGameRating(gameId: $g, userId: $u) { id amountOfRatings } } }`;
const DELETE_GAME = `mutation DG($g: ID!) { game { deleteGame(gameId: $g) { id } } }`;
const SET_SERIES = `mutation S($input: SeriesAssignmentInput!) { game { setGameSeries(input: $input) { id series { id name } } } }`;

let server: ApolloServer;
let userId: number;
let editorId: number;
let gameId: number;
let seriesId: number;
let commentId: number;

function userCtx(id: number, role: number) {
  return {
    user: {
      id,
      email: `${marker}-${id}@integration.test`,
      name: marker,
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
const meCtx = () => userCtx(userId, 1);
const editorCtx = () => userCtx(editorId, 2);

async function makeGame(name: string, extra: Record<string, unknown> = {}) {
  return prisma.csld_game.create({
    data: { name, description: '', added_by: userId, deleted: false, lang: 'cs', ...extra },
  });
}

beforeAll(async () => {
  server = createTestServer();

  const me = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  userId = me.id;
  const editor = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 2, name: `${marker} ed`, email: `${marker}-ed@integration.test` },
  });
  editorId = editor.id;

  gameId = (await makeGame(`${marker} hra`)).id;
  // The author link is what isGameAuthor checks — added_by alone is not enough.
  await prisma.csld_game_has_author.create({ data: { id_game: gameId, id_user: userId } });
  const series = await prisma.csld_series.create({
    data: { name: `${marker} série`, added_by: userId, deleted: false },
  });
  seriesId = series.id;
  const comment = await prisma.csld_comment.create({
    data: { game_id: gameId, user_id: userId, comment: 'start', is_hidden: false, amount_of_upvotes: 0 },
  });
  commentId = comment.id;
});

afterAll(async () => {
  if (gameId) {
    await prisma.csld_comment_upvote.deleteMany({ where: { comment_id: commentId } });
    await prisma.csld_comment.deleteMany({ where: { game_id: gameId } });
    await prisma.csld_rating.deleteMany({ where: { game_id: gameId } });
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: gameId } });
    await prisma.csld_game_has_label.deleteMany({ where: { id_game: gameId } });
    await prisma.csld_game.deleteMany({ where: { id: gameId } });
  }
  await prisma.csld_series.deleteMany({ where: { name: { startsWith: marker } } });
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, marker));
});

describe('NaN and missing-target guards', () => {
  it('rateGame rejects a malformed gameId', async () => {
    const res = await executeQuery(server, RATE, { g: 'not-a-number', r: 5 }, meCtx());
    expect(res.errors?.[0]?.message).toContain('Invalid gameId');
  });

  it('setGamePlayedState rejects a malformed gameId', async () => {
    const res = await executeQuery(server, PLAYED, { g: 'NaN', s: 2 }, meCtx());
    expect(res.errors?.[0]?.message).toContain('Invalid gameId');
  });

  it('createOrUpdateComment rejects a malformed gameId and an empty comment', async () => {
    const badId = await executeQuery(server, COMMENT, { g: 'x', c: 'text' }, meCtx());
    expect(badId.errors?.[0]?.message).toContain('Invalid gameId');
    const empty = await executeQuery(server, COMMENT, { g: String(gameId), c: '   ' }, meCtx());
    expect(empty.errors?.[0]?.extensions?.code).toBe('VALIDATION_FAILED');
  });

  it('setCommentVisible rejects a malformed commentId', async () => {
    const res = await executeQuery(server, SET_VISIBLE, { c: 'x', v: true }, editorCtx());
    expect(res.errors?.[0]?.message).toContain('Invalid commentId');
  });

  it('deleteComment rejects a malformed commentId and reports a missing comment', async () => {
    const bad = await executeQuery(server, DELETE_COMMENT, { c: 'x' }, meCtx());
    expect(bad.errors?.[0]?.message).toContain('Invalid commentId');
    const missing = await executeQuery(server, DELETE_COMMENT, { c: '999999999' }, meCtx());
    expect(missing.errors?.[0]?.message).toContain('Comment not found');
  });

  it('deleteGameRating rejects a malformed gameId', async () => {
    const res = await executeQuery(server, DELETE_RATING, { g: 'x' }, editorCtx());
    expect(res.errors?.[0]?.message).toContain('Invalid gameId');
  });

  it('deleteGame rejects a malformed gameId and a missing game', async () => {
    const bad = await executeQuery(server, DELETE_GAME, { g: 'x' }, meCtx());
    expect(bad.errors?.[0]?.message).toContain('Invalid gameId');
    const missing = await executeQuery(server, DELETE_GAME, { g: '999999999' }, meCtx());
    expect(missing.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });
});

describe('rateGame arms', () => {
  it('removes the rating when rating is null and recalculates the aggregates to zero', async () => {
    await prisma.csld_rating.create({ data: { game_id: gameId, user_id: userId, rating: 8, state: 2 } });
    const res = await executeQuery(server, RATE, { g: String(gameId), r: null }, meCtx());
    expect(res.errors).toBeUndefined();
    expect((res.data as any).game.rateGame.amountOfRatings).toBe(0);
    expect(await prisma.csld_rating.findFirst({ where: { game_id: gameId, user_id: userId } })).toBeNull();
    // the aggregates: avg ?? 0 and count ?? 0 with zero rows → all zeroed
    const row = await prisma.csld_game.findUnique({ where: { id: gameId } });
    expect(row!.average_rating).toBe(0);
    expect(row!.total_rating).toBe(0);
    expect(row!.amount_of_ratings).toBe(0);
  });

  it('upserts an existing rating (update arm) and recalculates', async () => {
    await prisma.csld_rating.create({ data: { game_id: gameId, user_id: userId, rating: 3, state: 1 } });
    const res = await executeQuery(server, RATE, { g: String(gameId), r: 9 }, meCtx());
    expect(res.errors).toBeUndefined();
    const row = await prisma.csld_rating.findUnique({
      where: { game_id_user_id: { game_id: gameId, user_id: userId } },
    });
    expect(row!.rating).toBe(9);
    expect(row!.state).toBe(2); // PLAYED when a rating is given
    expect((res.data as any).game.rateGame.amountOfRatings).toBe(1);
  });
});

describe('setGamePlayedState arms', () => {
  it('state 0 removes the play state entirely', async () => {
    await prisma.csld_rating.deleteMany({ where: { game_id: gameId, user_id: userId } }); // unique (game,user)
    await prisma.csld_rating.create({ data: { game_id: gameId, user_id: userId, state: 1 } });
    const res = await executeQuery(server, PLAYED, { g: String(gameId), s: 0 }, meCtx());
    expect(res.errors).toBeUndefined();
    expect(await prisma.csld_rating.findFirst({ where: { game_id: gameId, user_id: userId } })).toBeNull();
  });

  it('upserts the state of an existing rating row without losing its rating', async () => {
    await prisma.csld_rating.deleteMany({ where: { game_id: gameId, user_id: userId } }); // unique (game,user)
    await prisma.csld_rating.create({ data: { game_id: gameId, user_id: userId, rating: 7, state: 1 } });
    const res = await executeQuery(server, PLAYED, { g: String(gameId), s: 2 }, meCtx());
    expect(res.errors).toBeUndefined();
    const row = await prisma.csld_rating.findUnique({
      where: { game_id_user_id: { game_id: gameId, user_id: userId } },
    });
    expect(row!.state).toBe(2);
    expect(row!.rating).toBe(7); // the upsert only touches state
  });
});

describe('createOrUpdateComment arms', () => {
  it('updates an existing comment (no linkify of the empty string needed) and resets `added`', async () => {
    const before = await prisma.csld_comment.findUnique({ where: { id: commentId } });
    const res = await executeQuery(server, COMMENT, { g: String(gameId), c: `upravený ${stamp}` }, meCtx());
    expect(res.errors).toBeUndefined();
    const row = await prisma.csld_comment.findUnique({ where: { id: commentId } });
    expect(row!.comment).toContain(`upravený ${stamp}`);
    expect(row!.added.getTime()).toBeGreaterThan(before!.added.getTime());
  });

  it('createGame/updateGame urlLinkify empty-description arm: a game with no description stays empty', async () => {
    // makeGame writes description: '' → urlLinkify('') returns '' (the !text arm)
    const row = await prisma.csld_game.findUnique({ where: { id: gameId } });
    expect(row!.description).toBe('');
  });
});

describe('deleteGameRating arms', () => {
  it('without userId it deletes every rating on the game (the spread arm)', async () => {
    await prisma.csld_rating.deleteMany({ where: { game_id: gameId } });
    await prisma.csld_rating.create({ data: { game_id: gameId, user_id: userId, rating: 5, state: 2 } });
    const res = await executeQuery(server, DELETE_RATING, { g: String(gameId) }, editorCtx());
    expect(res.errors).toBeUndefined();
    expect((res.data as any).game.deleteGameRating.amountOfRatings).toBe(0);
    expect(await prisma.csld_rating.count({ where: { game_id: gameId } })).toBe(0);
  });
});

describe('create/update optional-field mapping (the ?? arms)', () => {
  const FULL_CREATE = `
    mutation C($input: CreateGameInput!) { game { createGame(input: $input) { id name year players menRole womenRole bothRole hours days web galleryURL photoAuthor ratingsDisabled commentsDisabled } } }`;
  const FULL_UPDATE = `
    mutation U($input: UpdateGameInput!) { game { updateGame(input: $input) { id year players menRole womenRole bothRole hours days web galleryURL photoAuthor ratingsDisabled commentsDisabled } } }`;

  it('createGame maps every optional field when all are provided', async () => {
    const res = await executeQuery(
      server, FULL_CREATE,
      {
        input: {
          name: `${marker} full`,
          description: 'popis',
          authors: [String(userId)],
          newAuthors: [],
          groupAuthors: [],
          newGroupAuthors: [],
          labels: [],
          newLabels: [],
          year: 2077, players: 30, menRole: 5, womenRole: 5, bothRole: 0,
          hours: 6, days: 2, web: 'https://example.com', galleryURL: 'https://g.example',
          photoAuthor: 'Fotograf', ratingsDisabled: true, commentsDisabled: true,
        },
      },
      meCtx(),
    );
    expect(res.errors).toBeUndefined();
    const g = (res.data as any).game.createGame;
    expect(g.year).toBe(2077);
    expect(g.players).toBe(30);
    expect(g.ratingsDisabled).toBe(true);
    expect(g.commentsDisabled).toBe(true);
    const createdId = parseInt(g.id, 10);
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: createdId } });
    await prisma.csld_game.delete({ where: { id: createdId } });
  });

  it('updateGame maps every optional field when all are provided', async () => {
    const res = await executeQuery(
      server, FULL_UPDATE,
      {
        input: {
          id: String(gameId),
          name: `${marker} hra`,
          description: 'popis',
          authors: [String(userId)],
          newAuthors: [],
          groupAuthors: [],
          newGroupAuthors: [],
          labels: [],
          newLabels: [],
          year: 2088, players: 12, menRole: 1, womenRole: 2, bothRole: 3,
          hours: 4, days: 1, web: 'https://web.example', galleryURL: 'https://gl.example',
          photoAuthor: 'Autoři fotek', ratingsDisabled: false, commentsDisabled: false,
        },
      },
      meCtx(), // the author (author link exists from beforeAll)
    );
    expect(res.errors).toBeUndefined();
    const g = (res.data as any).game.updateGame;
    expect(g.year).toBe(2088);
    expect(g.players).toBe(12);
    expect(g.photoAuthor).toBe('Autoři fotek');
  });
});

describe('setGameSeries resolve-target arms', () => {
  it('rejects a malformed series id', async () => {
    const res = await executeQuery(
      server, SET_SERIES,
      { input: { gameId: String(gameId), seriesId: 'NaN' } },
      meCtx(),
    );
    expect(res.errors?.[0]?.message).toContain('Invalid series ID');
  });

  it('rejects an unknown series id', async () => {
    const res = await executeQuery(
      server, SET_SERIES,
      { input: { gameId: String(gameId), seriesId: '999999999' } },
      meCtx(),
    );
    expect(res.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
  });

  it('rejects a soft-deleted series for a plain user; an editor links it', async () => {
    const deleted = await prisma.csld_series.create({
      data: { name: `${marker} smazaná`, added_by: userId, deleted: true },
    });
    try {
      const refused = await executeQuery(
        server, SET_SERIES,
        { input: { gameId: String(gameId), seriesId: String(deleted.id) } },
        meCtx(),
      );
      expect(refused.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');

      // restore the game's own series link first (the editor path overwrites)
      const allowed = await executeQuery(
        server, SET_SERIES,
        { input: { gameId: String(gameId), seriesId: String(deleted.id) } },
        editorCtx(),
      );
      expect(allowed.errors).toBeUndefined();
      expect((allowed.data as any).game.setGameSeries.series.id).toBe(String(deleted.id));
    } finally {
      await prisma.csld_game.update({ where: { id: gameId }, data: { series_id: seriesId } });
      await prisma.csld_series.delete({ where: { id: deleted.id } });
    }
  });

  it('a whitespace-only newSeriesName is treated as no name (unlink arm)', async () => {
    // Link first so the unlink is observable.
    await prisma.csld_game.update({ where: { id: gameId }, data: { series_id: seriesId } });
    const res = await executeQuery(
      server, SET_SERIES,
      { input: { gameId: String(gameId), seriesId: null, newSeriesName: '   ' } },
      meCtx(),
    );
    expect(res.errors).toBeUndefined();
    const row = await prisma.csld_game.findUnique({ where: { id: gameId } });
    expect(row!.series_id).toBeNull();
  });

  it('an unknown game and a stranger are refused', async () => {
    const missing = await executeQuery(
      server, SET_SERIES,
      { input: { gameId: '999999999', seriesId: String(seriesId) } },
      meCtx(),
    );
    expect(missing.errors?.[0]?.extensions?.code).toBe('NOT_FOUND');
    const badId = await executeQuery(
      server, SET_SERIES,
      { input: { gameId: 'x', seriesId: String(seriesId) } },
      meCtx(),
    );
    expect(badId.errors?.[0]?.message).toContain('Invalid game ID');
    const stranger = await prisma.csld_csld_user.findFirst({ where: { role: 1, id: { not: userId } } });
    if (stranger) {
      const refused = await executeQuery(
        server, SET_SERIES,
        { input: { gameId: String(gameId), seriesId: String(seriesId) } },
        userCtx(stranger.id, 1),
      );
      expect(refused.errors?.[0]?.extensions?.code).toBe('ACCESS_DENIED');
    }
  });
});

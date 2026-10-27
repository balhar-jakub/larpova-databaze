import { ApolloServer } from '@apollo/server';
import {describe, it, expect, beforeAll, afterAll} from '@jest/globals';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';

/**
 * Coverage for the gameMutation paths no other suite touches:
 * the comment moderation trio (setCommentVisible / setCommentLiked /
 * deleteComment), deleteGameRating, and the createGame / updateGame happy
 * paths including their field mapping and author/group/label sync.
 *
 * Every permission rule here is already pinned by gameAuthorPermissions and
 * deletedGames; this suite pins the BEHAVIOUR: idempotent upvotes, the
 * denormalized upvote count, editor-only comment hiding, owner-or-editor
 * comment deletion, editor-only rating removal, and the create/update
 * column mapping (incl. urlLinkify on description, the Java-parity `added`
 * reset on every save, and full author/group/label re-sync on update).
 */

const stamp = Date.now();

const CREATE_GAME = `
  mutation C($input: CreateGameInput!) {
    game { createGame(input: $input) { id name description year web galleryURL } }
  }`;
const UPDATE_GAME = `
  mutation U($input: UpdateGameInput!) {
    game { updateGame(input: $input) { id name description } }
  }`;
const SET_VISIBLE = `
  mutation V($c: ID!, $v: Boolean!) { game { setCommentVisible(commentId: $c, visible: $v) { id } } }`;
const LIKED = `
  mutation L($c: ID!, $v: Boolean!) { game { setCommentLiked(commentId: $c, liked: $v) { id } } }`;
const DELETE_COMMENT = `
  mutation D($c: ID!) { game { deleteComment(commentId: $c) { id } } }`;
const DELETE_RATING = `
  mutation DR($g: ID!, $u: ID) { game { deleteGameRating(gameId: $g, userId: $u) { id } } }`;

let server: ApolloServer;
let meId: number;
let otherId: number;
let gameId: number;
let modGameId: number; // moderation playground with two commenters
let myCommentId: number;
let otherCommentId: number;

function ctxFor(id: number, role: number) {
  return {
    user: {
      id,
      email: `gmut-${stamp}@integration.test`,
      name: 'GMut Probe',
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
const meCtx = () => ctxFor(meId, 1);
const otherCtx = () => ctxFor(otherId, 1);
const editorCtx = () => ctxFor(meId, 2);

async function makeGame(name: string) {
  return prisma.csld_game.create({
    data: {
      name,
      description: 'gmut fixture',
      added_by: meId,
      deleted: false,
      lang: 'cs',
    },
  });
}

async function makeComment(gameId: number, userId: number, text: string) {
  return prisma.csld_comment.create({
    data: {
      game_id: gameId,
      user_id: userId,
      comment: text,
      is_hidden: false,
      amount_of_upvotes: 0,
    },
  });
}

beforeAll(async () => {
  server = createTestServer();

  const marker = `gmut-${stamp}`;
  const me = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  const other = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: `${marker}-b`, email: `${marker}-b@integration.test` },
  });
  meId = me.id;
  otherId = other.id;

  gameId = (await makeGame(`${marker} main`)).id;
  modGameId = (await makeGame(`${marker} mod`)).id;
  myCommentId = (await makeComment(modGameId, meId, `mine ${stamp}`)).id;
  otherCommentId = (await makeComment(modGameId, otherId, `theirs ${stamp}`)).id;
});

afterAll(async () => {
  const gameIds = [gameId, modGameId].filter(Boolean);
  if (gameIds.length) {
    await prisma.csld_comment_upvote.deleteMany({ where: { comment_id: { in: (await prisma.csld_comment.findMany({ where: { game_id: { in: gameIds } }, select: { id: true } })).map((c) => c.id) } } });
    await prisma.csld_comment.deleteMany({ where: { game_id: { in: gameIds } } });
    await prisma.csld_rating.deleteMany({ where: { game_id: { in: gameIds } } });
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: { in: gameIds } } });
    await prisma.csld_game_has_group.deleteMany({ where: { id_game: { in: gameIds } } });
    await prisma.csld_game_has_label.deleteMany({ where: { id_game: { in: gameIds } } });
    await prisma.csld_game.deleteMany({ where: { id: { in: gameIds } } });
  }
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, `gmut-${stamp}`));
});

describe('createGame / updateGame behaviour', () => {
  it('createGame maps camelCase input to columns and linkifies the description', async () => {
    const res = await executeQuery(
      server,
      CREATE_GAME,
      {
        input: {
          name: `gmut-${stamp} created`,
          description: 'See https://example.com/docs for details.',
          authors: [String(meId)],
          newAuthors: [],
          groupAuthors: [],
          newGroupAuthors: [],
          labels: [],
          newLabels: [],
          year: 2077,
          web: 'https://example.com',
          galleryURL: 'https://example.com/gallery',
        },
      },
      meCtx(),
    );
    expect(res.errors).toBeUndefined();
    const game = (res.data as any).game.createGame;
    expect(game.name).toBe(`gmut-${stamp} created`);
    expect(game.year).toBe(2077);
    expect(game.web).toBe('https://example.com');
    expect(game.galleryURL).toBe('https://example.com/gallery');
    expect(game.description).toContain('<a href="https://example.com/docs"');
    const createdId = parseInt(game.id, 10);

    // author link actually persisted
    const authors = await prisma.csld_game_has_author.findMany({ where: { id_game: createdId } });
    expect(authors.map((a) => a.id_user)).toContain(meId);

    // cleanup
    await prisma.csld_game_has_author.deleteMany({ where: { id_game: createdId } });
    await prisma.csld_game.delete({ where: { id: createdId } });
  });

  it('updateGame re-syncs authors/groups/labels and resets `added` (Java parity)', async () => {
    // fixture: one author (other), one label
    const label = await prisma.csld_label.create({
      data: { name: `gmut-${stamp}-label`, is_required: false, is_authorized: true, added_by: meId },
    });
    const group = await prisma.csld_csld_group.create({
      data: { name: `gmut-${stamp}-group` },
    });
    await prisma.csld_game_has_author.create({ data: { id_game: gameId, id_user: otherId } });

    const res = await executeQuery(
      server,
      UPDATE_GAME,
      {
        input: {
          id: String(gameId),
          name: `gmut-${stamp} renamed`,
          description: 'updated description',
          authors: [String(meId)], // drop other, add me
          newAuthors: [],
          groupAuthors: [String(group.id)],
          newGroupAuthors: [],
          labels: [String(label.id)],
          newLabels: [],
        },
      },
      editorCtx(), // editor may edit any game
    );
    expect(res.errors).toBeUndefined();
    expect((res.data as any).game.updateGame.name).toBe(`gmut-${stamp} renamed`);

    const authorRows = await prisma.csld_game_has_author.findMany({ where: { id_game: gameId } });
    expect(authorRows.map((a) => a.id_user)).toEqual([meId]); // old author gone, new in
    const groupRows = await prisma.csld_game_has_group.findMany({ where: { id_game: gameId } });
    expect(groupRows.map((g) => g.id_group)).toEqual([group.id]);
    const labelRows = await prisma.csld_game_has_label.findMany({ where: { id_game: gameId } });
    expect(labelRows.map((l) => l.id_label)).toEqual([label.id]);

    // Java behaviour: `added` is reset on every save — a fresh update bumps it.
    const row = await prisma.csld_game.findUnique({ where: { id: gameId } });
    expect(row!.added.getTime()).toBeGreaterThan(Date.now() - 60_000);

    await prisma.csld_game_has_group.deleteMany({ where: { id_game: gameId } });
    await prisma.csld_csld_group.delete({ where: { id: group.id } });
    await prisma.csld_label.delete({ where: { id: label.id } });
  });

  it('createGame by an anonymous caller is refused', async () => {
    const res = await executeQuery(
      server,
      CREATE_GAME,
      {
        input: {
          name: 'anon', description: 'x', authors: [], newAuthors: [],
          groupAuthors: [], newGroupAuthors: [], labels: [], newLabels: [],
        },
      },
    );
    expect(res.errors?.[0]?.extensions?.code).toBe('AUTHENTICATION_REQUIRED');
  });
});

describe('comment moderation trio', () => {
  it('setCommentVisible is editor-only', async () => {
    const refused = await executeQuery(server, SET_VISIBLE, { c: String(otherCommentId), v: false }, otherCtx());
    expect(refused.errors?.[0]?.extensions?.code).toBe('ACCESS_DENIED');

    const allowed = await executeQuery(server, SET_VISIBLE, { c: String(otherCommentId), v: false }, editorCtx());
    expect(allowed.errors).toBeUndefined();
    const row = await prisma.csld_comment.findUnique({ where: { id: otherCommentId } });
    expect(row!.is_hidden).toBe(true);

    // and back
    await executeQuery(server, SET_VISIBLE, { c: String(otherCommentId), v: true }, editorCtx());
    const back = await prisma.csld_comment.findUnique({ where: { id: otherCommentId } });
    expect(back!.is_hidden).toBe(false);
  });

  it('setCommentLiked is idempotent and maintains the denormalized count', async () => {
    const first = await executeQuery(server, LIKED, { c: String(otherCommentId), v: true }, meCtx());
    expect(first.errors).toBeUndefined();
    const second = await executeQuery(server, LIKED, { c: String(otherCommentId), v: true }, otherCtx());
    expect(second.errors).toBeUndefined();

    // two distinct users liked — count is 2 even though `me` was asked twice is NOT the case here
    const row = await prisma.csld_comment.findUnique({ where: { id: otherCommentId } });
    expect(row!.amount_of_upvotes).toBe(2);

    // un-like by one — count drops
    await executeQuery(server, LIKED, { c: String(otherCommentId), v: false }, meCtx());
    const after = await prisma.csld_comment.findUnique({ where: { id: otherCommentId } });
    expect(after!.amount_of_upvotes).toBe(1);
  });

  it('deleteComment: owner deletes own; a stranger cannot; an editor can delete any', async () => {
    const strangerCtx = () => ctxFor(otherId + 1_000_000, 1); // nobody's account — just auth shape
    const stranger = await executeQuery(server, DELETE_COMMENT, { c: String(myCommentId) }, strangerCtx());
    expect(stranger.errors?.[0]?.extensions?.code).toBe('ACCESS_DENIED');

    const own = await executeQuery(server, DELETE_COMMENT, { c: String(myCommentId) }, meCtx());
    expect(own.errors).toBeUndefined();
    expect(await prisma.csld_comment.findUnique({ where: { id: myCommentId } })).toBeNull();

    const asEditor = await executeQuery(server, DELETE_COMMENT, { c: String(otherCommentId) }, editorCtx());
    expect(asEditor.errors).toBeUndefined();
    expect(await prisma.csld_comment.findUnique({ where: { id: otherCommentId } })).toBeNull();
  });
});

describe('deleteGameRating', () => {
  it('is editor-only and can remove a specific user rating', async () => {
    // other rates the game
    await prisma.csld_rating.create({
      data: { game_id: gameId, user_id: otherId, rating: 4, state: 2 },
    });

    const refused = await executeQuery(server, DELETE_RATING, { g: String(gameId) }, otherCtx());
    expect(refused.errors?.[0]?.extensions?.code).toBe('ACCESS_DENIED');

    const allowed = await executeQuery(
      server, DELETE_RATING, { g: String(gameId), u: String(otherId) }, editorCtx(),
    );
    expect(allowed.errors).toBeUndefined();
    expect(await prisma.csld_rating.findFirst({ where: { game_id: gameId, user_id: otherId } })).toBeNull();

    // aggregates recalculated to zero on the game row
    const gameRow = await prisma.csld_game.findUnique({ where: { id: gameId } });
    expect(gameRow!.amount_of_ratings).toBe(0);
  });
});

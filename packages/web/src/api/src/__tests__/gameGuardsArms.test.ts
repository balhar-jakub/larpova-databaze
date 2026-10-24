import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import {
  gameByIdResolver,
  ladderResolver,
  commentsPagedResolver,
  currentUsersCommentResolver,
  currentUsersRatingResolver,
} from '../resolvers/game';

/**
 * Direct-call guard/default arms of resolvers/game.ts that the other suites
 * leave cold: gameById's NaN guard, the ladder offset/limit defaults
 * (args omitted), commentsPaged's string-id parse and offset/limit
 * defaults, and currentUsersComment/currentUsersRating's camelCase `user.id`
 * arm of the `user?.id ?? user_id` fallback.
 *
 * (The ladder config's `?? RecentAndMostPlayed` fallback is defensive —
 * GraphQL validates LadderType enum values before the resolver runs.)
 */
const stamp = Date.now();
const marker = `gfield-${stamp}`;

let gameId: number;
let userId: number;
let commentId: number;

const ctx = (user?: { id: number }) => ({ db: prisma, user: user ?? null } as never);

beforeAll(async () => {
  const user = await prisma.csld_csld_user.create({
    data: { password: 'x', role: 1, name: marker, email: `${marker}@integration.test` },
  });
  userId = user.id;
  const game = await prisma.csld_game.create({
    data: { name: `${marker} hra`, deleted: false, added_by: userId, lang: 'cs' },
  });
  gameId = game.id;
  const comment = await prisma.csld_comment.create({
    data: { game_id: gameId, user_id: userId, comment: '<p>Text</p>', is_hidden: false, amount_of_upvotes: null },
  });
  commentId = comment.id;
});

afterAll(async () => {
  await prisma.csld_comment.deleteMany({ where: { id: commentId } });
  await prisma.csld_game.deleteMany({ where: { id: gameId } });
  await prisma.csld_csld_user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe('gameByIdResolver guard arm', () => {
  it('a NaN id answers null instead of throwing', async () => {
    expect(await gameByIdResolver({}, { gameId: 'not-a-number' }, ctx())).toBeNull();
  });
});

describe('ladder defaults (args omitted)', () => {
  it('offset/limit fall back to 0/25 and the ladder still answers', async () => {
    const result = await ladderResolver({}, { ladderType: 'Recent' } as never, ctx());
    expect(result.totalAmount).toBeGreaterThanOrEqual(0);
    expect(result.games.length).toBeLessThanOrEqual(25);
  });
});

describe('commentsPaged string-id and default arms', () => {
  it('a string id is parsed and offset/limit default to 0/10; null upvotes render as 0', async () => {
    const page = await commentsPagedResolver({ id: String(gameId) }, {} as never, ctx());
    expect(page.totalAmount).toBe(1);
    expect(page.comments[0].amountOfUpvotes).toBe(0); // amount_of_upvotes null ?? 0
    expect(page.comments[0].commentAsText).toBe('Text');
    // the id was parsed: the comment belongs to the fixture game
    expect(page.comments[0].game.id).toBe(gameId);
  });

  it('a numeric id is used as-is', async () => {
    const page = await commentsPagedResolver({ id: gameId }, { offset: 0, limit: 10 } as never, ctx());
    expect(page.totalAmount).toBe(1);
  });
});

describe('currentUsersComment/Rating camelCase arms', () => {
  it('reads user.id when the nested row carries the camelCase spelling', () => {
    const parent = { comments: [{ user: { id: 7 } }], ratings: [{ user: { id: 7 }, rating: 9 }] };
    expect(currentUsersCommentResolver(parent, {}, ctx({ id: 7 }))?.user.id).toBe(7);
    expect(currentUsersRatingResolver(parent, {}, ctx({ id: 7 }))?.rating).toBe(9);
  });

  it('falls back to the snake_case user_id and answers null when absent', () => {
    const parent = { comments: [{ user_id: 7 }], ratings: [{ user_id: 7, rating: 5 }] };
    expect(currentUsersCommentResolver(parent, {}, ctx({ id: 7 }))?.user_id).toBe(7);
    expect(currentUsersRatingResolver(parent, {}, ctx({ id: 7 }))?.rating).toBe(5);
    expect(currentUsersCommentResolver({ comments: [], ratings: [] }, {}, ctx({ id: 7 }))).toBeNull();
    expect(currentUsersRatingResolver({ comments: [], ratings: [] }, {}, ctx({ id: 7 }))).toBeNull();
  });
});

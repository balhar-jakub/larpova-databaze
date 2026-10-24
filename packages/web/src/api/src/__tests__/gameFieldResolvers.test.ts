/**
 * Field resolvers on the Game type that the query-level suites never reach:
 * gamesOfAuthors, commentsPaged, currentUsersComment/currentUsersRating, and
 * the ladder label filters. These are exercised directly with a real Prisma
 * context (the same integration style as the other suites) using fixture
 * rows marked with `jest-game-`.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
    gamesOfAuthorsResolver,
    commentsPagedResolver,
    currentUsersCommentResolver,
    currentUsersRatingResolver,
    ladderResolver,
} from '../resolvers/game';

const db = new PrismaClient();
const MARK = `jest-game-field-${Date.now()}`;

describe('game field resolvers', () => {
    let userId: number;
    let otherUserId: number;
    let gameId: number;
    let gameIds: number[] = [];
    let commentIds: number[] = [];

    const ctx = (user?: { id: number }) => ({ db, user } as never);

    beforeAll(async () => {
        const user = await db.csld_csld_user.create({
            data: { email: `${MARK}-author@integration.test`, password: 'x', role: 1, name: MARK + '-author', is_author: true },
        });
        userId = user.id;
        const other = await db.csld_csld_user.create({
            data: { email: `${MARK}-other@integration.test`, password: 'x', role: 1, name: MARK + '-other', is_author: false },
        });
        otherUserId = other.id;

        // The "main" game with an author link.
        const game = await db.csld_game.create({
            data: { name: `${MARK}-main`, deleted: false, added_by: userId, total_rating: 10 },
        });
        gameId = game.id;
        gameIds.push(gameId);
        await db.csld_game_has_author.create({ data: { id_game: gameId, id_user: userId } });

        // Two other games by the same author — the resolver should find these.
        for (let i = 0; i < 2; i++) {
            const other = await db.csld_game.create({
                data: { name: `${MARK}-other-${i}`, deleted: false, added_by: userId, total_rating: 5 },
            });
            gameIds.push(other.id);
            await db.csld_game_has_author.create({ data: { id_game: other.id, id_user: userId } });
        }

        // A comment on the main game by the author.
        const comment = await db.csld_comment.create({
            data: {
                game_id: gameId,
                user_id: userId,
                comment: '<p>Skvělá <b>hra</b>!</p>',
                added: new Date(),
                is_hidden: false,
                amount_of_upvotes: 2,
            },
        });
        commentIds.push(comment.id);

        // A hidden comment that must not appear.
        const hidden = await db.csld_comment.create({
            data: {
                game_id: gameId,
                user_id: otherUserId,
                comment: 'hidden',
                added: new Date(),
                is_hidden: true,
            },
        });
        commentIds.push(hidden.id);

        // The author's want-to-play rating on the main game.
        await db.csld_rating.create({
            data: { game_id: gameId, user_id: userId, state: 1, rating: 4 },
        });
    });

    afterAll(async () => {
        await db.csld_rating.deleteMany({ where: { game_id: { in: gameIds } } });
        await db.csld_comment.deleteMany({ where: { id: { in: commentIds } } });
        await db.csld_game_has_author.deleteMany({ where: { id_game: { in: gameIds } } });
        await db.csld_game_has_label.deleteMany({ where: { id_game: { in: gameIds } } });
        await db.csld_game.deleteMany({ where: { id: { in: gameIds } } });
        await db.csld_csld_user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    });

    describe('gamesOfAuthorsResolver', () => {
        it('returns the author\'s other games, ordered and normalized', async () => {
            const games = await gamesOfAuthorsResolver({ id: gameId }, {}, ctx());
            expect(games).toHaveLength(2);
            for (const g of games) {
                expect(g.id).not.toBe(gameId);
                expect(g.name).toContain(MARK);
            }
        });

        it('returns [] for an unparseable id', async () => {
            expect(await gamesOfAuthorsResolver({ id: 'not-a-number' }, {}, ctx())).toEqual([]);
        });

        it('returns [] when the game has no authors', async () => {
            expect(await gamesOfAuthorsResolver({ id: 999999999 }, {}, ctx())).toEqual([]);
        });
    });

    describe('commentsPagedResolver', () => {
        it('returns visible comments with normalized user/game and totals', async () => {
            const result = await commentsPagedResolver({ id: gameId }, { offset: 0, limit: 10 }, ctx());
            expect(result.totalAmount).toBe(1);
            expect(result.comments).toHaveLength(1);
            const comment = result.comments[0];
            expect(comment.commentAsText).toBe('Skvělá hra!');
            expect(comment.user.id).toBe(userId);
            expect(comment.game.id).toBe(gameId);
            expect(comment.amountOfUpvotes).toBe(2);
        });

        it('respects offset/limit', async () => {
            const result = await commentsPagedResolver({ id: gameId }, { offset: 10, limit: 10 }, ctx());
            expect(result.comments).toHaveLength(0);
            expect(result.totalAmount).toBe(1);
        });

        it('returns empty for an unparseable id', async () => {
            const result = await commentsPagedResolver({ id: 'zzz' }, { offset: 0, limit: 5 }, ctx());
            expect(result).toEqual({ comments: [], totalAmount: 0 });
        });
    });

    describe('currentUsersComment/currentUsersRating', () => {
        // Built inside the tests: userId only exists after beforeAll ran.
        const comments = () => [
            { user_id: userId, user: { id: userId } },
            { user_id: 999, user: { id: 999 } },
        ];
        const ratings = () => [
            { user_id: userId, user: { id: userId }, rating: 4 },
            { user_id: 999, user: { id: 999 }, rating: 2 },
        ];

        it('finds the signed-in user\'s comment', () => {
            const found = currentUsersCommentResolver({ comments: comments() }, {}, ctx({ id: userId }));
            expect(found.user.id).toBe(userId);
        });

        it('returns null when the user has no comment there', () => {
            expect(currentUsersCommentResolver({ comments: comments() }, {}, ctx({ id: 42 }))).toBeNull();
        });

        it('returns null when nobody is signed in', () => {
            expect(currentUsersCommentResolver({ comments: comments() }, {}, ctx())).toBeNull();
        });

        it('finds the signed-in user\'s rating', () => {
            const found = currentUsersRatingResolver({ ratings: ratings() }, {}, ctx({ id: userId }));
            expect(found.rating).toBe(4);
        });

        it('returns null rating when the user has none', () => {
            expect(currentUsersRatingResolver({ ratings: ratings() }, {}, ctx({ id: 42 }))).toBeNull();
        });
    });

    describe('ladderResolver label filters', () => {
        let labelId: number;

        beforeAll(async () => {
            const label = await db.csld_label.create({
                data: { name: `${MARK}-label`, is_required: false, is_authorized: true, added_by: userId },
            });
            labelId = label.id;
            await db.csld_game_has_label.create({
                data: { id_game: gameIds[1], id_label: labelId },
            });
        });

        afterAll(async () => {
            await db.csld_game_has_label.deleteMany({ where: { id_label: labelId } });
            await db.csld_label.deleteMany({ where: { id: labelId } });
        });

        it('filters by requiredLabels', async () => {
            const result = await ladderResolver(
                {},
                { ladderType: 'RecentAndMostPlayed', offset: 0, limit: 25, requiredLabels: [String(labelId)] },
                ctx(),
            );
            const ids = result.games.map((g: { id: number }) => g.id);
            expect(ids).toContain(gameIds[1]);
            expect(ids).not.toContain(gameId);
        });

        it('returns games when no label filter is given', async () => {
            const result = await ladderResolver(
                {},
                { ladderType: 'RecentAndMostPlayed', offset: 0, limit: 25 },
                ctx(),
            );
            expect(result.games.length).toBeGreaterThanOrEqual(3);
        });
    });
});

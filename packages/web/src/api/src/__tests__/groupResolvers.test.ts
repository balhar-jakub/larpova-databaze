/**
 * Group resolvers (`groupById`, `groupsByQuery`) and the nightly batch's
 * INTEGRATE_* flag branches. The group resolvers were the only query
 * resolvers with zero direct coverage: everything reached them indirectly
 * through the search tests, which masked the authorsOf mapping and the
 * parseInt guard.
 */
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { groupByIdResolver, groupsByQueryResolver } from '../resolvers/group';

const db = new PrismaClient();
const MARK = `jest-group-${Date.now()}`;

describe('group resolvers', () => {
    let groupId: number;
    let userId: number;
    const gameIds: number[] = [];

    beforeAll(async () => {
        const user = await db.csld_csld_user.create({
            data: { email: `${MARK}@integration.test`, password: 'x', role: 1, name: MARK + '-user', is_author: false },
        });
        userId = user.id;

        const group = await db.csld_csld_group.create({
            data: { name: `${MARK} skupina`, administrator_id: userId },
        });
        groupId = group.id;

        for (let i = 0; i < 2; i++) {
            const game = await db.csld_game.create({
                data: { name: `${MARK}-game-${i}`, deleted: false, added_by: userId },
            });
            gameIds.push(game.id);
            await db.csld_game_has_group.create({
                data: { id_game: game.id, id_group: groupId },
            });
        }
    });

    afterAll(async () => {
        await db.csld_game_has_group.deleteMany({ where: { id_group: groupId } });
        await db.csld_game.deleteMany({ where: { id: { in: gameIds } } });
        await db.csld_csld_group.deleteMany({ where: { id: groupId } });
        await db.csld_csld_user.deleteMany({ where: { id: userId } });
    });

    const ctx = () => ({ db, user: null } as never);

    it('groupById returns the group with its authorsOf games normalized', async () => {
        const group = await groupByIdResolver({}, { groupId: String(groupId) }, ctx());
        expect(group).not.toBeNull();
        expect(group.name).toBe(`${MARK} skupina`);
        expect(group.authorsOf).toHaveLength(2);
        for (const game of group.authorsOf) {
            expect(game.name).toContain(MARK);
        }
    });

    it('groupById returns null for an unknown id', async () => {
        const group = await groupByIdResolver({}, { groupId: '999999999' }, ctx());
        expect(group).toBeNull();
    });

    it('groupById returns null for an unparseable id', async () => {
        const group = await groupByIdResolver({}, { groupId: 'abc' }, ctx());
        expect(group).toBeNull();
    });

    it('groupsByQuery finds the group by a fragment without diacritics', async () => {
        const groups = await groupsByQueryResolver(
            {},
            { query: MARK.replace(/-/g, ' ').slice(0, 20), offset: 0, limit: 25 },
            ctx(),
        );
        const found = (groups as Array<{ id: number }>).find((g) => g.id === groupId);
        expect(found).toBeDefined();
    });
});

describe('runNightlyBatch: importer flag branches', () => {
    // 120 s, not the default 5: the batch also runs the similarity engine,
    // which walks EVERY game in the database — on the seeded dev database
    // that is 1,500+ games and the default timeout kills a healthy run.
    it('runs the calendar+article importers when INTEGRATE_* is set (failures swallowed)', async () => {
        const tasks = await import('../scheduled/tasks.js');
        const prevCalendar = process.env.INTEGRATE_CALENDAR;
        const prevArticles = process.env.INTEGRATE_ARTICLES;
        process.env.INTEGRATE_CALENDAR = 'true';
        process.env.INTEGRATE_ARTICLES = 'true';

        // The importers hit the network; without network access in the test
        // sandbox they fail and the batch must still complete (their try/catch
        // logs and continues). To keep this hermetic, stub fetch to fail fast.
        const originalFetch = global.fetch;
        (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => {
            throw new Error('offline');
        });

        try {
            await expect(tasks.runNightlyBatch(db)).resolves.toBeUndefined();
        } finally {
            (globalThis as { fetch?: unknown }).fetch = originalFetch;
            if (prevCalendar === undefined) delete process.env.INTEGRATE_CALENDAR;
            else process.env.INTEGRATE_CALENDAR = prevCalendar;
            if (prevArticles === undefined) delete process.env.INTEGRATE_ARTICLES;
            else process.env.INTEGRATE_ARTICLES = prevArticles;
        }
    }, 120_000);
});

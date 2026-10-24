import { describe, it, expect, jest } from '@jest/globals';
import { resolvers } from '../resolvers/index';

/**
 * Direct fallback matrix for the snake_case↔camelCase field resolvers of
 * `resolvers/index.ts`. Through GraphQL only the snake_case side is
 * reachable (rows come raw from Prisma); the camelCase side exists for
 * normalized rows spread by mappers (e.g. `mapEventRow` outputs), and the
 * neither-side arm is the defensive null. Calling the field resolver with a
 * hand-built row drives every side of every `??` arm in one test each —
 * the through-GraphQL arms are covered by fieldResolverArms.test.ts.
 */
describe('field-resolver fallback matrix (resolvers/index.ts, direct calls)', () => {
  const dummyCtx = { user: null, db: null, req: null, res: null, files: null } as any;

  describe('registrationOpenResolver', () => {
    const resolve = (row: any) => resolvers.Event.registrationOpen(row, {}, dummyCtx);
    it('camelCase boolean wins', () => {
      expect(resolve({ registrationOpen: true, registration_status: 'CLOSED' })).toBe(true);
      expect(resolve({ registrationOpen: false, registration_status: 'OPEN' })).toBe(false);
      expect(resolve({ registrationOpen: null, registration_status: 'OPEN' })).toBe(true);
      expect(resolve({ registrationOpen: null, registration_status: 'CLOSED' })).toBe(false);
      expect(resolve({ registrationOpen: null, registration_status: null })).toBe(false);
      // the same resolver serves RecommendedEvent
      expect(resolvers.RecommendedEvent.registrationOpen({ registrationOpen: null, registration_status: 'OPEN' }, {}, dummyCtx)).toBe(true);
    });
  });

  describe('registrationUrl / registrationStatus (Event + RecommendedEvent)', () => {
    it('camelCase wins, snake_case serves, neither is null', () => {
      const urlE = resolvers.Event.registrationUrl;
      const statusE = resolvers.Event.registrationStatus;
      const urlR = resolvers.RecommendedEvent.registrationUrl;
      const statusR = resolvers.RecommendedEvent.registrationStatus;
      expect(urlE({ registrationUrl: 'https://a' }, {}, dummyCtx)).toBe('https://a');
      expect(urlE({ registration_url: 'https://b' }, {}, dummyCtx)).toBe('https://b');
      expect(urlE({}, {}, dummyCtx)).toBeNull();
      expect(statusE({ registrationStatus: 'OPEN' }, {}, dummyCtx)).toBe('OPEN');
      expect(statusE({ registration_status: 'CLOSED' }, {}, dummyCtx)).toBe('CLOSED');
      expect(statusE({}, {}, dummyCtx)).toBeNull();
      expect(urlR({ registration_url: 'https://r' }, {}, dummyCtx)).toBe('https://r');
      expect(statusR({ registrationStatus: 'UPCOMING' }, {}, dummyCtx)).toBe('UPCOMING');
      expect(urlR({}, {}, dummyCtx)).toBeNull();
      expect(statusR({}, {}, dummyCtx)).toBeNull();
    });
  });

  describe('registrationOpensAt (Event + RecommendedEvent)', () => {
    const date = new Date('2030-01-01T10:00:00Z');
    it('camelCase wins; UPCOMING + opens_at renders; everything else null', () => {
      const resolve = resolvers.Event.registrationOpensAt;
      expect(resolve({ registrationOpensAt: 'x' }, {}, dummyCtx)).toBe('x');
      expect(resolve({ registration_status: 'UPCOMING', registration_opens_at: date }, {}, dummyCtx)).toBe('2030-01-01T10:00:00.000Z');
      expect(resolve({ registration_status: 'OPEN', registration_opens_at: date }, {}, dummyCtx)).toBeNull();
      expect(resolve({ registration_status: 'UPCOMING', registration_opens_at: null }, {}, dummyCtx)).toBeNull();
      expect(resolve({}, {}, dummyCtx)).toBeNull();
      const resolveR = resolvers.RecommendedEvent.registrationOpensAt;
      expect(resolveR({ registrationOpensAt: 'y' }, {}, dummyCtx)).toBe('y');
      expect(resolveR({ registration_status: 'UPCOMING', registration_opens_at: date }, {}, dummyCtx)).toBe('2030-01-01T10:00:00.000Z');
      expect(resolveR({ registration_status: 'OPEN', registration_opens_at: date }, {}, dummyCtx)).toBeNull();
      expect(resolveR({}, {}, dummyCtx)).toBeNull();
    });
  });

  describe('Label isRequired / isAuthorized', () => {
    it('camelCase wins, snake_case serves, neither null', () => {
      const req = resolvers.Label.isRequired;
      const auth = resolvers.Label.isAuthorized;
      expect(req({ isRequired: true }, {}, dummyCtx)).toBe(true);
      expect(req({ is_required: true }, {}, dummyCtx)).toBe(true);
      expect(req({}, {}, dummyCtx)).toBeNull();
      expect(auth({ isAuthorized: false }, {}, dummyCtx)).toBe(false);
      expect(auth({ is_authorized: true }, {}, dummyCtx)).toBe(true);
      expect(auth({}, {}, dummyCtx)).toBeNull();
    });
  });

  describe('Game.currentUsersRating (inline guards)', () => {
    it('anonymous visitor gets null', () => {
      expect(resolvers.Game.currentUsersRating({ csld_rating: [] }, {}, { user: null } as any)).toBeNull();
    });
    it('finds the visitor own rating, or null when they have none', () => {
      const ctx = { user: { id: 7 } } as any;
      const parent = { csld_rating: [{ user_id: 3, rating: 5 }, { user_id: 7, rating: 9 }] };
      expect(resolvers.Game.currentUsersRating(parent, {}, ctx)).toEqual({ user_id: 7, rating: 9 });
      expect(resolvers.Game.currentUsersRating({ csld_rating: [] }, {}, ctx)).toBeNull();
      expect(resolvers.Game.currentUsersRating({}, {}, ctx)).toBeNull(); // ?? [] arm
    });
  });

  describe('Event.allowedActions guard arms (direct calls)', () => {
    const allowed = resolvers.Event.allowedActions;
    it('anonymous gets nothing', async () => {
      expect(await allowed({ id: '1' }, {}, { user: null } as any)).toEqual([]);
    });
    it('an editor gets Edit+Delete without touching the database', async () => {
      const db = { csld_game_has_author: { findFirst: () => { throw new Error('must not query'); } } };
      expect(await allowed({ id: '1' }, {}, { user: { id: 9, role: 2 }, db } as any)).toEqual(['Edit', 'Delete']);
    });
    it('a NaN event id stops before the author lookup', async () => {
      const db = { csld_game_has_author: { findFirst: () => { throw new Error('must not query'); } } };
      expect(await allowed({ id: 'not-a-number' }, {}, { user: { id: 9, role: 1 }, db } as any)).toEqual([]);
    });
    it('a linked-game author gets Edit+Delete; a stranger nothing', async () => {
      const authorDb = { csld_game_has_author: { findFirst: async () => ({ id_user: 9 }) } };
      const strangerDb = { csld_game_has_author: { findFirst: async () => null } };
      expect(await allowed({ id: '5' }, {}, { user: { id: 9, role: 1 }, db: authorDb } as any)).toEqual(['Edit', 'Delete']);
      expect(await allowed({ id: '5' }, {}, { user: { id: 9, role: 1 }, db: strangerDb } as any)).toEqual([]);
    });
  });

  describe('User.commentsPaged guard arms (direct calls)', () => {
    const commentsPaged = resolvers.User.commentsPaged;
    const findMany = jest.fn(async () => [{
      id: 1, comment: '<p>Ahoj</p>', amount_of_upvotes: null,
      csld_game: { id: 3, name: 'hra', deleted: false },
    }]);
    const count = jest.fn(async () => 1);
    const db = { csld_comment: { findMany, count } };
    const ctx = { db, user: null } as any;

    it('a string id is parsed, a numeric id used as-is; a bad id short-circuits', async () => {
      await commentsPaged({ id: '42' }, { offset: 0, limit: 5 }, ctx);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ user_id: 42 }) }));
      await commentsPaged({ id: 42 }, { offset: 0, limit: 5 }, ctx);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ user_id: 42 }) }));
      // !userId / NaN arms: no query at all
      findMany.mockClear(); count.mockClear();
      expect(await commentsPaged({ id: 'nan' }, { offset: 0, limit: 5 }, ctx)).toEqual({ comments: [], totalAmount: 0 });
      expect(await commentsPaged({ id: 0 }, { offset: 0, limit: 5 }, ctx)).toEqual({ comments: [], totalAmount: 0 });
      expect(findMany).not.toHaveBeenCalled();
    });

    it('offset/limit fall back to 0/10 when absent, and null upvotes render as 0', async () => {
      await commentsPaged({ id: '7' }, {} as any, ctx);
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
      const page = await commentsPaged({ id: '7', name: 'Jméno' }, {} as any, ctx);
      expect(page.comments[0].amountOfUpvotes).toBe(0); // amount_of_upvotes null ?? 0
      expect(page.comments[0].user).toEqual({ id: 7, name: 'Jméno' });
      expect(page.comments[0].commentAsText).toContain('Ahoj');
      expect(page.totalAmount).toBe(1);
    });
  });
});

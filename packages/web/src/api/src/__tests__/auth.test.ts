import { isSignedIn, isEditor, isAdmin, isAtLeastEditor, isAdminOfGroup, CsldRole } from '../auth/appUsers';
import type { Context } from '../context';

function ctxWithRole(role: number): Context {
  return {
    user: {
      id: 1, email: 'test@test.com', name: 'Test', nickname: null,
      role, image: null, amountOfComments: 0, amountOfPlayed: 0, amountOfCreated: 0,
    },
    db: null as any, req: null as any, res: null as any,
    login: async () => {}, logout: async () => {}, files: null as any,
  };
}

const ctxAnonymous: Context = {
  user: null,
  db: null as any, req: null as any, res: null as any,
  login: async () => {}, logout: async () => {}, files: null as any,
};

describe('AppUsers role checks', () => {
  describe('isSignedIn', () => {
    it('returns true for authenticated user', () => {
      expect(isSignedIn(ctxWithRole(CsldRole.USER))).toBe(true);
    });
    it('returns false for anonymous', () => {
      expect(isSignedIn(ctxAnonymous)).toBe(false);
    });
  });

  describe('isEditor', () => {
    it('returns true for EDITOR (2)', () => {
      expect(isEditor(ctxWithRole(CsldRole.EDITOR))).toBe(true);
    });
    it('returns true for ADMIN (3)', () => {
      expect(isEditor(ctxWithRole(CsldRole.ADMIN))).toBe(true);
    });
    it('returns false for USER (1)', () => {
      expect(isEditor(ctxWithRole(CsldRole.USER))).toBe(false);
    });
    it('returns false for AUTHOR (4)', () => {
      // AUTHOR=4 is numerically > ADMIN but is NOT a staff role
      expect(isEditor(ctxWithRole(CsldRole.AUTHOR))).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('returns true for ADMIN', () => {
      expect(isAdmin(ctxWithRole(CsldRole.ADMIN))).toBe(true);
    });
    it('returns false for EDITOR', () => {
      expect(isAdmin(ctxWithRole(CsldRole.EDITOR))).toBe(false);
    });
    it('returns false for AUTHOR (numerically > ADMIN)', () => {
      expect(isAdmin(ctxWithRole(CsldRole.AUTHOR))).toBe(false);
    });
  });

  describe('isAtLeastEditor', () => {
    it('returns true for EDITOR', () => {
      expect(isAtLeastEditor(ctxWithRole(CsldRole.EDITOR))).toBe(true);
    });
    it('returns true for ADMIN', () => {
      expect(isAtLeastEditor(ctxWithRole(CsldRole.ADMIN))).toBe(true);
    });
    it('returns false for USER', () => {
      expect(isAtLeastEditor(ctxWithRole(CsldRole.USER))).toBe(false);
    });
    it('returns false for AUTHOR (not a staff role despite role=4)', () => {
      expect(isAtLeastEditor(ctxWithRole(CsldRole.AUTHOR))).toBe(false);
    });
  });

  describe('isAdminOfGroup', () => {
    it('returns true for EDITOR (role > 1)', () => {
      expect(isAdminOfGroup(ctxWithRole(CsldRole.EDITOR))).toBe(true);
    });
    it('returns true for ADMIN', () => {
      expect(isAdminOfGroup(ctxWithRole(CsldRole.ADMIN))).toBe(true);
    });
    it('returns false for USER (role = 1)', () => {
      expect(isAdminOfGroup(ctxWithRole(CsldRole.USER))).toBe(false);
    });
    it('returns false for ANONYMOUS (role = 0)', () => {
      expect(isAdminOfGroup(ctxWithRole(CsldRole.ANONYMOUS))).toBe(false);
    });
  });
});

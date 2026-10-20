import passport from 'passport';
import type { Context } from '../context.js';
import { toAuthUser, type AuthUser } from './appUsers.js';

type Db = Context['db'];

/**
 * Session plumbing only.
 *
 * There is deliberately no LocalStrategy here: the password flow is `logInResolver`
 * in resolvers/userMutation.ts, which owns the case-insensitive lookup and the
 * MD5 → PBKDF2 upgrade. A LocalStrategy used to sit in this file, and nothing ever
 * called `passport.authenticate('local')` — it was dead code duplicating the
 * resolver, and its copy of the hash upgrade never ran for anybody (see
 * docs/navrh-normalizace-emailu.md). `ctx.login(user)` needs nothing more than the
 * two hooks below.
 */
export function configurePassport(db: Db) {
  // ── Serialization ────────────────────────────────────
  passport.serializeUser<number>((user, done) => {
    const authUser = user as AuthUser;
    done(null, authUser.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await db.csld_csld_user.findUnique({
        where: { id },
        include: { csld_image: true },
      });

      if (!user) return done(null, null);

      done(null, toAuthUser(user));
    } catch (err) {
      done(err);
    }
  });

  return passport;
}

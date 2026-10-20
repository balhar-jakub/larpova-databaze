import passport from 'passport';
import type { Context } from '../context.js';
import type { AuthUser } from './appUsers.js';

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

      const authUser: AuthUser = {
        id: user.id,
        email: user.email!,
        name: user.name,
        nickname: user.nickname,
        description: user.description ?? null,
        gender: user.gender ?? null,
        role: user.role,
        image: user.csld_image
          ? { id: user.csld_image.id, path: user.csld_image.path }
          : null,
        amountOfComments: user.amount_of_comments,
        amountOfPlayed: user.amount_of_played,
        amountOfCreated: user.amount_of_created,
      };

      done(null, authUser);
    } catch (err) {
      done(err);
    }
  });

  return passport;
}

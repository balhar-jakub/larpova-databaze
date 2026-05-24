import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import type { Context } from '../context.js';
import { validatePassword, isLegacyMd5, generatePbkdf2Hash } from './password.js';
import type { AuthUser } from './appUsers.js';

type Db = Context['db'];

export function configurePassport(db: Db) {
  // ── Local Strategy ──────────────────────────────────
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email, password, done) => {
        try {
          const user = await db.csld_csld_user.findUnique({
            where: { email: email.toLowerCase() },
            include: { csld_image: true },
          });

          if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          if (!validatePassword(password, user.password)) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          // MD5 → PBKDF2 upgrade on successful legacy login
          if (isLegacyMd5(user.password)) {
            const newHash = generatePbkdf2Hash(password, email);
            await db.csld_csld_user.update({
              where: { id: user.id },
              data: { password: newHash },
            });
          }

          const authUser: AuthUser = {
            id: user.id,
            email: user.email!,
            name: user.name,
            nickname: user.nickname,
            role: user.role,
            image: user.csld_image
              ? { id: user.csld_image.id, path: user.csld_image.path }
              : null,
            amountOfComments: user.amount_of_comments,
            amountOfPlayed: user.amount_of_played,
            amountOfCreated: user.amount_of_created,
          };

          return done(null, authUser);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

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

import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { toAuthUser, type AuthUser } from './appUsers.js';
import { setRememberMeCookie } from './rememberMe.js';
import { recordLastLogin } from './recordLastLogin.js';

/**
 * GET /auth/email-login?token=… — the magic-link callback. The token row was
 * written by `startEmailLogin`; here it is exchanged for a Passport session.
 *
 * The router is a factory (same pattern as `createGoogleRouter`) so the HTTP
 * layer can be tested with supertest without booting `server.ts`, which starts
 * Prisma, Apollo and Next.
 */

export interface EmailLoginRouterDeps {
  prisma: PrismaClient;
  /** `req.login` wrapped in a promise (kept injectable so tests need no Passport). */
  login: (req: Request, user: AuthUser) => Promise<void>;
}

export function createEmailLoginRouter(deps: EmailLoginRouterDeps): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) return res.redirect('/signIn?error=invalid_token');

    try {
      // Find token (newest first)
      const auth = await deps.prisma.csld_email_authentication.findFirst({
        where: { auth_token: token },
        include: { csld_csld_user: { include: { csld_image: true } } },
        orderBy: { id: 'desc' },
      });

      if (!auth || !auth.csld_csld_user) {
        return res.redirect('/signIn?error=invalid_token');
      }

      // Check token expiry (15 minutes)
      const FIFTEEN_MINUTES = 15 * 60 * 1000;
      if (Date.now() - auth.created_at.getTime() > FIFTEEN_MINUTES) {
        await deps.prisma.csld_email_authentication.delete({ where: { id: auth.id } });
        return res.redirect('/signIn?error=expired_token');
      }

      const authUser = toAuthUser(auth.csld_csld_user);

      // Log in via Passport
      await deps.login(req, authUser);

      // Magic-link sign-in is a real login — record it on the account.
      await recordLastLogin(deps.prisma, authUser.id);

      // Set remember-me cookie
      setRememberMeCookie(res, authUser.id);

      // Delete used token
      await deps.prisma.csld_email_authentication.delete({
        where: { id: auth.id },
      });

      res.redirect('/');
    } catch (err) {
      console.error('Email login error:', err);
      res.redirect('/signIn?error=login_failed');
    }
  });

  return router;
}

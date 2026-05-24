import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { AuthUser } from './appUsers.js';

const REMEMBER_ME_KEY = process.env.REMEMBER_ME_KEY || 'csld-remember-me-key';
const COOKIE_NAME = 'LoggedIn'; // matches Java cookie name for browser compatibility
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Set a remember-me cookie on the response.
 */
export function setRememberMeCookie(res: Response, userId: number): void {
  const expiry = Date.now() + MAX_AGE_MS;
  const payload = `${userId}:${expiry}`;
  const signature = sign(payload);
  const token = Buffer.from(`${payload}:${signature}`).toString('base64url');

  res.cookie(COOKIE_NAME, token, {
    maxAge: MAX_AGE_MS,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: false, // set to true in production
  });
}

/**
 * Clear the remember-me cookie.
 */
export function clearRememberMeCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * Express middleware that checks for remember-me cookie and
 * auto-authenticates the user if the session has no user.
 */
export function rememberMeMiddleware(db: PrismaClient) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    // Only check remember-me if there's no active session user
    if ((req as any).user) return next();

    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next();

    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const [userIdStr, expiryStr, signature] = decoded.split(':');

      if (!userIdStr || !expiryStr || !signature) return next();

      const userId = parseInt(userIdStr, 10);
      const expiry = parseInt(expiryStr, 10);

      if (isNaN(userId) || isNaN(expiry)) return next();
      if (Date.now() > expiry) return next(); // expired

      // Verify signature
      const payload = `${userId}:${expiry}`;
      if (!verify(payload, signature)) return next();

      // Find user and set on request
      const user = await db.csld_csld_user.findUnique({
        where: { id: userId },
        include: { csld_image: true },
      });

      if (!user) return next();

      const authUser: AuthUser = {
        id: user.id,
        email: user.email!,
        name: user.name,
        nickname: user.nickname,
        role: user.role,
        image: user.csld_image ? { id: user.csld_image.id, path: user.csld_image.path } : null,
        amountOfComments: user.amount_of_comments,
        amountOfPlayed: user.amount_of_played,
        amountOfCreated: user.amount_of_created,
      };

      // Set user on request so Passport sees them
      (req as any).user = authUser;
    } catch {
      // Invalid cookie — ignore
    }

    next();
  };
}

// ── HMAC helpers ─────────────────────────────────────────

function sign(data: string): string {
  return crypto.createHmac('sha256', REMEMBER_ME_KEY).update(data).digest('hex');
}

function verify(data: string, signature: string): boolean {
  try {
    const expected = sign(data);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

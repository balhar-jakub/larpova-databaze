import { jest, describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { createHmac } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

/**
 * Full lifecycle coverage for rememberMe.ts (47.9% at the Phase 1 baseline —
 * only the key gate and the old-key forgery regression were pinned; the
 * happy path, every reject path and the cookie writer were never executed).
 *
 * Covers, against the REAL module (fresh module copy so the key is evaluated
 * for the current env):
 * - setRememberMeCookie: token format (userId:expiry:HMAC, base64url), cookie
 *   options, and the secure flag following NODE_ENV
 * - clearRememberMeCookie
 * - rememberMeMiddleware happy path: valid token -> req.user set (via real
 *   prisma row -> toAuthUser), session user untouched when already present
 * - every reject path: no cookie, malformed token, NaN fields, expired
 *   token, wrong signature, unknown user — all leave req.user unset and
 *   never throw
 *
 * Reading the file for this suite also surfaced: `secure: false` was
 * hardcoded on the cookie — the 30-day auth credential was marked safe to
 * send over plain HTTP in production. Fixed to follow NODE_ENV; pinned here.
 */

const KEY = 't'.repeat(64);
const cleanEnv = { ...process.env };

function setEnv(name: string, value: string | undefined) {
  (process.env as Record<string, string | undefined>)[name] = value;
}

beforeEach(() => {
  for (const k of Object.keys(process.env)) {
    if (k in cleanEnv === false) delete process.env[k];
    else process.env[k] = cleanEnv[k];
  }
  setEnv('NODE_ENV', 'test');
  setEnv('REMEMBER_ME_KEY', KEY);
  jest.resetModules();
});

afterAll(() => {
  for (const k of Object.keys(process.env)) {
    if (k in cleanEnv === false) delete process.env[k];
    else process.env[k] = cleanEnv[k];
  }
});

function signWithKey(payload: string, key: string = KEY) {
  return createHmac('sha256', key).update(payload).digest('hex');
}

function makeToken(userId: number, expiry: number, signature: string) {
  return Buffer.from(`${userId}:${expiry}:${signature}`).toString('base64url');
}

/** A response that records cookies the way express's res.cookie does. */
function fakeRes() {
  const cookies: Record<string, { value: string; opts: Record<string, unknown> }> = {};
  return {
    cookies,
    cookie: (name: string, value: string, opts: Record<string, unknown> = {}) => {
      cookies[name] = { value, opts };
    },
    clearCookie: (name: string, opts: Record<string, unknown> = {}) => {
      cookies[name] = { value: '', opts: { ...opts, expires: new Date(0) } };
    },
  };
}

/** A db stub whose findUnique returns a realistic csld_csld_user row. */
function dbWithUser(user: Record<string, unknown> | null) {
  const findUnique = user === null
    ? jest.fn(async () => null)
    : jest.fn(async () => user);
  return {
    db: { csld_csld_user: { findUnique } } as unknown as PrismaClient,
    findUnique,
  };
}

function middlewareReq(token: string | undefined) {
  return { cookies: token === undefined ? {} : { LoggedIn: token } } as never;
}

async function runMiddleware(mod: typeof import('../auth/rememberMe.js'), db: PrismaClient, req: unknown) {
  const next = jest.fn();
  await mod.rememberMeMiddleware(db)(req as never, {} as never, next as never);
  return next;
}

describe('setRememberMeCookie', () => {
  it('writes a base64url userId:expiry:HMAC token with a 30-day max-age', async () => {
    const mod = await import('../auth/rememberMe.js');
    const res = fakeRes();
    const before = Date.now();
    mod.setRememberMeCookie(res as never, 42);
    const after = Date.now();

    expect(res.cookies.LoggedIn).toBeDefined();
    const { value, opts } = res.cookies.LoggedIn;
    const decoded = Buffer.from(value, 'base64url').toString('utf-8');
    const [userIdStr, expiryStr, sig] = decoded.split(':');
    expect(userIdStr).toBe('42');
    // expiry ~30 days out, bracketing the call time
    const expiry = Number(expiryStr);
    expect(expiry).toBeGreaterThanOrEqual(before + 29.9 * 24 * 3600 * 1000);
    expect(expiry).toBeLessThanOrEqual(after + 30.1 * 24 * 3600 * 1000);
    // the signature is an HMAC over the payload with the configured key
    expect(sig).toBe(signWithKey(`${userIdStr}:${expiryStr}`));

    expect(opts.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.secure).toBe(false); // NODE_ENV=test
  });

  it('marks the cookie secure in production (30-day credential, never over HTTP)', async () => {
    setEnv('NODE_ENV', 'production');
    jest.resetModules();
    const mod = await import('../auth/rememberMe.js');
    const res = fakeRes();
    mod.setRememberMeCookie(res as never, 1);
    expect(res.cookies.LoggedIn.opts.secure).toBe(true);
  });
});

describe('clearRememberMeCookie', () => {
  it('clears the LoggedIn cookie on the root path', async () => {
    const mod = await import('../auth/rememberMe.js');
    const res = fakeRes();
    mod.clearRememberMeCookie(res as never);
    expect(res.cookies.LoggedIn.value).toBe('');
    expect(res.cookies.LoggedIn.opts.path).toBe('/');
  });
});

describe('rememberMeMiddleware', () => {
  const USER_ROW = {
    id: 7,
    email: 'rm@integration.test',
    name: 'Remember Me',
    nickname: null,
    role: 1,
    csld_image: null,
  };

  it('a valid token authenticates the user onto the request', async () => {
    const mod = await import('../auth/rememberMe.js');
    const { db } = dbWithUser(USER_ROW);
    const expiry = Date.now() + 24 * 3600 * 1000;
    const token = makeToken(7, expiry, signWithKey(`7:${expiry}`));
    const req = middlewareReq(token);

    const next = await runMiddleware(mod, db, req);
    expect(next).toHaveBeenCalledTimes(1);
    const user = (req as { user?: { id: number } }).user;
    expect(user?.id).toBe(7);
    expect(user).toHaveProperty('email', 'rm@integration.test');
  });

  it('never overrides an existing session user', async () => {
    const mod = await import('../auth/rememberMe.js');
    const { db, findUnique } = dbWithUser(USER_ROW);
    const expiry = Date.now() + 24 * 3600 * 1000;
    const token = makeToken(7, expiry, signWithKey(`7:${expiry}`));
    const req = { cookies: { LoggedIn: token }, user: { id: 1 } } as never;

    await runMiddleware(mod, db, req);
    expect((req as { user?: { id: number } }).user).toEqual({ id: 1 });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('no cookie -> straight through, no DB hit', async () => {
    const mod = await import('../auth/rememberMe.js');
    const { db, findUnique } = dbWithUser(USER_ROW);
    const req = middlewareReq(undefined);

    const next = await runMiddleware(mod, db, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { user?: unknown }).user).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('a malformed token is ignored without throwing', async () => {
    const mod = await import('../auth/rememberMe.js');
    const { db, findUnique } = dbWithUser(USER_ROW);
    const req = middlewareReq(Buffer.from('garbage:not:a:token').toString('base64url'));

    const next = await runMiddleware(mod, db, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { user?: unknown }).user).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('non-numeric payload fields are rejected (NaN guard)', async () => {
    const mod = await import('../auth/rememberMe.js');
    const { db, findUnique } = dbWithUser(USER_ROW);
    const sig = signWithKey('seven:tomorrow');
    const req = middlewareReq(makeToken(Number('seven'), 12345, sig) || '');

    const next = await runMiddleware(mod, db, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { user?: unknown }).user).toBeUndefined();
  });

  it('an expired token is rejected even with a valid signature', async () => {
    const mod = await import('../auth/rememberMe.js');
    const { db, findUnique } = dbWithUser(USER_ROW);
    const expiry = Date.now() - 1000;
    const token = makeToken(7, expiry, signWithKey(`7:${expiry}`));
    const req = middlewareReq(token);

    const next = await runMiddleware(mod, db, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { user?: unknown }).user).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('a valid-format token with a wrong signature never reaches the DB', async () => {
    const mod = await import('../auth/rememberMe.js');
    const { db, findUnique } = dbWithUser(USER_ROW);
    const expiry = Date.now() + 24 * 3600 * 1000;
    const token = makeToken(7, expiry, signWithKey(`7:${expiry}`, 'wrong-key'));
    const req = middlewareReq(token);

    const next = await runMiddleware(mod, db, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { user?: unknown }).user).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('a signature of the wrong LENGTH is a hard reject, not a crash', async () => {
    // timingSafeEqual throws on length mismatch; the token parser must turn
    // that into "no auto-login", not a 500 on every odd-length cookie.
    const mod = await import('../auth/rememberMe.js');
    const { db, findUnique } = dbWithUser(USER_ROW);
    const expiry = Date.now() + 24 * 3600 * 1000;
    const req = middlewareReq(makeToken(7, expiry, 'tooshort'));

    const next = await runMiddleware(mod, db, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { user?: unknown }).user).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('a signed token for a user that no longer exists authenticates nobody', async () => {
    const mod = await import('../auth/rememberMe.js');
    const { db, findUnique } = dbWithUser(null);
    const expiry = Date.now() + 24 * 3600 * 1000;
    const token = makeToken(999999, expiry, signWithKey(`999999:${expiry}`));
    const req = middlewareReq(token);

    const next = await runMiddleware(mod, db, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { user?: unknown }).user).toBeUndefined();
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});

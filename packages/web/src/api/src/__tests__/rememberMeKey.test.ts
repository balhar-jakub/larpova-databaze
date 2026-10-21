/**
 * Unit coverage for the remember-me signing key gate (rememberMeKey.ts) and
 * the cookie sign/verify lifecycle (rememberMe.ts). The gate mirrors
 * requireSessionSecret; these tests pin all three behaviors:
 *   - production throws on a missing key (the old auth-bypass fallback),
 *   - production throws on a short key (a 1-char "real" key is as forgeable
 *     as a hard-coded one),
 *   - dev/test keeps the fallback WITH a warning so local flows stay green.
 *
 * Plus the forgery regression: a token signed with the OLD hard-coded
 * fallback key must NOT verify once a real key is configured.
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { createHmac } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

const cleanEnv = { ...process.env };

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe('requireRememberMeKey', () => {
  beforeEach(() => {
    setEnv({ ...cleanEnv, REMEMBER_ME_KEY: undefined, NODE_ENV: 'test' });
  });

  it('returns the env key when it is long enough', async () => {
    setEnv({ REMEMBER_ME_KEY: 'a'.repeat(48) });
    const { requireRememberMeKey } = await import('../auth/rememberMeKey.js');
    expect(requireRememberMeKey()).toBe('a'.repeat(48));
  });

  it('throws in production when the key is missing (no silent fallback)', async () => {
    setEnv({ NODE_ENV: 'production', REMEMBER_ME_KEY: undefined });
    const { requireRememberMeKey } = await import('../auth/rememberMeKey.js');
    expect(() => requireRememberMeKey()).toThrow(/REMEMBER_ME_KEY is not set/);
  });

  it('throws in production when the key is too short', async () => {
    setEnv({ NODE_ENV: 'production', REMEMBER_ME_KEY: 'short' });
    const { requireRememberMeKey } = await import('../auth/rememberMeKey.js');
    expect(() => requireRememberMeKey()).toThrow(/at least 32 characters/);
  });

  it('falls back with a warning outside production (local flows stay green)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv({ NODE_ENV: 'test', REMEMBER_ME_KEY: undefined });
    const { requireRememberMeKey } = await import('../auth/rememberMeKey.js');
    expect(requireRememberMeKey()).toMatch(/csld-dev-remember-me-key/);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('rememberMe token lifecycle', () => {
  beforeEach(() => {
    setEnv({ ...cleanEnv, REMEMBER_ME_KEY: undefined, NODE_ENV: 'test' });
  });

  it('a cookie signed with the OLD hard-coded fallback key is rejected once a real key is configured (forgery regression)', async () => {
    // Configure a real key and require a freshly-evaluated module copy so the
    // gate runs with it (the module caches the key at import time).
    setEnv({ REMEMBER_ME_KEY: 'k'.repeat(64) });
    jest.resetModules();
    const mod = await import('../auth/rememberMe.js');

    // Sign a token the way the attacker did in the audit PoC: the old public key.
    const OLD_KEY = 'csld-remember-me-key';
    const userId = 1;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const payload = `${userId}:${expiry}`;
    const oldSig = createHmac('sha256', OLD_KEY).update(payload).digest('hex');

    // And the module's own sign() with the configured key must differ from it.
    // We assert via the middleware: a cookie signed with the OLD key must be
    // rejected (req.user stays unset) when REMEMBER_ME_KEY is configured.
    const { rememberMeMiddleware } = mod;
    // Repo test pattern: jest.fn with an explicit implementation (typed by
    // inference) — mockResolvedValue degenerates to `never` under this
    // ts-jest/tsconfig combination.
    const findUnique = jest.fn(async () => ({
      id: 1,
      nick: 'probe',
      role: 'ADMIN',
      csld_image: null,
    }));
    const db = { csld_csld_user: { findUnique } } as unknown as PrismaClient;
    const middleware = mod.rememberMeMiddleware(db);
    const token = Buffer.from(`${payload}:${oldSig}`).toString('base64url');
    const req = { cookies: { LoggedIn: token } } as never;
    const res = {} as never;
    const next = jest.fn();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as { user?: unknown }).user).toBeUndefined(); // OLD key rejected
    expect(db.csld_csld_user.findUnique).not.toHaveBeenCalled(); // never reached the DB
  });
});

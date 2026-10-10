/**
 * Phase 1 of the tech-debt roadmap: session secret fail-fast.
 *
 * The guard must guarantee: production NEVER boots on a hard-coded fallback
 * secret, and dev keeps working without any setup. These tests pin the exact
 * contract the three call sites (server.ts, api copies) rely on.
 */
import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { requireSessionSecret } from '../auth/sessionSecret.js';

const STRONG = 'x'.repeat(48); // >= 32 chars, arbitrary
const WEAK = 'short';

describe('requireSessionSecret', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    (process.env as any) = { ...ORIGINAL_ENV };
  });

  it('PRODUCTION without SESSION_SECRET throws (no silent fallback)', () => {
    delete process.env.SESSION_SECRET;
    (process.env as any).NODE_ENV = 'production';
    expect(() => requireSessionSecret()).toThrow(/SESSION_SECRET is not set/);
  });

  it('PRODUCTION with a weak secret (< 32 chars) throws', () => {
    process.env.SESSION_SECRET = WEAK;
    (process.env as any).NODE_ENV = 'production';
    expect(() => requireSessionSecret()).toThrow(/at least 32 characters/);
  });

  it('PRODUCTION with a strong secret returns it', () => {
    process.env.SESSION_SECRET = STRONG;
    (process.env as any).NODE_ENV = 'production';
    expect(requireSessionSecret()).toBe(STRONG);
  });

  it('DEV without SESSION_SECRET falls back with a warning', () => {
    delete process.env.SESSION_SECRET;
    (process.env as any).NODE_ENV = 'development';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const secret = requireSessionSecret();
    expect(secret).toBe('csld-dev-secret-change-in-production');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('falling back to the dev secret'));
    warn.mockRestore();
  });

  it('DEV with a weak secret also warns (but boots)', () => {
    process.env.SESSION_SECRET = WEAK;
    (process.env as any).NODE_ENV = 'development';
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(requireSessionSecret()).toBe('csld-dev-secret-change-in-production');
    warn.mockRestore();
  });

  it('reads the env object it is given (pure function, no hidden globals)', () => {
    expect(
      requireSessionSecret({ SESSION_SECRET: STRONG, NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toBe(STRONG);
    expect(() =>
      requireSessionSecret({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    ).toThrow(/SESSION_SECRET is not set/);
  });
});

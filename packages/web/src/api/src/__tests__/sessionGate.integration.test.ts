/**
 * Phase 1 integration: the REAL production entrypoint must refuse to boot
 * without SESSION_SECRET. Spawns `server.ts` in a subprocess with
 * NODE_ENV=production — a failed boot must exit non-zero with the guard's
 * message, not hang or silently start.
 *
 * Runs against the real file so a future refactor that renames the helper,
 * drops the import, or re-adds a fallback in server.ts breaks this test.
 *
 * The auth-bypass fix (audit Phase 2) added the REMEMBER_ME_KEY gate with the
 * same semantics, so the boot harness here always supplies BOTH keys and each
 * gate gets its own fail-fast case: with the other key present, so the test
 * proves WHICH gate fired.
 */
import {describe, it, expect} from '@jest/globals';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '../../../../server.ts');
const TIMEOUT = 30_000;

const VALID_SESSION_SECRET = 'integration-test-secret-0123456789abcdef0123456789abcdef';
const VALID_REMEMBER_ME_KEY = 'integration-test-rmkey-0123456789abcdef0123456789abcdef';

function bootServer(extraEnv: Record<string, string>): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', SERVER], {
      cwd: join(__dirname, '../../../../../../'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        // Both gates closed by default — each fail-fast case opens exactly one.
        SESSION_SECRET: VALID_SESSION_SECRET,
        REMEMBER_ME_KEY: VALID_REMEMBER_ME_KEY,
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (d) => (output += d.toString()));
    child.stderr.on('data', (d) => (output += d.toString()));
    child.on('exit', (code) => resolve({ code, output }));
    // The server boots a listener on success — kill it if it gets that far.
    setTimeout(() => {
      output += '\n[test] timeout — killing still-running server';
      child.kill('SIGKILL');
      resolve({ code: null, output });
    }, TIMEOUT);
  });
}

describe('server.ts session secret gate (integration)', () => {
  it(
    'exits non-zero in production WITHOUT SESSION_SECRET (fail-fast, no fallback boot)',
    async () => {
      const { code, output } = await bootServer({ SESSION_SECRET: '' });
      expect(code).not.toBe(0);
      expect(code).not.toBe(null); // must EXIT on its own, not be killed by the timeout
      expect(output).toMatch(/SESSION_SECRET is not set/);
    },
    TIMEOUT * 2,
  );

  it(
    'still reaches a listening state with a valid secret (guard does not block correct boots) — verified by absence of the guard throw',
    async () => {
      // We cannot fully boot against the shared local DB here (port conflicts,
      // concurrent test runs), so this asserts the negative space: with a strong
      // secret the process must NOT die with the guard's message. Any failure
      // that happens later (port in use etc.) is out of scope.
      const { code, output } = await bootServer({});
      expect(output).not.toMatch(/SESSION_SECRET is not set/);
      expect(output).not.toMatch(/Refusing to start in production/);
      // code === null means the timeout killed a healthy listener — that is success.
      if (code !== null) {
        expect(output).not.toMatch(/session-secret\]/);
      }
    },
    TIMEOUT * 2,
  );
});

describe('server.ts remember-me key gate (integration)', () => {
  it(
    'exits non-zero in production WITHOUT REMEMBER_ME_KEY (fail-fast — no silent hard-coded fallback boot)',
    async () => {
      // SESSION_SECRET is supplied, so if this boot dies it must be the
      // remember-me gate that fired — proving the exact guard.
      const { code, output } = await bootServer({ REMEMBER_ME_KEY: '' });
      expect(code).not.toBe(0);
      expect(code).not.toBe(null);
      expect(output).toMatch(/REMEMBER_ME_KEY is not set/);
      expect(output).not.toMatch(/SESSION_SECRET is not set/);
    },
    TIMEOUT * 2,
  );

  it(
    'exits non-zero in production with a too-short REMEMBER_ME_KEY',
    async () => {
      const { code, output } = await bootServer({ REMEMBER_ME_KEY: 'short' });
      expect(code).not.toBe(0);
      expect(code).not.toBe(null);
      expect(output).toMatch(/REMEMBER_ME_KEY must be at least 32 characters/);
    },
    TIMEOUT * 2,
  );
});

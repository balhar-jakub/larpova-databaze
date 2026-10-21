import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Coverage for createContext (context.ts, 44% at the Phase 1 baseline —
 * every suite uses testHelpers' hand-rolled context, so the real context
 * builder was never executed by a test).
 *
 * Pinned contracts:
 * - the `user` getter reads req.user LAZILY: a resolver that signs the caller
 *   in during the request (signup/login) must see that user on the same
 *   context instance (the comment in context.ts records why: "otherwise it
 *   answers with the email of nobody")
 * - db is the shared prisma instance
 * - files is the FileService wired via setFileService
 * - login/logout wrap passport's callback API into promises, resolving on
 *   success and rejecting on error
 */

describe('createContext', () => {
  let req: Record<string, unknown>;
  let res: Record<string, unknown>;
  let context: import('../context.js').Context;

  beforeEach(async () => {
    // FileService must be initialized before createContext can hand one out
    const { setFileService, getFileService } = await import('../files/index.js');
    try {
      getFileService();
    } catch {
      const { LocalFiles } = await import('../files/fileService.js');
      const dir = join(tmpdir(), `csld-files-ctx-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      setFileService(new LocalFiles(dir));
    }

    req = {
      user: null,
      login: (user: unknown, cb: (err: Error | null) => void) => cb(null),
      logout: (cb: (err: Error | null) => void) => cb(null),
    };
    res = {};

    const { createContext } = await import('../context.js');
    context = await createContext({ req: req as never, res: res as never });
  });

  afterEach(() => {
    // nothing persists between tests beyond module state; the FileService
    // singleton stays initialized — harmless for other suites.
  });

  it('exposes the shared prisma client as db', async () => {
    const { prisma } = await import('../context.js');
    expect(context.db).toBe(prisma);
  });

  it('hands out the initialized FileService', async () => {
    const { getFileService } = await import('../files/index.js');
    expect(context.files).toBe(getFileService());
  });

  it('user is null for an anonymous request', () => {
    expect(context.user).toBeNull();
  });

  it('user reads req.user LAZILY — a mid-request login is visible on the same context', () => {
    // Simulate a resolver that signs the caller in during this request:
    // passport sets req.user inside ctx.login(). The getter must pick that
    // up on the NEXT read of ctx.user — this is the documented reason the
    // field is a getter at all.
    const authUser = { id: 5, email: 'ctx@integration.test', name: 'Ctx', role: 3 } as never;
    req.user = authUser;
    expect(context.user).toBe(authUser);

    // and back to anonymous if the request says so
    req.user = null;
    expect(context.user).toBeNull();
  });

  it('login resolves when passport reports success', async () => {
    const user = { id: 1 } as never;
    await expect(context.login(user)).resolves.toBeUndefined();
  });

  it('login rejects when passport reports an error', async () => {
    req.login = (_user: unknown, cb: (err: Error | null) => void) => cb(new Error('session store down'));
    await expect(context.login({ id: 1 } as never)).rejects.toThrow('session store down');
  });

  it('logout resolves on success and rejects on error', async () => {
    await expect(context.logout()).resolves.toBeUndefined();

    req.logout = (cb: (err: Error | null) => void) => cb(new Error('logout failed'));
    await expect(context.logout()).rejects.toThrow('logout failed');
  });
});

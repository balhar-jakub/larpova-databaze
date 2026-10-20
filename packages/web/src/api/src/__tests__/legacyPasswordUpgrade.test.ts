import { ApolloServer } from '@apollo/server';
import { createHash } from 'node:crypto';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { validatePassword, isLegacyMd5 } from '../auth/password';

/**
 * 461 production accounts still carry the hash the Java application wrote: plain
 * lowercase MD5, no salt (`auth/password.ts`). The MD5 → PBKDF2 upgrade only ever
 * lived in `passport.ts`'s local strategy, and nothing calls
 * `passport.authenticate('local')` — the password flow is `logInResolver`, which
 * validated the hash and stopped there, so those accounts stayed on MD5 forever.
 *
 * These tests pin the upgrade onto the path that actually runs: it happens after a
 * password validated, never on a failed attempt, and never for an account without
 * a password (magic-link / OAuth users).
 */

const stamp = Date.now();
const PASSWORD = 'legacy-pass-1234';
const legacyEmail = `legacy-md5-${stamp}@integration.test`;
const mixedCaseEmail = `Legacy-Mixed-${stamp}@integration.test`;
const shellEmail = `legacy-shell-${stamp}@integration.test`;

let server: ApolloServer;
let legacyId: number;
let mixedId: number;
let shellId: number;

/** What the Java application wrote: lowercase hex of MD5(password), no salt. */
function md5(raw: string): string {
  return createHash('md5').update(raw, 'utf8').digest('hex');
}

/** logIn sets the remember-me cookie, so the fake response needs `cookie()`. */
const fakeRes = { cookie: () => undefined, clearCookie: () => undefined };

function logIn(userName: string, password: string) {
  return executeQuery(
    server,
    `mutation Login($userName: String!, $password: String!) {
       user { logIn(userName: $userName, password: $password) { id } }
     }`,
    { userName, password },
    { res: fakeRes },
  );
}

async function storedPassword(id: number): Promise<string> {
  const row = await prisma.csld_csld_user.findUnique({
    where: { id },
    select: { password: true },
  });
  return row?.password ?? '';
}

beforeAll(async () => {
  server = createTestServer();

  const legacy = await prisma.csld_csld_user.create({
    data: { email: legacyEmail, password: md5(PASSWORD), role: 1, name: 'Legacy', is_author: false },
  });
  legacyId = legacy.id;

  const mixed = await prisma.csld_csld_user.create({
    data: { email: mixedCaseEmail, password: md5(PASSWORD), role: 1, name: 'Legacy Mixed', is_author: false },
  });
  mixedId = mixed.id;

  const shell = await prisma.csld_csld_user.create({
    data: { email: shellEmail, password: '', role: 1, name: 'Shell', is_author: false },
  });
  shellId = shell.id;
});

afterAll(async () => {
  const rows = await prisma.csld_csld_user.findMany({
    where: { email: { contains: String(stamp) } },
    select: { id: true },
  });
  const ids = rows.map((row) => row.id);
  await prisma.csld_email_authentication.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.csld_csld_user.deleteMany({ where: { id: { in: ids } } });
});

describe('legacy MD5 hashes are upgraded on the login path that runs', () => {
  it('stores a PBKDF2 hash after the first successful password login', async () => {
    // The fixture really is legacy MD5, otherwise the test would pin nothing.
    expect(isLegacyMd5(await storedPassword(legacyId))).toBe(true);

    const result = await logIn(legacyEmail, PASSWORD);

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.logIn?.id).toBe(String(legacyId));

    const stored = await storedPassword(legacyId);
    expect(isLegacyMd5(stored)).toBe(false);
    expect(stored).toContain(':');
    expect(validatePassword(PASSWORD, stored)).toBe(true);
    expect(validatePassword('not-the-password', stored)).toBe(false);
  });

  it('keeps the same password working on the next login', async () => {
    const result = await logIn(legacyEmail, PASSWORD);

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.logIn?.id).toBe(String(legacyId));
    expect(isLegacyMd5(await storedPassword(legacyId))).toBe(false);
  });

  it('leaves the legacy hash untouched when the password is wrong', async () => {
    const before = await storedPassword(mixedId);
    expect(isLegacyMd5(before)).toBe(true);

    const result = await logIn(mixedCaseEmail, 'not-the-password');

    expect(result.errors?.[0].message).toBe('Invalid email or password');
    expect(await storedPassword(mixedId)).toBe(before);
  });

  it('upgrades a legacy account stored with capitals when signing in with the lowercase form', async () => {
    const result = await logIn(mixedCaseEmail.toLowerCase(), PASSWORD);

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.logIn?.id).toBe(String(mixedId));

    const stored = await storedPassword(mixedId);
    expect(isLegacyMd5(stored)).toBe(false);
    expect(validatePassword(PASSWORD, stored)).toBe(true);
  });

  it('never signs in — nor rewrites — an account that has no password', async () => {
    expect(await storedPassword(shellId)).toBe('');

    const empty = await logIn(shellEmail, '');
    expect(empty.errors?.[0].message).toBe('Invalid email or password');

    const anyPassword = await logIn(shellEmail, PASSWORD);
    expect(anyPassword.errors?.[0].message).toBe('Invalid email or password');

    expect(await storedPassword(shellId)).toBe('');
  });
});

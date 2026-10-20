import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { deleteFixtureUsers, fixtureUserIds } from './cleanupFixtures';
import { generatePbkdf2Hash, validatePassword } from '../auth/password';

/**
 * The credential lifecycle around the e-mail normalisation.
 *
 * `startRecoverPassword` now looks the account up case-insensitively, which is the
 * one path a user whose row was stored with capitals has to reset a password — and
 * it had no test at all. The same flow is the documented route for accounts without
 * a password (magic-link/OAuth) to gain one, because `updateLoggedInUserPassword`
 * demands the old password. Both claims are pinned here, together with the fact
 * that the 141 placeholder values left in the legacy column cannot authenticate.
 */

const stamp = Date.now();
const PASSWORD = 'recover-pass-1234';
const NEW_PASSWORD = 'recover-pass-5678';

/** Stored WITH capitals, like the rows the normalisation migration rewrote. */
const mixedEmail = `Recover-Mixed-${stamp}@integration.test`;
/** Ordinary account, for the settings-form password change. */
const plainEmail = `recover-plain-${stamp}@integration.test`;
/** No password at all — a magic-link/OAuth account. */
const credentiallessEmail = `recover-shell-${stamp}@integration.test`;
/** A stored value that is neither a digest nor PBKDF2 — the shape of 141 legacy rows. */
const placeholderEmail = `recover-placeholder-${stamp}@integration.test`;
const PLACEHOLDER = 'legacyvalue13';

let server: ApolloServer;
let mixedId: number;
let plainId: number;
let credentiallessId: number;
let placeholderId: number;

const fakeRes = { cookie: () => undefined, clearCookie: () => undefined };

function asUser(id: number, email: string) {
  return {
    user: {
      id,
      email,
      name: 'Recover Test',
      nickname: null,
      description: null,
      role: 1,
      image: null,
      amountOfComments: 0,
      amountOfPlayed: 0,
      amountOfCreated: 0,
    },
  };
}

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

function startRecover(email: string) {
  return executeQuery(
    server,
    `mutation Start($email: String!, $url: String!) {
       user { startRecoverPassword(email: $email, recoverUrl: $url) }
     }`,
    { email, url: 'http://test/recoverPassword/newPassword?token={token}' },
  );
}

function finishRecover(token: string, newPassword: string) {
  return executeQuery(
    server,
    `mutation Finish($token: String!, $newPassword: String!) {
       user { finishRecoverPassword(token: $token, newPassword: $newPassword) { id } }
     }`,
    { token, newPassword },
  );
}

function changePassword(userId: number, email: string, oldPassword: string, newPassword: string) {
  return executeQuery(
    server,
    `mutation Change($oldPassword: String!, $newPassword: String!) {
       user { updateLoggedInUserPassword(oldPassword: $oldPassword, newPassword: $newPassword) { id } }
     }`,
    { oldPassword, newPassword },
    asUser(userId, email),
  );
}

/** The one-time token the resolver wrote; the e-mail itself is not delivered in tests. */
async function issuedToken(userId: number): Promise<string | null> {
  const row = await prisma.csld_email_authentication.findFirst({
    where: { user_id: userId },
    orderBy: { id: 'desc' },
    select: { auth_token: true },
  });
  return row?.auth_token ?? null;
}

async function storedPassword(id: number): Promise<string> {
  const row = await prisma.csld_csld_user.findUnique({ where: { id }, select: { password: true } });
  return row?.password ?? '';
}

beforeAll(async () => {
  server = createTestServer();

  const mixed = await prisma.csld_csld_user.create({
    data: {
      email: mixedEmail,
      password: generatePbkdf2Hash(PASSWORD, mixedEmail),
      role: 1,
      name: 'Recover Mixed',
      is_author: false,
    },
  });
  mixedId = mixed.id;

  const plain = await prisma.csld_csld_user.create({
    data: {
      email: plainEmail,
      password: generatePbkdf2Hash(PASSWORD, plainEmail),
      role: 1,
      name: 'Recover Plain',
      is_author: false,
    },
  });
  plainId = plain.id;

  const credentialless = await prisma.csld_csld_user.create({
    data: { email: credentiallessEmail, password: '', role: 1, name: 'Recover Shell', is_author: false },
  });
  credentiallessId = credentialless.id;

  const placeholder = await prisma.csld_csld_user.create({
    data: { email: placeholderEmail, password: PLACEHOLDER, role: 1, name: 'Recover Legacy', is_author: false },
  });
  placeholderId = placeholder.id;
});

afterAll(async () => {
  // Shared with the other suites: one database, parallel workers, and
  // `csld_label.added_by` is ON DELETE RESTRICT.
  await deleteFixtureUsers(prisma, await fixtureUserIds(prisma, stamp));
});

describe('password recovery on a mixed-case stored address', () => {
  it('finds the account and mints a token for it instead of creating a new row', async () => {
    // The fixture is only reachable case-insensitively — exactly the state the
    // resolver used to miss (it compared the lower-cased input with the raw column).
    expect(
      await prisma.csld_csld_user.findUnique({ where: { email: mixedEmail.toLowerCase() } }),
    ).toBeNull();

    const result = await startRecover(mixedEmail.toLowerCase());

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.startRecoverPassword).toBe(true);

    const sameAddress = await prisma.csld_csld_user.count({
      where: { email: { equals: mixedEmail, mode: 'insensitive' } },
    });
    expect(sameAddress).toBe(1);
    expect(await issuedToken(mixedId)).not.toBeNull();
  });

  it('lets that account set a new password through the token', async () => {
    const token = await issuedToken(mixedId);
    expect(token).not.toBeNull();

    const finished = await finishRecover(token as string, NEW_PASSWORD);
    expect(finished.errors).toBeUndefined();
    expect(finished.data?.user?.finishRecoverPassword?.id).toBe(String(mixedId));

    expect(validatePassword(NEW_PASSWORD, await storedPassword(mixedId))).toBe(true);
    expect(validatePassword(PASSWORD, await storedPassword(mixedId))).toBe(false);

    const login = await logIn(mixedEmail.toLowerCase(), NEW_PASSWORD);
    expect(login.errors).toBeUndefined();
    expect(login.data?.user?.logIn?.id).toBe(String(mixedId));

    // The token is single-use.
    const reused = await finishRecover(token as string, 'another-password');
    expect(reused.errors?.[0].message).toBe('Invalid or expired token');
  });

  it('reveals nothing and mints nothing for an address nobody has', async () => {
    const result = await startRecover(`nobody-${stamp}@integration.test`);
    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.startRecoverPassword).toBe(true);
    expect(await prisma.csld_csld_user.count({ where: { email: { contains: String(stamp) } } })).toBe(4);
  });
});

describe('changing a password from the settings form', () => {
  it('accepts the current password and stores a new hash', async () => {
    const result = await changePassword(plainId, plainEmail, PASSWORD, NEW_PASSWORD);

    expect(result.errors).toBeUndefined();
    expect(validatePassword(NEW_PASSWORD, await storedPassword(plainId))).toBe(true);
  });

  it('refuses a wrong current password and leaves the hash alone', async () => {
    const before = await storedPassword(plainId);
    const result = await changePassword(plainId, plainEmail, 'not-the-password', 'whatever');

    expect(result.errors?.[0].message).toBe('Invalid current password');
    expect(await storedPassword(plainId)).toBe(before);
  });

  it('cannot be used by an account without a password — recovery is its route', async () => {
    const refused = await changePassword(credentiallessId, credentiallessEmail, '', 'first-password');
    expect(refused.errors?.[0].message).toBe('Invalid current password');

    // The documented way in: request a token, finish the reset, then sign in.
    expect((await startRecover(credentiallessEmail)).data?.user?.startRecoverPassword).toBe(true);
    const token = await issuedToken(credentiallessId);
    expect(token).not.toBeNull();
    expect((await finishRecover(token as string, PASSWORD)).errors).toBeUndefined();

    const login = await logIn(credentiallessEmail, PASSWORD);
    expect(login.errors).toBeUndefined();
    expect(login.data?.user?.logIn?.id).toBe(String(credentiallessId));
  });
});

describe('a legacy placeholder value in the password column', () => {
  it('cannot authenticate and is never rewritten', async () => {
    expect(await storedPassword(placeholderId)).toBe(PLACEHOLDER);

    const empty = await logIn(placeholderEmail, '');
    expect(empty.errors?.[0].message).toBe('Invalid email or password');

    // md5(<anything>) is 32 hex characters, so a 13-character value can never match.
    const guessed = await logIn(placeholderEmail, PLACEHOLDER);
    expect(guessed.errors?.[0].message).toBe('Invalid email or password');

    expect(await storedPassword(placeholderId)).toBe(PLACEHOLDER);
  });
});

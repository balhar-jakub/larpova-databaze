import { ApolloServer } from '@apollo/server';
import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createHash, randomBytes } from 'node:crypto';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { generatePbkdf2Hash, isLegacyMd5, validatePassword } from '../auth/password';

/**
 * The guards and failure paths around the identity resolvers — the two lines each
 * that decide whether a broken thing fails closed.
 *
 * None of these are reachable from a happy-path test, and each one is cheap to lose
 * in a refactor: an unauthenticated mutation that forgets to check `ctx.user`, a
 * sign-up that accepts whatever reCAPTCHA says, a magic-link request that mints a
 * token for a string that is not an address, an expired reset token that keeps
 * working, the cleanup that leaves a user with twenty live tokens, and the hash
 * upgrade that must never be allowed to fail a sign-in it already authorised.
 */

const stamp = Date.now();
const PASSWORD = 'guard-pass-1234';

const sessionEmail = `guard-session-${stamp}@integration.test`;
const md5Email = `guard-md5-${stamp}@integration.test`;
const expiredEmail = `guard-expired-${stamp}@integration.test`;
const tokensEmail = `guard-tokens-${stamp}@integration.test`;
const freshEmail = `guard-fresh-${stamp}@integration.test`;

let server: ApolloServer;
let sessionId: number;
let md5Id: number;
let expiredId: number;
let tokensId: number;

const fakeRes = { cookie: () => undefined, clearCookie: () => undefined };

const LOG_IN = `mutation L($u: String!, $p: String!) { user { logIn(userName: $u, password: $p) { id } } }`;
const LOG_OUT = `mutation { user { logOut { id } } }`;
const CREATE_USER = `mutation C($input: CreateUserInput!) { user { createUser(input: $input) { id } } }`;
const UPDATE_USER = `mutation U($input: UpdateLoggedInUserInput!) { user { updateLoggedInUser(input: $input) { id } } }`;
const CHANGE_PASSWORD = `mutation P($o: String!, $n: String!) { user { updateLoggedInUserPassword(oldPassword: $o, newPassword: $n) { id } } }`;
const FINISH_RECOVER = `mutation F($token: String!, $newPassword: String!) { user { finishRecoverPassword(token: $token, newPassword: $newPassword) { id } } }`;
const START_LOGIN = `mutation S($email: String!, $template: String!) { user { startEmailLogin(email: $email, loginUrlTemplate: $template) } }`;

function asUser(id: number, email: string) {
  return {
    user: {
      id,
      email,
      name: 'Guard Test',
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

function md5(raw: string): string {
  return createHash('md5').update(raw, 'utf8').digest('hex');
}

async function storedPassword(id: number): Promise<string> {
  const row = await prisma.csld_csld_user.findUnique({ where: { id }, select: { password: true } });
  return row?.password ?? '';
}

beforeAll(async () => {
  server = createTestServer();

  const session = await prisma.csld_csld_user.create({
    data: { email: sessionEmail, password: generatePbkdf2Hash(PASSWORD, sessionEmail), role: 1, name: 'Guard Session', is_author: false },
  });
  sessionId = session.id;

  const legacy = await prisma.csld_csld_user.create({
    data: { email: md5Email, password: md5(PASSWORD), role: 1, name: 'Guard MD5', is_author: false },
  });
  md5Id = legacy.id;

  const expired = await prisma.csld_csld_user.create({
    data: { email: expiredEmail, password: generatePbkdf2Hash(PASSWORD, expiredEmail), role: 1, name: 'Guard Expired', is_author: false },
  });
  expiredId = expired.id;

  const tokens = await prisma.csld_csld_user.create({
    data: { email: tokensEmail, password: '', role: 1, name: 'Guard Tokens', is_author: false },
  });
  tokensId = tokens.id;
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

describe('session guards', () => {
  it('logIn returns the signed-in user instead of authenticating again', async () => {
    const result = await executeQuery(
      server,
      LOG_IN,
      { u: sessionEmail, p: 'wrong-password-on-purpose' },
      { ...asUser(sessionId, sessionEmail), res: fakeRes },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.logIn?.id).toBe(String(sessionId));
  });

  it('logOut ends the session and clears its cookie, and is a no-op without one', async () => {
    const logout = jest.fn(async () => undefined);
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };

    const withSession = await executeQuery(server, LOG_OUT, {}, { user: asUser(sessionId, sessionEmail).user, logout, res });
    expect(withSession.errors).toBeUndefined();
    expect(withSession.data?.user?.logOut).toBeNull();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalled();

    const anonymous = await executeQuery(server, LOG_OUT, {}, { res: fakeRes });
    expect(anonymous.errors).toBeUndefined();
    expect(anonymous.data?.user?.logOut).toBeNull();
  });

  it('updateLoggedInUser refuses an anonymous caller', async () => {
    const result = await executeQuery(server, UPDATE_USER, {
      input: { email: freshEmail, name: 'Nobody' },
    });

    expect(result.errors?.[0].message).toBe('Not authenticated');
  });

  it('updateLoggedInUserPassword refuses an anonymous caller', async () => {
    const result = await executeQuery(server, CHANGE_PASSWORD, { o: 'x', n: 'y' });

    expect(result.errors?.[0].message).toBe('Not authenticated');
    expect(validatePassword(PASSWORD, await storedPassword(sessionId))).toBe(true);
  });
});

describe('registration guards', () => {
  it('createUser refuses the registration when reCAPTCHA says no', async () => {
    const originalFetch = global.fetch;
    const previousSecret = process.env.RECAPTCHA_SECRET;
    process.env.RECAPTCHA_SECRET = 'test-secret';
    global.fetch = jest.fn(async () => ({ json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) })) as unknown as typeof fetch;

    try {
      const email = `guard-recaptcha-${stamp}@integration.test`;
      const result = await executeQuery(server, CREATE_USER, {
        input: { email, password: 'some-password-1', recaptcha: 'bad-token' },
      });

      expect(result.errors?.[0].message).toBe('reCAPTCHA verification failed');
      // Nothing was written, so the address is still free.
      expect(await prisma.csld_csld_user.count({ where: { email } })).toBe(0);
    } finally {
      global.fetch = originalFetch;
      if (previousSecret === undefined) delete process.env.RECAPTCHA_SECRET;
      else process.env.RECAPTCHA_SECRET = previousSecret;
    }
  });
});

describe('magic-link guards', () => {
  it('refuses to mint a token for a string that is not an address', async () => {
    for (const bad of ['', '   ', 'not-an-address']) {
      const result = await executeQuery(server, START_LOGIN, { email: bad, template: 'http://test/?token={token}' });
      expect(result.errors?.[0].message).toBe('Invalid email');
    }

    expect(await prisma.csld_csld_user.count({ where: { email: { contains: String(stamp) } } })).toBe(4);
  });

  it('keeps only the newest token per account', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await executeQuery(server, START_LOGIN, {
        email: tokensEmail,
        template: 'http://test/auth/email-login?token={token}',
      });
      expect(result.errors).toBeUndefined();
      expect(result.data?.user?.startEmailLogin).toBe(true);
    }

    const tokens = await prisma.csld_email_authentication.findMany({
      where: { user_id: tokensId },
      select: { id: true },
    });
    expect(tokens).toHaveLength(1);
  });
});

describe('recovery guard', () => {
  it('refuses an expired token and deletes it', async () => {
    const token = randomBytes(32).toString('hex');
    await prisma.csld_email_authentication.create({
      data: { auth_token: token, user_id: expiredId, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    });

    const result = await executeQuery(server, FINISH_RECOVER, { token, newPassword: 'new-password-1' });

    expect(result.errors?.[0].message).toBe('Token expired');
    expect(await prisma.csld_email_authentication.count({ where: { auth_token: token } })).toBe(0);
    // The old password still works: an expired token changed nothing.
    expect(validatePassword(PASSWORD, await storedPassword(expiredId))).toBe(true);
  });
});

describe('the hash upgrade cannot break a sign-in it already authorised', () => {
  it('signs the user in and leaves the hash alone when the write fails', async () => {
    expect(isLegacyMd5(await storedPassword(md5Id))).toBe(true);

    // Fail only the user write the upgrade performs; every read still hits the db.
    const failingDb = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === 'csld_csld_user') {
          const delegate = Object.create((target as unknown as Record<string, object>).csld_csld_user);
          delegate.update = async () => {
            throw new Error('simulated write failure');
          };
          return delegate;
        }
        return Reflect.get(target, property, receiver);
      },
    });

    const result = await executeQuery(
      server,
      LOG_IN,
      { u: md5Email, p: PASSWORD },
      { db: failingDb, res: fakeRes },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.logIn?.id).toBe(String(md5Id));
    expect(isLegacyMd5(await storedPassword(md5Id))).toBe(true);
  });
});

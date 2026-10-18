import { ApolloServer } from '@apollo/server';
import { createTestServer, executeQuery } from './testHelpers';
import { prisma } from '../context';
import { generatePbkdf2Hash } from '../auth/password';
import { findUserByEmail, findUserCandidatesByEmail, normalizeEmail } from '../auth/emailLookup';

/**
 * `csld_csld_user.email` is a case-SENSITIVE unique column inherited from the
 * legacy application, and 351 production rows store the address with capitals
 * (`Cilkaj@seznam.cz`, `jakubě@balhar.net`, …). Every lookup compared a
 * lower-cased input against that raw column, so those accounts could not sign in
 * with a password, the magic link registered a *second* account for them (5 such
 * duplicate pairs are in production) and the sign-up availability check called a
 * taken address free — which is how the duplicate accounts appeared in the first
 * place. See docs/navrh-normalizace-emailu.md.
 *
 * These tests pin the case-insensitive contract of the lookup helper and of every
 * resolver that uses it.
 */

const stamp = Date.now();
const PASSWORD = 'Passw0rd!1';

/** An account stored WITH capitals, like the 232 real ones in production. */
const mixedEmail = `Case-Test-${stamp}@integration.test`;
/** A duplicate pair: the older row carries the password, the newer one is a shell. */
const pairKeptEmail = `Pair-Kept-${stamp}@integration.test`;
const pairShellEmail = pairKeptEmail.toLowerCase();
/** Two ordinary accounts, for the settings-form guard. */
const plainEmail = `plain-${stamp}@integration.test`;
const otherEmail = `other-${stamp}@integration.test`;

let server: ApolloServer;
let mixedId: number;
let pairKeptId: number;
let pairShellId: number;
let plainId: number;
let otherId: number;

/** Context of a signed-in caller, as the server builds it from the session. */
function asUser(id: number, email: string) {
  return {
    user: {
      id,
      email,
      name: 'Test',
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

/** logIn sets the remember-me cookie, so the fake response needs `cookie()`. */
const fakeRes = { cookie: () => undefined, clearCookie: () => undefined };

function account(email: string, name: string) {
  return {
    email,
    password: generatePbkdf2Hash(PASSWORD, email),
    role: 1,
    name,
    is_author: false,
  };
}

beforeAll(async () => {
  server = createTestServer();

  const mixed = await prisma.csld_csld_user.create({ data: account(mixedEmail, 'Case Test') });
  mixedId = mixed.id;
  // Created in this order on purpose: the shell has the higher id, so "oldest row
  // wins" must not be what picks the account — the password is.
  const kept = await prisma.csld_csld_user.create({ data: account(pairKeptEmail, 'Pair Kept') });
  pairKeptId = kept.id;
  const shell = await prisma.csld_csld_user.create({
    data: { email: pairShellEmail, password: '', role: 1, name: 'pair-shell', is_author: false },
  });
  pairShellId = shell.id;
  const plain = await prisma.csld_csld_user.create({ data: account(plainEmail, 'Plain') });
  plainId = plain.id;
  const other = await prisma.csld_csld_user.create({ data: account(otherEmail, 'Other') });
  otherId = other.id;
});

afterAll(async () => {
  // Sweep by the stamp, not by the addresses: an account a broken resolver
  // created as a "case variant" would otherwise survive in the database.
  const rows = await prisma.csld_csld_user.findMany({
    where: { email: { contains: String(stamp) } },
    select: { id: true },
  });
  const ids = rows.map((row) => row.id);
  await prisma.csld_email_authentication.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.csld_csld_user.deleteMany({ where: { id: { in: ids } } });
});

describe('normalizeEmail', () => {
  it('trims and lower-cases, diacritics included', () => {
    expect(normalizeEmail('  Jakubě@Balhar.NET ')).toBe('jakubě@balhar.net');
    expect(normalizeEmail('Cilkaj@seznam.cz')).toBe('cilkaj@seznam.cz');
  });

  it('turns a missing or blank input into an empty string', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail('   ')).toBe('');
  });
});

describe('findUserByEmail', () => {
  it('finds an account stored with capitals from the lower-cased input', async () => {
    const row = await findUserByEmail(prisma, mixedEmail.toLowerCase());
    expect(row?.id).toBe(mixedId);
  });

  it('finds it from the original spelling too (trimmed)', async () => {
    const row = await findUserByEmail(prisma, `  ${mixedEmail}  `);
    expect(row?.id).toBe(mixedId);
  });

  it('returns null for an address nobody has', async () => {
    expect(await findUserByEmail(prisma, `nobody-${stamp}@integration.test`)).toBeNull();
    expect(await findUserByEmail(prisma, '')).toBeNull();
  });

  it('lists every candidate of a duplicate address, oldest first', async () => {
    const rows = await findUserCandidatesByEmail(prisma, pairShellEmail);
    expect(rows.map((row) => row.id)).toEqual([pairKeptId, pairShellId]);
  });

  it('picks the account with a password and logs the ambiguity', async () => {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    let row;
    try {
      row = await findUserByEmail(prisma, pairKeptEmail.toUpperCase());
    } finally {
      console.warn = original;
    }

    expect(row?.id).toBe(pairKeptId);
    expect(warnings.join('\n')).toContain(`ids ${pairKeptId}, ${pairShellId}`);
    expect(warnings.join('\n')).toContain('Merge the duplicate rows');
  });
});

describe('resolvers on a case-variant address', () => {
  it('userByEmail answers the same account for any spelling', async () => {
    const check = `query Check($email: String!) { userByEmail(email: $email) { id name } }`;

    const stored = await executeQuery(server, check, { email: mixedEmail });
    const lower = await executeQuery(server, check, { email: mixedEmail.toLowerCase() });
    const padded = await executeQuery(server, check, { email: ` ${mixedEmail.toLowerCase()} ` });

    expect(stored.data?.userByEmail?.id).toBe(String(mixedId));
    expect(lower.data?.userByEmail?.id).toBe(String(mixedId));
    expect(padded.data?.userByEmail?.id).toBe(String(mixedId));
  });

  it('logIn accepts the lower-cased form of an account stored with capitals', async () => {
    const result = await executeQuery(
      server,
      `mutation Login($userName: String!, $password: String!) {
         user { logIn(userName: $userName, password: $password) { id } }
       }`,
      { userName: mixedEmail.toLowerCase(), password: PASSWORD },
      { res: fakeRes },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.logIn?.id).toBe(String(mixedId));
  });

  it('logIn rejects a wrong password with the generic message', async () => {
    const result = await executeQuery(
      server,
      `mutation Login($userName: String!, $password: String!) {
         user { logIn(userName: $userName, password: $password) { id } }
       }`,
      { userName: mixedEmail.toLowerCase(), password: 'not-the-password' },
      { res: fakeRes },
    );

    expect(result.errors?.[0].message).toBe('Invalid email or password');
  });

  it('logIn lets the password pick the account when an address is duplicated', async () => {
    // The shell has the higher id and the same address; only the older row's hash
    // matches, so the sign-in must land there.
    const result = await executeQuery(
      server,
      `mutation Login($userName: String!, $password: String!) {
         user { logIn(userName: $userName, password: $password) { id } }
       }`,
      { userName: pairShellEmail, password: PASSWORD },
      { res: fakeRes },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.logIn?.id).toBe(String(pairKeptId));
  });

  it('createUser refuses a case variant of a registered address', async () => {
    const result = await executeQuery(
      server,
      `mutation Create($input: CreateUserInput!) { user { createUser(input: $input) { id } } }`,
      { input: { email: mixedEmail.toLowerCase(), password: 'brand-new-pass', recaptcha: 'dev-bypass' } },
    );

    expect(result.errors?.[0].message).toBe('Email already registered');

    const count = await prisma.csld_csld_user.count({
      where: { email: { equals: mixedEmail, mode: 'insensitive' } },
    });
    expect(count).toBe(1);
  });

  it('startEmailLogin signs the existing account in instead of registering a twin', async () => {
    const where = { email: { equals: mixedEmail, mode: 'insensitive' as const } };
    const before = await prisma.csld_csld_user.count({ where });

    const result = await executeQuery(
      server,
      `mutation Start($email: String!, $template: String!) {
         user { startEmailLogin(email: $email, loginUrlTemplate: $template) }
       }`,
      { email: mixedEmail.toLowerCase(), template: 'http://test/auth/email-login?token={token}' },
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.startEmailLogin).toBe(true);
    expect(await prisma.csld_csld_user.count({ where })).toBe(before);

    const tokens = await prisma.csld_email_authentication.count({ where: { user_id: mixedId } });
    expect(tokens).toBeGreaterThan(0);
  });

  it("updateLoggedInUser refuses a case variant of somebody else's address", async () => {
    const result = await executeQuery(
      server,
      `mutation Update($input: UpdateLoggedInUserInput!) {
         user { updateLoggedInUser(input: $input) { id } }
       }`,
      { input: { email: otherEmail.toUpperCase(), name: 'Plain' } },
      asUser(plainId, plainEmail),
    );

    expect(result.errors?.[0].message).toBe('Email already registered');

    const row = await prisma.csld_csld_user.findUnique({
      where: { id: plainId },
      select: { email: true },
    });
    expect(row?.email).toBe(plainEmail);
  });

  it('updateLoggedInUser keeps the account when the address is its own (any spelling)', async () => {
    const result = await executeQuery(
      server,
      `mutation Update($input: UpdateLoggedInUserInput!) {
         user { updateLoggedInUser(input: $input) { id } }
       }`,
      { input: { email: ` ${plainEmail.toUpperCase()} `, name: 'Plain' } },
      asUser(plainId, plainEmail),
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.user?.updateLoggedInUser?.id).toBe(String(plainId));

    const row = await prisma.csld_csld_user.findUnique({
      where: { id: plainId },
      select: { email: true },
    });
    // Saving the profile writes the canonical form, so the column stops drifting.
    expect(row?.email).toBe(plainEmail);
  });

  it('leaves other accounts untouched by the settings save', async () => {
    const row = await prisma.csld_csld_user.findUnique({
      where: { id: otherId },
      select: { email: true },
    });
    expect(row?.email).toBe(otherEmail);
  });
});

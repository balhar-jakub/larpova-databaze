import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../context';
import { linkGoogleIdentity, googleSignInConfigured, type GoogleEnv } from '../auth/googleLink';
import { generatePbkdf2Hash } from '../auth/password';

/**
 * The account-linking decision (docs/navrh-prihlaseni-google.md, rules 1–5).
 *
 * The rules exist because a silent choice here hands somebody an account: linking
 * by address is only safe when Google vouched for that address and exactly one
 * account holds it. Everything else refuses and leaves the database untouched.
 */

const stamp = Date.now();
const PASSWORD = 'google-pass-1234';

const linkedEmail = `google-linked-${stamp}@integration.test`;
const plainEmail = `google-plain-${stamp}@integration.test`;
const staffEmail = `google-staff-${stamp}@integration.test`;
const dupEmailStored = `Google-Dup-${stamp}@integration.test`;
const dupEmailTyped = `google-dup-${stamp}@integration.test`;
const conflictEmail = `google-conflict-${stamp}@integration.test`;
const freshTyped = `Google.Fresh-${stamp}@Integration.Test`;
const freshCanonical = freshTyped.toLowerCase();

let linkedId: number;
let plainId: number;
let staffId: number;
let dupIds: number[];
let conflictId: number;

async function linkCount(sub: string): Promise<number> {
  return prisma.csld_oauth_account.count({ where: { provider: 'google', provider_account_id: sub } });
}

beforeAll(async () => {
  const make = async (data: { email: string; name?: string; role?: number; is_author?: boolean }) =>
    prisma.csld_csld_user.create({
      data: {
        email: data.email,
        name: data.name ?? 'Google Test',
        password: generatePbkdf2Hash(PASSWORD, data.email),
        role: data.role ?? 1,
        is_author: data.is_author ?? false,
      },
    });

  linkedId = (await make({ email: linkedEmail })).id;
  plainId = (await make({ email: plainEmail })).id;
  staffId = (await make({ email: staffEmail, name: 'Editor', role: 2, is_author: true })).id;
  conflictId = (await make({ email: conflictEmail })).id;

  const first = await make({ email: dupEmailStored, name: 'dup first' });
  const second = await make({ email: dupEmailTyped, name: 'dup second' });
  dupIds = [first.id, second.id];

  await prisma.csld_oauth_account.create({
    data: {
      user_id: linkedId,
      provider: 'google',
      provider_account_id: 'sub-existing',
      provider_email: linkedEmail,
      last_login_at: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });
  await prisma.csld_oauth_account.create({
    data: {
      user_id: conflictId,
      provider: 'google',
      provider_account_id: 'sub-other',
      provider_email: conflictEmail,
    },
  });
});

afterAll(async () => {
  const rows = await prisma.csld_csld_user.findMany({
    where: { email: { contains: String(stamp) } },
    select: { id: true },
  });
  const ids = rows.map((row) => row.id);
  await prisma.csld_oauth_account.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.csld_email_authentication.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.csld_csld_user.deleteMany({ where: { id: { in: ids } } });
});

describe('rule 1 — an existing link signs that user in', () => {
  it('uses the identity key, not the address, and refreshes the link', async () => {
    const before = await prisma.csld_oauth_account.findFirst({
      where: { provider_account_id: 'sub-existing' },
      select: { last_login_at: true },
    });

    const outcome = await linkGoogleIdentity(prisma, {
      sub: 'sub-existing',
      email: `moved-to-a-new-address-${stamp}@integration.test`,
      emailVerified: true,
    });

    expect(outcome).toEqual({ kind: 'sign-in', userId: linkedId, how: 'linked' });

    const after = await prisma.csld_oauth_account.findFirst({
      where: { provider_account_id: 'sub-existing' },
      select: { provider_email: true, last_login_at: true },
    });
    expect(after?.provider_email).toBe(`moved-to-a-new-address-${stamp}@integration.test`);
    expect(after!.last_login_at.getTime()).toBeGreaterThan(before!.last_login_at.getTime());
  });
});

describe('rule 2 — a verified address with exactly one account links it', () => {
  it('links and signs in', async () => {
    const outcome = await linkGoogleIdentity(prisma, {
      sub: 'sub-plain',
      email: plainEmail.toUpperCase(),
      emailVerified: true,
    });

    expect(outcome).toEqual({ kind: 'sign-in', userId: plainId, how: 'email' });

    const link = await prisma.csld_oauth_account.findFirst({
      where: { provider_account_id: 'sub-plain' },
      select: { user_id: true, provider_email: true },
    });
    expect(link?.user_id).toBe(plainId);
    expect(link?.provider_email).toBe(plainEmail);
  });
});

describe('rule 3 — an address several accounts share is never guessed', () => {
  it('refuses, names the candidates, and writes nothing', async () => {
    const outcome = await linkGoogleIdentity(prisma, {
      sub: 'sub-dup',
      email: dupEmailTyped,
      emailVerified: true,
    });

    expect(outcome.kind).toBe('ambiguous');
    if (outcome.kind !== 'ambiguous') return;
    expect(outcome.userIds.sort()).toEqual([...dupIds].sort());
    expect(await linkCount('sub-dup')).toBe(0);
  });
});

describe('rule 4 — nobody holds the address, so the account is registered', () => {
  it('creates the account in canonical form and links it', async () => {
    const outcome = await linkGoogleIdentity(prisma, {
      sub: 'sub-fresh',
      email: freshTyped,
      emailVerified: true,
      name: 'Jana Nováková',
    });

    expect(outcome.kind).toBe('registered');
    if (outcome.kind !== 'registered') return;

    const user = await prisma.csld_csld_user.findUnique({
      where: { id: outcome.userId },
      select: { email: true, name: true, password: true, role: true, is_author: true },
    });
    expect(user?.email).toBe(freshCanonical);
    expect(user?.name).toBe('Jana Nováková');
    expect(user?.password).toBe('');
    expect(user?.role).toBe(1);
    expect(user?.is_author).toBe(false);

    const link = await prisma.csld_oauth_account.findFirst({
      where: { provider_account_id: 'sub-fresh' },
      select: { user_id: true, provider_email: true },
    });
    expect(link?.user_id).toBe(outcome.userId);
    expect(link?.provider_email).toBe(freshCanonical);
  });

  it('falls back to the local part when Google sends no name', async () => {
    const typed = `google-noname-${stamp}@integration.test`;
    const outcome = await linkGoogleIdentity(prisma, { sub: 'sub-noname', email: typed, emailVerified: true });

    expect(outcome.kind).toBe('registered');
    if (outcome.kind !== 'registered') return;
    const user = await prisma.csld_csld_user.findUnique({ where: { id: outcome.userId }, select: { name: true } });
    expect(user?.name).toBe(`google-noname-${stamp}`);
  });
});

describe('rule 5 — an account bound to another Google identity is refused', () => {
  it('refuses and leaves the existing link alone', async () => {
    const outcome = await linkGoogleIdentity(prisma, {
      sub: 'sub-new',
      email: conflictEmail,
      emailVerified: true,
    });

    expect(outcome).toEqual({ kind: 'conflict', userId: conflictId });
    expect(await linkCount('sub-new')).toBe(0);
    expect(await linkCount('sub-other')).toBe(1);
  });
});

describe('an unverified address never links', () => {
  it('refuses and writes nothing', async () => {
    const outcome = await linkGoogleIdentity(prisma, {
      sub: 'sub-unverified',
      email: plainEmail,
      emailVerified: false,
    });

    expect(outcome).toEqual({ kind: 'unverified' });
    expect(await linkCount('sub-unverified')).toBe(0);
  });
});

describe('linking never grants authorisation', () => {
  it('leaves role and artist flag untouched, and says so in the log', async () => {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };

    let outcome;
    try {
      outcome = await linkGoogleIdentity(prisma, { sub: 'sub-staff', email: staffEmail.toUpperCase(), emailVerified: true });
    } finally {
      console.warn = original;
    }

    expect(outcome).toEqual({ kind: 'sign-in', userId: staffId, how: 'email' });

    const user = await prisma.csld_csld_user.findUnique({
      where: { id: staffId },
      select: { role: true, is_author: true },
    });
    expect(user?.role).toBe(2);
    expect(user?.is_author).toBe(true);

    const log = warnings.join('\n');
    expect(log).toContain(`auto-linked sub sub-staff to existing account ${staffId}`);
    expect(log).toContain('STAFF account (role 2)');
  });
});

describe('googleSignInConfigured', () => {
  it('needs both halves of the client credentials', () => {
    expect(googleSignInConfigured({})).toBe(false);
    expect(googleSignInConfigured({ GOOGLE_CLIENT_ID: 'id' })).toBe(false);
    expect(googleSignInConfigured({ GOOGLE_CLIENT_SECRET: 'secret' })).toBe(false);
    expect(googleSignInConfigured({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })).toBe(true);
  });
});

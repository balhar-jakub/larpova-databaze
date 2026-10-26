import type { PrismaClient } from '@prisma/client';
import { findUserCandidatesByEmail, normalizeEmail } from './emailLookup.js';

/**
 * Account linking for external identities — the decision, without any HTTP.
 *
 * Rules (docs/navrh-prihlaseni-google.md, "Bezpečnost: jak propojovat účty"):
 *
 * 1. An existing link (`provider` + Google `sub`) signs that user in. The `sub` is
 *    the identity key; the address in the token is only a hint, because a Google
 *    account can change address.
 * 2. No link, a verified address, and exactly one account holding it → link and
 *    sign in. That is safe for the same reason "forgot password" is: control of the
 *    mailbox is control of the account, and both paths prove exactly that.
 * 3. Several accounts share the address → refuse. Picking one silently would hand
 *    somebody an account; the user has to come in with a password or a magic link
 *    and link from their profile.
 * 4. Nobody holds the address → register (role USER, empty password, like the magic
 *    link) and link. "Continue with Google" is therefore also sign-up.
 * 5. The account is already bound to a different Google identity → refuse.
 *
 * Never touches `role` or `is_author`: Google proves identity, it does not grant
 * authorisation. Auto-linking an existing account is logged, and a staff account is
 * called out in that log line.
 */

export const GOOGLE_PROVIDER = 'google';

/** The environment keys this feature reads; a plain object so tests can pass one. */
export interface GoogleEnv {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
}

/** Role of an ordinary user (`CsldRole.USER`); anything else is staff. */
const USER_ROLE = 1;

export interface GoogleIdentity {
  /** Google `sub` — stable, the identity key. */
  sub: string;
  email: string;
  /** `email_verified` from the verified ID token. */
  emailVerified: boolean;
  name?: string | null;
}

export type GoogleLinkOutcome =
  /** Sign in an existing account; `how` says whether the identity was already linked. */
  | { kind: 'sign-in'; userId: number; how: 'linked' | 'email' }
  /** A new account was created for this identity. */
  | { kind: 'registered'; userId: number }
  /** Several accounts share the address — nothing was written. */
  | { kind: 'ambiguous'; userIds: number[] }
  /** Google did not vouch for the address — nothing was written. */
  | { kind: 'unverified' }
  /** The account is already linked to a different Google identity — nothing was written. */
  | { kind: 'conflict'; userId: number };

type Db = PrismaClient;

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

/** The one matching e-mail account: refused when it already carries another
 * Google identity, linked when free (a lost unique race counts as linked).
 * The staff note in the log marks privileged accounts for review. */
async function linkToExistingUser(
  db: Db,
  user: { id: number; role: number },
  identity: GoogleIdentity,
  email: string,
  linkBySub: () => Promise<{ user_id: number } | null>,
): Promise<GoogleLinkOutcome> {
  // 5. Already bound to another Google identity.
  const otherLink = await db.csld_oauth_account.findFirst({
    where: { user_id: user.id, provider: GOOGLE_PROVIDER },
    select: { provider_account_id: true },
  });
  if (otherLink && otherLink.provider_account_id !== identity.sub) {
    return { kind: 'conflict', userId: user.id };
  }

  try {
    await db.csld_oauth_account.create({
      data: {
        user_id: user.id,
        provider: GOOGLE_PROVIDER,
        provider_account_id: identity.sub,
        provider_email: email,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Two callbacks for the same identity raced; whichever won is the answer.
    const raced = await linkBySub();
    if (raced) return { kind: 'sign-in', userId: raced.user_id, how: 'linked' };
    return { kind: 'conflict', userId: user.id };
  }

  const staff = user.role !== USER_ROLE;
  console.warn(
    `[google] auto-linked sub ${identity.sub} to existing account ${user.id} by e-mail` +
      (staff ? ` — STAFF account (role ${user.role})` : ''),
  );
  return { kind: 'sign-in', userId: user.id, how: 'email' };
}

export async function linkGoogleIdentity(db: Db, identity: GoogleIdentity): Promise<GoogleLinkOutcome> {
  const email = normalizeEmail(identity.email);
  if (!identity.emailVerified || !email) return { kind: 'unverified' };

  const linkBySub = () =>
    db.csld_oauth_account.findUnique({
      where: {
        provider_provider_account_id: {
          provider: GOOGLE_PROVIDER,
          provider_account_id: identity.sub,
        },
      },
      select: { id: true, user_id: true },
    });

  // 1. The identity key decides.
  const linked = await linkBySub();
  if (linked) {
    await db.csld_oauth_account.update({
      where: { id: linked.id },
      data: { provider_email: email, last_login_at: new Date() },
    });
    return { kind: 'sign-in', userId: linked.user_id, how: 'linked' };
  }

  // Several accounts on one address: never guess.
  const candidates = await findUserCandidatesByEmail(db, email);
  if (candidates.length > 1) {
    return { kind: 'ambiguous', userIds: candidates.map((candidate) => candidate.id) };
  }

  if (candidates.length === 1) {
    return linkToExistingUser(db, candidates[0], identity, email, linkBySub);
  }

  // 4. New account, created and linked atomically so a race cannot leave an
  // identity-less shell behind.
  const created = await db.$transaction(async (tx) => {
    const user = await tx.csld_csld_user.create({
      data: {
        email,
        name: identity.name?.trim() || email.split('@')[0],
        password: '',
        role: USER_ROLE,
        is_author: false,
        amount_of_comments: 0,
        amount_of_played: 0,
        amount_of_created: 0,
      },
      select: { id: true },
    });
    await tx.csld_oauth_account.create({
      data: {
        user_id: user.id,
        provider: GOOGLE_PROVIDER,
        provider_account_id: identity.sub,
        provider_email: email,
      },
    });
    return user;
  });

  return { kind: 'registered', userId: created.id };
}

/** True when both client id and secret are present, i.e. the button may be offered. */
export function googleSignInConfigured(env: GoogleEnv = process.env as GoogleEnv): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

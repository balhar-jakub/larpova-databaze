import type { Prisma } from '@prisma/client';
import type { Context } from '../context.js';

/**
 * Case-insensitive user lookup by e-mail.
 *
 * `csld_csld_user.email` is a case-SENSITIVE unique column inherited from the
 * legacy application, and 351 production rows carry an address that differs from
 * its lower-cased form (`Cilkaj@seznam.cz`, `jakubě@balhar.net`, …). Every lookup
 * used to compare a lower-cased input against that raw column, so those accounts
 * could not sign in with a password, the magic link silently registered a second
 * account for them, and the sign-up availability check called a taken address
 * free — see docs/navrh-normalizace-emailu.md.
 *
 * Contract:
 *   1. exact match on the normalised address (index `unique_email`) — the normal
 *      path once the `normalize_user_email` migration has run;
 *   2. otherwise a match on the database's own `lower(btrim(email))`, which keeps
 *      the legacy rows reachable in the window before that migration and after a
 *      rollback of the app;
 *   3. several case-insensitive matches (5 known duplicate pairs in production)
 *      are never resolved silently: the pick is deterministic and logged.
 */

type Db = Context['db'];

/** The row shape every caller needs: the profile picture comes along. */
export type UserWithImage = Prisma.csld_csld_userGetPayload<{ include: { csld_image: true } }>;

const WITH_IMAGE = { csld_image: true } as const;

/**
 * Canonical form of an address, for storage and for the fast lookup path:
 * `trim()` + `toLowerCase()`. Everything written to the column goes through it,
 * so `unique_email` stops being a case-sensitive trap.
 */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * Every account the address could mean, oldest first. One row in the normal
 * case; more only for the legacy duplicate pairs.
 */
export async function findUserCandidatesByEmail(
  db: Db,
  rawEmail: string | null | undefined,
): Promise<UserWithImage[]> {
  if (!normalizeEmail(rawEmail)) return [];

  // One id lookup, matching the way the normalisation migration rewrites the
  // column (`lower(btrim(email))`). Deliberately NOT `findUnique(normalizeEmail(…))`
  // first: for a duplicate pair the lower-cased form can be the magic-link *shell*,
  // and the account with the history is the row stored with capitals — a fast path
  // on the normalised form alone would hand the caller the wrong account. It also
  // does not use `mode: 'insensitive'`, where `%` and `_` in the input act as
  // wildcards. Two round trips, and the comparison can use the `lower(email)`
  // index once it exists; until then it is a scan of a ~3k-row table.
  const matches = await db.$queryRaw<{ id: number }[]>`
    SELECT id FROM csld_csld_user
    WHERE email IS NOT NULL AND lower(btrim(email)) = lower(btrim(${rawEmail ?? ''}))
  `;
  if (matches.length === 0) return [];

  return db.csld_csld_user.findMany({
    where: { id: { in: matches.map((row) => row.id) } },
    include: WITH_IMAGE,
    orderBy: { id: 'asc' },
  });
}

/**
 * The single account an address means, for every flow that has no password to
 * decide between candidates (magic link, password recovery, the sign-up
 * availability check, …). Returns null when nobody has the address.
 */
export async function findUserByEmail(
  db: Db,
  rawEmail: string | null | undefined,
): Promise<UserWithImage | null> {
  const candidates = await findUserCandidatesByEmail(db, rawEmail);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const primary = pickPrimaryCandidate(candidates);
  console.warn(
    `[emailLookup] ${candidates.length} accounts share the address "${normalizeEmail(rawEmail)}" ` +
      `(ids ${candidates.map((candidate) => candidate.id).join(', ')}); using id ${primary.id}. ` +
      'Merge the duplicate rows — see docs/navrh-normalizace-emailu.md.',
  );
  return primary;
}

/**
 * Which row is "the account" when several share an address: the one with a
 * password, otherwise the oldest. Both hold for all five known duplicate pairs
 * (the newer row is either an import artefact or a magic-link shell).
 * `rows` come in id order.
 */
function pickPrimaryCandidate(rows: UserWithImage[]): UserWithImage {
  return rows.find((row) => (row.password ?? '').length > 0) ?? rows[0];
}

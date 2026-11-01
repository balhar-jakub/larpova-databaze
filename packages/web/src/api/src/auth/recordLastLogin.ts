import type { Context } from '../context.js';

type Db = Context['db'];

/**
 * `csld_csld_user.last_login = now()` — written on EVERY successful
 * authentication (magic link, password, Google), so the returning-user rate
 * is measurable from the database. Before this column existed, only magic-link
 * logins left a trace (`csld_email_authentication.created_at`) and Passport /
 * Google logins left none (site-usage audit 2026-11-01).
 *
 * A failure here must never fail the sign-in — the session is already valid —
 * so it is logged, not thrown.
 */
export async function recordLastLogin(db: Db, userId: number): Promise<void> {
  try {
    await db.csld_csld_user.update({
      where: { id: userId },
      data: { last_login: new Date() },
    });
  } catch (err) {
    console.warn(`[lastLogin] update failed for user ${userId}:`, err);
  }
}

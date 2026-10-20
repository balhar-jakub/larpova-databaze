import type { PrismaClient } from '@prisma/client';

/**
 * Removes a suite's fixture accounts without failing the suite.
 *
 * The API suites share one database and run in parallel, so a fixture user can pick
 * up rows from another suite — `csld_label.added_by` is `ON DELETE RESTRICT`, and a
 * suite that attaches a label to a user id it did not create (or that happens to be
 * a fixture id) makes a plain `deleteMany` throw and takes the whole suite down with
 * a "Test suite failed to run". That is ordering-dependent: green on Node 22, red on
 * Node 26, because the schedule differs.
 *
 * Deleting the dependents first is safe for fixtures: a test account never owns
 * labels, ratings or tokens of its own, so anything attached to it came from
 * elsewhere and is junk in a throwaway CI database. The final delete is still
 * guarded — a leftover fixture is harmless, a suite that cannot run is not.
 */
export async function deleteFixtureUsers(prisma: PrismaClient, ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  const where = { where: { user_id: { in: ids } } };
  await prisma.csld_email_authentication.deleteMany(where);
  await prisma.csld_oauth_account.deleteMany(where);
  await prisma.csld_label.deleteMany({ where: { added_by: { in: ids } } });

  try {
    await prisma.csld_csld_user.deleteMany({ where: { id: { in: ids } } });
  } catch (error) {
    console.warn(`[tests] fixture users left behind (${ids.join(', ')}):`, error);
  }
}

/** The ids of the accounts a suite created, found by the shared marker in the address. */
export async function fixtureUserIds(prisma: PrismaClient, stamp: string | number): Promise<number[]> {
  const rows = await prisma.csld_csld_user.findMany({
    where: { email: { contains: String(stamp) } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

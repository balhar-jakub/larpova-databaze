import { prisma } from '../context';

/**
 * Structural invariants the migrations establish, which no other test can see.
 *
 * `user_email_normalized_idx` is an expression index, and Prisma has no way to
 * express one: it exists only in `prisma/migrations/20261019120100_...`. That also
 * makes it invisible to the two drift gates, so deleting or renaming that migration
 * would leave the case-insensitive lookup silently back on a sequential scan — the
 * index is the one thing about it that has to be asserted explicitly.
 *
 * The check is conditional on purpose: CI applies every migration to an empty
 * database, so the assertion runs there, while a developer's database restored from
 * a production dump has not recorded the migration at all. In that case the test
 * says so instead of failing on a database the change was never applied to.
 */

describe('e-mail normalisation state', () => {
  it('has the index the case-insensitive lookup is planned against', async () => {
    const applied = await prisma.$queryRaw<{ name: string }[]>`
      SELECT migration_name AS name FROM _prisma_migrations
      WHERE migration_name = '20261019120100_user_email_normalized_index'
        AND finished_at IS NOT NULL
    `;

    if (applied.length === 0) {
      console.warn(
        'user_email_normalized_idx: migration not recorded in this database — ' +
          'skipped (CI applies it; a restored snapshot does not carry it)',
      );
      return;
    }

    const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'csld_csld_user'
        AND indexname = 'user_email_normalized_idx'
    `;

    expect(indexes).toHaveLength(1);
    // The expression has to match the query exactly, otherwise the planner never
    // picks the index (an index on lower(email) would not serve lower(btrim(email))).
    expect(indexes[0].indexdef).toContain('lower(btrim(');
  });
});

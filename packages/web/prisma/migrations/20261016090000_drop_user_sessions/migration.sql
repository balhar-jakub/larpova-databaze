-- Drop the legacy session table left over from the pre-rewrite application.
-- Nothing in the rewritten app reads or writes user_sessions (sessions live in
-- the signed cookie store; the table holds a single stale row on production),
-- and the post-deploy drift check fails while the table exists. The earlier
-- schema sync already dropped it on the test schema for the same reason.
DROP TABLE IF EXISTS "user_sessions";

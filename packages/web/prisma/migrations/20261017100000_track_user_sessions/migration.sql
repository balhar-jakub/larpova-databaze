-- The session table is owned by migrations now, so the database matches
-- prisma/schema.prisma and the post-deploy drift gate stops reading it as drift
-- to drop ("schema is still out of sync after the push: DROP TABLE user_sessions").
--
-- The DDL mirrors the statement connect-pg-simple ran at runtime (varchar sid
-- under the session_pkey constraint, json session, timestamp(6) expiry, index
-- IDX_session_expire) — the schema model declares exactly those names — so a
-- production table created by the store is already identical and both statements
-- below are no-ops there. On an empty database (CI, a fresh clone) they build it.
CREATE TABLE IF NOT EXISTS "user_sessions" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");

-- Normalize csld_csld_user.email to lower(btrim(email)).
--
-- The column is a case-SENSITIVE unique index inherited from the legacy app, and
-- 351 production rows carried the address with capitals ('Cilkaj@seznam.cz',
-- 'jakubě@balhar.net', … 119 of them synthetic @larpovadatabaze.cz placeholders
-- from the old site). Every lookup compares a normalized input against this
-- column, so those accounts could not sign in with a password, the magic link
-- registered a second account for them and the sign-up availability check called
-- a taken address free. Reads are fixed in the application (auth/emailLookup.ts);
-- this migration fixes the data so the column stops being a trap.
--
-- The five case-insensitive duplicate pairs were merged ahead of this migration
-- (scripts/fix-case-duplicate-users.sql). The guard below is the ordering
-- contract: if a duplicate is still present, fail with a message an operator can
-- act on instead of an opaque unique violation from the UPDATE.

DO $$
DECLARE dups int;
BEGIN
  SELECT count(*) INTO dups FROM (
    SELECT lower(btrim(email)) FROM csld_csld_user
    WHERE email IS NOT NULL
    GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF dups > 0 THEN
    RAISE EXCEPTION 'normalize_user_email: % case-insensitive duplicate(s) still present — merge them first (scripts/fix-case-duplicate-users.sql)', dups;
  END IF;
END $$;

UPDATE csld_csld_user
SET email = lower(btrim(email))
WHERE email IS NOT NULL AND email <> lower(btrim(email));

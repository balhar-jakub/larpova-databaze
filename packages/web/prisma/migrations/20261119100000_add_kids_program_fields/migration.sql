-- Kids-program fields: an event-level flag for a children's program and a
-- per-comment flag so a review can be scoped to the kids part of a game.
-- Both nullable / default false so existing rows read as "no program" / "not
-- a kids review" without any backfill.
ALTER TABLE "event" ADD COLUMN "kids_program" BOOLEAN DEFAULT false;
ALTER TABLE "csld_comment" ADD COLUMN "kids_review" BOOLEAN DEFAULT false;
